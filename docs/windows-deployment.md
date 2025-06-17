# Windows Self-Hosting Guide for CleanTrack

## Prerequisites

### 1. Install Node.js
- Download Node.js 18+ from https://nodejs.org/
- Choose the Windows Installer (.msi)
- Install with default settings
- Verify installation: `node --version` and `npm --version`

### 2. Install PostgreSQL
- Download PostgreSQL 15+ from https://www.postgresql.org/download/windows/
- Install with default settings
- Remember the password you set for the `postgres` user
- Default port: 5432

### 3. Install Git (Optional but recommended)
- Download Git from https://git-scm.com/download/win
- Install with default settings

## Database Setup

### 1. Create Database
Open pgAdmin or Command Prompt and create the database:

```sql
-- Connect to PostgreSQL as postgres user
CREATE DATABASE cleantrack;
CREATE USER cleantrack_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE cleantrack TO cleantrack_user;
```

### 2. Configure Environment Variables
Create a `.env` file in your project root:

```env
# Database
DATABASE_URL="postgresql://cleantrack_user:your_secure_password@localhost:5432/cleantrack"

# NextAuth
NEXTAUTH_SECRET="your-super-secret-key-here-make-it-long-and-random"
NEXTAUTH_URL="http://localhost:3000"

# For production, change to your domain:
# NEXTAUTH_URL="https://yourdomain.com"

# Optional: Email configuration (for password resets)
# EMAIL_SERVER_HOST="smtp.gmail.com"
# EMAIL_SERVER_PORT=587
# EMAIL_SERVER_USER="your-email@gmail.com"
# EMAIL_SERVER_PASSWORD="your-app-password"
# EMAIL_FROM="noreply@yourdomain.com"
```

## Application Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database Schema
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 3. Build Application
```bash
npm run build
```

## Running the Application

### Option 1: Development Mode
```bash
npm run dev
```
Application will be available at http://localhost:3000

### Option 2: Production Mode
```bash
npm run build
npm start
```

## Windows Service Setup (Recommended for Production)

### Using PM2 (Process Manager)

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Create PM2 configuration file `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'cleantrack',
    script: 'npm',
    args: 'start',
    cwd: 'C:\\path\\to\\your\\cleantrack\\folder',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
```

3. Start the application:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Using Windows Task Scheduler

1. Create a batch file `start-cleantrack.bat`:
```batch
@echo off
cd /d "C:\path\to\your\cleantrack\folder"
npm start
```

2. Create a scheduled task:
   - Open Task Scheduler
   - Create Basic Task
   - Set trigger to "At startup"
   - Set action to start your batch file

## Firewall Configuration

Open Windows Firewall and allow inbound connections on port 3000 (or your chosen port).

## Domain and SSL Setup (Optional)

### Using IIS as Reverse Proxy

1. Install IIS with URL Rewrite module
2. Create a new site in IIS
3. Install URL Rewrite and Application Request Routing
4. Configure reverse proxy to localhost:3000

### Using Nginx (Alternative)

1. Download Nginx for Windows
2. Configure nginx.conf:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Considerations

1. **Change default passwords** for PostgreSQL
2. **Use strong NEXTAUTH_SECRET** (generate with: `openssl rand -base64 32`)
3. **Configure Windows Firewall** to only allow necessary ports
4. **Keep Windows and Node.js updated**
5. **Use HTTPS in production** with SSL certificates
6. **Backup database regularly**

## Backup Strategy

### Database Backup Script
Create `backup-db.bat`:
```batch
@echo off
set PGPASSWORD=your_database_password
pg_dump -h localhost -U cleantrack_user -d cleantrack -f "backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql"
```

Schedule this to run daily via Task Scheduler.

## Troubleshooting

### Common Issues:

1. **Port already in use**: Change PORT in .env file
2. **Database connection failed**: Check PostgreSQL service is running
3. **Permission errors**: Run Command Prompt as Administrator
4. **npm install fails**: Clear npm cache with `npm cache clean --force`

### Logs Location:
- Application logs: Check console output or PM2 logs
- PostgreSQL logs: Usually in `C:\Program Files\PostgreSQL\{version}\data\log`

## Performance Optimization

1. **Enable gzip compression** in your reverse proxy
2. **Configure caching headers** for static assets
3. **Monitor memory usage** and restart if needed
4. **Use SSD storage** for better database performance

## Monitoring

Consider setting up monitoring with:
- PM2 monitoring dashboard
- Windows Performance Monitor
- Custom health check endpoints in your app 