@echo off
echo Starting NeatPlan application...
echo.

if not exist ".env" (
    echo ERROR: .env file not found!
    echo Copy env.example to .env and configure it.
    pause
    exit /b 1
)

if not exist ".next" (
    echo ERROR: Application not built!
    echo Run install.bat first.
    pause
    exit /b 1
)

echo NeatPlan is starting on http://localhost:4040
echo Press Ctrl+C to stop
echo.

call pnpm start -- -H 0.0.0.0 -p 4040
