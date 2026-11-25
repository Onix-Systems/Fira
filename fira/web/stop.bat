@echo off
echo Checking for Fira servers...

set "FOUND_SERVERS=0"

REM Check for Python processes first
echo Checking for Python servers...
tasklist /FI "IMAGENAME eq python.exe" | findstr "python.exe" >nul
if %errorlevel%==0 (
    echo Stopping Python servers...
    taskkill /F /IM python.exe >nul 2>&1
    if %errorlevel%==0 set "FOUND_SERVERS=1"
)

tasklist /FI "IMAGENAME eq python3.exe" | findstr "python3.exe" >nul
if %errorlevel%==0 (
    echo Stopping Python3 servers...
    taskkill /F /IM python3.exe >nul 2>&1
    if %errorlevel%==0 set "FOUND_SERVERS=1"
)

REM Kill any processes using common Fira ports
echo Checking processes on Fira ports...
netstat -aon | findstr ":5000" >nul
if %errorlevel%==0 (
    echo Stopping processes on port 5000...
    for /f "tokens=5" %%i in ('netstat -aon ^| findstr ":5000"') do (
        taskkill /F /PID %%i >nul 2>&1
        if %errorlevel%==0 set "FOUND_SERVERS=1"
    )
)

netstat -aon | findstr ":8080" >nul
if %errorlevel%==0 (
    echo Stopping processes on port 8080...
    for /f "tokens=5" %%i in ('netstat -aon ^| findstr ":8080"') do (
        taskkill /F /PID %%i >nul 2>&1
        if %errorlevel%==0 set "FOUND_SERVERS=1"
    )
)

netstat -aon | findstr ":8081" >nul
if %errorlevel%==0 (
    echo Stopping processes on port 8081...
    for /f "tokens=5" %%i in ('netstat -aon ^| findstr ":8081"') do (
        taskkill /F /PID %%i >nul 2>&1
        if %errorlevel%==0 set "FOUND_SERVERS=1"
    )
)

echo.
if "%FOUND_SERVERS%"=="1" (
    echo Fira servers stopped successfully!
) else (
    echo No Fira servers were running.
)
echo.
pause