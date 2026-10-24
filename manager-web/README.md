# WebApp Management Interface — MessMate

Manager-only React/Vite web interface based on the supplied reference screenshot. The interface uses a fixed institutional palette sampled from the reference, a system font stack, and standard Lucide icons; it does not import generated font/theme assets.

## Pages
- Manager Login
- Dashboard and meal rating summary
- Menu Management (add, edit and delete menu items by date and meal)
- Feedback & Complaints (anonymised grouped feedback and filters)
- AI Insights (configured LLM summary mode or transparent rule-based fallback)
- Responses (manager corrective-action responses and 24-hour deadlines)
- Reports (CSV export of anonymised issue summaries)
- Settings (light/dark theme and feedback-window reference)

## Run
Start the shared API from `../backend`:

```bash
python run.py
```

Then from this folder:

```bash
npm install
npm run dev
```

Open http://localhost:5174.

Demo account: `manager@srm.edu` / `Manager@123`.

API URL can be configured with `VITE_API_URL` in `.env`.
