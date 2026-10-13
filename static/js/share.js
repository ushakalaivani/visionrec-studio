/**
 * Multi-Channel Sharing & AI Bot Integration
 * Handles sharing to Email, WhatsApp, AI Bots, Native Web Share, and Direct Link copy.
 */

class ShareManager {
  constructor() {
    this.shareModal = document.getElementById('shareModal');
    this.aiModal = document.getElementById('aiModal');
    
    this.currentRecordId = null;
    this.currentTitle = '';
    this.currentFilename = '';

    this.bindEvents();
  }

  bindEvents() {
    // Share modal close
    document.getElementById('btnCloseShare').addEventListener('click', () => {
      this.shareModal.classList.remove('open');
    });

    // AI modal close
    document.getElementById('btnCloseAI').addEventListener('click', () => {
      this.aiModal.classList.remove('open');
    });

    // Copy link button
    document.getElementById('btnCopyLink').addEventListener('click', () => {
      this.copyToClipboard(document.getElementById('shareDirectUrl').value, "📋 Direct video link copied to clipboard!");
    });

    // Copy AI prompt button
    document.getElementById('btnCopyAIPrompt').addEventListener('click', () => {
      this.copyToClipboard(document.getElementById('aiPromptBox').value, "🤖 AI Bot prompt copied to clipboard!");
    });

    // Native Web Share button
    document.getElementById('btnWebShare').addEventListener('click', () => {
      this.triggerNativeShare();
    });
  }

  openShareModal(recordId, title, filename) {
    this.currentRecordId = recordId;
    this.currentTitle = title;
    this.currentFilename = filename;

    const streamUrl = `${window.location.origin}/stream/${filename}`;
    document.getElementById('shareDirectUrl').value = streamUrl;
    document.getElementById('shareModalTitle').innerText = `Share "${title}"`;

    // Configure Email Link
    const mailSubject = encodeURIComponent(`Video & Voice Recording: ${title}`);
    const mailBody = encodeURIComponent(
      `Hello,\n\nI have recorded a video with synchronized voice recording:\n\nTitle: ${title}\nWatch / Stream Link: ${streamUrl}\nRecorded with VisionRec Studio (Computer Vision Engineering).\n\nBest regards.`
    );
    document.getElementById('shareEmailLink').href = `mailto:?subject=${mailSubject}&body=${mailBody}`;

    // Configure WhatsApp Link
    const waText = encodeURIComponent(`📹 *Video & Voice Recording*: ${title}\n🔗 Watch here: ${streamUrl}\n⏱️ Max 3-min CV Recording`);
    document.getElementById('shareWhatsAppLink').href = `https://api.whatsapp.com/send?text=${waText}`;

    this.shareModal.classList.add('open');
  }

  async openAIModal(recordId) {
    this.currentRecordId = recordId;
    this.aiModal.classList.add('open');
    
    const aiContent = document.getElementById('aiReportContent');
    aiContent.innerHTML = `<p style="color:var(--text-muted); text-align:center;">Analyzing Computer Vision & Audio features for AI Bot...</p>`;

    try {
      const response = await fetch(`/api/records/${recordId}/ai-bot-report`);
      const data = await response.json();

      if (data.status === 'success') {
        const report = data.ai_report;
        aiContent.innerHTML = `
          <div style="background:rgba(15,23,42,0.6); padding:1rem; border-radius:8px; border:1px solid rgba(139,92,246,0.2); font-size:0.85rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
              <strong>🎯 Title:</strong> <span>${report.title}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
              <strong>⏱️ Duration:</strong> <span>${report.duration} (Limit Compliant)</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
              <strong>👁️ Face Detection:</strong> <span>${report.computer_vision_analysis.face_detection}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
              <strong>🎙️ Synchronized Voice:</strong> <span>${report.computer_vision_analysis.audio_speech_activity}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <strong>⚡ Motion Analysis:</strong> <span>${report.computer_vision_analysis.motion_activity_level}</span>
            </div>
          </div>
        `;

        document.getElementById('aiPromptBox').value = 
          `[AI Bot Video Inspection]\nVideo URL: ${window.location.origin}/stream/${report.record_id}.webm\nDuration: ${report.duration}\nCV Summary: Face tracking active, synchronized audio stream verified.\n\nPrompt: ${report.ai_prompt_suggestion}`;
      }
    } catch (e) {
      console.error("AI Report error:", e);
      aiContent.innerHTML = `<p style="color:var(--accent-rose);">Error generating AI report.</p>`;
    }
  }

  async triggerNativeShare() {
    const streamUrl = `${window.location.origin}/stream/${this.currentFilename}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: this.currentTitle,
          text: `Check out this 3-minute video recording with voice: ${this.currentTitle}`,
          url: streamUrl
        });
        showToast("✅ Shared successfully via device!");
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn("Share failed:", err);
        }
      }
    } else {
      this.copyToClipboard(streamUrl, "📋 Native share not supported; link copied to clipboard!");
    }
  }

  copyToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg);
      }).catch(() => {
        this.fallbackCopy(text, successMsg);
      });
    } else {
      this.fallbackCopy(text, successMsg);
    }
  }

  fallbackCopy(text, successMsg) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg);
    } catch (err) {
      showToast("❌ Unable to copy link.");
    }
    document.body.removeChild(textarea);
  }
}
