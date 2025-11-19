# Production Deployment Guide - NeatPlan

Complete step-by-step guide to deploy NeatPlan to production at **neatplan.app**.

---

## 📋 Pre-Deployment Checklist

### 1. Environment Setup

```bash
# Clone/pull latest code
git pull origin main

# Install dependencies
npm ci

# Validate environment
npm run validate-env
```

### 2. Generate Strong Secrets

Run this command **3 times** to generate unique secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the outputs for:
1. `NEXTAUTH_SECRET`
2. `CRON_SECRET`
3. `POSTGRES_PASSWORD`

---

## 🔧 Environment Configuration

### Create Production `.env` File

```bash
# Copy template
cp env.example .env

# Edit with your values
nano .env  # or vim, code, etc.
```

### Required Variables for neatplan.app

```bash
# Environment
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Database (use strong password!)
DATABASE_URL=postgresql://neatplan_user:YOUR_STRONG_PASSWORD@db:5432/neatplan
POSTGRES_USER=neatplan_user
POSTGRES_DB=neatplan
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD

# Application URL (your domain with HTTPS)
NEXTAUTH_URL=https://neatplan.app
NEXT_PUBLIC_APP_BASE_URL=https://neatplan.app

# Security Secrets (generated above)
NEXTAUTH_SECRET=your_64_char_secret_from_above
CRON_SECRET=your_64_char_secret_from_above

# CORS
CORS_ALLOWED_ORIGIN=https://neatplan.app
```

### Optional Variables (Configure Later)

```bash
# IP Whitelisting
# ALLOWED_IPS=203.0.113.10,198.51.100.0/24
# IP_WHITELIST_ENFORCE=true

# SMTP (skip for now - configure later)
# SMTP_HOST=smtp.resend.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=resend
# SMTP_PASS=your_api_key
# SMTP_FROM=NeatPlan <noreply@neatplan.app>

# OpenAI (only if using AI features)
# OPENAI_API_KEY=sk-...
```

---

## 🐳 Docker Deployment (Recommended)

### Option 1: Docker Compose (Full Stack)

```bash
# 1. Ensure .env is configured
npm run validate-env

# 2. Build and start services
docker-compose up -d

# 3. Check logs
docker-compose logs -f web

# 4. Run database migrations
docker-compose exec web npx prisma migrate deploy

# 5. (Optional) Seed database with test data
docker-compose exec web npm run prisma:seed
```

Your app will be running on `http://localhost:3000` (you'll need a reverse proxy for HTTPS).

### Option 2: Standalone Docker Container

```bash
# 1. Build image
docker build -t neatplan:latest .

# 2. Run container (requires external PostgreSQL)
docker run -d \
  --name neatplan \
  --env-file .env \
  -p 3000:3000 \
  neatplan:latest
```

---

## 🌐 Reverse Proxy Setup (HTTPS)

You need a reverse proxy to handle HTTPS for neatplan.app.

### Option 1: Nginx

```nginx
server {
    listen 80;
    server_name neatplan.app www.neatplan.app;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name neatplan.app www.neatplan.app;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/neatplan.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/neatplan.app/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;" always;

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 2: Caddy (Simpler)

```caddyfile
neatplan.app {
    reverse_proxy localhost:3000
}
```

Caddy automatically handles HTTPS with Let's Encrypt!

### Option 3: Traefik (Docker)

```yaml
# Add to docker-compose.yml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.neatplan.rule=Host(`neatplan.app`)"
  - "traefik.http.routers.neatplan.entrypoints=websecure"
  - "traefik.http.routers.neatplan.tls.certresolver=letsencrypt"
```

---

## ☁️ Cloud Platform Deployment

### Vercel (Easiest - Recommended for Quick Start)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod

# 4. Set environment variables in Vercel dashboard
# Go to: Settings > Environment Variables
# Add all variables from .env
```

**Note:** You'll need a PostgreSQL database (use Vercel Postgres, Supabase, or Railway).

### Railway

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Add PostgreSQL
railway add

# 5. Deploy
railway up
```

### DigitalOcean App Platform

1. Connect GitHub repository
2. Set environment variables
3. Add PostgreSQL database
4. Deploy!

### AWS / Azure / GCP

Use Docker image + managed PostgreSQL + load balancer.

---

## 🗄️ Database Setup

### Run Migrations

```bash
# Docker Compose
docker-compose exec web npx prisma migrate deploy

# Standalone
npx prisma migrate deploy
```

### Create Admin User

```bash
# Docker Compose
docker-compose exec web npx prisma db seed

# Standalone
npm run prisma:seed
```

**Default admin credentials:**
- Email: `admin@neatplan.app` (update in `prisma/seed.ts` if needed)
- Password: Check `prisma/seed.ts` for default password

**⚠️ IMPORTANT:** Change the admin password immediately after first login!

---

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Allow only HTTPS, SSH, and database (from app only)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 2. Enable IP Whitelisting (Optional)

```bash
# In .env
ALLOWED_IPS=your.office.ip.address,other.allowed.ip
IP_WHITELIST_ENFORCE=true
```

### 3. Database Security

```bash
# Ensure PostgreSQL only listens on localhost
# In docker-compose.yml, ports are already bound to 127.0.0.1
```

### 4. Regular Updates

```bash
# Update dependencies monthly
npm audit fix
npm update

# Rebuild and redeploy
docker-compose build --no-cache
docker-compose up -d
```

---

## 🔄 Cron Job Setup

The app needs a cron job to check schedules. Two options:

### Option 1: Vercel Cron (Automatic)

Already configured in `vercel.json` - runs hourly automatically.

### Option 2: Manual Cron

```bash
# Add to crontab
crontab -e

# Run every hour
0 * * * * curl -X POST https://neatplan.app/api/cron/check-schedules -H "x-cron-secret: YOUR_CRON_SECRET"
```

---

## 📊 Monitoring & Logging

### Check Application Logs

```bash
# Docker Compose
docker-compose logs -f web

# View last 100 lines
docker-compose logs --tail=100 web
```

### Monitor Health

```bash
# Health check endpoint
curl https://neatplan.app/api/health
```

### Database Monitoring

```bash
# Connect to database
docker-compose exec db psql -U neatplan_user -d neatplan

# Check table sizes
\dt+

# Count users
SELECT COUNT(*) FROM users;
```

---

## 🧪 Testing Production Deployment

### 1. Validate Environment

```bash
npm run validate-env
# Should pass with no errors
```

### 2. Test Authentication

```bash
# Visit: https://neatplan.app/auth
# Try logging in with admin credentials
```

### 3. Test API Endpoints

```bash
# Health check
curl https://neatplan.app/api/health

# Should return 401 (auth required)
curl https://neatplan.app/api/rooms
```

### 4. Test Cron Job

```bash
# Should succeed with valid secret
curl -X POST https://neatplan.app/api/cron/check-schedules \
  -H "x-cron-secret: YOUR_CRON_SECRET"

# Should fail without secret
curl -X POST https://neatplan.app/api/cron/check-schedules
```

---

## 🔧 Troubleshooting

### Issue: "Invalid credentials" error

```bash
# Check database connection
docker-compose exec db psql -U neatplan_user -d neatplan -c "\conninfo"

# Verify user exists
docker-compose exec db psql -U neatplan_user -d neatplan -c "SELECT email FROM users;"
```

### Issue: "CORS error"

```bash
# Check CORS_ALLOWED_ORIGIN matches your domain
echo $CORS_ALLOWED_ORIGIN
# Should be: https://neatplan.app
```

### Issue: Container won't start

```bash
# Check logs
docker-compose logs web

# Common fixes:
# 1. Database not ready - wait longer
# 2. Port 3000 in use - change port
# 3. Permissions - check file ownership (should be UID 1001)
```

### Issue: Database migrations fail

```bash
# Reset and retry
docker-compose down
docker volume rm neatplan_neatplan_data
docker-compose up -d
docker-compose exec web npx prisma migrate deploy
```

---

## 🚀 Quick Deploy Commands

```bash
# Full deployment from scratch
git pull origin main
npm ci
npm run validate-env
docker-compose build --no-cache
docker-compose down
docker-compose up -d
docker-compose exec web npx prisma migrate deploy
docker-compose exec web npm run prisma:seed

# Check status
docker-compose ps
docker-compose logs -f web
```

---

## 📝 Post-Deployment Tasks

1. ✅ Change admin password
2. ✅ Create user accounts for cleaners
3. ✅ Add rooms and equipment
4. ✅ Create cleaning schedules
5. ✅ Test task assignment and completion
6. ⏳ Configure SMTP (later)
7. ⏳ Enable IP whitelisting (if needed)
8. ⏳ Set up monitoring/alerts
9. ⏳ Schedule regular backups

---

## 💾 Backup & Restore

### Backup Database

```bash
# Create backup
docker-compose exec db pg_dump -U neatplan_user neatplan > backup-$(date +%Y%m%d).sql

# Or automated daily backups
0 2 * * * docker-compose exec db pg_dump -U neatplan_user neatplan > /backups/neatplan-$(date +\%Y\%m\%d).sql
```

### Restore Database

```bash
# Restore from backup
docker-compose exec -T db psql -U neatplan_user neatplan < backup-20251117.sql
```

---

## 📞 Support & Resources

- **Security Audit Report:** `SECURITY_AUDIT_REPORT.md`
- **Security Fixes:** `SECURITY_FIXES.md`
- **Environment Validation:** `npm run validate-env`
- **Prisma Docs:** https://www.prisma.io/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment

---

## ✅ Production Readiness Checklist

- [ ] Strong random secrets generated
- [ ] `.env` configured with production values
- [ ] `npm run validate-env` passes
- [ ] HTTPS/TLS certificate configured
- [ ] Database migrations run successfully
- [ ] Admin account created and password changed
- [ ] Cron job configured and tested
- [ ] Firewall rules configured
- [ ] Backup strategy implemented
- [ ] Monitoring/logging set up
- [ ] Security headers verified (check with securityheaders.com)
- [ ] Test all user flows (login, tasks, schedules)

---

**You're ready to launch! 🚀**

Once deployed, users can access your app at: **https://neatplan.app**
