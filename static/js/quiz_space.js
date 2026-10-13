/**
 * Quiz Space & Interactive Q&A Engine
 * Handles 1-10 Questions management, Shuffled Interactive Quiz Arena,
 * User Answer saving, Voice answers, and simultaneous 3-minute video recording.
 */

class QuizSpaceManager {
  constructor() {
    this.questions = [];
    this.currentQuiz = [];
    this.currentIndex = 0;
    this.userAnswers = [];
    this.quizStartTime = null;
    this.quizTimerInterval = null;
    this.quizTimeSeconds = 0;
    this.questionTimeLimit = 30; // 30s per question
    this.questionTimerSeconds = 30;
    this.isQuizActive = false;
    this.selectedOption = null;
    this.savedSubmissions = [];

    // Speech recognition for voice answering
    this.speechRecognition = null;
    this.isSpeechActive = false;

    // References to UI containers
    this.quizTabBtn = document.getElementById('navTabQuiz');
    this.studioTabBtn = document.getElementById('navTabStudio');
    this.galleryTabBtn = document.getElementById('navTabGallery');

    this.quizSpaceSection = document.getElementById('quizSpaceSection');
    this.studioSection = document.getElementById('studioSection');
    this.gallerySection = document.getElementById('gallerySection');

    // Sub-views inside Quiz Space
    this.viewQuizStart = document.getElementById('quizStartView');
    this.viewQuizPlay = document.getElementById('quizPlayView');
    this.viewQuizResults = document.getElementById('quizResultsView');
    this.viewQuestionEditor = document.getElementById('questionEditorView');
    this.viewAnswerHistory = document.getElementById('answerHistoryView');

    this.init();
  }

  async init() {
    this.bindTabEvents();
    this.bindQuizControls();
    this.setupSpeechRecognition();
    await this.loadQuestions();
    await this.loadAnswerHistory();
  }

  bindTabEvents() {
    if (this.quizTabBtn) {
      this.quizTabBtn.addEventListener('click', () => this.switchMainTab('quiz'));
    }
    if (this.studioTabBtn) {
      this.studioTabBtn.addEventListener('click', () => this.switchMainTab('studio'));
    }
    if (this.galleryTabBtn) {
      this.galleryTabBtn.addEventListener('click', () => this.switchMainTab('gallery'));
    }
  }

  switchMainTab(tab) {
    // Update tab buttons
    [this.quizTabBtn, this.studioTabBtn, this.galleryTabBtn].forEach(b => b && b.classList.remove('active'));
    
    // Hide sections
    if (this.studioSection) this.studioSection.style.display = 'none';
    if (this.quizSpaceSection) this.quizSpaceSection.style.display = 'none';
    if (this.gallerySection) this.gallerySection.style.display = 'none';

    if (tab === 'quiz') {
      if (this.quizTabBtn) this.quizTabBtn.classList.add('active');
      if (this.quizSpaceSection) this.quizSpaceSection.style.display = 'block';
    } else if (tab === 'gallery') {
      if (this.galleryTabBtn) this.galleryTabBtn.classList.add('active');
      if (this.gallerySection) this.gallerySection.style.display = 'block';
      if (window.galleryManager) window.galleryManager.loadRecords();
    } else {
      if (this.studioTabBtn) this.studioTabBtn.classList.add('active');
      if (this.studioSection) this.studioSection.style.display = 'grid';
    }
  }

  switchQuizSubView(viewName) {
    [
      this.viewQuizStart,
      this.viewQuizPlay,
      this.viewQuizResults,
      this.viewQuestionEditor,
      this.viewAnswerHistory
    ].forEach(v => {
      if (v) v.style.display = 'none';
    });

    if (viewName === 'start' && this.viewQuizStart) this.viewQuizStart.style.display = 'block';
    if (viewName === 'play' && this.viewQuizPlay) this.viewQuizPlay.style.display = 'block';
    if (viewName === 'results' && this.viewQuizResults) this.viewQuizResults.style.display = 'block';
    if (viewName === 'editor' && this.viewQuestionEditor) this.viewQuestionEditor.style.display = 'block';
    if (viewName === 'history' && this.viewAnswerHistory) this.viewAnswerHistory.style.display = 'block';
  }

  bindQuizControls() {
    // Start Quiz Buttons
    const btnStartQuiz = document.getElementById('btnStartShuffledQuiz');
    if (btnStartQuiz) {
      btnStartQuiz.addEventListener('click', () => this.startShuffledQuiz());
    }

    const btnOpenEditor = document.getElementById('btnOpenQuestionEditor');
    if (btnOpenEditor) {
      btnOpenEditor.addEventListener('click', () => {
        this.renderQuestionEditor();
        this.switchQuizSubView('editor');
      });
    }

    const btnOpenHistory = document.getElementById('btnOpenAnswerHistory');
    if (btnOpenHistory) {
      btnOpenHistory.addEventListener('click', () => {
        this.renderAnswerHistory();
        this.switchQuizSubView('history');
      });
    }

    // Question navigation & submission during play
    const btnNextQuestion = document.getElementById('btnNextQuestion');
    if (btnNextQuestion) {
      btnNextQuestion.addEventListener('click', () => this.submitAnswerAndNext());
    }

    const btnQuitQuiz = document.getElementById('btnQuitQuiz');
    if (btnQuitQuiz) {
      btnQuitQuiz.addEventListener('click', () => {
        if (confirm("Are you sure you want to exit this quiz session?")) {
          this.endQuizSession(false);
          this.switchQuizSubView('start');
        }
      });
    }

    // Results Actions
    const btnRetakeQuiz = document.getElementById('btnRetakeQuiz');
    if (btnRetakeQuiz) {
      btnRetakeQuiz.addEventListener('click', () => this.startShuffledQuiz());
    }

    const btnSaveAnswers = document.getElementById('btnSaveAnswersToServer');
    if (btnSaveAnswers) {
      btnSaveAnswers.addEventListener('click', () => this.saveUserAnswersToServer());
    }

    const btnExportResults = document.getElementById('btnExportResultsJson');
    if (btnExportResults) {
      btnExportResults.addEventListener('click', () => this.exportResultsAsJson());
    }

    // Editor Actions
    const btnSaveAllQuestions = document.getElementById('btnSaveAllQuestions');
    if (btnSaveAllQuestions) {
      btnSaveAllQuestions.addEventListener('click', () => this.saveEditorQuestionsToServer());
    }

    const btnResetDefaultQuestions = document.getElementById('btnResetDefaultQuestions');
    if (btnResetDefaultQuestions) {
      btnResetDefaultQuestions.addEventListener('click', () => this.resetDefaultQuestions());
    }

    const btnAddNewQuestion = document.getElementById('btnAddNewQuestion');
    if (btnAddNewQuestion) {
      btnAddNewQuestion.addEventListener('click', () => this.addQuestionToEditor());
    }

    const btnBackToQuizMenu = document.querySelectorAll('.btn-back-to-quiz-menu');
    btnBackToQuizMenu.forEach(b => {
      b.addEventListener('click', () => this.switchQuizSubView('start'));
    });

    // Voice Answer Toggle
    const btnVoiceAnswer = document.getElementById('btnVoiceAnswerToggle');
    if (btnVoiceAnswer) {
      btnVoiceAnswer.addEventListener('click', () => this.toggleVoiceAnswer());
    }

    // Keyboard shortcuts during quiz
    window.addEventListener('keydown', (e) => {
      if (!this.isQuizActive) return;
      // Ignore if typing in text input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const key = e.key.toUpperCase();
      if (['A', '1'].includes(key)) this.selectOption(0);
      else if (['B', '2'].includes(key)) this.selectOption(1);
      else if (['C', '3'].includes(key)) this.selectOption(2);
      else if (['D', '4'].includes(key)) this.selectOption(3);
      else if (e.key === 'Enter') this.submitAnswerAndNext();
    });
  }

  // ==================== SPEECH RECOGNITION ====================
  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onresult = (event) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript.trim().toLowerCase();
        console.log("Voice Command Detected:", text);
        this.handleVoiceCommand(text);
      };

      this.speechRecognition.onerror = (event) => {
        console.warn("Speech Recognition error:", event.error);
      };
    }
  }

  toggleVoiceAnswer() {
    if (!this.speechRecognition) {
      showToast("⚠️ Voice recognition is not supported in this browser.");
      return;
    }

    const btn = document.getElementById('btnVoiceAnswerToggle');
    if (this.isSpeechActive) {
      this.speechRecognition.stop();
      this.isSpeechActive = false;
      if (btn) btn.classList.remove('active');
      showToast("🔇 Voice Answer Mode Disabled");
    } else {
      try {
        this.speechRecognition.start();
        this.isSpeechActive = true;
        if (btn) btn.classList.add('active');
        showToast("🎙️ Voice Answer Active! Say 'Option A', 'B', 'C', 'D' or 'Submit'");
      } catch (e) {
        console.warn("Speech start error:", e);
      }
    }
  }

  handleVoiceCommand(text) {
    if (!this.isQuizActive) return;
    if (text.includes('option a') || text.includes('choice a') || text.includes('first') || text.includes('option 1')) {
      this.selectOption(0);
      showToast("🗣️ Voice Selected: Option A");
    } else if (text.includes('option b') || text.includes('choice b') || text.includes('second') || text.includes('option 2')) {
      this.selectOption(1);
      showToast("🗣️ Voice Selected: Option B");
    } else if (text.includes('option c') || text.includes('choice c') || text.includes('third') || text.includes('option 3')) {
      this.selectOption(2);
      showToast("🗣️ Voice Selected: Option C");
    } else if (text.includes('option d') || text.includes('choice d') || text.includes('fourth') || text.includes('option 4')) {
      this.selectOption(3);
      showToast("🗣️ Voice Selected: Option D");
    } else if (text.includes('submit') || text.includes('next') || text.includes('continue')) {
      this.submitAnswerAndNext();
    }
  }

  // ==================== QUESTIONS API ====================
  async loadQuestions() {
    try {
      const res = await fetch('/api/quiz/questions');
      const data = await res.json();
      if (data.status === 'success' && data.questions) {
        this.questions = data.questions;
        this.updateStartViewStats();
      }
    } catch (e) {
      console.error("Failed to load quiz questions:", e);
    }
  }

  updateStartViewStats() {
    const qCountBadge = document.getElementById('quizTotalCountBadge');
    if (qCountBadge) {
      qCountBadge.innerText = `${this.questions.length} Questions (1 to ${this.questions.length})`;
    }
    const qListPreview = document.getElementById('quizQuestionsPreviewList');
    if (qListPreview) {
      qListPreview.innerHTML = this.questions.map((q, idx) => `
        <div class="q-preview-item">
          <span class="q-num-badge">Q${idx + 1}</span>
          <div class="q-preview-text">
            <strong>${this.escapeHtml(q.question)}</strong>
            <div class="q-preview-meta">
              <span>🏷️ ${this.escapeHtml(q.category || 'General')}</span>
              <span>✅ Correct: ${String.fromCharCode(65 + (q.correct_index || 0))}</span>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  // ==================== SHUFFLED QUIZ RUNNER ====================
  startShuffledQuiz() {
    if (!this.questions || this.questions.length === 0) {
      showToast("⚠️ No questions available. Please add questions first.");
      return;
    }

    // Clone and shuffle 1 to 10 questions using Fisher-Yates
    this.currentQuiz = JSON.parse(JSON.stringify(this.questions));
    for (let i = this.currentQuiz.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.currentQuiz[i], this.currentQuiz[j]] = [this.currentQuiz[j], this.currentQuiz[i]];
    }

    this.currentIndex = 0;
    this.userAnswers = [];
    this.isQuizActive = true;
    this.quizStartTime = Date.now();
    this.selectedOption = null;

    this.switchQuizSubView('play');
    this.renderCurrentQuestion();
    this.startOverallTimer();

    // Notify user
    showToast(`🎲 Shuffled ${this.currentQuiz.length} questions! Quiz started.`);
  }

  startOverallTimer() {
    clearInterval(this.quizTimerInterval);
    this.quizTimeSeconds = 0;
    const timerElem = document.getElementById('quizPlayTimerDisplay');

    this.quizTimerInterval = setInterval(() => {
      this.quizTimeSeconds++;
      if (timerElem) {
        const mins = Math.floor(this.quizTimeSeconds / 60);
        const secs = this.quizTimeSeconds % 60;
        timerElem.innerText = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    }, 1000);
  }

  renderCurrentQuestion() {
    const q = this.currentQuiz[this.currentIndex];
    this.selectedOption = null;

    // Progress Bar & Counter
    const progressElem = document.getElementById('quizPlayProgressBar');
    const stepElem = document.getElementById('quizQuestionStepDisplay');
    const totalQ = this.currentQuiz.length;
    const currentNum = this.currentIndex + 1;

    if (progressElem) {
      const pct = (currentNum / totalQ) * 100;
      progressElem.style.width = `${pct}%`;
    }
    if (stepElem) {
      stepElem.innerText = `Question ${currentNum} of ${totalQ}`;
    }

    // Category
    const catElem = document.getElementById('quizPlayCategoryBadge');
    if (catElem) {
      catElem.innerText = q.category || 'Computer Vision & Audio';
    }

    // Question Text
    const textElem = document.getElementById('quizPlayQuestionText');
    if (textElem) {
      textElem.innerText = q.question;
    }

    // Options A, B, C, D
    const optionsContainer = document.getElementById('quizOptionsContainer');
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      const labels = ['A', 'B', 'C', 'D'];

      q.options.forEach((optText, optIdx) => {
        const optBtn = document.createElement('button');
        optBtn.className = 'quiz-option-btn';
        optBtn.dataset.index = optIdx;
        optBtn.innerHTML = `
          <div class="option-letter-badge">${labels[optIdx]}</div>
          <div class="option-text">${this.escapeHtml(optText)}</div>
          <div class="option-check-icon">✓</div>
        `;

        optBtn.addEventListener('click', () => this.selectOption(optIdx));
        optionsContainer.appendChild(optBtn);
      });
    }

    // Reset feedback box
    const feedbackBox = document.getElementById('quizFeedbackBox');
    if (feedbackBox) {
      feedbackBox.style.display = 'none';
      feedbackBox.className = 'quiz-feedback-box';
    }

    // Next button state
    const btnNext = document.getElementById('btnNextQuestion');
    if (btnNext) {
      btnNext.disabled = true;
      btnNext.innerText = (currentNum === totalQ) ? "Finish & View Results 🏁" : "Next Question ➔";
    }
  }

  selectOption(optIdx) {
    if (!this.isQuizActive) return;
    this.selectedOption = optIdx;

    // Highlight selected button
    const buttons = document.querySelectorAll('.quiz-option-btn');
    buttons.forEach((btn, idx) => {
      btn.classList.toggle('selected', idx === optIdx);
    });

    const btnNext = document.getElementById('btnNextQuestion');
    if (btnNext) {
      btnNext.disabled = false;
    }
  }

  submitAnswerAndNext() {
    if (this.selectedOption === null) {
      showToast("⚠️ Please select an option first!");
      return;
    }

    const q = this.currentQuiz[this.currentIndex];
    const isCorrect = (this.selectedOption === q.correct_index);

    // Record answer
    this.userAnswers.push({
      question_id: q.id,
      question: q.question,
      options: q.options,
      selected_index: this.selectedOption,
      selected_text: q.options[this.selectedOption] || '',
      correct_index: q.correct_index,
      correct_text: q.options[q.correct_index] || '',
      is_correct: isCorrect,
      explanation: q.explanation,
      category: q.category
    });

    // Provide visual feedback before advancing
    const buttons = document.querySelectorAll('.quiz-option-btn');
    buttons.forEach((btn, idx) => {
      if (idx === q.correct_index) {
        btn.classList.add('correct');
      } else if (idx === this.selectedOption && !isCorrect) {
        btn.classList.add('incorrect');
      }
    });

    // Move to next or finish
    setTimeout(() => {
      if (this.currentIndex + 1 < this.currentQuiz.length) {
        this.currentIndex++;
        this.renderCurrentQuestion();
      } else {
        this.finishQuiz();
      }
    }, 450);
  }

  finishQuiz() {
    this.isQuizActive = false;
    clearInterval(this.quizTimerInterval);

    // Switch to results view
    this.renderResults();
    this.switchQuizSubView('results');

    // Auto-save user answers to server
    this.saveUserAnswersToServer(true);
  }

  endQuizSession(completed = false) {
    this.isQuizActive = false;
    clearInterval(this.quizTimerInterval);
    if (this.speechRecognition && this.isSpeechActive) {
      this.speechRecognition.stop();
      this.isSpeechActive = false;
    }
  }

  // ==================== QUIZ RESULTS & BREAKDOWN ====================
  renderResults() {
    const total = this.userAnswers.length;
    const correct = this.userAnswers.filter(a => a.is_correct).length;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

    const scoreNumElem = document.getElementById('resultsScoreNumber');
    const scorePctElem = document.getElementById('resultsScorePercent');
    const scoreMessage = document.getElementById('resultsScoreMessage');
    const timeTakenElem = document.getElementById('resultsTimeTaken');

    if (scoreNumElem) scoreNumElem.innerText = `${correct} / ${total}`;
    if (scorePctElem) scorePctElem.innerText = `${percent}%`;

    const mins = Math.floor(this.quizTimeSeconds / 60);
    const secs = this.quizTimeSeconds % 60;
    if (timeTakenElem) timeTakenElem.innerText = `⏱️ Time: ${mins}m ${secs}s`;

    if (scoreMessage) {
      if (percent >= 90) {
        scoreMessage.innerHTML = "🏆 <strong>Outstanding!</strong> Master of Computer Vision & Audio Engineering!";
        scoreMessage.style.color = "var(--accent-emerald)";
      } else if (percent >= 70) {
        scoreMessage.innerHTML = "👏 <strong>Great Job!</strong> High proficiency demonstrated!";
        scoreMessage.style.color = "var(--accent-cyan)";
      } else if (percent >= 50) {
        scoreMessage.innerHTML = "👍 <strong>Good Effort!</strong> Review incorrect questions below to improve.";
        scoreMessage.style.color = "var(--accent-amber)";
      } else {
        scoreMessage.innerHTML = "📚 <strong>Keep Practicing!</strong> Check the explanations below.";
        scoreMessage.style.color = "var(--accent-rose)";
      }
    }

    // Render detailed answer sheet (1 to 10)
    const breakdownContainer = document.getElementById('resultsQuestionsBreakdown');
    if (breakdownContainer) {
      breakdownContainer.innerHTML = this.userAnswers.map((ans, idx) => `
        <div class="result-card ${ans.is_correct ? 'result-card-correct' : 'result-card-incorrect'}">
          <div class="result-card-header">
            <span class="q-num-badge ${ans.is_correct ? 'correct' : 'incorrect'}">
              Q${idx + 1} ${ans.is_correct ? '✅ Correct' : '❌ Incorrect'}
            </span>
            <span style="font-size:0.8rem; color:var(--text-muted);">${this.escapeHtml(ans.category || '')}</span>
          </div>
          <h4 style="margin:0.5rem 0; color:#fff;">${this.escapeHtml(ans.question)}</h4>
          <div class="result-answers-comparison">
            <div>
              <span style="color:var(--text-muted); font-size:0.8rem;">Your Answer:</span>
              <strong style="color:${ans.is_correct ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; display:block;">
                ${this.escapeHtml(ans.selected_text)}
              </strong>
            </div>
            ${!ans.is_correct ? `
              <div>
                <span style="color:var(--text-muted); font-size:0.8rem;">Correct Answer:</span>
                <strong style="color:var(--accent-emerald); display:block;">
                  ${this.escapeHtml(ans.correct_text)}
                </strong>
              </div>
            ` : ''}
          </div>
          ${ans.explanation ? `
            <div class="result-explanation">
              💡 <strong>Explanation:</strong> ${this.escapeHtml(ans.explanation)}
            </div>
          ` : ''}
        </div>
      `).join('');
    }
  }

  async saveUserAnswersToServer(silent = false) {
    if (!this.userAnswers || this.userAnswers.length === 0) return;

    const payload = {
      username: "User",
      time_taken_seconds: this.quizTimeSeconds,
      answers: this.userAnswers,
      quiz_metadata: {
        total_questions: this.userAnswers.length,
        shuffled: true,
        completed_at: new Date().toISOString()
      }
    };

    try {
      const res = await fetch('/api/quiz/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        if (!silent) showToast("✅ Quiz answers saved successfully to server!");
        await this.loadAnswerHistory();
      }
    } catch (e) {
      console.error("Failed to save quiz answers:", e);
      if (!silent) showToast("❌ Error saving answers to server.");
    }
  }

  exportResultsAsJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      quiz_report: "VisionRec Studio Interactive Quiz",
      score_percent: Math.round((this.userAnswers.filter(a => a.is_correct).length / this.userAnswers.length) * 100),
      time_seconds: this.quizTimeSeconds,
      timestamp: new Date().toISOString(),
      answers: this.userAnswers
    }, null, 2));

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `quiz_answers_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("📥 Exported Quiz Answer Sheet (JSON)");
  }

  // ==================== 1 TO 10 QUESTION EDITOR ====================
  renderQuestionEditor() {
    const editorList = document.getElementById('editorQuestionsList');
    if (!editorList) return;

    editorList.innerHTML = '';
    this.questions.forEach((q, idx) => {
      const item = document.createElement('div');
      item.className = 'editor-q-card';
      item.dataset.index = idx;
      item.innerHTML = `
        <div class="editor-q-header">
          <span class="q-num-badge">Question #${idx + 1}</span>
          <button class="btn-card btn-card-delete" onclick="window.quizSpaceManager.removeQuestionFromEditor(${idx})">🗑️ Delete</button>
        </div>

        <div class="editor-field-group">
          <label>Question Text</label>
          <input type="text" class="link-input editor-q-text" value="${this.escapeHtml(q.question)}" placeholder="Enter question text...">
        </div>

        <div class="editor-options-grid">
          ${[0, 1, 2, 3].map(optIdx => `
            <div class="editor-opt-row">
              <span class="opt-label">${String.fromCharCode(65 + optIdx)}</span>
              <input type="text" class="link-input editor-opt-text" data-opt="${optIdx}" value="${this.escapeHtml(q.options[optIdx] || '')}" placeholder="Option ${String.fromCharCode(65 + optIdx)}">
              <label class="correct-radio-label">
                <input type="radio" name="correct_opt_${idx}" value="${optIdx}" ${q.correct_index === optIdx ? 'checked' : ''}> Correct
              </label>
            </div>
          `).join('')}
        </div>

        <div class="editor-field-group" style="margin-top:0.75rem;">
          <label>Explanation / Learning Note</label>
          <input type="text" class="link-input editor-q-exp" value="${this.escapeHtml(q.explanation || '')}" placeholder="Why is this answer correct?">
        </div>
      `;
      editorList.appendChild(item);
    });
  }

  addQuestionToEditor() {
    if (this.questions.length >= 10) {
      showToast("⚠️ Maximum 10 questions limit reached.");
      return;
    }

    this.questions.push({
      id: this.questions.length + 1,
      question: `New Question ${this.questions.length + 1}`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correct_index: 0,
      explanation: "Explanation here",
      category: "Computer Vision"
    });

    this.renderQuestionEditor();
    showToast(`➕ Added Question #${this.questions.length}`);
  }

  removeQuestionFromEditor(index) {
    if (this.questions.length <= 1) {
      showToast("⚠️ Must maintain at least 1 question.");
      return;
    }
    this.questions.splice(index, 1);
    this.renderQuestionEditor();
    showToast("🗑️ Question removed.");
  }

  async saveEditorQuestionsToServer() {
    const cards = document.querySelectorAll('.editor-q-card');
    const updated = [];

    cards.forEach((card, idx) => {
      const qText = card.querySelector('.editor-q-text').value.trim();
      const optInputs = card.querySelectorAll('.editor-opt-text');
      const options = Array.from(optInputs).map(inp => inp.value.trim());
      const checkedRadio = card.querySelector(`input[name="correct_opt_${idx}"]:checked`);
      const correctIdx = checkedRadio ? parseInt(checkedRadio.value) : 0;
      const expText = card.querySelector('.editor-q-exp').value.trim();

      updated.push({
        id: idx + 1,
        question: qText || `Question #${idx + 1}`,
        options: options.length === 4 ? options : ["Option A", "Option B", "Option C", "Option D"],
        correct_index: correctIdx,
        explanation: expText,
        category: "General CV/Audio"
      });
    });

    try {
      const res = await fetch('/api/quiz/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: updated })
      });
      const data = await res.json();
      if (data.status === 'success') {
        this.questions = data.questions;
        this.updateStartViewStats();
        showToast("✅ All 1-10 Questions saved to server storage!");
        this.switchQuizSubView('start');
      }
    } catch (e) {
      console.error("Save questions error:", e);
      showToast("❌ Failed to save questions to server.");
    }
  }

  async resetDefaultQuestions() {
    if (!confirm("Reset all questions back to the default 1 to 10 question bank?")) return;
    try {
      const res = await fetch('/api/quiz/questions/reset', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        this.questions = data.questions;
        this.updateStartViewStats();
        this.renderQuestionEditor();
        showToast("🔄 Reset to default 1 to 10 questions successfully!");
      }
    } catch (e) {
      console.error("Reset error:", e);
    }
  }

  // ==================== SAVED ANSWERS HISTORY ====================
  async loadAnswerHistory() {
    try {
      const res = await fetch('/api/quiz/answers');
      const data = await res.json();
      if (data.status === 'success' && data.submissions) {
        this.savedSubmissions = data.submissions;
      }
    } catch (e) {
      console.error("Failed to load answer history:", e);
    }
  }

  renderAnswerHistory() {
    const listElem = document.getElementById('historySubmissionsList');
    if (!listElem) return;

    if (!this.savedSubmissions || this.savedSubmissions.length === 0) {
      listElem.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <h3>No saved quiz answers yet</h3>
          <p>Take the 1-10 question quiz to save and track your score history!</p>
        </div>
      `;
      return;
    }

    listElem.innerHTML = this.savedSubmissions.map(sub => `
      <div class="history-item-card">
        <div class="history-card-top">
          <div>
            <strong style="color:#fff; font-size:1.05rem;">Score: ${sub.correct_answers} / ${sub.total_questions} (${sub.score_percent}%)</strong>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">
              📅 ${sub.timestamp_display} • ⏱️ Duration: ${sub.time_taken_seconds}s
            </div>
          </div>
          <button class="btn-card btn-card-delete" onclick="window.quizSpaceManager.deleteSubmission('${sub.id}')">🗑️</button>
        </div>

        <div class="history-card-answers-summary">
          ${(sub.answers || []).map((ans, idx) => `
            <span class="history-pill ${ans.is_correct ? 'pill-correct' : 'pill-incorrect'}" title="Q${idx + 1}: ${this.escapeHtml(ans.question)} (${ans.selected_text})">
              Q${idx + 1}: ${ans.is_correct ? '✅' : '❌'}
            </span>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  async deleteSubmission(submissionId) {
    try {
      const res = await fetch(`/api/quiz/answers/${submissionId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        showToast("🗑️ Quiz submission deleted.");
        await this.loadAnswerHistory();
        this.renderAnswerHistory();
      }
    } catch (e) {
      console.error("Delete submission error:", e);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
