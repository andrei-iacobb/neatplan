# CleanTrack Windows Server 2022 PowerShell Deployment Script
# Run this script as Administrator

param(
    [string]$ServerIP = "",
    [string]$Port = "3000",
    [string]$Domain = "",
    [switch]$EnableSSL = $false,
    [switch]$InstallIIS = $false
)

# Function to check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Function to get server IP automatically
function Get-ServerIP {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -ne "Loopback Pseudo-Interface 1" } | Select-Object -First 1).IPAddress
    return $ip
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "CleanTrack Windows Server 2022 Deployment" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check administrator privileges
if (-not (Test-Administrator)) {
    Write-Host "❌ This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running as Administrator" -ForegroundColor Green

# Auto-detect server IP if not provided
if ([string]::IsNullOrEmpty($ServerIP)) {
    $ServerIP = Get-ServerIP
    Write-Host "🔍 Auto-detected Server IP: $ServerIP" -ForegroundColor Yellow
}

# Step 1: Check Node.js
Write-Host "[1/8] Checking Node.js installation..." -ForegroundColor Blue
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js LTS from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Step 2: Install dependencies
Write-Host "[2/8] Installing dependencies..." -ForegroundColor Blue
try {
    npm install
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install dependencies!" -ForegroundColor Red
    exit 1
}

# Step 3: Build application
Write-Host "[3/8] Building application..." -ForegroundColor Blue
try {
    npm run build
    Write-Host "✅ Application built successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Create logs directory
Write-Host "[4/8] Creating logs directory..." -ForegroundColor Blue
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}
Write-Host "✅ Logs directory ready" -ForegroundColor Green

# Step 5: Install PM2
Write-Host "[5/8] Installing PM2..." -ForegroundColor Blue
try {
    npm install -g pm2
    npm install -g pm2-windows-service
    Write-Host "✅ PM2 installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install PM2!" -ForegroundColor Red
    exit 1
}

# Step 6: Configure environment
Write-Host "[6/8] Configuring environment..." -ForegroundColor Blue

# Determine NEXTAUTH_URL
$nextAuthUrl = ""
if (-not [string]::IsNullOrEmpty($Domain)) {
    if ($EnableSSL) {
        $nextAuthUrl = "https://$Domain"
    } else {
        $nextAuthUrl = "http://$Domain"
    }
} else {
    $nextAuthUrl = "http://$ServerIP`:$Port"
}

# Create .env.production if it doesn't exist
if (-not (Test-Path ".env.production")) {
    $envContent = @"
# CleanTrack Production Configuration
# Generated on $(Get-Date)

# Database Configuration
DATABASE_URL="your_production_database_url"

# Authentication
NEXTAUTH_SECRET="your_super_secure_secret_key_here"
NEXTAUTH_URL="$nextAuthUrl"

# OpenAI (if using AI features)
OPENAI_API_KEY="your_openai_api_key"

# Environment
NODE_ENV="production"
PORT=$Port
"@
    
    $envContent | Out-File -FilePath ".env.production" -Encoding UTF8
    Write-Host "✅ Created .env.production with NEXTAUTH_URL: $nextAuthUrl" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env.production already exists, skipping creation" -ForegroundColor Yellow
}

# Step 7: Configure Windows Firewall
Write-Host "[7/8] Configuring Windows Firewall..." -ForegroundColor Blue
try {
    $existingRule = Get-NetFirewallRule -DisplayName "CleanTrack App" -ErrorAction SilentlyContinue
    if (-not $existingRule) {
        New-NetFirewallRule -DisplayName "CleanTrack App" -Direction Inbound -Port $Port -Protocol TCP -Action Allow | Out-Null
        Write-Host "✅ Firewall rule created for port $Port" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Firewall rule already exists" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not configure firewall automatically" -ForegroundColor Yellow
    Write-Host "   Run manually: New-NetFirewallRule -DisplayName 'CleanTrack App' -Direction Inbound -Port $Port -Protocol TCP -Action Allow" -ForegroundColor Gray
}

# Step 8: Optional IIS setup
if ($InstallIIS) {
    Write-Host "[8/8] Installing IIS (optional)..." -ForegroundColor Blue
    try {
        Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-HttpRedirection, IIS-ApplicationDevelopment -All | Out-Null
        Write-Host "✅ IIS installed (you may need to restart)" -ForegroundColor Green
        Write-Host "   Don't forget to install URL Rewrite and ARR modules" -ForegroundColor Yellow
    } catch {
        Write-Host "⚠️  Could not install IIS automatically" -ForegroundColor Yellow
    }
} else {
    Write-Host "[8/8] Skipping IIS installation..." -ForegroundColor Blue
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Edit .env.production with your actual configuration:"
Write-Host "   - Update DATABASE_URL with your database connection"
Write-Host "   - Set a secure NEXTAUTH_SECRET (use: openssl rand -base64 32)"
Write-Host "   - Verify NEXTAUTH_URL: $nextAuthUrl"
Write-Host "   - Add your OPENAI_API_KEY if using AI features"
Write-Host ""
Write-Host "2. Run database migrations:"
Write-Host "   npx prisma migrate deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start the application:"
Write-Host "   pm2 start ecosystem.config.js --env production" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Save PM2 configuration:"
Write-Host "   pm2 save" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Install PM2 as Windows Service:"
Write-Host "   pm2-service-install" -ForegroundColor Gray
Write-Host "   pm2-service-start" -ForegroundColor Gray
Write-Host ""

Write-Host "🌐 Access URLs:" -ForegroundColor Yellow
Write-Host "   Local: http://localhost:$Port"
Write-Host "   Network: $nextAuthUrl"
Write-Host ""

Write-Host "📊 Useful Commands:" -ForegroundColor Yellow
Write-Host "   View logs: pm2 logs cleantrack"
Write-Host "   Restart app: pm2 restart cleantrack"
Write-Host "   Stop app: pm2 stop cleantrack"
Write-Host "   App status: pm2 status"
Write-Host ""

Write-Host "🔧 The app now uses environment-agnostic URL handling!" -ForegroundColor Green
Write-Host "   Thanks to the url-utils.ts changes, it will automatically" -ForegroundColor Green
Write-Host "   work with whatever NEXTAUTH_URL you configure." -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to continue..." 