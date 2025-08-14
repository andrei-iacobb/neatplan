# NeatPlan PostgreSQL Installation Script for Windows
# Run as Administrator

param(
    [string]$PostgresPassword = "NeatPlan2024SecurePass",
    [string]$InstallPath = "C:\Program Files\PostgreSQL\15",
    [switch]$SkipDownload = $false,
    [switch]$Silent = $false
)

# Function to check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "NeatPlan PostgreSQL Installation" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check administrator privileges
if (-not (Test-Administrator)) {
    Write-Host "❌ This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running as Administrator" -ForegroundColor Green

# Check if PostgreSQL is already installed
$postgresService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($postgresService) {
    Write-Host "✅ PostgreSQL is already installed!" -ForegroundColor Green
    Write-Host "Service status: $($postgresService.Status)" -ForegroundColor Yellow
    
    if ($postgresService.Status -eq "Running") {
        Write-Host "✅ PostgreSQL service is running" -ForegroundColor Green
    } else {
        Write-Host "🔄 Starting PostgreSQL service..." -ForegroundColor Yellow
        Start-Service $postgresService.Name
        Write-Host "✅ PostgreSQL service started" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "📝 Next steps:"
    Write-Host "1. Run setup-database.ps1 to create the NeatPlan database"
    Write-Host "2. Or manually create database using pgAdmin"
    exit 0
}

Write-Host "🔍 PostgreSQL not found, proceeding with installation..." -ForegroundColor Yellow

# Check if Chocolatey is available
$chocoInstalled = Get-Command choco -ErrorAction SilentlyContinue
if ($chocoInstalled -and -not $SkipDownload) {
    Write-Host "📦 Using Chocolatey to install PostgreSQL..." -ForegroundColor Blue
    try {
        $chocoArgs = "install postgresql --params ""/Password:$PostgresPassword /Port:5432"""
        if ($Silent) {
            $chocoArgs += " -y"
        }
        
        Invoke-Expression "choco $chocoArgs"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ PostgreSQL installed successfully via Chocolatey!" -ForegroundColor Green
            
            # Wait for service to start
            Write-Host "⏳ Waiting for PostgreSQL service to start..." -ForegroundColor Yellow
            Start-Sleep -Seconds 10
            
            # Check service status
            $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
            if ($service -and $service.Status -eq "Running") {
                Write-Host "✅ PostgreSQL service is running!" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Service may need manual start" -ForegroundColor Yellow
            }
            
            Write-Host ""
            Write-Host "📝 Installation complete! Default settings:"
            Write-Host "   Host: localhost"
            Write-Host "   Port: 5432"
            Write-Host "   Database: postgres"
            Write-Host "   Username: postgres"
            Write-Host "   Password: $PostgresPassword"
            Write-Host ""
            Write-Host "🔄 Next: Run setup-database.ps1 to create NeatPlan database"
            exit 0
        }
    } catch {
        Write-Host "⚠️  Chocolatey installation failed, falling back to manual download" -ForegroundColor Yellow
    }
}

# Manual download and installation
Write-Host "📥 Downloading PostgreSQL installer..." -ForegroundColor Blue

$downloadUrl = "https://get.enterprisedb.com/postgresql/postgresql-15.8-1-windows-x64.exe"
$installerPath = "$env:TEMP\postgresql-installer.exe"

try {
    # Download installer
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath
    Write-Host "✅ Download complete" -ForegroundColor Green
    
    # Prepare installation arguments
    $installArgs = @(
        "--mode", "unattended"
        "--unattendedmodeui", "none"
        "--superpassword", $PostgresPassword
        "--servicename", "postgresql-x64-15"
        "--serviceaccount", "postgres"
        "--servicepassword", $PostgresPassword
        "--serverport", "5432"
        "--locale", "English, United States"
        "--datadir", "$InstallPath\data"
        "--prefix", $InstallPath
    )
    
    Write-Host "🚀 Installing PostgreSQL (this may take several minutes)..." -ForegroundColor Blue
    Write-Host "   Installation path: $InstallPath" -ForegroundColor Gray
    Write-Host "   Service name: postgresql-x64-15" -ForegroundColor Gray
    Write-Host "   Port: 5432" -ForegroundColor Gray
    
    # Run installer
    $process = Start-Process -FilePath $installerPath -ArgumentList $installArgs -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "✅ PostgreSQL installed successfully!" -ForegroundColor Green
        
        # Add to PATH if not already there
        $pgBinPath = "$InstallPath\bin"
        $currentPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::Machine)
        
        if ($currentPath -notlike "*$pgBinPath*") {
            Write-Host "🔧 Adding PostgreSQL to system PATH..." -ForegroundColor Blue
            $newPath = "$currentPath;$pgBinPath"
            [Environment]::SetEnvironmentVariable("PATH", $newPath, [EnvironmentVariableTarget]::Machine)
            Write-Host "✅ PATH updated" -ForegroundColor Green
        }
        
        # Wait for service to start
        Write-Host "⏳ Waiting for PostgreSQL service to start..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
        
        # Check service status
        $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
        if ($service) {
            if ($service.Status -eq "Running") {
                Write-Host "✅ PostgreSQL service is running!" -ForegroundColor Green
            } else {
                Write-Host "🔄 Starting PostgreSQL service..." -ForegroundColor Yellow
                Start-Service $service.Name
                Write-Host "✅ PostgreSQL service started!" -ForegroundColor Green
            }
        }
        
        # Cleanup installer
        Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
        
        Write-Host ""
        Write-Host "===============================================" -ForegroundColor Cyan
        Write-Host "🎉 PostgreSQL Installation Complete!" -ForegroundColor Green
        Write-Host "===============================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "📋 Installation Details:"
        Write-Host "   Host: localhost"
        Write-Host "   Port: 5432"
        Write-Host "   Superuser: postgres"
        Write-Host "   Password: $PostgresPassword"
        Write-Host "   Service: postgresql-x64-15"
        Write-Host "   Install Path: $InstallPath"
        Write-Host ""
        Write-Host "🔧 Management Tools:"
        Write-Host "   pgAdmin: Start Menu > PostgreSQL > pgAdmin 4"
        Write-Host "   Command Line: psql -U postgres -h localhost"
        Write-Host ""
        Write-Host "📝 Next Steps:"
        Write-Host "1. Run: .\scripts\windows\setup-database.ps1"
        Write-Host "2. Or manually create NeatPlan database using pgAdmin"
        Write-Host ""
        Write-Host "🔍 Test Connection:"
        Write-Host "   psql -U postgres -h localhost -c '\l'"
        
    } else {
        throw "Installation failed with exit code: $($process.ExitCode)"
    }
    
} catch {
    Write-Host "❌ Installation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Manual Installation Steps:" -ForegroundColor Yellow
    Write-Host "1. Download PostgreSQL from: https://www.postgresql.org/download/windows/"
    Write-Host "2. Run the installer as Administrator"
    Write-Host "3. Set postgres user password to: $PostgresPassword"
    Write-Host "4. Use default port: 5432"
    Write-Host "5. After installation, run setup-database.ps1"
    
    # Cleanup failed download
    if (Test-Path $installerPath) {
        Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
    }
    
    exit 1
}

Write-Host ""
Write-Host "✅ Ready for NeatPlan database setup!" -ForegroundColor Green 