@echo off
title Fira Project Management Server
echo ================================
echo   Fira Project Management Server
echo ================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.7+ from https://python.org
    pause
    exit /b 1
)

REM Using mini-server (no dependencies required)
echo Using mini-server (no dependencies required)...

REM Create projects directory if it doesn't exist
if not exist "projects" mkdir projects

echo.
echo Starting Fira server...
echo Server will be available at: http://localhost:8080
echo.
echo To stop the server, press Ctrl+C
echo.

REM Open the site in the default browser
start http://localhost:8080

REM Start the mini-server (no dependencies required)
set FIRA_PORT=8080
timeout /t 2 /nobreak >nul
python mini-server.py

echo.
echo Server stopped.
pause
