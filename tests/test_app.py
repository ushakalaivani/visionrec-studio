"""
VisionRec Studio - Comprehensive Unit and Integration Tests
Tests Flask endpoints, Computer Vision engine, 3-minute limit enforcement,
Continuous rolling chunk recordings, 1-10 Questions Quiz APIs, User Answer Saving,
and Sharing utilities.
"""

import os
import sys
import io
import json
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app
from cv_engine import CVMediaEngine
import config

class VisionRecTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        self.engine = CVMediaEngine()

    def test_index_page(self):
        """Test home dashboard loads successfully with Quiz Space tabs."""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'VisionRec Studio', response.data)
        self.assertIn(b'Quiz Space', response.data)
        self.assertIn(b'3:00 Rolling Limit', response.data)

    def test_system_status(self):
        """Test system status reports correct 3-minute (180s) limit."""
        response = self.app.get('/api/system-status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'online')
        self.assertEqual(data['max_duration_seconds'], 180)

    def test_quiz_questions_endpoints(self):
        """Test getting, updating, and resetting 1 to 10 questions."""
        # 1. Get default questions
        res = self.app.get('/api/quiz/questions')
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['status'], 'success')
        self.assertGreaterEqual(data['count'], 1)
        self.assertLessEqual(data['count'], 10)
        
        # Verify question structure
        first_q = data['questions'][0]
        self.assertIn('question', first_q)
        self.assertIn('options', first_q)
        self.assertEqual(len(first_q['options']), 4)
        self.assertIn('correct_index', first_q)

        # 2. Update questions
        custom_questions = [
            {
                "id": 1,
                "question": "What is Python?",
                "options": ["A snake", "Programming language", "Car", "Planet"],
                "correct_index": 1,
                "explanation": "Python is a high-level general-purpose programming language.",
                "category": "Programming"
            },
            {
                "id": 2,
                "question": "What is OpenCV?",
                "options": ["Computer Vision Library", "Text editor", "Database", "Browser"],
                "correct_index": 0,
                "explanation": "OpenCV is an open-source computer vision and machine learning library.",
                "category": "Computer Vision"
            }
        ]
        post_res = self.app.post('/api/quiz/questions',
                                 data=json.dumps({"questions": custom_questions}),
                                 content_type='application/json')
        self.assertEqual(post_res.status_code, 200)
        post_data = json.loads(post_res.data)
        self.assertEqual(post_data['count'], 2)
        self.assertEqual(post_data['questions'][0]['question'], "What is Python?")

        # 3. Reset back to defaults
        reset_res = self.app.post('/api/quiz/questions/reset')
        self.assertEqual(reset_res.status_code, 200)
        reset_data = json.loads(reset_res.data)
        self.assertEqual(reset_data['count'], 10)

    def test_quiz_answers_submission_lifecycle(self):
        """Test saving user quiz answers, checking score calculation, listing, and deletion."""
        answers_payload = {
            "username": "Test Student",
            "time_taken_seconds": 45,
            "recording_id": "rec_sample_test",
            "answers": [
                {
                    "question_id": 1,
                    "question": "Q1?",
                    "selected_index": 0,
                    "selected_text": "Opus",
                    "correct_index": 0,
                    "correct_text": "Opus",
                    "is_correct": True
                },
                {
                    "question_id": 2,
                    "question": "Q2?",
                    "selected_index": 2,
                    "selected_text": "Wrong",
                    "correct_index": 1,
                    "correct_text": "Right",
                    "is_correct": False
                }
            ]
        }

        # 1. Save answers
        post_res = self.app.post('/api/quiz/answers',
                                 data=json.dumps(answers_payload),
                                 content_type='application/json')
        self.assertEqual(post_res.status_code, 201)
        res_data = json.loads(post_res.data)
        self.assertEqual(res_data['status'], 'success')
        submission = res_data['submission']
        self.assertEqual(submission['correct_answers'], 1)
        self.assertEqual(submission['total_questions'], 2)
        self.assertEqual(submission['score_percent'], 50.0)

        submission_id = submission['id']

        # 2. List submissions
        get_res = self.app.get('/api/quiz/answers')
        self.assertEqual(get_res.status_code, 200)
        list_data = json.loads(get_res.data)
        sub_ids = [s['id'] for s in list_data['submissions']]
        self.assertIn(submission_id, sub_ids)

        # 3. Delete submission
        del_res = self.app.delete(f'/api/quiz/answers/{submission_id}')
        self.assertEqual(del_res.status_code, 200)
        del_data = json.loads(del_res.data)
        self.assertEqual(del_data['status'], 'success')

    def test_continuous_multisegment_upload_lifecycle(self):
        """
        Test continuous multi-segment 3-minute rolling recording:
        Segment 1 + Segment 2 linked with session_id.
        """
        fake_video_bytes = b"CONTINUOUS_MOCK_STREAM_PART_1"
        video_io = io.BytesIO(fake_video_bytes)
        
        # Segment 1
        upload_data = {
            'video': (video_io, 'test_session_part1.webm'),
            'duration': '180.0',  # exactly 3 minutes
            'title': 'Interview Session (Part 1)',
            'session_id': 'session_abc_123',
            'segment_index': '1',
            'cv_metrics': json.dumps({'avg_fps': 30})
        }
        res1 = self.app.post('/api/records/upload', data=upload_data, content_type='multipart/form-data')
        self.assertEqual(res1.status_code, 201)
        rec1 = json.loads(res1.data)['record']
        self.assertEqual(rec1['session_id'], 'session_abc_123')
        self.assertEqual(rec1['segment_index'], 1)
        self.assertEqual(rec1['duration_formatted'], '03:00')

        # Segment 2
        video_io2 = io.BytesIO(b"CONTINUOUS_MOCK_STREAM_PART_2")
        upload_data2 = {
            'video': (video_io2, 'test_session_part2.webm'),
            'duration': '115.0',  # 1 min 55 sec
            'title': 'Interview Session (Part 2)',
            'session_id': 'session_abc_123',
            'segment_index': '2',
            'cv_metrics': json.dumps({'avg_fps': 30})
        }
        res2 = self.app.post('/api/records/upload', data=upload_data2, content_type='multipart/form-data')
        self.assertEqual(res2.status_code, 201)
        rec2 = json.loads(res2.data)['record']
        self.assertEqual(rec2['session_id'], 'session_abc_123')
        self.assertEqual(rec2['segment_index'], 2)
        self.assertEqual(rec2['duration_formatted'], '01:55')

        # Cleanup
        self.app.delete(f"/api/records/{rec1['id']}")
        self.app.delete(f"/api/records/{rec2['id']}")

    def test_duration_limit_enforcement(self):
        """Verify duration cannot exceed 180 seconds (3 mins)."""
        video_io = io.BytesIO(b"DUR_TEST_STREAM")
        upload_data = {
            'video': (video_io, 'over_limit.webm'),
            'duration': '350.0',
            'title': 'Over Limit Test'
        }
        res = self.app.post('/api/records/upload', data=upload_data, content_type='multipart/form-data')
        self.assertEqual(res.status_code, 201)
        res_json = json.loads(res.data)
        
        self.assertEqual(res_json['record']['duration_seconds'], 180)
        self.assertEqual(res_json['record']['duration_formatted'], '03:00')

        self.app.delete(f"/api/records/{res_json['record']['id']}")

if __name__ == '__main__':
    unittest.main()
