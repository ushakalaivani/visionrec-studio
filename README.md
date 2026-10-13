# 👁️ VisionRec Studio

> **High-Performance Computer Vision Video & Synchronized Voice Recorder with Interactive Quiz Space**  
> Built with Computer Vision Engineering, Continuous 3-Minute Rolling Recording, Background Recording across Applications, Interactive 1-10 Question Shuffled Quiz with Voice Input & Answer Sheet Persistence, Local Storage Management, Deletion Control, and Multi-Channel Sharing (Email, WhatsApp, AI Bot, Web Share).

---

## ✨ Key Features

### 1. 📝 Interactive Quiz Space (1 to 10 Questions)
- **1 to 10 Questions Bank & Custom Editor**:
  - Full Question & Answer management supporting up to 10 questions with 4 multiple-choice options (A, B, C, D), correct answer flags, categories, and explanations.
  - Reset to default questions, add, remove, and persist custom question sets to server storage (`/api/quiz/questions`).
- **Shuffled Interactive Quiz Arena**:
  - Real-time Fisher-Yates randomization of questions 1 through 10 upon starting a quiz.
  - Interactive option buttons (A, B, C, D) with immediate answer verification, keyboard shortcuts (`A-D`, `1-4`, `Enter`), and streak counters.
  - **🎙️ Voice Answer Mode**: Hands-free voice commands via Web Speech API ("Option A", "Option 2", "Submit", "Next").
- **User Answer Sheet Persistence & History**:
  - Automatically calculates score percentage, time elapsed, and per-question correctness breakdown.
  - Saves completed answer sheets to server storage (`/api/quiz/answers`) with deletion and JSON export options.

### 2. 🔄 Continuous 3-Minute Rolling Recording ("Don't Stop Until I Stop")
- **Continuous Multi-Segment Rolling Chunks**:
  - When recording starts, it captures in continuous 3-minute segments (`Part 1`, `Part 2`, `Part 3`, etc.).
  - At exactly 3 minutes (180s), the current chunk is auto-saved to disk and indexed, while the recording seamlessly continues rolling into the next segment **without stopping** until the user clicks **"Stop & Save"**!
  - Segment counters and total session elapsed timers displayed in real-time.

### 3. 🖥️ Continuous Background Recording Across Applications
- **Background Web Worker Timer (`worker_timer.js`)**:
  - Operates in a background OS thread that does NOT get throttled or paused when switching tabs or opening another application (Word, PDF, IDE, browser).
- **Screen & Application Window Capture Mode**:
  - 1-click toggle between live Webcam and full Screen / Application Share (`getDisplayMedia`) with synchronized voice audio recording.

### 4. 🧠 Computer Vision Engineering Pipeline
- **Face Detection & Tracking Reticle**: Visual tracking corners and alignment guides.
- **Real-Time Motion Energy Analyzer**: Detects movement intensity and subject dynamics.
- **Interactive Vision Filters**:
  - `Studio Clean`: High quality camera enhancement
  - `Face Focus / Bokeh`: Depth-of-field focus simulation
  - `Edge Detection`: Sobel luminance differential filter
  - `Night Vision`: Low-light green channel amplification
  - `Cyberpunk Neon`: Chromatic tone mapping LUT
  - `Monochrome High-Contrast`: Luma-weighted black and white
- **Computer Vision HUD**: Real-time FPS telemetry, motion percentage, timestamp watermark, audio visualizer.

### 5. 📁 Storage & Management
- All recordings stored in `records/` with metadata (`records/metadata.json`).
- Automatically captures keyframe thumbnails from canvas frames.
- Gallery dashboard with multi-segment badges (`Part 1`, `Part 2`), timestamp, duration badge, file size in MB.

### 6. 🗑️ Delete Option
- Delete any individual recording or quiz submission from storage with one click and confirmation.
- Instantly cleans up video media file, thumbnail, and metadata index.

### 7. 🔗 Multi-Channel Sharing Hub
- **✉️ Email**: Pre-formatted `mailto:` link with video title, streaming link, and recording timestamp.
- **💬 WhatsApp**: 1-click WhatsApp Web & mobile link with formatted message and stream link.
- **🤖 AI Bot**:
  - Generates a structured Computer Vision and Voice metadata report.
  - Pre-assembled prompts for Gemini / Claude / ChatGPT / Telegram AI Bots.
  - REST endpoint (`/api/records/<id>/ai-bot-report`) for AI webhook integrations.
- **📲 Anywhere / Web Share**: Native OS device sharing menu + 1-click Direct URL copy.

---

## 📂 Project Architecture

```
/home/usha/video-audio/
├── app.py                      # Flask backend application & REST API (Records + Quiz Q&A)
├── cv_engine.py                # Computer Vision engine, Quiz Manager & continuous session indexer
├── config.py                   # Configuration (3 min limit, storage paths, quiz files)
├── run.sh                      # Quick start shell script
├── records/                    # Stored video + audio recording files
│   ├── thumbnails/             # Keyframe thumbnails
│   ├── metadata.json           # Indexed recordings metadata
│   ├── quiz_questions.json     # Saved 1 to 10 questions bank
│   └── quiz_answers.json       # User quiz submissions & answer sheets
├── static/
│   ├── css/
│   │   └── style.css           # Modern theme with tabbed spaces and quiz arena
│   └── js/
│       ├── cv_processor.js     # Real-time Computer Vision canvas pipeline
│       ├── recorder.js         # Continuous rolling 3-min recorder + screen share
│       ├── worker_timer.js     # Web Worker timer for background app switching
│       ├── quiz_space.js       # 1-10 Questions, shuffled quiz arena, voice & answer saver
│       ├── gallery.js          # Gallery management, multi-segment player, deletion
│       └── share.js            # Multi-channel sharing & AI Bot integration
├── templates/
│   └── index.html              # Main dashboard with Studio, Quiz Space & Gallery tabs
└── tests/
    └── test_app.py             # Automated unit & integration tests
```

---

## 🚀 Getting Started

### 1. Launch the Application
Run the launcher script:
```bash
./run.sh
```
or directly via Python:
```bash
python3 app.py
```

### 2. Open in Browser
Navigate to:
```
http://localhost:5000
```

### 3. Running the Test Suite
Execute the automated test suite:
```bash
python3 -m unittest discover -s tests -v
```
