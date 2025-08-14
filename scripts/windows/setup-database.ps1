# NeatPlan Database Setup Script
# Creates database and user for NeatPlan application

param(
    [string]$PostgresPassword = "NeatPlan2024SecurePass",
    [string]$DatabaseName = "neatplan",
    [string]$DatabaseUser = "neatplan_user",
    [string]$DatabasePassword = "NeatPlan2024SecurePass",
    [string]$PostgresUser = "postgres",
    [string]$Host = "localhost",
    [int]$Port = 5432
)

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "NeatPlan Database Setup" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Function to test PostgreSQL connection
function Test-PostgreSQLConnection {
    param($User, $Password, $Host, $Port)
    
    try {
        $env:PGPASSWORD = $Password
        $result = & psql -U $User -h $Host -p $Port -c "\l" 2>&1
        $env:PGPASSWORD = $null
        
        if ($LASTEXITCODE -eq 0) {
            return $true
        } else {
            return $false
        }
    } catch {
        return $false
    }
}

# Check if PostgreSQL is running
Write-Host "🔍 Checking PostgreSQL service..." -ForegroundColor Blue
$postgresService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue

if (-not $postgresService) {
    Write-Host "❌ PostgreSQL service not found!" -ForegroundColor Red
    Write-Host "Please run install-postgresql.ps1 first" -ForegroundColor Yellow
    exit 1
}

if ($postgresService.Status -ne "Running") {
    Write-Host "🔄 Starting PostgreSQL service..." -ForegroundColor Yellow
    try {
        Start-Service $postgresService.Name
        Start-Sleep -Seconds 5
        Write-Host "✅ PostgreSQL service started" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to start PostgreSQL service" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ PostgreSQL service is running" -ForegroundColor Green
}

# Test connection to PostgreSQL
Write-Host "🔐 Testing PostgreSQL connection..." -ForegroundColor Blue
if (-not (Test-PostgreSQLConnection -User $PostgresUser -Password $PostgresPassword -Host $Host -Port $Port)) {
    Write-Host "❌ Cannot connect to PostgreSQL!" -ForegroundColor Red
    Write-Host "Please check the postgres user password" -ForegroundColor Yellow
    Write-Host "Default password should be: $PostgresPassword" -ForegroundColor Gray
    
    # Prompt for correct password
    $newPassword = Read-Host "Enter the correct postgres password" -AsSecureString
    $PostgresPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($newPassword))
    
    if (-not (Test-PostgreSQLConnection -User $PostgresUser -Password $PostgresPassword -Host $Host -Port $Port)) {
        Write-Host "❌ Still cannot connect. Please check PostgreSQL installation." -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ PostgreSQL connection successful" -ForegroundColor Green

# Check if database already exists
Write-Host "🔍 Checking if database '$DatabaseName' exists..." -ForegroundColor Blue
$env:PGPASSWORD = $PostgresPassword
$dbExists = & psql -U $PostgresUser -h $Host -p $Port -lqt | Select-String $DatabaseName
$env:PGPASSWORD = $null

if ($dbExists) {
    Write-Host "⚠️  Database '$DatabaseName' already exists" -ForegroundColor Yellow
    $recreate = Read-Host "Do you want to recreate it? This will delete all data! (y/N)"
    
    if ($recreate -eq "y" -or $recreate -eq "Y") {
        Write-Host "🗑️  Dropping existing database..." -ForegroundColor Yellow
        $env:PGPASSWORD = $PostgresPassword
        & psql -U $PostgresUser -h $Host -p $Port -c "DROP DATABASE IF EXISTS $DatabaseName;"
        & psql -U $PostgresUser -h $Host -p $Port -c "DROP USER IF EXISTS $DatabaseUser;"
        $env:PGPASSWORD = $null
        Write-Host "✅ Existing database dropped" -ForegroundColor Green
    } else {
        Write-Host "✅ Using existing database" -ForegroundColor Green
        Write-Host ""
        Write-Host "📝 Database connection details:"
        Write-Host "   Host: $Host"
        Write-Host "   Port: $Port"
        Write-Host "   Database: $DatabaseName"
        Write-Host "   Username: $DatabaseUser"
        Write-Host "   Password: $DatabasePassword"
        Write-Host ""
        Write-Host "🔗 Connection string:"
        Write-Host "   DATABASE_URL=\""postgresql://$DatabaseUser`:$DatabasePassword@$Host`:$Port/$DatabaseName\""" -ForegroundColor Green
        exit 0
    }
}

# Create database user
Write-Host "👤 Creating database user '$DatabaseUser'..." -ForegroundColor Blue
$env:PGPASSWORD = $PostgresPassword

$createUserSQL = @"
DO `$`$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DatabaseUser') THEN
        CREATE USER $DatabaseUser WITH PASSWORD '$DatabasePassword';
    ELSE
        ALTER USER $DatabaseUser WITH PASSWORD '$DatabasePassword';
    END IF;
END
`$`$;
"@

& psql -U $PostgresUser -h $Host -p $Port -c $createUserSQL

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database user created/updated" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to create database user" -ForegroundColor Red
    $env:PGPASSWORD = $null
    exit 1
}

# Create database
Write-Host "🗄️  Creating database '$DatabaseName'..." -ForegroundColor Blue
& psql -U $PostgresUser -h $Host -p $Port -c "CREATE DATABASE $DatabaseName OWNER $DatabaseUser;"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database created" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to create database" -ForegroundColor Red
    $env:PGPASSWORD = $null
    exit 1
}

# Grant permissions
Write-Host "🔑 Granting permissions..." -ForegroundColor Blue
& psql -U $PostgresUser -h $Host -p $Port -c "GRANT ALL PRIVILEGES ON DATABASE $DatabaseName TO $DatabaseUser;"
& psql -U $PostgresUser -h $Host -p $Port -d $DatabaseName -c "GRANT ALL ON SCHEMA public TO $DatabaseUser;"
& psql -U $PostgresUser -h $Host -p $Port -d $DatabaseName -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DatabaseUser;"
& psql -U $PostgresUser -h $Host -p $Port -d $DatabaseName -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DatabaseUser;"

$env:PGPASSWORD = $null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Permissions granted" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some permissions may not have been granted properly" -ForegroundColor Yellow
}

# Test connection with new user
Write-Host "🧪 Testing connection with new user..." -ForegroundColor Blue
if (Test-PostgreSQLConnection -User $DatabaseUser -Password $DatabasePassword -Host $Host -Port $Port) {
    Write-Host "✅ User connection successful" -ForegroundColor Green
} else {
    Write-Host "⚠️  User connection test failed, but database should still work" -ForegroundColor Yellow
}

# Create or update .env file
Write-Host "📝 Creating/updating .env file..." -ForegroundColor Blue
$connectionString = "postgresql://$DatabaseUser`:$DatabasePassword@$Host`:$Port/$DatabaseName"

# Check if .env file exists
$envExists = Test-Path ".env"
$envContent = ""

if ($envExists) {
    $envContent = Get-Content ".env" -Raw
    # Update DATABASE_URL if it exists
    if ($envContent -match "DATABASE_URL=.*") {
        $envContent = $envContent -replace "DATABASE_URL=.*", "DATABASE_URL=`"$connectionString`""
    } else {
        $envContent += "`nDATABASE_URL=`"$connectionString`""
    }
} else {
    # Create new .env file from template
    if (Test-Path "scripts\windows\env-template-native.txt") {
        $envContent = Get-Content "scripts\windows\env-template-native.txt" -Raw
        $envContent = $envContent -replace 'DATABASE_URL="postgresql://neatplan_user:NeatPlan2024SecurePass@localhost:5432/neatplan"', "DATABASE_URL=`"$connectionString`""
    } else {
        $envContent = @"
# NeatPlan Environment Configuration
DATABASE_URL="$connectionString"
NEXTAUTH_SECRET="your-super-secret-key-here-32-chars-minimum"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
"@
    }
}

$envContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "✅ .env file updated" -ForegroundColor Green

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "🎉 Database Setup Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Database Details:"
Write-Host "   Host: $Host"
Write-Host "   Port: $Port"
Write-Host "   Database: $DatabaseName"
Write-Host "   Username: $DatabaseUser"
Write-Host "   Password: $DatabasePassword"
Write-Host ""
Write-Host "🔗 Connection String:"
Write-Host "   $connectionString" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next Steps:"
Write-Host "1. Review and update .env file if needed"
Write-Host "2. Run: npm install"
Write-Host "3. Run: npx prisma generate"
Write-Host "4. Run: npx prisma db push"
Write-Host "5. Run: npx prisma db seed"
Write-Host "6. Run: npm run dev"
Write-Host ""
Write-Host "🔧 Useful Commands:"
Write-Host "   Test connection: psql -U $DatabaseUser -h $Host -d $DatabaseName"
Write-Host "   pgAdmin: Use the connection details above"
Write-Host "   Reset DB: npx prisma migrate reset" 