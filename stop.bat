@echo off
echo Stopping Fira servers...

REM Kill Python processes running server.py or mini-server.py
echo Stopping Python servers...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM python3.exe >nul 2>&1

REM Alternative approach - kill by window title if the above doesn't work
taskkill /F /FI "WINDOWTITLE:*server.py*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE:*mini-server.py*" >nul 2>&1

REM Kill any processes using common Fira ports
echo Stopping processes on Fira ports...
for /f "tokens=5" %%i in ('netstat -aon ^| findstr ":5000"') do (
    taskkill /F /PID %%i >nul 2>&1
)
for /f "tokens=5" %%i in ('netstat -aon ^| findstr ":8080"') do (
    taskkill /F /PID %%i >nul 2>&1
)
for /f "tokens=5" %%i in ('netstat -aon ^| findstr ":8081"') do (
    taskkill /F /PID %%i >nul 2>&1
)

echo.
echo Fira servers stopped successfully!
echo.
pause