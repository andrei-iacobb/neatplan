# 🐳 CleanTrack Docker Deployment Guide

## ✅ What We've Fixed

### **Database Connection Issue**
- **Problem**: App was trying to connect to `localhost:5432` instead of Docker database
- **Solution**: Updated Docker Compose to override `.env` file and use correct database URL

### **Security & Secrets**
- **Generated secure NextAuth secret**: `+Ml/o3N7D7cFzUcZiF7ttLwXKwrS5hHVBccQ0ZjIjBo=`
- **Updated database credentials**: `cleantrack_user` / `CleanTrack2024SecurePass`
- **Proper environment isolation**: Docker env overrides local `.env` file

## 🚀 Deployment Steps

### **1. Clean Start (If needed)**
```bash
# Stop any existing containers
docker-compose down -v

# Remove old images if you want fresh build
docker system prune -a
```

### **2. Build and Deploy**
```bash
# Build and start the complete stack
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

### **3. Access Your Application**
- **Local access**: http://localhost:3000
- **Network access**: http://10.60.1.195:3000
- **From other devices**: Use your machine's IP address

## 🗄️ Database Information

### **Database Credentials**
- **Host**: `db` (inside Docker) / `localhost:5432` (from host)
- **Database**: `cleantrack`
- **Username**: `cleantrack_user`
- **Password**: `CleanTrack2024SecurePass`
- **Full URL**: `postgresql://cleantrack_user:CleanTrack2024SecurePass@db:5432/cleantrack`

### **Data Persistence**
- Data is stored in Docker volume: `cleantrack_cleantrack_data`
- Data persists between container restarts
- Data is only lost if you run: `docker-compose down -v`

## 🔧 Troubleshooting

### **"Can't reach database server at localhost:5432"**
This error occurs when the `.env` file overrides Docker environment variables.
**Solution**: The Docker Compose now prevents loading the `.env` file.

### **Container fails to start**
Check logs: `docker-compose logs web` or `docker-compose logs db`

### **Database connection timeout**
The startup script waits for database to be ready. Check: `docker-compose logs db`

### **Port already in use**
```bash
# Check what's using port 3000
sudo lsof -i :3000

# Kill the process or change port in docker-compose.yml
```

## 📊 Monitoring

### **Check container status**
```bash
docker-compose ps
```

### **View logs**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f db
```

### **Connect to database**
```bash
# From host machine
docker exec -it cleantrack_db psql -U cleantrack_user -d cleantrack

# Or using pgAdmin/DBeaver with:
# Host: localhost, Port: 5432, DB: cleantrack, User: cleantrack_user
```

## 🔐 Security Notes

- **Change secrets for production**: Update `NEXTAUTH_SECRET` in docker-compose.yml
- **Database password**: Update `POSTGRES_PASSWORD` and `DATABASE_URL` together
- **External access**: The app is accessible from any IP (0.0.0.0:3000)
- **Firewall**: Consider firewall rules for external access

## 🌐 External Access Options

### **Local Network**
Already configured! Access via: `http://your-ip:3000`

### **Internet Access**
For internet access, use:
- **ngrok**: `ngrok http 3000`
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:3000`
- **Deploy to cloud**: Vercel, Railway, DigitalOcean, etc.

## ✅ Success Indicators

When working correctly, you should see:
1. Database health check passing
2. Prisma migrations running
3. "Ready in Xms" message
4. Application accessible on port 3000
5. No "localhost:5432" connection errors

## 📝 Configuration Summary

**Environment Variables (in Docker):**
- `DATABASE_URL`: Points to Docker database service
- `NEXTAUTH_SECRET`: Secure random secret
- `NEXTAUTH_URL`: Your external access URL
- `NODE_ENV`: development
- `NEXT_TELEMETRY_DISABLED`: 1

**Network Configuration:**
- App binds to: `0.0.0.0:3000` (external access)
- Database port: `5432` (both internal and external)
- Custom Docker network for service communication 