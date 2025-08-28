@echo off
color 0A
echo ==========================================
echo   BRAIN REACTION SPEED GAME SETUP
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Node.js is already installed!
    node --version
    echo.
    goto :install_deps
) else (
    echo [WARNING] Node.js is not installed on this system.
    echo.
    echo To run this game, you need to install Node.js first.
    echo.
    echo STEP 1: Download and Install Node.js
    echo =====================================
    echo 1. Go to: https://nodejs.org/
    echo 2. Download the LTS version (recommended)
    echo 3. Run the installer and follow the setup wizard
    echo 4. Restart this script after installation
    echo.
    echo Would you like to open the Node.js download page now?
    echo.
    set /p choice="Press Y to open download page, or any other key to continue: "
    if /i "%choice%"=="Y" (
        start https://nodejs.org/
    )
    echo.
    echo After installing Node.js, please:
    echo 1. Close this window
    echo 2. Open a new Command Prompt
    echo 3. Navigate to this folder
    echo 4. Run this script again
    echo.
    pause
    exit /b 1
)

:install_deps
echo STEP 2: Installing Game Dependencies
echo ===================================
echo Installing required packages...
echo.

call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies.
    echo Please check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Dependencies installed successfully!
echo.

:start_server
echo STEP 3: Starting Game Server
echo ============================
echo Starting the Brain Reaction Speed Game server...
echo.
echo Server will be available at: http://localhost:3000
echo.
echo Game Features:
echo - Multiplayer brain reaction speed testing
echo - User registration and login
echo - Real-time game requests and matchmaking
echo - Anti-cheat protection
echo - Statistics tracking
echo.
echo [INFO] Press Ctrl+C to stop the server
echo.

call npm start

echo.
echo Server stopped.
pause