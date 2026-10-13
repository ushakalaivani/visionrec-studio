/**
 * Computer Vision Real-Time Processing Engine
 * Handles pixel manipulation, CV HUD overlays, Face Tracking simulation, 
 * Motion Detection, and Audio Waveform visualization.
 */

class ComputerVisionProcessor {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    
    this.filterMode = 'normal';
    this.isRunning = false;
    this.lastFrameTime = performance.now();
    this.fps = 30;
    this.frameCount = 0;
    
    // Motion detection state
    this.prevFrameData = null;
    this.motionScore = 0;
    
    // Face tracking state (smooth interpolated bounding box)
    this.faceBox = { x: 0.35, y: 0.25, w: 0.30, h: 0.45, targetX: 0.35, targetY: 0.25 };
    
    // Audio analyzer reference for HUD visualizer
    this.audioAnalyzer = null;
    this.audioDataArray = null;

    // Recording status for HUD
    this.isRecording = false;
    this.recordingDurationSec = 0;
    this.maxDurationSec = 180;
  }

  setFilterMode(mode) {
    this.filterMode = mode;
  }

  setAudioAnalyzer(analyzer) {
    this.audioAnalyzer = analyzer;
    if (analyzer) {
      this.audioDataArray = new Uint8Array(analyzer.frequencyBinCount);
    } else {
      this.audioDataArray = null;
    }
  }

  start() {
    this.isRunning = true;
    this.renderLoop();
  }

  stop() {
    this.isRunning = false;
  }

  renderLoop() {
    if (!this.isRunning) return;

    const now = performance.now();
    const delta = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    if (delta > 0) {
      this.fps = Math.round(1 / delta);
    }

    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      this.processFrame();
    }

    requestAnimationFrame(() => this.renderLoop());
  }

  processFrame() {
    const width = this.canvas.width = this.video.videoWidth || 640;
    const height = this.canvas.height = this.video.videoHeight || 360;

    // Draw base video frame
    this.ctx.drawImage(this.video, 0, 0, width, height);

    // Apply Computer Vision Filter / Pixel processing
    this.applyCVFilter(width, height);

    // Compute motion detection
    this.computeMotionEnergy(width, height);

    // Render Computer Vision HUD
    this.renderHUD(width, height);
  }

  applyCVFilter(w, h) {
    if (this.filterMode === 'normal') {
      return; // Clean pass-through
    }

    const imgData = this.ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const len = data.length;

    if (this.filterMode === 'edge') {
      // Sobel edge approximation on luminance
      const copy = new Uint8Array(data);
      for (let y = 1; y < h - 1; y += 2) {
        for (let x = 1; x < w - 1; x += 2) {
          const idx = (y * w + x) * 4;
          const left = copy[idx - 4];
          const right = copy[idx + 4];
          const top = copy[idx - w * 4];
          const bottom = copy[idx + w * 4];

          const diffX = Math.abs(right - left);
          const diffY = Math.abs(bottom - top);
          const edgeVal = Math.min(255, (diffX + diffY) * 2);

          data[idx] = 0;           // R
          data[idx + 1] = edgeVal; // G (Neon Green edges)
          data[idx + 2] = edgeVal; // B (Cyan edges)
        }
      }
      this.ctx.putImageData(imgData, 0, 0);
    } else if (this.filterMode === 'night') {
      // Night vision low-light amplifier
      for (let i = 0; i < len; i += 4) {
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        data[i] = Math.min(255, lum * 0.4);       // Red
        data[i + 1] = Math.min(255, lum * 1.6);   // Green amplified
        data[i + 2] = Math.min(255, lum * 0.5);   // Blue
      }
      this.ctx.putImageData(imgData, 0, 0);
    } else if (this.filterMode === 'cyberpunk') {
      // Cyberpunk duo-tone LUT
      for (let i = 0; i < len; i += 4) {
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        data[i] = Math.min(255, lum * 255 + 50);   // Magenta/Pink
        data[i + 1] = Math.min(255, lum * 180);
        data[i + 2] = Math.min(255, 255 - lum * 50); // Cyan shadows
      }
      this.ctx.putImageData(imgData, 0, 0);
    } else if (this.filterMode === 'mono') {
      // High contrast B&W
      for (let i = 0; i < len; i += 4) {
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        data[i] = lum;
        data[i + 1] = lum;
        data[i + 2] = lum;
      }
      this.ctx.putImageData(imgData, 0, 0);
    } else if (this.filterMode === 'bokeh') {
      // Background vignette / focus simulation
      const radGrad = this.ctx.createRadialGradient(w/2, h/2, w*0.2, w/2, h/2, w*0.6);
      radGrad.addColorStop(0, 'rgba(0,0,0,0)');
      radGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
      this.ctx.fillStyle = radGrad;
      this.ctx.fillRect(0, 0, w, h);
    }
  }

  computeMotionEnergy(w, h) {
    this.frameCount++;
    if (this.frameCount % 5 !== 0) return; // Sample every 5 frames

    const smallW = 64;
    const smallH = 36;
    
    // Offscreen calculation for motion
    if (!this.offCanvas) {
      this.offCanvas = document.createElement('canvas');
      this.offCanvas.width = smallW;
      this.offCanvas.height = smallH;
      this.offCtx = this.offCanvas.getContext('2d', { willReadFrequently: true });
    }

    this.offCtx.drawImage(this.video, 0, 0, smallW, smallH);
    const currData = this.offCtx.getImageData(0, 0, smallW, smallH).data;

    if (this.prevFrameData) {
      let diffSum = 0;
      for (let i = 0; i < currData.length; i += 4) {
        const d = Math.abs(currData[i] - this.prevFrameData[i]);
        if (d > 25) diffSum += d;
      }
      this.motionScore = Math.min(100, Math.round((diffSum / (smallW * smallH * 255)) * 1000));
    }
    this.prevFrameData = new Uint8Array(currData);
  }

  renderHUD(w, h) {
    const ctx = this.ctx;

    // Draw Face Tracking / Center Alignment Reticle
    const boxX = w * this.faceBox.x;
    const boxY = h * this.faceBox.y;
    const boxW = w * this.faceBox.w;
    const boxH = h * this.faceBox.h;

    ctx.save();
    ctx.strokeStyle = this.isRecording ? 'rgba(244, 63, 94, 0.75)' : 'rgba(6, 182, 212, 0.75)';
    ctx.lineWidth = 2;
    const cLen = 20;

    // Bounding corners (CV style)
    // Top Left
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + cLen);
    ctx.lineTo(boxX, boxY);
    ctx.lineTo(boxX + cLen, boxY);
    ctx.stroke();

    // Top Right
    ctx.beginPath();
    ctx.moveTo(boxX + boxW - cLen, boxY);
    ctx.lineTo(boxX + boxW, boxY);
    ctx.lineTo(boxX + boxW, boxY + cLen);
    ctx.stroke();

    // Bottom Left
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + boxH - cLen);
    ctx.lineTo(boxX, boxY + boxH);
    ctx.lineTo(boxX + cLen, boxY + boxH);
    ctx.stroke();

    // Bottom Right
    ctx.beginPath();
    ctx.moveTo(boxX + boxW - cLen, boxY + boxH);
    ctx.lineTo(boxX + boxW, boxY + boxH);
    ctx.lineTo(boxX + boxW, boxY + boxH - cLen);
    ctx.stroke();

    // Face tag
    ctx.fillStyle = this.isRecording ? 'rgba(244, 63, 94, 0.9)' : 'rgba(6, 182, 212, 0.9)';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText("CV: FACE TRACKING [98.4%]", boxX + 4, boxY - 6);

    // Real-time Audio Waveform on Canvas Bottom
    if (this.audioAnalyzer && this.audioDataArray) {
      this.audioAnalyzer.getByteTimeDomainData(this.audioDataArray);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
      ctx.beginPath();

      const sliceWidth = w * 1.0 / this.audioDataArray.length;
      let x = 0;

      for (let i = 0; i < this.audioDataArray.length; i++) {
        const v = this.audioDataArray[i] / 128.0;
        const y = (v * (h * 0.15)) + (h - 40);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();
    }

    // Timestamp & Watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '11px JetBrains Mono, monospace';
    const timeStr = new Date().toLocaleTimeString();
    ctx.fillText(`VISION-CV • ${timeStr} • ${this.fps} FPS`, 15, h - 15);

    ctx.restore();
  }

  captureThumbnailBlob() {
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.85);
    });
  }
}
