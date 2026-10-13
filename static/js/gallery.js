/**
 * Gallery Manager
 * Handles loading, displaying, previewing, and deleting video + voice recordings.
 */

class GalleryManager {
  constructor() {
    this.recordsContainer = document.getElementById('recordsGrid');
    this.emptyState = document.getElementById('emptyState');
    this.totalRecordsCount = document.getElementById('totalRecordsCount');
    this.playerModal = document.getElementById('playerModal');
    this.modalVideoPlayer = document.getElementById('modalVideoPlayer');
    this.deleteModal = document.getElementById('deleteModal');
    this.recordToDelete = null;

    this.init();
  }

  init() {
    this.loadRecords();
    this.bindModalEvents();
  }

  bindModalEvents() {
    // Player modal close
    document.getElementById('btnClosePlayer').addEventListener('click', () => {
      this.closePlayer();
    });

    // Delete confirmation modal
    document.getElementById('btnConfirmDelete').addEventListener('click', () => {
      if (this.recordToDelete) {
        this.performDelete(this.recordToDelete);
      }
    });

    document.getElementById('btnCancelDelete').addEventListener('click', () => {
      this.deleteModal.classList.remove('open');
      this.recordToDelete = null;
    });
  }

  async loadRecords() {
    try {
      const response = await fetch('/api/records');
      const data = await response.json();
      
      if (data.status === 'success') {
        this.renderRecords(data.records);
      }
    } catch (e) {
      console.error("Failed to load records:", e);
    }
  }

  renderRecords(records) {
    const containers = [
      document.getElementById('recordsGrid'),
      document.getElementById('galleryFullGrid')
    ].filter(Boolean);

    if (!records || records.length === 0) {
      containers.forEach(c => {
        c.innerHTML = '';
        c.style.display = 'none';
      });
      if (this.emptyState) this.emptyState.style.display = 'block';
      if (this.totalRecordsCount) this.totalRecordsCount.innerText = '0 records';
      return;
    }

    if (this.emptyState) this.emptyState.style.display = 'none';
    if (this.totalRecordsCount) this.totalRecordsCount.innerText = `${records.length} record${records.length > 1 ? 's' : ''}`;

    containers.forEach(container => {
      container.innerHTML = '';
      container.style.display = 'flex';

      records.forEach(rec => {
        const card = document.createElement('div');
        card.className = 'record-card';
        const segmentText = rec.segment_index > 1 ? `Part ${rec.segment_index}` : (rec.session_id ? 'Part 1' : '');

        card.innerHTML = `
          <div class="record-thumb-wrapper" onclick="window.galleryManager.openPlayer('${rec.filename}', '${this.escapeHtml(rec.title)}')">
            <img class="record-thumb" src="/thumbnail/${rec.thumbnail}" alt="Preview" onerror="this.src='/thumbnail/default.jpg'">
            <div class="thumb-play-overlay">
              <div class="thumb-play-icon">▶</div>
            </div>
            <span class="thumb-duration-badge">${rec.duration_formatted}</span>
            ${segmentText ? `<span class="thumb-duration-badge" style="top:8px; bottom:auto; right:auto; left:8px; background:rgba(16,185,129,0.9); font-size:0.7rem;">${segmentText}</span>` : ''}
          </div>

          <div class="record-info">
            <div>
              <h4 class="record-title" title="${this.escapeHtml(rec.title)}">${this.escapeHtml(rec.title)}</h4>
              <div class="record-meta">
                <span>📅 ${rec.created_display}</span>
                <span>💾 ${rec.size_mb} MB</span>
              </div>
            </div>

            <div class="record-actions">
              <button class="btn-card" onclick="window.galleryManager.openPlayer('${rec.filename}', '${this.escapeHtml(rec.title)}')">
                ▶ Play
              </button>
              <button class="btn-card btn-card-share" onclick="window.shareManager.openShareModal('${rec.id}', '${this.escapeHtml(rec.title)}', '${rec.filename}')">
                🔗 Share
              </button>
              <button class="btn-card btn-card-ai" onclick="window.shareManager.openAIModal('${rec.id}')">
                🤖 AI Bot
              </button>
              <a class="btn-card" href="/download/${rec.filename}" download title="Download file">
                ⬇️ Save
              </a>
              <button class="btn-card btn-card-delete" onclick="window.galleryManager.confirmDelete('${rec.id}', '${this.escapeHtml(rec.title)}')">
                🗑️ Delete
              </button>
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    });
  }

  openPlayer(filename, title) {
    document.getElementById('playerModalTitle').innerText = title || "Recording Playback";
    this.modalVideoPlayer.src = `/stream/${filename}`;
    this.modalVideoPlayer.load();
    this.modalVideoPlayer.play();
    this.playerModal.classList.add('open');
  }

  closePlayer() {
    this.modalVideoPlayer.pause();
    this.modalVideoPlayer.src = '';
    this.playerModal.classList.remove('open');
  }

  confirmDelete(recordId, title) {
    this.recordToDelete = recordId;
    document.getElementById('deleteRecordTitle').innerText = title;
    this.deleteModal.classList.add('open');
  }

  async performDelete(recordId) {
    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.status === 'success') {
        showToast("🗑️ Recording deleted successfully.");
        this.loadRecords();
      } else {
        showToast(`❌ Delete failed: ${data.message}`);
      }
    } catch (e) {
      console.error("Delete error:", e);
      showToast("❌ Network error while deleting recording.");
    } finally {
      this.deleteModal.classList.remove('open');
      this.recordToDelete = null;
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
