# NeatPlan - Quick Start Guide

Fast reference for deploying NeatPlan to production at **neatplan.app**.

---

## 🎯 Before You Deploy

### 1. Generate Secrets (Run 3 times)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the outputs for:
- `NEXTAUTH_SECRET`
- `CRON_SECRET`
- `POSTGRES_PASSWORD`

### 2. Create .env File

```bash
cp env.example .env
nano .env  # or code .env
```

### 3. Update These Values in .env

```bash
# Required Changes:
NEXTAUTH_SECRET=<paste-secret-1>
CRON_SECRET=<paste-secret-2>
POSTGRES_PASSWORD=<paste-secret-3>
DATABASE_URL=postgresql://neatplan_user:<paste-secret-3>@db:5432/neatplan

# Already set correctly:
NEXTAUTH_URL=https://neatplan.app
CORS_ALLOWED_ORIGIN=https://neatplan.app
NODE_ENV=production
```

### 4. Validate Configuration

```bash
npm run validate-env
```

Should show: ✅ All environment variables are properly configured!

---

## 🚀 Deploy Options

### Option A: Docker (Full Stack)

```bash
# Build and start
docker-compose up -d

# Run migrations
docker-compose exec web npx prisma migrate deploy

# Create admin user
docker-compose exec web npm run prisma:seed

# Check logs
docker-compose logs -f web
```

App runs on `http://localhost:3000` (add reverse proxy for HTTPS)

### Option B: Vercel (Easiest)

```bash
npm i -g vercel
vercel login
vercel --prod
```

Then add environment variables in Vercel dashboard.

### Option C: Railway

```bash
npm i -g @railway/cli
railway login
railway init
railway add  # Add PostgreSQL
railway up
```

---

## 🌐 Setup HTTPS (Required)

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name neatplan.app;

    ssl_certificate /etc/letsencrypt/live/neatplan.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/neatplan.app/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy (Auto HTTPS)

```caddyfile
neatplan.app {
    reverse_proxy localhost:3000
}
```

---

## ⏰ Setup Cron Job

### Option 1: Manual Cron

```bash
crontab -e

# Add this line (runs hourly):
0 * * * * curl -X POST https://neatplan.app/api/cron/check-schedules -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Option 2: Vercel Cron

Already configured in `vercel.json` - works automatically!

---

## ✅ Post-Deploy Checklist

```bash
# 1. Test health endpoint
curl https://neatplan.app/api/health

# 2. Test cron authentication
curl -X POST https://neatplan.app/api/cron/check-schedules \
  -H "x-cron-secret: YOUR_CRON_SECRET"

# 3. Login with admin account
# Visit: https://neatplan.app/auth
# Email: admin@neatplan.app (or check prisma/seed.ts)

# 4. Change admin password immediately!

# 5. Test task assignment flow
```

---

## 🔧 Common Commands

```bash
# Validate environment
npm run validate-env

# View logs (Docker)
docker-compose logs -f web

# Run migrations
docker-compose exec web npx prisma migrate deploy

# Restart services
docker-compose restart

# Backup database
docker-compose exec db pg_dump -U neatplan_user neatplan > backup.sql

# Restore database
docker-compose exec -T db psql -U neatplan_user neatplan < backup.sql
```

---

## 🆘 Troubleshooting

### Can't login?

```bash
# Check if admin user exists
docker-compose exec db psql -U neatplan_user neatplan -c "SELECT email FROM users;"

# Recreate admin
docker-compose exec web npm run prisma:seed
```

### CORS errors?

Check that `CORS_ALLOWED_ORIGIN=https://neatplan.app` matches your domain.

### Container won't start?

```bash
# Check logs
docker-compose logs web

# Common fix: wait for database
docker-compose restart web
```

### Database connection error?

```bash
# Test connection
docker-compose exec db psql -U neatplan_user neatplan -c "\conninfo"
```

---

## 📚 Full Documentation

- **Deployment Guide:** `PRODUCTION_DEPLOYMENT.md`
- **Security Audit:** `SECURITY_AUDIT_REPORT.md`
- **Security Fixes:** `SECURITY_FIXES.md`
- **Environment:** `env.example`

---

## 🎬 Quick Deploy (From Scratch)

```bash
# 1. Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# (run 3 times, save outputs)

# 2. Configure environment
cp env.example .env
# Edit .env with your secrets

# 3. Validate
npm run validate-env

# 4. Deploy
docker-compose up -d

# 5. Setup database
docker-compose exec web npx prisma migrate deploy
docker-compose exec web npm run prisma:seed

# 6. Check it works
curl http://localhost:3000/api/health

# 7. Setup HTTPS reverse proxy
# (Nginx, Caddy, or Traefik)

# 8. Done! 🎉
# Visit https://neatplan.app
```

---

## 🔐 Security Reminders

- ✅ Use strong random secrets (min 64 chars)
- ✅ Enable HTTPS/TLS
- ✅ Change admin password after first login
- ✅ Don't commit `.env` to git
- ✅ Keep dependencies updated (`npm audit`)
- ⏳ Configure SMTP later
- ⏳ Consider IP whitelisting

---

**Need help?** Check `PRODUCTION_DEPLOYMENT.md` for detailed instructions.

**Ready to launch?** 🚀 https://neatplan.app
