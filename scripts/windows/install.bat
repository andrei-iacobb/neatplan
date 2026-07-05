@echo off
echo ========================================
echo NeatPlan Windows Installation Script
echo ========================================
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js 18+ is required. Install from https://nodejs.org/
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing pnpm...
    call npm install -g pnpm
)

echo Node.js:
node --version
echo.

echo Installing dependencies...
call pnpm install
if %errorlevel% neq 0 exit /b 1

echo.
echo Validating environment...
call pnpm run validate-env
if %errorlevel% neq 0 (
    echo Fix .env before continuing. See env.example.
    pause
    exit /b 1
)

echo.
echo Generating Prisma client...
call pnpm exec prisma generate
if %errorlevel% neq 0 exit /b 1

echo.
echo Applying database schema...
call pnpm exec prisma migrate deploy
if %errorlevel% neq 0 (
    call pnpm exec prisma db push
)

echo.
echo Seeding database (optional)...
call pnpm run prisma:seed
if %errorlevel% neq 0 (
    echo WARNING: Seed skipped or failed — may already exist.
)

echo.
echo Building application...
call pnpm run build:no-lint
if %errorlevel% neq 0 exit /b 1

echo.
echo ========================================
echo Installation complete
echo ========================================
echo.
echo 1. Confirm .env is configured
echo 2. Run start.bat
echo 3. Open http://localhost:4040
echo 4. Use credentials from prisma/seed.ts and change passwords immediately
echo.
pause
