@echo off
echo Creating database backup...

:: Set your database credentials here
set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=cleantrack_user
set DB_NAME=cleantrack

:: Prompt for password (you can set PGPASSWORD environment variable instead)
set /p DB_PASSWORD=Enter database password: 

:: Create backup directory if it doesn't exist
if not exist "backups" mkdir backups

:: Generate filename with timestamp
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "MIN=%dt:~10,2%" & set "SS=%dt:~12,2%"
set "timestamp=%YYYY%%MM%%DD%_%HH%%MIN%%SS%"

set BACKUP_FILE=backups\cleantrack_backup_%timestamp%.sql

:: Set password environment variable
set PGPASSWORD=%DB_PASSWORD%

:: Create backup
echo Creating backup: %BACKUP_FILE%
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f %BACKUP_FILE%

if %errorlevel% eq 0 (
    echo Backup created successfully: %BACKUP_FILE%
) else (
    echo ERROR: Backup failed!
)

:: Clear password from environment
set PGPASSWORD=

pause 