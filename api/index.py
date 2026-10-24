import os
import sys
import shutil

# Add backend directory to sys.path so app modules import cleanly
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Copy seeded SQLite database to /tmp if running in read-only Vercel serverless container
TMP_DB = "/tmp/messmate.db"
SEED_DB = os.path.join(BACKEND_DIR, "seed.db")
if not os.path.exists(SEED_DB):
    SEED_DB = os.path.join(BACKEND_DIR, "messmate.db")

if not os.path.exists(TMP_DB) and os.path.exists(SEED_DB):
    try:
        shutil.copy2(SEED_DB, TMP_DB)
    except Exception as e:
        print(f"Warning: could not copy seed db to /tmp: {e}")

from app.main import app
