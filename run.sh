#!/bin/bash
# VisionRec Studio Launcher Script

echo "=========================================================="
echo "  📹 VisionRec Studio - Computer Vision Video & Voice Recorder"
echo "  ⏱️  Enforced Limit: 3 Minutes (180 Seconds) Per Video"
echo "  🚀 Multi-Channel Sharing: Email, WhatsApp, AI Bot, Anywhere"
echo "=========================================================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not found."
    exit 1
fi

PORT=${PORT:-8000}
HOST=${HOST:-"0.0.0.0"}

echo "Starting server on http://${HOST}:${PORT} ..."
python3 app.py
