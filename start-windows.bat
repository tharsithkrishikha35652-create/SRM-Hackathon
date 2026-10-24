@echo off
start "MessMate API" cmd /k "cd backend && python run.py"
start "MessMate Student App" cmd /k "cd student-app && npm install && npm run dev"
start "MessMate Manager Web" cmd /k "cd manager-web && npm install && npm run dev"
echo Starting API, Student App, and Manager Web in separate windows.
echo Student: http://localhost:5173
echo Manager: http://localhost:5174
