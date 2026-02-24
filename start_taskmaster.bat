@echo off
echo ========================================
echo    🚀 TaskMaster Pro Launcher
echo ========================================
echo.

:: Start MongoDB (if not running)
echo 📦 Checking MongoDB...
net start MongoDB 2>nul || echo MongoDB already running

:: Start Backend
echo 📡 Starting backend server...
cd /d C:\Desktop\TaskMaster\backend
start cmd /k "venv\Scripts\activate && python app.py"

:: Wait for backend to initialize
echo ⏳ Waiting for backend to start...
timeout /t 3 /nobreak >nul

:: Start Frontend and open browser
echo 🌐 Starting frontend server...
cd /d C:\Desktop\TaskMaster\frontend
start cmd /k "python -m http.server 5500"

:: Open browser automatically
echo 📱 Opening TaskMaster Pro in your browser...
timeout /t 2 /nobreak >nul
start http://localhost:5500

echo.
echo ========================================
echo ✅ TaskMaster Pro is now running!
echo 📍 Website: http://localhost:5500
echo 📡 Backend: http://localhost:5000
echo ========================================
echo.
echo Press any key to close this window...
pause >nul