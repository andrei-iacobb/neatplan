@echo off
echo ===============================================
echo CleanTrack Windows Server 2022 Deployment
echo ===============================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo This script must be run as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Node.js is not installed or not in PATH!
    echo Please install Node.js LTS from: https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js: OK

echo [2/6] Installing dependencies...
npm install
if %errorLevel% neq 0 (
    echo Failed to install dependencies!
    pause
    exit /b 1
)

echo [3/6] Building application...
npm run build:no-lint
if %errorLevel% neq 0 (
    echo Build failed! Trying alternative build...
    npm run build
    if %errorLevel% neq 0 (
        echo All build attempts failed!
        pause
        exit /b 1
    )
)

echo [4/6] Creating logs directory...
if not exist "logs" mkdir logs

echo [5/6] Installing PM2 globally...
npm install -g pm2
npm install -g pm2-windows-service

echo [6/6] Setting up environment...
if not exist ".env.production" (
    echo Creating .env.production template...
    echo # CleanTrack Production Configuration > .env.production
    echo # Database Configuration >> .env.production
    echo DATABASE_URL="your_production_database_url" >> .env.production
    echo. >> .env.production
    echo # Authentication >> .env.production
    echo NEXTAUTH_SECRET="your_super_secure_secret_key_here" >> .env.production
    echo NEXTAUTH_URL="http://localhost:3000" >> .env.production
    echo. >> .env.production
    echo # OpenAI ^(if using AI features^) >> .env.production
    echo OPENAI_API_KEY="your_openai_api_key" >> .env.production
    echo. >> .env.production
    echo # Environment >> .env.production
    echo NODE_ENV="production" >> .env.production
    echo PORT=3000 >> .env.production
    echo.
    echo ⚠️  IMPORTANT: Edit .env.production with your actual configuration!
    echo    - Update DATABASE_URL with your database connection string
    echo    - Set a secure NEXTAUTH_SECRET
    echo    - Update NEXTAUTH_URL with your server's IP or domain
    echo    - Add your OPENAI_API_KEY if using AI features
    echo.
)

echo ===============================================
echo Deployment Complete!
echo ===============================================
echo.
echo Next steps:
echo 1. Edit .env.production with your configuration
echo 2. Run database migrations: npx prisma migrate deploy
echo 3. Start the application: pm2 start ecosystem.config.js --env production
echo 4. Save PM2 config: pm2 save
echo 5. Install as Windows service: pm2-service-install
echo.
echo To access your application:
echo - Local: http://localhost:3000
echo - Network: http://your-server-ip:3000
echo.
echo Configure Windows Firewall:
echo New-NetFirewallRule -DisplayName "CleanTrack App" -Direction Inbound -Port 3000 -Protocol TCP -Action Allow
echo.
pause 