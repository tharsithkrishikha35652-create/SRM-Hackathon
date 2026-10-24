@echo off
start "MessMate Manager Web" cmd /k "cd /d %~dp0 && npm install && npm run dev"
echo Manager web: http://localhost:5174
echo Ensure the FastAPI backend is running at http://127.0.0.1:8000
