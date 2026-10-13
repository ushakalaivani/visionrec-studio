"""
VisionRec Studio - Flask Web Application & REST API
High Performance Computer Vision Video & Voice Recorder with 3-Minute Limit, Storage, Deletion & Multi-Channel Sharing
"""

import os
import json
import base64
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file, abort
import config
from cv_engine import CVMediaEngine

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = config.MAX_UPLOAD_SIZE_MB * 1024 * 1024

engine = CVMediaEngine()

@app.route('/')
def index():
    """Render main recording studio dashboard."""
    return render_template('index.html', max_duration=config.MAX_RECORDING_SECONDS)

@app.route('/api/records', methods=['GET'])
def list_records():
    """Get list of all video records."""
    records = engine.list_records()
    return jsonify({
        "status": "success",
        "count": len(records),
        "records": records
    })

@app.route('/api/records/<record_id>', methods=['GET'])
def get_record(record_id):
    """Get details of a specific record."""
    rec = engine.get_record(record_id)
    if not rec:
        return jsonify({"status": "error", "message": "Record not found"}), 404
    return jsonify({"status": "success", "record": rec})

@app.route('/api/records/upload', methods=['POST'])
def upload_recording():
    """
    Upload recorded video blob (with synchronized audio), thumbnail, and metadata.
    Enforces maximum 3 minutes (180s) limit per segment, supporting continuous multi-part sessions.
    """
    if 'video' not in request.files:
        return jsonify({"status": "error", "message": "No video file provided"}), 400

    video_file = request.files['video']
    if video_file.filename == '':
        return jsonify({"status": "error", "message": "Empty video filename"}), 400

    duration = float(request.form.get('duration', 0))
    # Cap duration at 180 seconds (3 min)
    duration = min(duration, config.MAX_RECORDING_SECONDS)

    title = request.form.get('title', '').strip()
    session_id = request.form.get('session_id', None)
    segment_index = int(request.form.get('segment_index', 1))

    cv_metrics_str = request.form.get('cv_metrics', '{}')
    try:
        cv_metrics = json.loads(cv_metrics_str)
    except Exception:
        cv_metrics = {}

    quiz_metadata_str = request.form.get('quiz_metadata', None)
    quiz_metadata = None
    if quiz_metadata_str:
        try:
            quiz_metadata = json.loads(quiz_metadata_str)
        except Exception:
            quiz_metadata = None

    # Save recording through engine
    record_data = engine.save_recording(
        file_storage=video_file,
        custom_title=title if title else None,
        duration=duration,
        cv_metadata=cv_metrics,
        session_id=session_id,
        segment_index=segment_index,
        quiz_metadata=quiz_metadata
    )

    # If client passed custom keyframe thumbnail
    if 'thumbnail' in request.files:
        try:
            thumb_file = request.files['thumbnail']
            thumb_bytes = thumb_file.read()
            if thumb_bytes:
                engine.save_thumbnail_image(record_data['id'], thumb_bytes)
        except Exception as e:
            print(f"Error saving custom thumbnail: {e}")

    return jsonify({
        "status": "success",
        "message": "Recording saved successfully",
        "record": engine.get_record(record_data['id'])
    }), 201

# ==================== QUIZ & Q&A REST APIs ====================

@app.route('/api/quiz/questions', methods=['GET'])
def get_quiz_questions():
    """Retrieve 1 to 10 questions for interactive quiz."""
    questions = engine.load_quiz_questions()
    return jsonify({
        "status": "success",
        "count": len(questions),
        "questions": questions
    })

@app.route('/api/quiz/questions', methods=['POST'])
def update_quiz_questions():
    """Update or save 1 to 10 questions to server storage."""
    data = request.get_json(silent=True) or {}
    questions = data.get('questions', [])
    if not isinstance(questions, list) or len(questions) == 0:
        return jsonify({"status": "error", "message": "Questions array must not be empty"}), 400

    saved = engine.save_quiz_questions(questions)
    return jsonify({
        "status": "success",
        "message": f"Saved {len(saved)} questions successfully",
        "count": len(saved),
        "questions": saved
    })

@app.route('/api/quiz/questions/reset', methods=['POST'])
def reset_quiz_questions():
    """Reset question bank to default 1 to 10 questions."""
    defaults = engine.get_default_questions()
    saved = engine.save_quiz_questions(defaults)
    return jsonify({
        "status": "success",
        "message": "Reset to default 1 to 10 questions",
        "count": len(saved),
        "questions": saved
    })

@app.route('/api/quiz/answers', methods=['GET'])
def get_quiz_answers():
    """Retrieve saved user quiz attempts and answer sheets."""
    submissions = engine.load_quiz_answers()
    return jsonify({
        "status": "success",
        "count": len(submissions),
        "submissions": submissions
    })

@app.route('/api/quiz/answers', methods=['POST'])
def save_quiz_answers():
    """Save a completed user quiz attempt with 1 to 10 answers and score."""
    data = request.get_json(silent=True) or {}
    if 'answers' not in data or not isinstance(data['answers'], list):
        return jsonify({"status": "error", "message": "Answers list is required"}), 400

    submission = engine.save_quiz_answers(data)
    return jsonify({
        "status": "success",
        "message": "Quiz answers saved successfully",
        "submission": submission
    }), 201

@app.route('/api/quiz/answers/<submission_id>', methods=['DELETE'])
def delete_quiz_answer(submission_id):
    """Delete a user quiz submission attempt."""
    success, msg = engine.delete_quiz_answer(submission_id)
    if not success:
        return jsonify({"status": "error", "message": msg}), 404
    return jsonify({"status": "success", "message": msg})


@app.route('/api/records/<record_id>', methods=['DELETE'])
def delete_record(record_id):
    """
    Delete a specific video and voice recording from storage.
    """
    success, msg = engine.delete_record(record_id)
    if not success:
        return jsonify({"status": "error", "message": msg}), 404
    return jsonify({"status": "success", "message": msg})

@app.route('/stream/<filename>')
def stream_video(filename):
    """Stream recorded video file."""
    file_path = os.path.join(config.RECORDS_DIR, filename)
    if not os.path.exists(file_path):
        abort(404)
    return send_from_directory(config.RECORDS_DIR, filename, mimetype='video/webm')

@app.route('/download/<filename>')
def download_video(filename):
    """Download recorded video file as attachment."""
    file_path = os.path.join(config.RECORDS_DIR, filename)
    if not os.path.exists(file_path):
        abort(404)
    return send_file(file_path, as_attachment=True, download_name=filename)

@app.route('/thumbnail/<filename>')
def get_thumbnail(filename):
    """Serve preview thumbnail image."""
    thumb_path = os.path.join(config.THUMBNAILS_DIR, filename)
    if not os.path.exists(thumb_path):
        abort(404)
    return send_from_directory(config.THUMBNAILS_DIR, filename, mimetype='image/jpeg')

@app.route('/api/records/<record_id>/ai-bot-report', methods=['GET'])
def ai_bot_report(record_id):
    """Generate Computer Vision and audio report for AI bot / webhook."""
    report = engine.analyze_for_ai_bot(record_id)
    if not report:
        return jsonify({"status": "error", "message": "Record not found"}), 404
    return jsonify({"status": "success", "ai_report": report})

@app.route('/api/system-status', methods=['GET'])
def system_status():
    """System information, recording limit, and storage stats."""
    records = engine.list_records()
    total_size_bytes = sum(r.get('size_bytes', 0) for r in records)
    return jsonify({
        "status": "online",
        "app_name": "VisionRec Studio",
        "max_duration_seconds": config.MAX_RECORDING_SECONDS,
        "max_duration_display": "3:00 (3 Minutes)",
        "total_recordings": len(records),
        "total_storage_mb": round(total_size_bytes / (1024 * 1024), 2),
        "storage_path": config.RECORDS_DIR
    })

if __name__ == '__main__':
    print(f"🚀 Starting VisionRec Studio on http://{config.DEFAULT_HOST}:{config.DEFAULT_PORT}")
    app.run(host=config.DEFAULT_HOST, port=config.DEFAULT_PORT, debug=config.DEBUG)
