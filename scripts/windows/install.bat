@echo off
echo ========================================
echo NeatPlan Windows Installation Script
echo ========================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found: 
node --version

echo.
echo Installing npm dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate Prisma client
    pause
    exit /b 1
)

echo.
echo Setting up database schema...
call npx prisma db push
if %errorlevel% neq 0 (
    echo ERROR: Failed to setup database schema
    echo Please check your DATABASE_URL in .env file
    pause
    exit /b 1
)

echo.
echo Seeding database with sample data...
call npx prisma db seed
if %errorlevel% neq 0 (
    echo WARNING: Failed to seed database (this might be okay if data already exists)
)

echo.
echo Building application...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build application
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation completed successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure your .env file is configured correctly
echo 2. Run 'start.bat' to start the application
echo 3. Access the application at http://localhost:3000
echo.
echo Default login credentials:
echo Admin: admin@neatplan.com / admin123
echo Cleaner: cleaner@neatplan.com / cleaner123
echo.
pause 