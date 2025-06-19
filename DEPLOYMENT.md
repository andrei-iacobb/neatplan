# Deployment Guide

This guide explains how to deploy your CleanTrack app in different scenarios without relying on localhost:3000.

## Deployment Options

### 1. Production Server Deployment (Recommended)

This is the best option for your app since it uses database operations and API routes.

#### Environment Setup
Create a `.env.production` file:
```bash
DATABASE_URL="your_production_database_url"
NEXTAUTH_SECRET="your_production_secret"
NEXTAUTH_URL="https://yourdomain.com"  # Your actual domain
OPENAI_API_KEY="your_openai_api_key"
```

#### Build and Deploy
```bash
npm run build
npm run start:prod
```

#### For Different Domains/Ports
Set the `NEXTAUTH_URL` environment variable to match your deployment:
- `https://yourdomain.com` for custom domain
- `https://yourapp.vercel.app` for Vercel
- `http://your-server-ip:8080` for custom port

### 2. Docker Deployment
Your existing Dockerfile will work. Just update the environment variables:

```bash
docker build -t cleantrack .
docker run -p 8080:3000 \
  -e NEXTAUTH_URL="http://localhost:8080" \
  -e DATABASE_URL="your_db_url" \
  cleantrack
```

### 3. Static File Deployment (Limited)

⚠️ **Warning**: This approach has limitations because your app uses:
- API routes
- Database operations
- Authentication

For a static version, you'd need to:
1. Remove all API routes
2. Replace database calls with static data
3. Remove authentication

If you still want static files:
```bash
npm run build:static
```

Files will be in `./out` directory.

### 4. Subdirectory Deployment

If deploying to a subdirectory (e.g., `yoursite.com/cleantrack`):

1. Set environment variables:
```bash
NEXT_PUBLIC_BASE_PATH="/cleantrack"
NEXTAUTH_URL="https://yoursite.com/cleantrack"
```

2. Update `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  basePath: '/cleantrack',
  assetPrefix: '/cleantrack',
  // ... other config
};
```

## Recommended Deployment Platforms

### Vercel (Easiest)
1. Push to GitHub
2. Connect to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

### Railway/Render
1. Connect your repository
2. Set environment variables
3. Deploy with their Node.js buildpack

### Traditional VPS
1. Install Node.js
2. Clone repository
3. Set environment variables
4. Run `npm run build && npm run start:prod`
5. Use PM2 or similar for process management

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTAUTH_URL` | Your app's URL | `https://yourdomain.com` |
| `DATABASE_URL` | Database connection | Your database URL |
| `NEXTAUTH_SECRET` | Auth secret | Random secret string |
| `OPENAI_API_KEY` | OpenAI API key | Your API key |

## Troubleshooting

### URLs not working
- Ensure `NEXTAUTH_URL` matches your actual domain
- Check that all fetch calls use relative URLs (they should)

### Authentication issues
- Verify `NEXTAUTH_SECRET` is set
- Ensure `NEXTAUTH_URL` is correct

### Database connection issues
- Verify `DATABASE_URL` is correct
- Ensure database is accessible from deployment environment

## Testing Your Deployment

1. Build locally: `npm run build && npm run start:prod`
2. Test all features work
3. Check authentication flows
4. Verify API endpoints respond correctly 