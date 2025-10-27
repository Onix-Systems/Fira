@echo off
REM Script to generate changelog using git-cliff
REM Usage: generate-changelog.bat [tag]
REM If tag is not provided, generates changelog for all unreleased commits

setlocal enabledelayedexpansion

REM Check if git-cliff is installed
where git-cliff >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: git-cliff is not installed
    echo.
    echo Install git-cliff using one of the following methods:
    echo.
    echo 1. Using cargo ^(Rust^):
    echo    cargo install git-cliff
    echo.
    echo 2. Using pre-built binaries:
    echo    Visit: https://github.com/orhun/git-cliff/releases
    echo    Download git-cliff-x86_64-pc-windows-msvc.zip
    echo    Extract and add to PATH
    echo.
    echo 3. Using package managers:
    echo    - Scoop: scoop install git-cliff
    echo    - Chocolatey: choco install git-cliff
    echo.
    exit /b 1
)

REM Check if cliff.toml exists
if not exist "cliff.toml" (
    echo Error: cliff.toml configuration file not found
    exit /b 1
)

echo Generating changelog...

if "%~1"=="" (
    REM Generate unreleased changelog
    echo Generating unreleased changes...
    git-cliff --unreleased --tag unreleased -o CHANGELOG.md
) else (
    REM Generate changelog up to specified tag
    echo Generating changelog up to tag: %~1
    git-cliff --tag "%~1" -o CHANGELOG.md
)

if %ERRORLEVEL% equ 0 (
    echo Changelog generated successfully: CHANGELOG.md
) else (
    echo Error: Failed to generate changelog
    exit /b 1
)

endlocal
