@echo off
start "MessMate API" cmd /k "cd backend && python run.py"
start "MessMate Student App" cmd /k "npm run dev:student"
start "MessMate Manager Web" cmd /k "npm run dev:manager"
echo Starting API, Student App, and Manager Web in separate windows.
echo Student: http://localhost:5173
echo Manager: http://localhost:5174
