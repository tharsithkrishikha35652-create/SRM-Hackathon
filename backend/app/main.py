from fastapi import FastAPI, HTTPException, Header, Depends, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
import sqlite3, os, secrets, hashlib, hmac, json, re

# Load environment variables (.env in backend or root)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from app.menus import OFFICIAL_MENUS, get_official_menu, WEEKDAYS
from app.risk_engine import (
    calculate_recurrence_points,
    calculate_delay_points,
    calculate_risk_score,
    determine_risk_level,
    should_escalate,
    get_calendar_week_key,
    reconcile_issue_risk,
    evaluate_positive_feedback_trigger_b,
    reconcile_all_issues,
    RESOLUTION_REDUCTION_POINTS,
    ESCALATION_THRESHOLD
)
from app.gemini_service import (
    process_pending_complaints_job,
    get_ai_status,
    normalise_rule_based,
    generate_meal_summary
)

# Handle SQLite on Vercel Serverless (where repository filesystem is read-only)
if os.environ.get("VERCEL"):
    import shutil
    TMP_DB = "/tmp/messmate.db"
    SEED_DB = os.path.join(BASE_DIR, "seed.db")
    if not os.path.exists(SEED_DB):
        SEED_DB = os.path.join(BASE_DIR, "messmate.db")
    if not os.path.exists(TMP_DB) and os.path.exists(SEED_DB):
        try:
            shutil.copy2(SEED_DB, TMP_DB)
        except Exception as e:
            print(f"Warning: could not copy seed db: {e}")
    DB_PATH = TMP_DB if os.path.exists(TMP_DB) else SEED_DB
else:
    DB_PATH = os.path.join(BASE_DIR, "messmate.db")
TZ = ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Kolkata"))
ALLOW_FEEDBACK_OUTSIDE_WINDOW = os.getenv(
    "ALLOW_FEEDBACK_OUTSIDE_WINDOW",
    "false" if os.getenv("VERCEL") or os.getenv("APP_ENV", "").lower() == "production" else "true",
).lower() in {"1", "true", "yes"}
ALLOW_MULTIPLE_FEEDBACK = os.getenv(
    "ALLOW_MULTIPLE_FEEDBACK",
    "false" if os.getenv("VERCEL") or os.getenv("APP_ENV", "").lower() == "production" else "true",
).lower() in {"1", "true", "yes"}

app = FastAPI(title="MessMate API", version="2.5.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

MEALS = [
    {"id": "breakfast", "name": "Breakfast", "start": "07:00", "end": "11:00", "time": "7:00 AM – 11:00 AM"},
    {"id": "lunch", "name": "Lunch", "start": "12:30", "end": "15:00", "time": "12:30 PM – 3:00 PM"},
    {"id": "snacks", "name": "Snacks", "start": "15:00", "end": "17:00", "time": "3:00 PM – 5:00 PM"},
    {"id": "dinner", "name": "Dinner", "start": "19:00", "end": "22:00", "time": "7:00 PM – 10:00 PM"},
]

def menu_for_date(day, dietary="non_veg"):
    day_name = day.strftime("%A").lower()
    return {m: get_official_menu(day_name, m, dietary) for m in ["breakfast", "lunch", "snacks", "dinner"]}

def connect():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return c

def migrate_user_role_constraint():
    """Allow reviewer accounts in databases created before reviewer support."""
    if not os.path.exists(DB_PATH):
        return

    c = sqlite3.connect(DB_PATH, timeout=10)
    try:
        c.execute("PRAGMA foreign_keys=OFF")
        table = c.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
        ).fetchone()
        if not table or "reviewer" in (table[0] or "").lower():
            return

        existing = {row[1] for row in c.execute("PRAGMA table_info(users)")}
        columns = [
            "id", "identifier", "name", "role", "password_hash", "register_no",
            "department", "semester", "theme", "dietary_preference",
        ]
        select_values = {
            "id": "id", "identifier": "identifier", "name": "name", "role": "role",
            "password_hash": "password_hash", "register_no": "register_no",
            "department": "department", "semester": "semester", "theme": "theme",
            "dietary_preference": "dietary_preference",
        }
        copied = [name for name in columns if name in existing]
        c.execute("""
            CREATE TABLE users_new(
                id INTEGER PRIMARY KEY,
                identifier TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('student','manager','reviewer')),
                password_hash TEXT NOT NULL,
                register_no TEXT,
                department TEXT,
                semester TEXT,
                theme TEXT DEFAULT 'light',
                dietary_preference TEXT DEFAULT 'non_veg'
            )
        """)
        c.execute(
            f"INSERT INTO users_new ({','.join(copied)}) "
            f"SELECT {','.join(select_values[name] for name in copied)} FROM users"
        )
        c.execute("DROP TABLE users")
        c.execute("ALTER TABLE users_new RENAME TO users")
        c.commit()
    finally:
        c.close()

def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 180000).hex()
    return f"{salt}${hashed}"

def check_password(password, stored):
    try:
        salt, expected = stored.split("$", 1)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 180000).hex()
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False

def init_db():
    with connect() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY,
            identifier TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student','manager','reviewer')),
            password_hash TEXT NOT NULL,
            register_no TEXT,
            department TEXT,
            semester TEXT,
            theme TEXT DEFAULT 'light',
            dietary_preference TEXT DEFAULT 'non_veg'
        );
        CREATE TABLE IF NOT EXISTS sessions(
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS feedback(
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            meal_id TEXT NOT NULL,
            service_date TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
            items_json TEXT NOT NULL DEFAULT '{}',
            comment TEXT DEFAULT '',
            category TEXT DEFAULT '',
            dietary TEXT DEFAULT 'non_veg',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS complaints(
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            meal_id TEXT NOT NULL,
            service_date TEXT NOT NULL,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Submitted',
            processed_for_ai INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS issue_groups(
            id INTEGER PRIMARY KEY,
            meal_id TEXT NOT NULL,
            service_date TEXT NOT NULL,
            issue_key TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'Open',
            response TEXT DEFAULT '',
            responded_at TEXT,
            deadline TEXT NOT NULL,
            UNIQUE(meal_id, service_date, issue_key)
        );
        CREATE TABLE IF NOT EXISTS complaint_group_links(
            complaint_id INTEGER PRIMARY KEY REFERENCES complaints(id) ON DELETE CASCADE,
            group_id INTEGER NOT NULL REFERENCES issue_groups(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS menu_items(
            id INTEGER PRIMARY KEY,
            menu_date TEXT NOT NULL,
            meal_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            dietary_type TEXT NOT NULL DEFAULT 'Veg'
        );
        CREATE TABLE IF NOT EXISTS issue_week_records(
            id INTEGER PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES issue_groups(id) ON DELETE CASCADE,
            week_key TEXT NOT NULL,
            first_seen_at TEXT NOT NULL,
            UNIQUE(group_id, week_key)
        );
        CREATE TABLE IF NOT EXISTS response_cycles(
            id INTEGER PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES issue_groups(id) ON DELETE CASCADE,
            cycle_number INTEGER NOT NULL DEFAULT 1,
            started_at TEXT NOT NULL,
            deadline TEXT NOT NULL,
            responded_at TEXT,
            response_text TEXT,
            status TEXT NOT NULL DEFAULT 'Open',
            UNIQUE(group_id, cycle_number)
        );
        CREATE TABLE IF NOT EXISTS resolutions(
            id INTEGER PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES issue_groups(id) ON DELETE CASCADE,
            trigger_type TEXT NOT NULL,
            verified_by TEXT NOT NULL,
            credit_applied INTEGER NOT NULL DEFAULT 15,
            notes TEXT DEFAULT '',
            verified_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS escalations(
            id INTEGER PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES issue_groups(id) ON DELETE CASCADE,
            reason TEXT NOT NULL,
            score_at_trigger INTEGER NOT NULL,
            triggered_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Active',
            closed_at TEXT,
            closed_by TEXT,
            closure_notes TEXT
        );
        CREATE TABLE IF NOT EXISTS risk_history(
            id INTEGER PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES issue_groups(id) ON DELETE CASCADE,
            old_score INTEGER NOT NULL,
            new_score INTEGER NOT NULL,
            reason TEXT NOT NULL,
            breakdown_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ai_processing_jobs(
            id INTEGER PRIMARY KEY,
            batch_size INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'completed',
            model TEXT,
            provider TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL
        );
        ''')

        # Check for column migrations if database already existed
        comp_cols = [r["name"] for r in c.execute("PRAGMA table_info(complaints)").fetchall()]
        if "processed_for_ai" not in comp_cols:
            c.execute("ALTER TABLE complaints ADD COLUMN processed_for_ai INTEGER DEFAULT 0")

        feed_cols = [r["name"] for r in c.execute("PRAGMA table_info(feedback)").fetchall()]
        if "dietary" not in feed_cols:
            c.execute("ALTER TABLE feedback ADD COLUMN dietary TEXT DEFAULT 'non_veg'")

        # Remove the legacy one-rating-per-user/meal/day constraint for testing.
        feedback_sql = c.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='feedback'"
        ).fetchone()["sql"] or ""
        if "UNIQUE(user_id, meal_id, service_date)" in feedback_sql.replace("\n", " "):
            c.execute("PRAGMA foreign_keys=OFF")
            c.execute("ALTER TABLE feedback RENAME TO feedback_legacy")
            c.execute("""
                CREATE TABLE feedback(
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    meal_id TEXT NOT NULL,
                    service_date TEXT NOT NULL,
                    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
                    items_json TEXT NOT NULL DEFAULT '{}',
                    comment TEXT DEFAULT '',
                    category TEXT DEFAULT '',
                    dietary TEXT DEFAULT 'non_veg',
                    created_at TEXT NOT NULL
                )
            """)
            c.execute("""
                INSERT INTO feedback(id,user_id,meal_id,service_date,rating,items_json,comment,category,dietary,created_at)
                SELECT id,user_id,meal_id,service_date,rating,items_json,comment,category,dietary,created_at
                FROM feedback_legacy
            """)
            c.execute("DROP TABLE feedback_legacy")
            c.execute("PRAGMA foreign_keys=ON")
            c.execute("CREATE INDEX IF NOT EXISTS idx_feedback_period ON feedback(meal_id, service_date)")

        user_cols = [r["name"] for r in c.execute("PRAGMA table_info(users)").fetchall()]
        if "dietary_preference" not in user_cols:
            c.execute("ALTER TABLE users ADD COLUMN dietary_preference TEXT DEFAULT 'non_veg'")

        # Migrate issue_groups columns for Risk Engine
        ig_cols = [r["name"] for r in c.execute("PRAGMA table_info(issue_groups)").fetchall()]
        new_ig_cols = [
            ("risk_score", "INTEGER DEFAULT 0"),
            ("risk_level", "TEXT DEFAULT 'LOW'"),
            ("recurrence_score", "INTEGER DEFAULT 0"),
            ("delay_score", "INTEGER DEFAULT 0"),
            ("resolution_credits", "INTEGER DEFAULT 0"),
            ("distinct_weeks", "INTEGER DEFAULT 1"),
            ("is_food_safety_hazard", "INTEGER DEFAULT 0"),
            ("category", "TEXT DEFAULT 'Food quality'"),
            ("first_reported_at", "TEXT"),
            ("last_reported_at", "TEXT"),
            ("confidence", "REAL DEFAULT 0.9")
        ]
        for col_name, col_def in new_ig_cols:
            if col_name not in ig_cols:
                c.execute(f"ALTER TABLE issue_groups ADD COLUMN {col_name} {col_def}")

        # Create performance indexes
        c.executescript('''
        CREATE INDEX IF NOT EXISTS idx_complaints_ai ON complaints(processed_for_ai);
        CREATE INDEX IF NOT EXISTS idx_complaints_period ON complaints(meal_id, service_date);
        CREATE INDEX IF NOT EXISTS idx_feedback_period ON feedback(meal_id, service_date);
        CREATE INDEX IF NOT EXISTS idx_issue_groups_period ON issue_groups(meal_id, service_date);
        CREATE INDEX IF NOT EXISTS idx_issue_groups_risk ON issue_groups(risk_score, risk_level);
        CREATE INDEX IF NOT EXISTS idx_menu_items_date ON menu_items(menu_date, meal_id);
        CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status, group_id);
        CREATE INDEX IF NOT EXISTS idx_week_records_group ON issue_week_records(group_id, week_key);
        ''')

        # Seed initial users if empty
        if c.execute("SELECT COUNT(*) n FROM users").fetchone()["n"] == 0:
            c.execute(
                "INSERT INTO users(identifier,name,role,password_hash,register_no,department,semester,dietary_preference) VALUES(?,?,?,?,?,?,?,?)",
                ("student@srm.edu", "Vatsan Kumar", "student", hash_password("Student@123"), "RA2311003010001", "Computer Science", "Semester 1", "non_veg")
            )
            c.execute(
                "INSERT INTO users(identifier,name,role,password_hash) VALUES(?,?,?,?)",
                ("manager@srm.edu", "Mess Manager", "manager", hash_password("Manager@123"))
            )

        # Seed 100 database-only demo student accounts. Passwords are random,
        # stored only as hashes, and are not exposed by the application.
        for student_number in range(1, 101):
            identifier = "demo.student@srm.edu" if student_number == 1 else f"demo.student.{student_number:03d}@srm.edu"
            exists = c.execute("SELECT 1 FROM users WHERE identifier=?", (identifier,)).fetchone()
            if not exists:
                c.execute(
                    """INSERT INTO users(identifier,name,role,password_hash,department,semester,dietary_preference)
                       VALUES(?,?,?,?,?,?,?)""",
                    (identifier, f"Demo Student {student_number:03d}", "student", hash_password(secrets.token_urlsafe(32)), "Computer Science", "Semester 1", "non_veg")
                )

        demo_students = c.execute(
            """SELECT id FROM users
               WHERE identifier=? OR identifier LIKE 'demo.student.___@srm.edu'
               ORDER BY CASE WHEN identifier='demo.student@srm.edu' THEN 0 ELSE 1 END, identifier""",
            ("demo.student@srm.edu",)
        ).fetchall()
        seed_date = datetime.now(TZ).date().isoformat()
        seed_now = datetime.now(TZ).isoformat()
        demo_feedback = {
            "breakfast": (
                "Demo feedback: Breakfast too salty",
                "Food taste",
                "Breakfast was too salty; the salt level was noticeably high and should be reduced.",
                "We are reviewing the breakfast recipe and will reduce the salt level in the next batch."
            ),
            "lunch": (
                "Demo feedback: Lunch served at low temperature",
                "Food temperature",
                "Lunch was served at a low temperature and should be kept warmer during service.",
                "The lunch team will check holding temperatures and serve the meal warmer."
            ),
            "snacks": (
                "Demo feedback: Snacks quantity too low",
                "Food quantity",
                "The snacks quantity was too low, and the serving ran short before everyone was served.",
                "We will increase the snack quantity and monitor replenishment during service."
            ),
            "dinner": (
                "Demo feedback: Dinner needs more spice",
                "Food taste",
                "Dinner had less spice than expected; please increase the spice level slightly.",
                "The dinner team will adjust the spice level while keeping the recipe balanced."
            )
        }
        if demo_students:
            for meal in MEALS:
                title, category, description, response = demo_feedback[meal["id"]]
                deadline = datetime.combine(
                    date.fromisoformat(seed_date),
                    datetime.strptime(meal["end"], "%H:%M").time(),
                    TZ
                ) + timedelta(hours=24)
                issue_key = f"demo_seed_{meal['id']}_v1"
                c.execute(
                    """INSERT OR IGNORE INTO issue_groups(
                           meal_id,service_date,issue_key,title,summary,count,status,response,
                           responded_at,deadline,category,first_reported_at,last_reported_at
                       ) VALUES(?,?,?,?,?,0,'Responded',?,?,?,?,?,?)""",
                    (meal["id"], seed_date, issue_key, title, description, response,
                     seed_now, deadline.isoformat(), category, seed_now, seed_now)
                )
                group = c.execute(
                    "SELECT id FROM issue_groups WHERE meal_id=? AND service_date=? AND issue_key=?",
                    (meal["id"], seed_date, issue_key)
                ).fetchone()
                for student in demo_students:
                    existing_rows = c.execute(
                        """SELECT id FROM complaints WHERE user_id=? AND meal_id=? AND service_date=?
                           AND title LIKE 'Demo feedback:%' ORDER BY id""",
                        (student["id"], meal["id"], seed_date)
                    ).fetchall()
                    if existing_rows:
                        complaint_id = existing_rows[0]["id"]
                        c.execute(
                            """UPDATE complaints SET category=?,title=?,description=?,status='Responded',
                               processed_for_ai=1 WHERE id=?""",
                            (category, title, description, complaint_id)
                        )
                        for duplicate in existing_rows[1:]:
                            c.execute("DELETE FROM complaints WHERE id=?", (duplicate["id"],))
                    else:
                        cur = c.execute(
                            """INSERT INTO complaints(
                                   user_id,meal_id,service_date,category,title,description,status,
                                   processed_for_ai,created_at
                               ) VALUES(?,?,?,?,?,?,'Responded',1,?)""",
                            (student["id"], meal["id"], seed_date, category, title, description, seed_now)
                        )
                        complaint_id = cur.lastrowid
                    c.execute(
                        "INSERT OR IGNORE INTO complaint_group_links(complaint_id,group_id) VALUES(?,?)",
                        (complaint_id, group["id"])
                    )
                c.execute(
                    """UPDATE issue_groups SET title=?,summary=?,count=(
                           SELECT COUNT(*) FROM complaint_group_links WHERE group_id=?
                       ),status='Responded',response=?,responded_at=?,deadline=?,category=? WHERE id=?""",
                    (title, description, group["id"], response, seed_now, deadline.isoformat(), category, group["id"])
                )
                c.execute(
                    """INSERT OR IGNORE INTO response_cycles(
                           group_id,cycle_number,started_at,deadline,responded_at,response_text,status
                       ) VALUES(?,1,?,?,?,?, 'Responded')""",
                    (group["id"], seed_now, deadline.isoformat(), seed_now, response)
                )
                c.execute(
                    """UPDATE response_cycles SET deadline=?,responded_at=?,response_text=?,status='Responded'
                       WHERE group_id=? AND cycle_number=1""",
                    (deadline.isoformat(), seed_now, response, group["id"])
                )
                week_key = get_calendar_week_key(datetime.fromisoformat(seed_date))
                c.execute(
                    "INSERT OR IGNORE INTO issue_week_records(group_id,week_key,first_seen_at) VALUES(?,?,?)",
                    (group["id"], week_key, seed_now)
                )
                reconcile_issue_risk(c, group["id"])

        # Seed reviewer if missing
        if c.execute("SELECT COUNT(*) n FROM users WHERE identifier='reviewer@srm.edu'").fetchone()["n"] == 0:
            c.execute(
                "INSERT INTO users(identifier,name,role,password_hash) VALUES(?,?,?,?)",
                ("reviewer@srm.edu", "Hostel Warden (Reviewer)", "reviewer", hash_password("Reviewer@123"))
            )

        # Seed initial week records and response cycles for existing issue groups if missing
        groups = c.execute("SELECT id, meal_id, service_date, deadline, response, responded_at, status FROM issue_groups").fetchall()
        for g in groups:
            s_date = g["service_date"]
            try:
                s_dt = datetime.fromisoformat(s_date)
                w_key = get_calendar_week_key(s_dt)
            except Exception:
                w_key = get_calendar_week_key(datetime.now(TZ))
            c.execute(
                "INSERT OR IGNORE INTO issue_week_records(group_id, week_key, first_seen_at) VALUES(?,?,?)",
                (g["id"], w_key, datetime.now(TZ).isoformat())
            )
            c.execute(
                "INSERT OR IGNORE INTO response_cycles(group_id, cycle_number, started_at, deadline, responded_at, response_text, status) VALUES(?,?,?,?,?,?,?)",
                (g["id"], 1, datetime.now(TZ).isoformat(), g["deadline"], g["responded_at"], g["response"], "Responded" if g["responded_at"] else "Open")
            )
        c.commit()

migrate_user_role_constraint()
init_db()

# Synchronously seed baseline issue groups from complaints on startup without blocking
def _seed_initial_groups():
    with connect() as c:
        unprocessed = c.execute("SELECT COUNT(*) n FROM complaints WHERE processed_for_ai=0").fetchone()["n"]
    if unprocessed > 0:
        process_pending_complaints_job(connect, {m["id"]: m for m in MEALS}, TZ)
    reconcile_all_issues(connect)

_seed_initial_groups()

class LoginBody(BaseModel):
    identifier: str
    password: str
    role: Optional[str] = None

class FeedbackBody(BaseModel):
    meal_id: str
    service_date: str
    rating: int = Field(ge=1, le=5)
    items: dict = {}
    comment: str = ""
    category: str = ""
    dietary: str = "non_veg"

class ComplaintBody(BaseModel):
    meal_id: str
    service_date: str
    category: str
    title: str
    description: str

class ResponseBody(BaseModel):
    response: str

class ResolutionBody(BaseModel):
    notes: str = ""
    trigger_type: str = "corrective_action"
    credit_amount: Optional[int] = None

class EscalationCloseBody(BaseModel):
    closure_notes: str

class SafetyOverrideBody(BaseModel):
    is_safety_hazard: bool
    reason: str = ""

class ThemeBody(BaseModel):
    theme: str

class MenuItemBody(BaseModel):
    menu_date: str
    meal_id: str
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    dietary_type: str = "Veg"
    id: Optional[int] = None

def current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please sign in to continue")
    token = authorization.split(" ", 1)[1]
    with connect() as c:
        row = c.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?",
            (token, datetime.now(TZ).isoformat())
        ).fetchone()
    if not row:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    return dict(row)

def require_role(role):
    def dependency(user=Depends(current_user)):
        if user["role"] != role:
            raise HTTPException(403, "You do not have permission to access this page")
        return user
    return dependency

def require_roles(*roles):
    def dependency(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "You do not have permission to access this action")
        return user
    return dependency

def active_meal(now=None):
    now = now or datetime.now(TZ)
    hm = now.strftime("%H:%M")
    for m in MEALS:
        if m["start"] <= hm < m["end"]:
            return m
    return None

def meal_by_id(meal_id):
    for m in MEALS:
        if m["id"] == meal_id:
            return m
    raise HTTPException(404, "Invalid meal")

def resolve_menu_items(target_date: date, meal_id: str, dietary: str = "non_veg") -> List[str]:
    d_str = target_date.isoformat()
    with connect() as c:
        dtype_filter = "Veg" if dietary == "veg" else None
        if dtype_filter:
            rows = c.execute("SELECT name FROM menu_items WHERE menu_date=? AND meal_id=? AND dietary_type='Veg' ORDER BY id", (d_str, meal_id)).fetchall()
        else:
            rows = c.execute("SELECT name FROM menu_items WHERE menu_date=? AND meal_id=? ORDER BY id", (d_str, meal_id)).fetchall()
        if rows:
            return [r["name"] for r in rows]
    
    day_name = target_date.strftime("%A")
    return get_official_menu(day_name, meal_id, dietary)

@app.post("/api/auth/login")
def login(body: LoginBody):
    ident = body.identifier.strip().lower()
    with connect() as c:
        user = c.execute("SELECT * FROM users WHERE LOWER(identifier)=? OR LOWER(register_no)=?", (ident, ident)).fetchone()
    if not user or not check_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")

    # Credential-only login determines the dashboard from the stored account role.
    if body.role in ("manager", "reviewer"):
        if user["role"] not in ("manager", "reviewer"):
            raise HTTPException(403, "This account belongs to a student login. Choose student login.")
    elif body.role and user["role"] != body.role:
        raise HTTPException(403, "This account belongs to a different login type. Choose the correct login.")

    token = secrets.token_urlsafe(36)
    expires = (datetime.now(TZ) + timedelta(days=7)).isoformat()
    with connect() as c:
        c.execute("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)", (token, user["id"], expires))
        c.commit()

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "role": user["role"],
            "identifier": user["identifier"],
            "register_no": user["register_no"],
            "department": user["department"],
            "semester": user["semester"],
            "theme": user["theme"],
            "dietary_preference": user["dietary_preference"]
        }
    }

@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return {
        "id": user["id"],
        "name": user["name"],
        "role": user["role"],
        "identifier": user["identifier"],
        "register_no": user["register_no"],
        "department": user["department"],
        "semester": user["semester"],
        "theme": user["theme"],
        "dietary_preference": user["dietary_preference"]
    }

@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        with connect() as c:
            c.execute("DELETE FROM sessions WHERE token=?", (token,))
            c.commit()
    return {"ok": True}

@app.put("/api/profile/theme")
def set_theme(body: ThemeBody, user=Depends(current_user)):
    if body.theme not in ("light", "dark"):
        raise HTTPException(400, "Theme must be light or dark")
    with connect() as c:
        c.execute("UPDATE users SET theme=? WHERE id=?", (body.theme, user["id"]))
        c.commit()
    return {"theme": body.theme}

@app.get("/api/menu/today")
def today_menu(
    dietary: str = Query(default="non_veg"),
    menu_date: Optional[str] = Query(default=None),
    user=Depends(current_user),
):
    now = datetime.now(TZ)
    current_date = now.date()
    selected_date = current_date
    if menu_date:
        try:
            selected_date = date.fromisoformat(menu_date)
        except ValueError:
            raise HTTPException(400, "Use YYYY-MM-DD for the menu date")
    is_today = selected_date == current_date
    active = active_meal(now) if is_today else None
    diet = "veg" if dietary.lower() == "veg" else "non_veg"
    selected_time = now.strftime("%H:%M") if is_today else ""
    
    meals = [
        {
            **m,
            "items": resolve_menu_items(selected_date, m["id"], diet),
            "status": "open" if active and active["id"] == m["id"] else ("upcoming" if is_today and selected_time < m["start"] else "closed")
        }
        for m in MEALS
    ]
    return {
        "date": selected_date.isoformat(),
        "date_label": selected_date.strftime("%a, %d %b %Y"),
        "active_meal": active["id"] if active else None,
        "dietary": diet,
        "meals": meals
    }

@app.get("/api/menu/complete")
def complete_menu(dietary: str = Query(default="non_veg"), user=Depends(current_user)):
    today = datetime.now(TZ).date()
    diet = "veg" if dietary.lower() == "veg" else "non_veg"
    days = []
    for i in range(7):
        target = today + timedelta(days=i)
        days.append({
            "date": target.isoformat(),
            "label": target.strftime("%A, %d %b"),
            "meals": [
                {
                    **m,
                    "items": resolve_menu_items(target, m["id"], diet)
                }
                for m in MEALS
            ]
        })
    return {"dietary": diet, "days": days}

@app.get("/api/feedback/mine")
def my_feedback(user=Depends(require_role("student"))):
    with connect() as c:
        ratings = [dict(r) for r in c.execute(
            "SELECT id,meal_id,service_date,rating,comment,category,created_at FROM feedback WHERE user_id=? ORDER BY created_at DESC",
            (user["id"],)
        ).fetchall()]

        complaints = [dict(r) for r in c.execute(
            """SELECT c.id,c.meal_id,c.service_date,c.category,c.title,c.description,c.status,c.created_at,
                      g.response,g.status as group_status
               FROM complaints c
               LEFT JOIN complaint_group_links l ON l.complaint_id=c.id
               LEFT JOIN issue_groups g ON g.id=l.group_id
               WHERE c.user_id=? ORDER BY c.created_at DESC""",
            (user["id"],)
        ).fetchall()]

    return {"ratings": ratings, "complaints": complaints}

@app.get("/api/feedback/responses")
def student_feedback_responses(user=Depends(require_role("student"))):
    """Return anonymized overall feedback summaries and manager responses by meal."""
    with connect() as c:
        rating_rows = c.execute(
            "SELECT meal_id, AVG(rating) AS average, COUNT(*) AS count FROM feedback GROUP BY meal_id"
        ).fetchall()
        issue_rows = c.execute(
            """SELECT meal_id, service_date, title, summary, count, status, response, responded_at
               FROM issue_groups
               ORDER BY service_date DESC, responded_at DESC, id DESC"""
        ).fetchall()

    ratings_by_meal = {
        row["meal_id"]: {"average": round(row["average"], 1), "count": row["count"]}
        for row in rating_rows
    }
    issues_by_meal = {meal["id"]: [] for meal in MEALS}
    for row in issue_rows:
        if row["meal_id"] not in issues_by_meal:
            continue
        issues_by_meal[row["meal_id"]].append({
            "service_date": row["service_date"],
            "title": row["title"],
            "summary": row["summary"],
            "report_count": row["count"],
            "status": row["status"],
            "response": row["response"] or "",
            "responded_at": row["responded_at"],
        })

    return {
        "meals": [
            {
                "id": meal["id"],
                "name": meal["name"],
                "rating_average": ratings_by_meal.get(meal["id"], {}).get("average"),
                "rating_count": ratings_by_meal.get(meal["id"], {}).get("count", 0),
                "feedback_count": sum(issue["report_count"] for issue in issues_by_meal[meal["id"]]),
                "feedback_summaries": issues_by_meal[meal["id"]],
            }
            for meal in MEALS
        ]
    }

@app.post("/api/feedback")
def submit_feedback(body: FeedbackBody, user=Depends(require_role("student"))):
    meal = meal_by_id(body.meal_id)
    now = datetime.now(TZ)
    service_date = now.date().isoformat()

    active = active_meal(now)
    if not ALLOW_FEEDBACK_OUTSIDE_WINDOW and (not active or active["id"] != body.meal_id):
        raise HTTPException(403, f"{meal['name']} feedback is open {meal['time']} only.")

    now_iso = now.isoformat()
    with connect() as c:
        if not ALLOW_MULTIPLE_FEEDBACK:
            existing = c.execute(
                "SELECT 1 FROM feedback WHERE user_id=? AND meal_id=? AND service_date=? LIMIT 1",
                (user["id"], body.meal_id, service_date),
            ).fetchone()
            if existing:
                raise HTTPException(400, "You have already submitted feedback for this meal today.")
        try:
            c.execute(
                """INSERT INTO feedback(user_id,meal_id,service_date,rating,items_json,comment,category,dietary,created_at)
                   VALUES(?,?,?,?,?,?,?,?,?)""",
                (user["id"], body.meal_id, service_date, body.rating, json.dumps(body.items or {}), body.comment.strip()[:1000], body.category.strip()[:60], body.dietary, now_iso)
            )
            c.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(400, "Feedback could not be saved. Check your rating and try again.")

    return {"ok": True, "message": "Thanks! Your feedback has been submitted."}

@app.post("/api/complaints")
def submit_complaint(body: ComplaintBody, background_tasks: BackgroundTasks, user=Depends(require_role("student"))):
    meal = meal_by_id(body.meal_id)
    now = datetime.now(TZ)
    service_date = now.date().isoformat()

    active = active_meal(now)
    if not active or active["id"] != body.meal_id:
        raise HTTPException(403, f"{meal['name']} feedback is open {meal['time']} only.")

    title = body.title.strip()
    desc = body.description.strip()
    if len(title) < 3:
        raise HTTPException(422, "Please provide a clearer title for your concern.")
    if len(desc) < 5:
        raise HTTPException(422, "Please share a few more details so the kitchen team can act on it.")

    now_iso = now.isoformat()
    with connect() as c:
        cur = c.execute(
            """INSERT INTO complaints(user_id,meal_id,service_date,category,title,description,status,processed_for_ai,created_at)
               VALUES(?,?,?,?,?,?,?,?,?)""",
            (user["id"], body.meal_id, service_date, body.category.strip()[:60], title[:120], desc[:2000], "Submitted", 0, now_iso)
        )
        c.commit()
        comp_id = cur.lastrowid

    # Queue Gemini AI processing in the background - zero wait for the student
    background_tasks.add_task(process_pending_complaints_job, connect, {m["id"]: m for m in MEALS}, TZ)

    return {"ok": True, "id": comp_id, "message": "Your complaint has been submitted privately."}

# ==========================================
# MANAGER & REVIEWER WORKSPACE ENDPOINTS
# ==========================================

@app.get("/api/manager/overview")
def manager_overview(user=Depends(require_roles("manager", "reviewer"))):
    reconcile_all_issues(connect)
    today = datetime.now(TZ).date().isoformat()
    with connect() as c:
        ratings = c.execute(
            "SELECT meal_id, AVG(rating) avg, COUNT(*) count FROM feedback WHERE service_date=? GROUP BY meal_id",
            (today,)
        ).fetchall()
        total_complaints = c.execute("SELECT COUNT(*) n FROM complaints WHERE service_date=?", (today,)).fetchone()["n"]
        rating_total = c.execute("SELECT COUNT(*) n FROM feedback WHERE service_date=?", (today,)).fetchone()["n"]
        pending_ai = c.execute("SELECT COUNT(*) n FROM complaints WHERE processed_for_ai=0").fetchone()["n"]
        
        # Risk score summaries
        risk_counts = c.execute(
            """SELECT 
                 SUM(CASE WHEN risk_level='LOW' THEN 1 ELSE 0 END) as low_count,
                 SUM(CASE WHEN risk_level='MEDIUM' THEN 1 ELSE 0 END) as med_count,
                 SUM(CASE WHEN risk_level='HIGH' THEN 1 ELSE 0 END) as high_count,
                 SUM(CASE WHEN risk_level='CRITICAL' THEN 1 ELSE 0 END) as crit_count
               FROM issue_groups"""
        ).fetchone()
        active_escalations = c.execute("SELECT COUNT(*) as n FROM escalations WHERE status='Active'").fetchone()["n"]

        issues = c.execute(
            "SELECT * FROM issue_groups ORDER BY risk_score DESC, CASE status WHEN 'Open' THEN 0 ELSE 1 END, count DESC LIMIT 100"
        ).fetchall()

    meal_ratings = {r["meal_id"]: {"average": round(r["avg"], 1), "count": r["count"]} for r in ratings}
    
    out = []
    now_dt = datetime.now(TZ)
    for row in issues:
        d = dict(row)
        d["overdue"] = d["status"] not in ("Responded", "Resolved") and now_dt > datetime.fromisoformat(d["deadline"])
        d["score_breakdown"] = {
            "recurrence": d.get("recurrence_score", 0),
            "delay": d.get("delay_score", 0),
            "credits": -(d.get("resolution_credits", 0)),
            "total": d.get("risk_score", 0)
        }
        out.append(d)

    ai_info = get_ai_status(pending_ai)

    return {
        "date": today,
        "total_complaints": total_complaints,
        "total_ratings": rating_total,
        "meal_ratings": meal_ratings,
        "risk_summary": {
            "low": risk_counts["low_count"] or 0,
            "medium": risk_counts["med_count"] or 0,
            "high": risk_counts["high_count"] or 0,
            "critical": risk_counts["crit_count"] or 0,
            "active_escalations": active_escalations
        },
        "issues": out,
        "ai_status": ai_info,
        "summary_mode": ai_info["provider"]
    }

@app.get("/api/manager/issues")
def get_manager_issues(
    meal_id: Optional[str] = None,
    risk_level: Optional[str] = None,
    status: Optional[str] = None,
    escalated_only: bool = False,
    user=Depends(require_roles("manager", "reviewer"))
):
    reconcile_all_issues(connect)
    with connect() as c:
        query = "SELECT * FROM issue_groups WHERE 1=1"
        params = []
        if meal_id and meal_id != "all":
            query += " AND meal_id=?"
            params.append(meal_id)
        if risk_level and risk_level != "all":
            query += " AND risk_level=?"
            params.append(risk_level.upper())
        if status and status != "all":
            query += " AND status=?"
            params.append(status)
        query += " ORDER BY risk_score DESC, count DESC"
        rows = c.execute(query, params).fetchall()

        issues_out = []
        now_dt = datetime.now(TZ)
        for r in rows:
            d = dict(r)
            esc = c.execute("SELECT * FROM escalations WHERE group_id=? AND status='Active' LIMIT 1", (d["id"],)).fetchone()
            d["escalation"] = dict(esc) if esc else None
            cycle = c.execute("SELECT * FROM response_cycles WHERE group_id=? ORDER BY cycle_number DESC LIMIT 1", (d["id"],)).fetchone()
            d["cycle"] = dict(cycle) if cycle else None
            d["overdue"] = d["status"] not in ("Responded", "Resolved") and now_dt > datetime.fromisoformat(d["deadline"])
            d["score_breakdown"] = {
                "recurrence": d.get("recurrence_score", 0),
                "delay": d.get("delay_score", 0),
                "credits": -(d.get("resolution_credits", 0)),
                "total": d.get("risk_score", 0)
            }
            if escalated_only and not d["escalation"]:
                continue
            issues_out.append(d)
    return {"issues": issues_out, "count": len(issues_out)}

@app.get("/api/manager/issues/{issue_id}")
def get_manager_issue_details(issue_id: int, user=Depends(require_roles("manager", "reviewer"))):
    with connect() as c:
        row = c.execute("SELECT * FROM issue_groups WHERE id=?", (issue_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Issue not found")
        issue = dict(row)
        cycles = [dict(r) for r in c.execute("SELECT * FROM response_cycles WHERE group_id=? ORDER BY cycle_number ASC", (issue_id,)).fetchall()]
        resolutions = [dict(r) for r in c.execute("SELECT * FROM resolutions WHERE group_id=? ORDER BY id DESC", (issue_id,)).fetchall()]
        escalations = [dict(r) for r in c.execute("SELECT * FROM escalations WHERE group_id=? ORDER BY id DESC", (issue_id,)).fetchall()]
        history = [dict(r) for r in c.execute("SELECT * FROM risk_history WHERE group_id=? ORDER BY id DESC", (issue_id,)).fetchall()]
        # Privacy-guaranteed complaints (strictly NO user_id, student name, email, or reg_no)
        complaints = [
            {
                "id": r["id"],
                "meal_id": r["meal_id"],
                "service_date": r["service_date"],
                "category": r["category"],
                "title": r["title"],
                "description": r["description"],
                "status": r["status"],
                "created_at": r["created_at"]
            }
            for r in c.execute(
                """SELECT c.id, c.meal_id, c.service_date, c.category, c.title, c.description, c.status, c.created_at
                   FROM complaints c 
                   JOIN complaint_group_links l ON l.complaint_id=c.id 
                   WHERE l.group_id=?""",
                (issue_id,)
            ).fetchall()
        ]
        issue["cycles"] = cycles
        issue["resolutions"] = resolutions
        issue["escalations"] = escalations
        issue["history"] = history
        issue["complaints"] = complaints
        issue["score_breakdown"] = {
            "recurrence": issue.get("recurrence_score", 0),
            "delay": issue.get("delay_score", 0),
            "credits": -(issue.get("resolution_credits", 0)),
            "total": issue.get("risk_score", 0)
        }
    return issue

@app.post("/api/manager/issues/{issue_id}/respond")
def respond_issue(issue_id: int, body: ResponseBody, user=Depends(require_roles("manager", "reviewer"))):
    response = body.response.strip()
    if len(response) < 3:
        raise HTTPException(422, "Please enter a valid response.")
    now = datetime.now(TZ).isoformat()
    with connect() as c:
        row = c.execute("SELECT id, deadline FROM issue_groups WHERE id=?", (issue_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Issue not found")
        # Freeze response delay for active cycle
        c.execute(
            """UPDATE response_cycles 
               SET responded_at=?, response_text=?, status='Responded'
               WHERE group_id=? AND status IN ('Open', 'Overdue')""",
            (now, response[:1500], issue_id)
        )
        c.execute(
            "UPDATE issue_groups SET response=?, responded_at=?, status='Responded' WHERE id=?",
            (response[:1500], now, issue_id)
        )
        c.execute(
            "UPDATE complaints SET status='Responded' WHERE id IN (SELECT complaint_id FROM complaint_group_links WHERE group_id=?)",
            (issue_id,)
        )
        # Recalculate score immediately
        reconcile_issue_risk(c, issue_id)
        c.commit()
    return {"ok": True, "responded_at": now, "message": "Manager response saved successfully."}

@app.post("/api/manager/issues/{issue_id}/verify-resolution")
def verify_resolution(issue_id: int, body: ResolutionBody, user=Depends(require_roles("reviewer", "manager"))):
    """
    Authorized resolution verification.
    Applies resolution credit (default 15 pts) and marks issue resolved.
    Enforces that duplicate credits cannot be granted for the same cycle/event.
    """
    credit = body.credit_amount if (body.credit_amount is not None and body.credit_amount > 0) else RESOLUTION_REDUCTION_POINTS
    now = datetime.now(TZ).isoformat()
    with connect() as c:
        issue = c.execute("SELECT * FROM issue_groups WHERE id=?", (issue_id,)).fetchone()
        if not issue:
            raise HTTPException(404, "Issue not found")
        
        # Check if already verified in this cycle
        existing = c.execute(
            "SELECT id FROM resolutions WHERE group_id=? AND trigger_type=?",
            (issue_id, body.trigger_type)
        ).fetchone()
        if existing and issue["status"] == "Resolved":
            raise HTTPException(400, f"A {body.trigger_type} resolution has already been verified for this issue.")

        c.execute(
            """INSERT INTO resolutions(group_id, trigger_type, verified_by, credit_applied, notes, verified_at)
               VALUES(?,?,?,?,?,?)""",
            (issue_id, body.trigger_type, user.get("name") or user.get("identifier"), credit, body.notes.strip(), now)
        )
        c.execute(
            "UPDATE issue_groups SET status='Resolved' WHERE id=?",
            (issue_id,)
        )
        c.execute(
            "UPDATE complaints SET status='Resolved' WHERE id IN (SELECT complaint_id FROM complaint_group_links WHERE group_id=?)",
            (issue_id,)
        )
        reconcile_issue_risk(c, issue_id)
        c.commit()
        updated = c.execute("SELECT risk_score, risk_level, status FROM issue_groups WHERE id=?", (issue_id,)).fetchone()
    return {
        "ok": True,
        "credit_applied": credit,
        "new_score": updated["risk_score"],
        "new_level": updated["risk_level"],
        "status": updated["status"],
        "message": f"Resolution verified. {credit} points credit applied."
    }

@app.get("/api/manager/escalations")
def get_escalations(status: Optional[str] = None, user=Depends(require_roles("manager", "reviewer"))):
    with connect() as c:
        query = """
            SELECT e.*, g.title as issue_title, g.meal_id, g.category, g.risk_score as current_score
            FROM escalations e
            JOIN issue_groups g ON g.id=e.group_id
            WHERE 1=1
        """
        params = []
        if status and status != "all":
            query += " AND e.status=?"
            params.append(status)
        query += " ORDER BY CASE e.status WHEN 'Active' THEN 0 ELSE 1 END, e.triggered_at DESC"
        rows = [dict(r) for r in c.execute(query, params).fetchall()]
    return {"escalations": rows, "count": len(rows)}

@app.post("/api/manager/escalations/{escalation_id}/close")
def close_escalation(escalation_id: int, body: EscalationCloseBody, user=Depends(require_roles("reviewer", "manager"))):
    notes = body.closure_notes.strip()
    if len(notes) < 5:
        raise HTTPException(422, "Please provide comprehensive closure / inspection notes.")
    now = datetime.now(TZ).isoformat()
    with connect() as c:
        esc = c.execute("SELECT * FROM escalations WHERE id=?", (escalation_id,)).fetchone()
        if not esc:
            raise HTTPException(404, "Escalation not found")
        if esc["status"] == "Closed":
            return {"ok": True, "message": "Escalation was already closed."}
        c.execute(
            """UPDATE escalations 
               SET status='Closed', closed_at=?, closed_by=?, closure_notes=?
               WHERE id=?""",
            (now, user.get("name") or user.get("identifier"), notes, escalation_id)
        )
        c.commit()
    return {"ok": True, "closed_at": now, "message": "Inspection escalation closed successfully."}

@app.post("/api/manager/issues/{issue_id}/override-safety")
def override_safety(issue_id: int, body: SafetyOverrideBody, user=Depends(require_roles("reviewer", "manager"))):
    with connect() as c:
        row = c.execute("SELECT id FROM issue_groups WHERE id=?", (issue_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Issue not found")
        c.execute(
            "UPDATE issue_groups SET is_food_safety_hazard=? WHERE id=?",
            (1 if body.is_safety_hazard else 0, issue_id)
        )
        reconcile_issue_risk(c, issue_id)
        c.commit()
        updated = c.execute("SELECT risk_score, risk_level, is_food_safety_hazard FROM issue_groups WHERE id=?", (issue_id,)).fetchone()
    return {"ok": True, "issue": dict(updated)}

@app.post("/api/manager/ai/trigger")
def trigger_ai_analysis(background_tasks: BackgroundTasks, user=Depends(require_roles("manager", "reviewer"))):
    background_tasks.add_task(process_pending_complaints_job, connect, {m["id"]: m for m in MEALS}, TZ)
    return {"ok": True, "message": "AI analysis queued in background."}

@app.get("/api/manager/ai/summary")
def manager_meal_ai_summary(meal_id: str, user=Depends(require_roles("manager", "reviewer"))):
    meal = meal_by_id(meal_id)
    today = datetime.now(TZ).date().isoformat()
    with connect() as c:
        complaints = [dict(row) for row in c.execute(
            """SELECT category,title,description,NULL AS rating FROM complaints
               WHERE meal_id=? AND service_date=? ORDER BY id""",
            (meal_id, today)
        ).fetchall()]
        ratings = [dict(row) for row in c.execute(
            """SELECT category, 'Meal rating' AS title, comment AS description, rating FROM feedback
               WHERE meal_id=? AND service_date=? ORDER BY id""",
            (meal_id, today)
        ).fetchall()]
    result = generate_meal_summary(meal["name"], complaints + ratings)
    return {**result, "meal_id": meal_id, "service_date": today, "count": len(complaints) + len(ratings)}

@app.get("/api/manager/feedback")
def manager_feedback(user=Depends(require_roles("manager", "reviewer"))):
    with connect() as c:
        groups = c.execute("SELECT * FROM issue_groups ORDER BY service_date DESC, count DESC").fetchall()
        ratings = c.execute("SELECT meal_id,service_date,AVG(rating) average,COUNT(*) count,category FROM feedback GROUP BY meal_id,service_date,category ORDER BY service_date DESC").fetchall()
        total_complaints = c.execute("SELECT COUNT(*) n FROM complaints").fetchone()["n"]
        total_ratings = c.execute("SELECT COUNT(*) n FROM feedback").fetchone()["n"]
        pending_ai = c.execute("SELECT COUNT(*) n FROM complaints WHERE processed_for_ai=0").fetchone()["n"]

    items = []
    for row in groups:
        d = dict(row)
        d.update({"type": "Complaint", "category": d.get("category") or "Grouped issue", "title": d["title"], "summary": d["summary"]})
        items.append(d)
    for row in ratings:
        d = dict(row)
        items.append({
            "id": f"rating-{d['meal_id']}-{d['service_date']}-{len(items)}",
            "type": "Rating",
            "meal_id": d["meal_id"],
            "service_date": d["service_date"],
            "category": d["category"] or "Meal rating",
            "title": f"Average rating {round(d['average'],1)}/5",
            "summary": "Aggregated meal-rating responses for this meal and category; individual comments are not shown.",
            "rating": round(d["average"], 1),
            "count": d["count"],
            "status": "Recorded"
        })

    return {
        "counts": {
            "all": len(items),
            "complaints": len(groups),
            "ratings": len(ratings),
            "total_complaints": total_complaints,
            "total_ratings": total_ratings,
            "pending_ai": pending_ai
        },
        "items": items,
        "ai_status": get_ai_status(pending_ai)
    }

@app.get("/api/manager/menu")
def manager_menu(menu_date: str, dietary: str = "non_veg", user=Depends(require_roles("manager", "reviewer"))):
    try:
        parsed_date = date.fromisoformat(menu_date)
    except ValueError:
        raise HTTPException(400, "Use YYYY-MM-DD for the menu date")
    with connect() as c:
        rows = c.execute(
            "SELECT * FROM menu_items WHERE menu_date=? ORDER BY CASE meal_id WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'snacks' THEN 3 ELSE 4 END, id",
            (menu_date,)
        ).fetchall()
        if not rows:
            day_name = parsed_date.strftime("%A")
            for meal in MEALS:
                items = get_official_menu(day_name, meal["id"], dietary)
                for item_name in items:
                    dtype = "Non-Veg" if any(w in item_name.lower() for w in ["chicken", "fish", "egg", "mutton", "omelet"]) else "Veg"
                    c.execute(
                        "INSERT INTO menu_items(menu_date,meal_id,name,description,dietary_type) VALUES(?,?,?,?,?)",
                        (menu_date, meal["id"], item_name, "Official CEG Hostel Menu", dtype)
                    )
            c.commit()
            rows = c.execute(
                "SELECT * FROM menu_items WHERE menu_date=? ORDER BY CASE meal_id WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'snacks' THEN 3 ELSE 4 END, id",
                (menu_date,)
            ).fetchall()
    return {"date": menu_date, "dietary": dietary, "items": [dict(r) for r in rows]}

@app.post("/api/manager/menu")
def save_manager_menu(body: MenuItemBody, user=Depends(require_roles("manager", "reviewer"))):
    try:
        date.fromisoformat(body.menu_date)
    except ValueError:
        raise HTTPException(400, "Use YYYY-MM-DD for the menu date")
    meal_by_id(body.meal_id)
    if body.dietary_type not in ("Veg", "Non-Veg", "Vegan"):
        raise HTTPException(400, "Invalid food type")
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Item name is required")
    with connect() as c:
        if body.id:
            exists = c.execute("SELECT id FROM menu_items WHERE id=?", (body.id,)).fetchone()
            if not exists:
                raise HTTPException(404, "Menu item not found")
            c.execute(
                "UPDATE menu_items SET menu_date=?,meal_id=?,name=?,description=?,dietary_type=? WHERE id=?",
                (body.menu_date, body.meal_id, name, body.description[:250], body.dietary_type, body.id)
            )
            item_id = body.id
        else:
            cur = c.execute(
                "INSERT INTO menu_items(menu_date,meal_id,name,description,dietary_type) VALUES(?,?,?,?,?)",
                (body.menu_date, body.meal_id, name, body.description[:250], body.dietary_type)
            )
            item_id = cur.lastrowid
        c.commit()
        row = c.execute("SELECT * FROM menu_items WHERE id=?", (item_id,)).fetchone()
    return dict(row)

@app.delete("/api/manager/menu/{item_id}")
def delete_manager_menu(item_id: int, user=Depends(require_roles("manager", "reviewer"))):
    with connect() as c:
        cur = c.execute("DELETE FROM menu_items WHERE id=?", (item_id,))
        c.commit()
    if cur.rowcount == 0:
        raise HTTPException(404, "Menu item not found")
    return {"ok": True}
