@echo off
echo Starting NeatPlan application...
echo.

:: Check if .env file exists
if not exist ".env" (
    echo ERROR: .env file not found!
    echo Please create a .env file with your configuration.
    echo See .env.example for reference.
    pause
    exit /b 1
)

:: Check if application is built
if not exist ".next" (
    echo ERROR: Application not built!
    echo Please run 'install.bat' first to build the application.
    pause
    exit /b 1
)

echo NeatPlan is starting...
echo Access the application at: http://localhost:3000
echo Press Ctrl+C to stop the application
echo.

:: Start the application
call npm start 