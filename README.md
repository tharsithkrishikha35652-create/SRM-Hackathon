# MessMate — Student App + WebApp Management Interface

MessMate serves student and manager dashboards from one React/Vite app at `http://localhost:5174/`, backed by one FastAPI + SQLite API. The login response determines which dashboard is rendered.

- `student-app/` — the only frontend application. Students and managers sign in here; the account role selects the dashboard.
- `manager-web/src/` — manager dashboard component and its isolated styles, imported by the unified app; it has no separate app entry point or dev server.
- `backend/` — shared API, authentication, SQLite persistence, menu management, anonymised complaint aggregation, manager responses and deadlines.

## Manager web interface
The manager frontend includes Manager Login, Dashboard, Menu Management, Feedback & Complaints, AI Insights, Responses, Reports and Settings. The UI uses a palette sampled from the supplied reference image, a standard system font stack, and standard Lucide icons; no generated font/theme assets are imported.

## Demo accounts
- Student: `student@srm.edu` / `Student@123`
- Manager: `manager@srm.edu` / `Manager@123`

These are local demonstration credentials only.

## Run locally

From the repository root, install dependencies once:

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

### 2. Unified app
```bash
npm run dev
```
Open `http://localhost:5174`. Sign in with either a student or manager account; the backend identifies the account role and opens the matching dashboard. For student menu testing, change the visible “Menu day” date input on the student homepage.

Build the unified app from the repository root with `npm run build`.

Windows users can use `start-windows.bat` to launch the API and unified app. See `IMPLEMENTATION_REPORT.md` for checks performed and remaining verification limits.

## Manager menu API
The manager can view menu items by date and meal, add new items, edit existing items and delete items. Menu entries are stored in SQLite. Manager feedback views return grouped issue summaries and anonymised rating aggregates, not individual student identities.

## Feedback windows
Asia/Kolkata: breakfast 07:00–11:00, lunch 12:30–15:00, snacks 15:00–17:00, dinner 19:00–22:00. The backend enforces these windows.

## AI summaries
The manager issue summaries use the configured LLM integration when an API key is available. Otherwise, the app uses a deterministic rule-based fallback. The interface labels the mode honestly.

## Limitations
- The college's official menu API is not connected.
- The future risk-score formula is not implemented because its constraints are not yet defined.
- Demo records are fictional. External meal photographs require an internet connection.
- This is a hackathon MVP, not a production-hardened deployment.
