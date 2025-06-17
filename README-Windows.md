# CleanTrack - Windows Self-Hosting Guide

CleanTrack is a comprehensive cleaning management system with admin and cleaner interfaces, real-time session tracking, and equipment maintenance scheduling.

## 🚀 Quick Start for Windows

### 1. Prerequisites
- **Node.js 18+**: Download from [https://nodejs.org/](https://nodejs.org/)
- **PostgreSQL 15+**: Download from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
- **Git** (optional): Download from [https://git-scm.com/download/win](https://git-scm.com/download/win)

### 2. Download & Setup

1. **Extract the CleanTrack files** to your desired folder (e.g., `C:\cleantrack\`)

2. **Setup Database**:
   - Open pgAdmin or PostgreSQL command line
   - Create database and user:
   ```sql
   CREATE DATABASE cleantrack;
   CREATE USER cleantrack_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE cleantrack TO cleantrack_user;
   ```

3. **Configure Environment**:
   - Copy `scripts/windows/env-template.txt` to `.env` in the project root
   - Update the database password and other settings in `.env`

4. **Run Installation**:
   - Open Command Prompt as Administrator
   - Navigate to your CleanTrack folder
   - Run: `scripts\windows\install.bat`

### 3. Start the Application

Run: `scripts\windows\start.bat`

The application will be available at [http://localhost:3000](http://localhost:3000)

## 👥 Default Login Credentials

- **Admin**: `admin@cleantrack.com` / `admin123`
- **Cleaner**: `cleaner@cleantrack.com` / `cleaner123`
- **User**: `user@cleantrack.com` / `user123`

## 🔧 Production Deployment

### Option 1: PM2 Process Manager (Recommended)

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start CleanTrack as a service:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

3. Monitor the application:
   ```bash
   pm2 status
   pm2 logs cleantrack
   pm2 monit
   ```

### Option 2: Windows Task Scheduler

1. Use the provided `scripts\windows\start.bat`
2. Create a scheduled task to run on system startup
3. Set the task to run the batch file with appropriate privileges

## 🗄️ Database Backup

Run the backup script regularly:
```bash
scripts\windows\backup-database.bat
```

Or schedule it to run automatically via Windows Task Scheduler.

## 🔒 Security Checklist

- [ ] Change default user passwords
- [ ] Use strong `NEXTAUTH_SECRET` in .env
- [ ] Configure Windows Firewall (allow port 3000)
- [ ] Use HTTPS in production
- [ ] Regular database backups
- [ ] Keep Windows and Node.js updated

## 🌐 Domain Setup (Optional)

### Using IIS as Reverse Proxy:
1. Install IIS with URL Rewrite module
2. Configure reverse proxy to `http://localhost:3000`

### Using Custom Domain:
1. Update `NEXTAUTH_URL` in `.env` to your domain
2. Configure SSL certificates
3. Update firewall rules

## 📁 File Structure

```
cleantrack/
├── scripts/windows/     # Windows deployment scripts
├── docs/               # Documentation
├── src/                # Application source code
├── prisma/             # Database schema and migrations
├── .env                # Environment configuration
├── ecosystem.config.js # PM2 configuration
└── README-Windows.md   # This file
```

## 🛠️ Troubleshooting

### Common Issues:

**Port 3000 already in use:**
- Change `PORT=3001` in your `.env` file

**Database connection failed:**
- Check PostgreSQL service is running
- Verify credentials in `.env` file
- Ensure database and user exist

**Permission errors:**
- Run Command Prompt as Administrator
- Check Windows user permissions on the folder

**npm install fails:**
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` folder and retry

### Log Files:
- PM2 logs: `pm2 logs cleantrack`
- Application logs: Check console output
- PostgreSQL logs: `C:\Program Files\PostgreSQL\{version}\data\log`

## 📊 Features

### Admin Interface:
- Dashboard with real-time statistics
- Room and equipment management
- Schedule assignment and monitoring
- User session tracking
- Recent activity monitoring with live updates

### Cleaner Interface:
- Personal dashboard with assigned tasks
- Room and equipment schedules
- Task completion tracking
- Mobile-responsive design

### Real-Time Features:
- Session tracking and monitoring
- Live activity updates every 30 seconds
- User presence indicators
- Automatic logout detection

## 🔄 Updates

To update CleanTrack:
1. Backup your database
2. Replace application files (keep `.env` file)
3. Run: `npm install && npx prisma generate && npm run build`
4. Restart the application

## 💡 Performance Tips

1. **Use SSD storage** for better database performance
2. **Monitor memory usage** - restart if needed (PM2 handles this)
3. **Enable gzip compression** in your reverse proxy
4. **Configure caching** for static assets
5. **Regular maintenance** - clean logs and backup database

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the full documentation in `docs/windows-deployment.md`
3. Check application logs for error details

---

**CleanTrack** - Comprehensive cleaning management with real-time tracking and mobile support. 