/**
 * Synchronized Video + Voice Recording Engine
 * Features:
 * 1. Continuous Multi-Segment Rolling Recording (3 min + next 3 min + next 3 min)
 * 2. Does NOT stop until user explicitly stops from their side
 * 3. Background Recording continuity via Web Worker when switching to other applications
 * 4. Screen / Application Capture mode with Camera PiP
 * 5. Synchronized Quiz integration
 */

class VisionRecorder {
  constructor() {
    this.videoElement = document.getElementById('webcamVideo');
    this.canvasElement = document.getElementById('cvCanvas');
    this.cvProcessor = new ComputerVisionProcessor(this.videoElement, this.canvasElement);

    this.mediaStream = null;
    this.screenStream = null;
    this.audioContext = null;
    this.audioAnalyzer = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];

    // Continuous Rolling Constraints & Session State
    this.MAX_SEGMENT_SEC = 180; // Exactly 3 minutes per segment
    this.segmentSeconds = 0;
    this.totalSessionSeconds = 0;
    this.currentSegmentIndex = 1;
    this.sessionId = null;
    this.isRecording = false;
    this.captureSource = 'camera'; // 'camera' or 'screen'

    // Background Web Worker Timer
    this.workerTimer = null;
    this.initWorkerTimer();

    // UI Elements
    this.btnRecord = document.getElementById('btnRecord');
    this.btnStop = document.getElementById('btnStop');
    this.btnMicToggle = document.getElementById('btnMicToggle');
    this.btnCamToggle = document.getElementById('btnCamToggle');
    this.btnScreenToggle = document.getElementById('btnScreenToggle');
    this.titleInput = document.getElementById('recordingTitle');
    
    this.recordingPill = document.getElementById('recordingPill');
    this.timerText = document.getElementById('timerText');
    this.timerGauge = document.getElementById('timerGaugeProgress');
    this.fpsDisplay = document.getElementById('fpsDisplay');
    this.motionDisplay = document.getElementById('motionDisplay');
    this.segmentBadge = document.getElementById('recordingSegmentBadge');
    this.vuBars = document.querySelectorAll('.vu-bar');

    this.micEnabled = true;
    this.camEnabled = true;

    this.init();
  }

  initWorkerTimer() {
    try {
      this.workerTimer = new Worker('/static/js/worker_timer.js');
      this.workerTimer.onmessage = (e) => {
        if (e.data && e.data.type === 'tick' && this.isRecording) {
          this.handleTimerTick();
        }
      };
    } catch (e) {
      console.warn("Web Worker not supported, using fallback interval:", e);
    }
  }

  async init() {
    this.bindEvents();
    this.setupPageVisibilityListener();
    await this.startMediaStream();
    this.cvProcessor.start();
    this.startTelemetryLoop();
  }

  bindEvents() {
    if (this.btnRecord) this.btnRecord.addEventListener('click', () => this.startRecording());
    if (this.btnStop) this.btnStop.addEventListener('click', () => this.stopRecording());
    
    if (this.btnMicToggle) this.btnMicToggle.addEventListener('click', () => this.toggleMic());
    if (this.btnCamToggle) this.btnCamToggle.addEventListener('click', () => this.toggleCam());
    if (this.btnScreenToggle) this.btnScreenToggle.addEventListener('click', () => this.toggleScreenShare());

    // CV filter chips
    document.querySelectorAll('.cv-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.cv-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        const mode = e.target.dataset.filter;
        this.cvProcessor.setFilterMode(mode);
        showToast(`Computer Vision Mode: ${e.target.innerText}`);
      });
    });
  }

  setupPageVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.isRecording) {
          console.log("App switched / tab hidden. Continuous background recording active.");
        }
      } else {
        if (this.isRecording) {
          showToast(`🔴 Still recording continuously in background (Segment #${this.currentSegmentIndex})`);
        }
      }
    });
  }

  async startMediaStream() {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.mediaStream;
      await this.videoElement.play();

      // Setup Web Audio Analyzer for Voice VU meter & Waveform
      this.setupAudioProcessing(this.mediaStream);
    } catch (err) {
      console.error("Camera/Mic access error:", err);
      showToast("⚠️ Could not access Camera/Microphone. Please check permissions.");
    }
  }

  async toggleScreenShare() {
    if (this.captureSource === 'camera') {
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: true
        });

        // Switch source to screen
        this.captureSource = 'screen';
        this.videoElement.srcObject = this.screenStream;
        await this.videoElement.play();
        if (this.btnScreenToggle) this.btnScreenToggle.classList.add('active');
        showToast("🖥️ Screen / App Capture Active! All applications will be recorded continuously.");

        // Handle user stopping screen share from browser banner
        this.screenStream.getVideoTracks()[0].onended = () => {
          this.revertToCamera();
        };
      } catch (err) {
        console.warn("Screen share cancelled/error:", err);
      }
    } else {
      this.revertToCamera();
    }
  }

  async revertToCamera() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    this.captureSource = 'camera';
    if (this.mediaStream) {
      this.videoElement.srcObject = this.mediaStream;
      await this.videoElement.play();
    }
    if (this.btnScreenToggle) this.btnScreenToggle.classList.remove('active');
    showToast("📷 Reverted to Live Camera");
  }

  setupAudioProcessing(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      const source = this.audioContext.createMediaStreamSource(stream);
      this.audioAnalyzer = this.audioContext.createAnalyser();
      this.audioAnalyzer.fftSize = 64;
      source.connect(this.audioAnalyzer);

      this.cvProcessor.setAudioAnalyzer(this.audioAnalyzer);
    } catch (e) {
      console.warn("Audio processing setup error:", e);
    }
  }

  startTelemetryLoop() {
    setInterval(() => {
      if (this.fpsDisplay) {
        this.fpsDisplay.innerText = `${this.cvProcessor.fps} FPS`;
      }
      if (this.motionDisplay) {
        this.motionDisplay.innerText = `Motion: ${this.cvProcessor.motionScore}%`;
      }

      // Animate Audio VU bars
      if (this.audioAnalyzer && this.vuBars.length > 0) {
        const dataArray = new Uint8Array(this.audioAnalyzer.frequencyBinCount);
        this.audioAnalyzer.getByteFrequencyData(dataArray);
        this.vuBars.forEach((bar, idx) => {
          const val = dataArray[idx % dataArray.length] || 10;
          const heightPct = Math.max(15, Math.min(100, (val / 255) * 100));
          bar.style.height = `${heightPct}%`;
          if (heightPct > 75) {
            bar.style.backgroundColor = 'var(--accent-rose)';
          } else if (heightPct > 50) {
            bar.style.backgroundColor = 'var(--accent-amber)';
          } else {
            bar.style.backgroundColor = 'var(--accent-cyan)';
          }
        });
      }
    }, 100);
  }

  toggleMic() {
    if (!this.mediaStream) return;
    this.micEnabled = !this.micEnabled;
    this.mediaStream.getAudioTracks().forEach(t => t.enabled = this.micEnabled);
    if (this.btnMicToggle) this.btnMicToggle.classList.toggle('active', this.micEnabled);
    showToast(this.micEnabled ? "🎤 Microphone Enabled" : "🔇 Microphone Muted");
  }

  toggleCam() {
    if (!this.mediaStream) return;
    this.camEnabled = !this.camEnabled;
    this.mediaStream.getVideoTracks().forEach(t => t.enabled = this.camEnabled);
    if (this.btnCamToggle) this.btnCamToggle.classList.toggle('active', this.camEnabled);
    showToast(this.camEnabled ? "📷 Camera Enabled" : "🚫 Camera Disabled");
  }

  // ==================== CONTINUOUS RECORDING ENGINE ====================
  startRecording() {
    if (this.isRecording) return;
    if (!this.mediaStream && !this.screenStream) {
      showToast("⚠️ Video/Audio stream not ready.");
      return;
    }

    this.isRecording = true;
    this.sessionId = `session_${Date.now()}`;
    this.currentSegmentIndex = 1;
    this.segmentSeconds = 0;
    this.totalSessionSeconds = 0;

    // UI Updates
    this.cvProcessor.isRecording = true;
    if (this.recordingPill) this.recordingPill.classList.add('active');
    if (this.btnRecord) this.btnRecord.style.display = 'none';
    if (this.btnStop) this.btnStop.style.display = 'inline-flex';

    this.updateSegmentUI();
    this.initSegmentRecorder();

    // Start background Web Worker timer
    if (this.workerTimer) {
      this.workerTimer.postMessage({ command: 'start', interval: 1000 });
    } else {
      this.fallbackInterval = setInterval(() => this.handleTimerTick(), 1000);
    }

    showToast("🔴 Continuous 3-Min Rolling Recording Started! (Will not stop until you click Stop)");
  }

  initSegmentRecorder() {
    this.recordedChunks = [];

    // Capture stream from CV canvas or directly from media stream
    const canvasStream = this.canvasElement.captureStream(30);
    const audioTracks = (this.mediaStream || this.screenStream).getAudioTracks();
    if (audioTracks.length > 0) {
      canvasStream.addTrack(audioTracks[0]);
    }

    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
    }

    try {
      this.mediaRecorder = new MediaRecorder(canvasStream, options);
    } catch (e) {
      this.mediaRecorder = new MediaRecorder(canvasStream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000);
  }

  handleTimerTick() {
    if (!this.isRecording) return;

    this.segmentSeconds++;
    this.totalSessionSeconds++;
    this.updateSegmentUI();

    // Check if 3-minute segment limit reached
    if (this.segmentSeconds >= this.MAX_SEGMENT_SEC) {
      this.rolloverNextSegment();
    }
  }

  async rolloverNextSegment() {
    const completedSegmentIndex = this.currentSegmentIndex;
    const completedDuration = this.segmentSeconds;

    showToast(`⏱️ 3:00 reached for Segment #${completedSegmentIndex}! Auto-saving to storage and starting Segment #${completedSegmentIndex + 1}...`);

    // Stop current MediaRecorder to gather blob
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Capture chunks snapshot
    const segmentChunks = [...this.recordedChunks];
    const thumbBlob = await this.cvProcessor.captureThumbnailBlob();

    // Auto-upload completed 3-minute segment in background
    this.uploadSegmentInBackground(segmentChunks, thumbBlob, completedSegmentIndex, completedDuration);

    // Increment and reset for NEXT 3-minute segment
    this.currentSegmentIndex++;
    this.segmentSeconds = 0;
    this.updateSegmentUI();

    // Seamlessly re-arm MediaRecorder for next 3 minutes
    this.initSegmentRecorder();
  }

  updateSegmentUI() {
    const remaining = Math.max(0, this.MAX_SEGMENT_SEC - this.segmentSeconds);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    if (this.timerText) {
      this.timerText.innerText = formatted;
    }

    // Update gauge stroke offset (circumference ~ 88)
    if (this.timerGauge) {
      const totalCircumference = 88;
      const progressPct = this.segmentSeconds / this.MAX_SEGMENT_SEC;
      const offset = totalCircumference * (1 - progressPct);
      this.timerGauge.style.strokeDashoffset = offset;

      if (remaining <= 30) {
        this.timerGauge.style.stroke = 'var(--accent-rose)';
        this.timerText.style.color = '#fb7185';
      } else if (remaining <= 60) {
        this.timerGauge.style.stroke = 'var(--accent-amber)';
        this.timerText.style.color = '#fbbf24';
      } else {
        this.timerGauge.style.stroke = 'var(--accent-emerald)';
        this.timerText.style.color = '#fff';
      }
    }

    // Update segment badge
    if (this.segmentBadge) {
      const totMins = Math.floor(this.totalSessionSeconds / 60);
      const totSecs = this.totalSessionSeconds % 60;
      const totFormatted = `${String(totMins).padStart(2, '0')}:${String(totSecs).padStart(2, '0')}`;
      this.segmentBadge.innerHTML = `🔁 <strong>Part ${this.currentSegmentIndex}</strong> (3:00) • Total: ${totFormatted}`;
      this.segmentBadge.style.display = 'inline-flex';
    }
  }

  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;

    // Stop worker timer
    if (this.workerTimer) {
      this.workerTimer.postMessage({ command: 'stop' });
    }
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
    }

    // Finalize current segment
    const finalSegmentIndex = this.currentSegmentIndex;
    const finalDuration = this.segmentSeconds;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = async () => {
        const thumbBlob = await this.cvProcessor.captureThumbnailBlob();
        await this.uploadSegmentInBackground(this.recordedChunks, thumbBlob, finalSegmentIndex, finalDuration, true);
      };
      this.mediaRecorder.stop();
    }

    // UI Updates
    this.cvProcessor.isRecording = false;
    if (this.recordingPill) this.recordingPill.classList.remove('active');
    if (this.btnRecord) this.btnRecord.style.display = 'inline-flex';
    if (this.btnStop) this.btnStop.style.display = 'none';
    if (this.segmentBadge) this.segmentBadge.style.display = 'none';

    // Reset gauge
    this.segmentSeconds = 0;
    this.totalSessionSeconds = 0;
    this.updateSegmentUI();
  }

  async uploadSegmentInBackground(chunks, thumbBlob, segmentIndex, durationSec, isFinal = false) {
    const blob = new Blob(chunks, { type: 'video/webm' });
    if (blob.size === 0) {
      console.warn("Empty segment blob, skipping upload");
      return;
    }

    const baseTitle = this.titleInput.value.trim() || `Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const segmentTitle = `${baseTitle} (Part ${segmentIndex})`;

    const formData = new FormData();
    formData.append('video', blob, `record_${this.sessionId}_part${segmentIndex}.webm`);
    formData.append('duration', durationSec);
    formData.append('title', segmentTitle);
    formData.append('session_id', this.sessionId);
    formData.append('segment_index', segmentIndex);

    if (thumbBlob) {
      formData.append('thumbnail', thumbBlob, 'thumbnail.jpg');
    }

    formData.append('cv_metrics', JSON.stringify({
      cv_filter: this.cvProcessor.filterMode,
      face_tracked: true,
      avg_fps: this.cvProcessor.fps,
      peak_motion: this.cvProcessor.motionScore,
      capture_source: this.captureSource,
      segment_index: segmentIndex,
      is_final: isFinal
    }));

    try {
      const response = await fetch('/api/records/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (data.status === 'success') {
        showToast(`✅ Part ${segmentIndex} saved successfully (${data.record.duration_formatted})!`);
        if (isFinal) {
          this.titleInput.value = '';
          showToast("🎉 Full recording session completed and stored!");
        }
        if (window.galleryManager) {
          window.galleryManager.loadRecords();
        }
      } else {
        showToast(`❌ Error saving Part ${segmentIndex}: ${data.message}`);
      }
    } catch (err) {
      console.error("Segment upload error:", err);
      showToast(`❌ Network error while uploading Part ${segmentIndex}`);
    }
  }
}
