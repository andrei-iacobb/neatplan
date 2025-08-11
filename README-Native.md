# 🚀 CleanTrack Native Windows Setup

**Run CleanTrack entirely natively on Windows - No Docker Required!**

This guide will help you set up CleanTrack to run completely natively on Windows with a local PostgreSQL database.

---

## 📋 Prerequisites

- **Windows 10/11** or **Windows Server 2019/2022**
- **Node.js 18.0+** ([Download here](https://nodejs.org/))
- **PostgreSQL 15+** (we'll install this)
- **Git** ([Download here](https://git-scm.com/))

---

## 🎯 Quick Start (Automated)

### Option 1: Full Automated Setup

Run this single command as **Administrator** in PowerShell:

```powershell
.\scripts\windows\setup-native.ps1
```

This will:
- ✅ Install PostgreSQL locally
- ✅ Create the database and user
- ✅ Install Node.js dependencies
- ✅ Set up environment configuration
- ✅ Run database migrations
- ✅ Seed sample data
- ✅ Build and start the application

### Option 2: Step-by-Step Manual Setup

If you prefer to understand each step, follow the manual guide below.

---

## 🔧 Manual Setup Guide

### Step 1: Install PostgreSQL

**Download and install PostgreSQL:**

1. Download PostgreSQL 15+ from: https://www.postgresql.org/download/windows/
2. Run the installer as Administrator
3. During installation:
   - Set password for `postgres` user (remember this!)
   - Use default port `5432`
   - Select default locale

**Or use Chocolatey (if installed):**
```powershell
choco install postgresql --params '/Password:YourSecurePassword'
```

**Or use our automated script:**
```powershell
.\scripts\windows\install-postgresql.ps1
```

### Step 2: Create Database and User

Open **pgAdmin** or **psql** and run:

```sql
-- Create user
CREATE USER cleantrack_user WITH PASSWORD 'CleanTrack2024SecurePass';

-- Create database
CREATE DATABASE cleantrack OWNER cleantrack_user;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE cleantrack TO cleantrack_user;
```

**Or use our automated script:**
```powershell
.\scripts\windows\setup-database.ps1
```

### Step 3: Configure Environment

1. **Copy environment template:**
   ```powershell
   copy scripts\windows\env-template-native.txt .env
   ```

2. **Edit `.env` file** with your settings:
   ```env
   # Database Configuration
   DATABASE_URL="postgresql://cleantrack_user:CleanTrack2024SecurePass@localhost:5432/cleantrack"
   
   # NextAuth Configuration
   NEXTAUTH_SECRET="your-super-secret-key-here-32-chars-min"
   NEXTAUTH_URL="http://localhost:3000"
   
   # Optional: OpenAI for AI features
   OPENAI_API_KEY="your-openai-api-key"
   
   # Environment
   NODE_ENV="development"
   ```

### Step 4: Install Dependencies and Setup

```powershell
# Install Node.js dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Seed with sample data
npx prisma db seed
```

### Step 5: Build and Start

```powershell
# Build the application
npm run build

# Start the application
npm start
```

**Or for development:**
```powershell
npm run dev
```

---

## 🌐 Access Your Application

Once running, access CleanTrack at:

- **Local**: http://localhost:3000
- **Network**: http://YOUR_IP_ADDRESS:3000

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@cleantrack.com | admin123 |
| **Cleaner** | cleaner@cleantrack.com | cleaner123 |

---

## 🚀 Production Deployment

### Using PM2 (Recommended)

1. **Install PM2:**
   ```powershell
   npm install -g pm2
   npm install -g pm2-windows-service
   ```

2. **Start with PM2:**
   ```powershell
   pm2 start ecosystem.config.js --env production
   pm2 save
   ```

3. **Install as Windows Service:**
   ```powershell
   pm2-service-install
   pm2-service-start
   ```

### Using Windows Service

Run our service installation script:
```powershell
.\scripts\windows\install-service.ps1
```

---

## 🛠️ Maintenance

### Database Backup

```powershell
# Automated backup
.\scripts\windows\backup-database.bat

# Manual backup
pg_dump -h localhost -U cleantrack_user -d cleantrack -f backup_$(date +%Y%m%d).sql
```

### Update Application

```powershell
# Pull latest changes
git pull

# Install new dependencies
npm install

# Run migrations
npx prisma migrate deploy

# Rebuild
npm run build

# Restart PM2
pm2 restart all
```

### Check Status

```powershell
# Check PM2 status
pm2 status

# Check logs
pm2 logs

# Check database connection
npx prisma db pull
```

---

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `NEXTAUTH_SECRET` | Secret for NextAuth.js | Required |
| `NEXTAUTH_URL` | Application URL | http://localhost:3000 |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Optional |
| `PORT` | Application port | 3000 |
| `NODE_ENV` | Environment mode | development |

### PostgreSQL Configuration

For production, edit `postgresql.conf`:

```ini
# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB

# Connection settings
max_connections = 100

# Logging
log_statement = 'mod'
log_min_duration_statement = 1000
```

---

## 🚨 Troubleshooting

### Common Issues

**1. Database Connection Failed**
- Check PostgreSQL service is running: `Get-Service postgresql*`
- Verify DATABASE_URL in `.env`
- Test connection: `psql -h localhost -U cleantrack_user -d cleantrack`

**2. Port Already in Use**
- Change port in `.env`: `PORT=3001`
- Or kill process: `taskkill /f /im node.exe`

**3. Prisma Client Error**
- Regenerate client: `npx prisma generate`
- Reset database: `npx prisma migrate reset`

**4. Build Errors**
- Clear cache: `npm run build:no-lint`
- Delete node_modules: `rmdir /s node_modules && npm install`

### Get Help

1. **Check logs:**
   ```powershell
   # PM2 logs
   pm2 logs
   
   # Application logs
   Get-Content logs\app.log -Tail 50
   ```

2. **Database logs:**
   ```powershell
   # Check PostgreSQL logs in:
   # C:\Program Files\PostgreSQL\15\data\log\
   ```

3. **Performance monitoring:**
   ```powershell
   pm2 monit
   ```

---

## 📊 Performance Tips

### For Production

1. **Enable compression:**
   ```javascript
   // next.config.ts
   compress: true,
   ```

2. **PostgreSQL tuning:**
   ```sql
   ALTER SYSTEM SET shared_buffers = '256MB';
   ALTER SYSTEM SET effective_cache_size = '1GB';
   SELECT pg_reload_conf();
   ```

3. **Windows optimization:**
   ```powershell
   # Disable Windows Defender real-time scanning for node_modules
   Add-MpPreference -ExclusionPath "C:\path\to\your\app\node_modules"
   ```

---

## ✅ What's Different from Docker?

| Aspect | Docker Setup | Native Setup |
|--------|--------------|--------------|
| **Database** | PostgreSQL container | Local PostgreSQL installation |
| **Performance** | Container overhead | Native Windows performance |
| **Maintenance** | Container updates | Direct OS package management |
| **Debugging** | Docker logs | Direct access to logs |
| **Resource Usage** | Higher memory usage | Lower memory footprint |
| **Startup Time** | Slower (container startup) | Faster (direct execution) |

---

## 🎉 Success!

You now have CleanTrack running completely natively on Windows! 

- **Faster performance** (no Docker overhead)
- **Easier debugging** (direct access to logs)
- **Better integration** with Windows
- **Simpler maintenance** (standard Windows tools)

Access your application at: **http://localhost:3000**

Need help? Check the troubleshooting section or open an issue on GitHub. 