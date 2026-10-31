import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ['FIREBASE_MANAGER_EMAILS'] = 'manager@test.invalid'
os.environ['FIREBASE_REVIEWER_EMAILS'] = 'reviewer@test.invalid'

from fastapi.testclient import TestClient
from app import main


def fake_verify(token: str) -> dict:
    email = token
    return {
        'uid': f'uid-{email}',
        'email': email,
        'name': email.split('@', 1)[0].title(),
        'email_verified': True,
    }


main.verify_firebase_token = fake_verify
client = TestClient(main.app)


def test_firebase_token_creates_student_profile_and_protects_manager_routes():
    headers = {'Authorization': 'Bearer student@test.invalid'}
    response = client.post('/api/auth/firebase', headers=headers)
    assert response.status_code == 200
    assert response.json()['user']['role'] == 'student'
    assert client.get('/api/manager/overview', headers=headers).status_code == 403


def test_only_allowlisted_email_receives_manager_role():
    headers = {'Authorization': 'Bearer manager@test.invalid'}
    response = client.post('/api/auth/firebase', headers=headers)
    assert response.status_code == 200
    assert response.json()['user']['role'] == 'manager'
    assert client.get('/api/manager/overview', headers=headers).status_code == 200


def test_unverified_firebase_email_is_rejected(monkeypatch):
    monkeypatch.setattr(main, 'verify_firebase_token', lambda token: {
        'uid': 'unverified', 'email': 'new@test.invalid', 'email_verified': False
    })
    response = client.post('/api/auth/firebase', headers={'Authorization': 'Bearer unverified'})
    assert response.status_code == 403
