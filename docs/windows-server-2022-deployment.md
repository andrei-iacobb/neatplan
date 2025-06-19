# Windows Server 2022 Deployment Guide

## Prerequisites

### 1. Install Node.js
```powershell
# Download and install Node.js LTS (20.x or later)
# From: https://nodejs.org/en/download/

# Verify installation
node --version
npm --version
```

### 2. Install Git (if needed)
```powershell
# Download from: https://git-scm.com/download/win
# Or use winget:
winget install Git.Git
```

### 3. Install PM2 for Process Management
```powershell
npm install -g pm2
npm install -g pm2-windows-service
```

## Deployment Steps

### 1. Clone and Setup Application
```powershell
# Clone your repository
git clone <your-repo-url> C:\inetpub\cleantrack
cd C:\inetpub\cleantrack

# Install dependencies
npm install

# Build the application
npm run build
```

### 2. Configure Environment Variables

Create `C:\inetpub\cleantrack\.env.production`:
```env
# Database Configuration
DATABASE_URL="your_production_database_url"

# Authentication
NEXTAUTH_SECRET="your_super_secure_secret_key_here"
NEXTAUTH_URL="http://your-server-ip:3000"
# Or for custom domain: NEXTAUTH_URL="https://yourdomain.com"
# Or for custom port: NEXTAUTH_URL="http://your-server-ip:8080"

# OpenAI (if using AI features)
OPENAI_API_KEY="your_openai_api_key"

# Environment
NODE_ENV="production"
```

### 3. Configure for Different Scenarios

#### Option A: Default Port (3000)
```env
NEXTAUTH_URL="http://your-server-ip:3000"
PORT=3000
```

#### Option B: Custom Port (e.g., 8080)
```env
NEXTAUTH_URL="http://your-server-ip:8080"
PORT=8080
```

#### Option C: Behind IIS Reverse Proxy
```env
NEXTAUTH_URL="https://yourdomain.com"
PORT=3000
```

### 4. Database Setup
```powershell
# Run database migrations
npx prisma migrate deploy

# Seed the database (optional)
npm run prisma:seed
```

### 5. Start the Application

#### Option A: Using PM2 (Recommended)
```powershell
# Create PM2 ecosystem file
# See ecosystem.config.js below

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 as Windows Service
pm2-service-install
pm2-service-start
```

#### Option B: Direct Start
```powershell
# Set environment and start
$env:NODE_ENV="production"
npm run start:prod
```

## PM2 Configuration

Update your `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'cleantrack',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: 'C:\\inetpub\\cleantrack',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Add your production environment variables here
    },
    log_file: 'C:\\inetpub\\cleantrack\\logs\\combined.log',
    out_file: 'C:\\inetpub\\cleantrack\\logs\\out.log',
    error_file: 'C:\\inetpub\\cleantrack\\logs\\error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    watch: false,
    max_memory_restart: '1G'
  }]
}
```

## Windows Firewall Configuration

```powershell
# Allow incoming connections on your chosen port
New-NetFirewallRule -DisplayName "CleanTrack App" -Direction Inbound -Port 3000 -Protocol TCP -Action Allow

# For custom port (e.g., 8080)
New-NetFirewallRule -DisplayName "CleanTrack App Custom" -Direction Inbound -Port 8080 -Protocol TCP -Action Allow
```

## IIS Reverse Proxy Setup (Optional)

### 1. Install IIS and Required Modules
```powershell
# Enable IIS
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-HttpRedirection, IIS-ApplicationDevelopment

# Install URL Rewrite Module
# Download from: https://www.iis.net/downloads/microsoft/url-rewrite

# Install Application Request Routing
# Download from: https://www.iis.net/downloads/microsoft/application-request-routing
```

### 2. Configure IIS Site
Create `C:\inetpub\wwwroot\cleantrack\web.config`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="CleanTrack Proxy" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

## SSL/HTTPS Setup

### Option A: Using IIS with SSL Certificate
1. Import your SSL certificate into IIS
2. Bind HTTPS to your site
3. Update `NEXTAUTH_URL` to use `https://`

### Option B: Using Cloudflare or Reverse Proxy
1. Configure your DNS to point to the server
2. Use Cloudflare or similar service for SSL termination
3. Update `NEXTAUTH_URL` accordingly

## Monitoring and Maintenance

### View Application Logs
```powershell
# PM2 logs
pm2 logs cleantrack

# Application logs
Get-Content C:\inetpub\cleantrack\logs\combined.log -Tail 50

# Follow logs in real-time
Get-Content C:\inetpub\cleantrack\logs\combined.log -Wait
```

### Restart Application
```powershell
# Restart with PM2
pm2 restart cleantrack

# Or restart PM2 service
Restart-Service PM2
```

### Update Application
```powershell
# Stop application
pm2 stop cleantrack

# Pull updates
git pull origin main

# Install new dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 start cleantrack
```

## Performance Optimization

### 1. Enable Node.js Production Optimizations
```powershell
# Set NODE_ENV in system environment
[System.Environment]::SetEnvironmentVariable("NODE_ENV", "production", "Machine")
```

### 2. Configure PM2 for Multiple Instances
```javascript
// In ecosystem.config.js
instances: 'max', // Uses all CPU cores
exec_mode: 'cluster'
```

### 3. Windows Server Performance Settings
```powershell
# Optimize network settings
netsh int tcp set global autotuninglevel=normal
netsh int tcp set global chimney=enabled
netsh int tcp set global rss=enabled
```

## Troubleshooting

### Common Issues:

1. **Port Already in Use**
   ```powershell
   # Find what's using the port
   netstat -ano | findstr :3000
   
   # Kill the process
   taskkill /PID <process_id> /F
   ```

2. **Permission Issues**
   ```powershell
   # Run as Administrator
   # Ensure IIS_IUSRS has read permissions on app folder
   ```

3. **Environment Variables Not Loading**
   ```powershell
   # Verify .env.production file exists and is readable
   # Check PM2 ecosystem configuration
   ```

4. **Database Connection Issues**
   ```powershell
   # Test database connection
   npx prisma db pull
   ```

## Security Considerations

1. **Firewall**: Only open necessary ports
2. **SSL**: Always use HTTPS in production
3. **Environment Variables**: Store sensitive data securely
4. **Regular Updates**: Keep Node.js and dependencies updated
5. **Monitoring**: Set up application and server monitoring

## Backup Strategy

```powershell
# Create backup script
# Backup database, application files, and configuration
# Schedule with Windows Task Scheduler
```

This deployment method gives you full control over your Windows Server 2022 environment while leveraging the environment-agnostic changes we made to your application. 