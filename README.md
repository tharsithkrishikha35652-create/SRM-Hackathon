# MessMate — separated student app and manager web dashboard

MessMate is now split into two independent React/Vite frontends sharing one FastAPI + SQLite backend.

## Project layout

- `student-app/` — student-facing, mobile-first app (port 5173). Includes today's menu, complete menu, meal ratings, complaints and personal feedback history. It only offers student login.
- `manager-web/` — manager-facing web dashboard (port 5174). Includes grouped complaint insights, report counts, response deadlines and manager responses. It only offers manager login.
- `backend/` — shared FastAPI API and SQLite database. Role checks remain enforced by the backend.

The two frontends have separate local session keys and separate theme preferences. They do not share dashboard navigation.

## Demo accounts

- Student: `student@srm.edu` / `Student@123`
- Manager: `manager@srm.edu` / `Manager@123`

These are local demo credentials only. Change them before any real deployment.

## Run locally (three terminals)

From the repository root, install both frontends once:

```bash
npm install
```

Then use the root scripts below, or run `start-windows.bat` on Windows.

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

API: `http://127.0.0.1:8000` · API docs: `http://127.0.0.1:8000/docs`

### 2. Student app

```bash
npm run dev:student
```

Open `http://localhost:5173`.

### 3. Manager web dashboard

```bash
npm run dev:manager
```

Build both frontends from the repository root with `npm run build`.

Open `http://localhost:5174`.

## Feedback windows

Configured for Asia/Kolkata: breakfast 07:00–11:00, lunch 12:30–15:00, snacks 16:00–18:00, dinner 19:00–22:00. The backend enforces these windows.

## Optional LLM summaries

Manager complaint aggregation has a local deterministic fallback. To enable the optional OpenAI-compatible LLM integration, configure `LLM_API_KEY`, `LLM_BASE_URL` and `LLM_MODEL` in the backend environment.

## Scope and limitations

- Student and manager UIs are separate frontends but use the same backend and database.
- Demo menu and feedback data are fictional.
- Official college menu integration and the future risk-score formula are not implemented.
- External meal photos require an internet connection.
- This is a hackathon demo, not a production-hardened deployment.
