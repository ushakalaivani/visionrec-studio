import os

# Base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Recording Constraints
MAX_RECORDING_SECONDS = 180  # Exactly 3 minutes time limit per video
WARNING_THRESHOLD_SECONDS = 30  # Warning indicator when 30s remaining

# Storage Paths
RECORDS_DIR = os.path.join(BASE_DIR, 'records')
THUMBNAILS_DIR = os.path.join(RECORDS_DIR, 'thumbnails')
METADATA_FILE = os.path.join(RECORDS_DIR, 'metadata.json')
QUIZ_QUESTIONS_FILE = os.path.join(RECORDS_DIR, 'quiz_questions.json')
QUIZ_ANSWERS_FILE = os.path.join(RECORDS_DIR, 'quiz_answers.json')

# Allowed video and audio formats
ALLOWED_EXTENSIONS = {'webm', 'mp4', 'mkv', 'ogg', 'wav'}
MAX_UPLOAD_SIZE_MB = 200

# Quiz settings
MAX_QUIZ_QUESTIONS = 10

# Server Configuration
DEFAULT_HOST = '0.0.0.0'
DEFAULT_PORT = 8000
DEBUG = True

