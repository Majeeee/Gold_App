@echo off
chcp 65001 >nul
title Gold App - Setup (Gradle)

echo.
echo  ╔══════════════════════════════════════╗
echo  ║      GOLD APP SETUP · GRADLE         ║
echo  ╚══════════════════════════════════════╝
echo.

:: ── Check prerequisites ───────────────────────────────────────
echo [1/5] Checking prerequisites...

where java >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Java 21 not found → adoptium.net
    pause & exit /b 1
)

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker not found → docker.com
    pause & exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found → nodejs.org
    pause & exit /b 1
)

echo [OK] All prerequisites found
echo.

:: ── Create .env ───────────────────────────────────────────────
echo [2/5] Setting up .env...
if not exist .env (
    (
        echo DB_USER=goldapp
        echo DB_PASS=goldapp123
        echo DB_NAME=golddb
        echo JWT_SECRET=goldapp-super-secret-key-must-be-at-least-32-chars!!
        echo TELEGRAM_BOT_TOKEN=YOUR_TOKEN
        echo TELEGRAM_BOT_USERNAME=YOUR_BOT
        echo MAIL_USERNAME=YOUR_GMAIL
        echo MAIL_PASSWORD=YOUR_APP_PASSWORD
        echo FRED_API_KEY=YOUR_FRED_KEY
        echo BINANCE_API_KEY=YOUR_KEY
        echo BINANCE_SECRET_KEY=YOUR_SECRET
    ) > .env
    echo [OK] .env created - Edit API keys: notepad .env
) else (
    echo [OK] .env exists
)
echo.

:: ── Install web dependencies ──────────────────────────────────
echo [3/5] Installing web dependencies...
if exist web (
    cd web
    call npm install --silent
    echo [OK] Web dependencies installed
    cd ..
)

:: ── Install mobile dependencies ───────────────────────────────
if exist mobile (
    cd mobile
    call npm install --silent
    echo [OK] Mobile dependencies installed
    cd ..
)
echo.

:: ── Build backend with Gradle ─────────────────────────────────
echo [4/5] Building backend with Gradle...
if exist backend (
    cd backend
    if exist gradlew.bat (
        call gradlew.bat bootJar -x test --no-daemon
    ) else (
        call gradle bootJar -x test
    )
    if %errorlevel% neq 0 (
        echo [WARN] Gradle build failed - check build.gradle
    ) else (
        echo [OK] Backend built → build/libs/gold-backend.jar
    )
    cd ..
)
echo.

:: ── Start Docker ──────────────────────────────────────────────
echo [5/5] Starting Docker...
docker compose down --remove-orphans 2>nul
docker compose up -d --build
if %errorlevel% neq 0 (
    echo [ERROR] Docker failed. Is Docker Desktop running?
    pause & exit /b 1
)

timeout /t 10 /nobreak >nul

echo.
echo ══════════════════════════════════════════
echo   Setup Complete!
echo ══════════════════════════════════════════
echo.
echo   Backend:  http://localhost:8080
echo   Web:      cd web ^& npm run dev
echo   Mobile:   cd mobile ^& npx expo start
echo   Admin:    admin@gold.se / Admin123!
echo.
echo   Edit API keys: notepad .env
echo.
pause
