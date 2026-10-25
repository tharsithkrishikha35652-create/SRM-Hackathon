@echo off
start "MessMate API" cmd /k "cd backend && ..\.venv\Scripts\python.exe run.py"
start "MessMate Unified App" cmd /k "npm run dev"
echo Starting the API and unified MessMate app.
echo Student and Manager: http://localhost:5174
