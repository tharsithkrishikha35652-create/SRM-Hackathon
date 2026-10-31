# MessMate — Student App + WebApp Management Interface

MessMate serves student and manager dashboards from one React/Vite app at `http://localhost:5174/`, backed by one FastAPI + SQLite API. The login response determines which dashboard is rendered.

- `student-app/` — the only frontend application. Students and managers sign in here; the account role selects the dashboard.
- `manager-web/src/` — manager dashboard component and its isolated styles, imported by the unified app; it has no separate app entry point or dev server.
- `backend/` — shared API, authentication, SQLite persistence, menu management, anonymised complaint aggregation, manager responses and deadlines.

## Manager web interface
The manager frontend includes Dashboard, Today's Feedback, Escalations, Complete Menu, Feedback History and Settings. Manager and reviewer access is assigned only through the backend's Firebase email allowlists.

## Firebase Authentication
Email/password sign-in and student registration use Firebase Authentication. Add authorized manager and reviewer emails to the backend-only `FIREBASE_MANAGER_EMAILS` and `FIREBASE_REVIEWER_EMAILS` allowlists. Configure Firebase Admin credentials in the backend environment using Application Default Credentials, `GOOGLE_APPLICATION_CREDENTIALS`, or `FIREBASE_SERVICE_ACCOUNT_JSON`; never commit service-account credentials.

Enable Email/Password in the Firebase Console and configure the project's authorized domains. New student accounts must verify their email before using the app. Existing legacy demo accounts and synthetic feedback are removed during backend initialization.

## Run locally

From the repository root, install dependencies once:

```bash
npm install
```

Then use the root scripts below, or run `start-windows.bat` on Windows.

### Run the app and API together
```bash
npm run dev
```
The Vite server starts FastAPI automatically on a private, dynamically assigned loopback port and proxies `/api` through port 5174. No separate API window or port 8000 is needed. Open `http://localhost:5174`, then sign in with a student or manager account. For student menu testing, change the visible “Menu day” date input on the student homepage.

The backend Python dependencies must be installed once from `backend/requirements.txt` into the repository or backend virtual environment. The development server detects `.venv` automatically; set `MESSMATE_PYTHON` if using another interpreter.

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
- External meal photographs require an internet connection.
- This is a hackathon MVP, not a production-hardened deployment.
