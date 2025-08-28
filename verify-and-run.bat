@echo off
color 0A
echo ==========================================
echo   NODE.JS INSTALLATION VERIFICATION
echo ==========================================
echo.

echo Checking Node.js installation...
echo.

REM Check Node.js version
echo [1/3] Checking Node.js...
node --version 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Node.js is installed!
    for /f "tokens=*" %%i in ('node --version') do echo    Version: %%i
) else (
    echo ❌ Node.js not found!
    echo.
    echo Please install Node.js first:
    echo 1. Go to https://nodejs.org/
    echo 2. Download the LTS version
    echo 3. Run the installer
    echo 4. Restart this script
    echo.
    pause
    exit /b 1
)

echo.

REM Check npm version
echo [2/3] Checking npm...
npm --version 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ npm is available!
    for /f "tokens=*" %%i in ('npm --version') do echo    Version: %%i
) else (
    echo ❌ npm not found!
    echo.
    pause
    exit /b 1
)

echo.

REM Install dependencies
echo [3/3] Installing game dependencies...
echo.
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies!
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ All dependencies installed successfully!
echo.

echo ==========================================
echo   STARTING BRAIN REACTION SPEED GAME
echo ==========================================
echo.
echo 🎮 Game Features:
echo   • Real-time multiplayer (2 players)
echo   • Brain reaction speed testing
echo   • Anti-cheat protection
echo   • Statistics tracking
echo   • Secure user accounts
echo.
echo 🌐 Server will start at: http://localhost:3000
echo.
echo 💡 To test multiplayer:
echo   1. Open two browser tabs
echo   2. Create different accounts
echo   3. Send game requests
echo   4. Play and compete!
echo.
echo 🛑 Press Ctrl+C to stop the server
echo.
echo Starting server...
echo.

call npm start

echo.
echo 🛑 Server stopped.
pause