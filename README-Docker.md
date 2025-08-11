# CleanTrack Docker Setup

Simple Docker setup for the CleanTrack cleaning management application.

## Quick Start

1. Copy the environment file:

```bash
cp env.example .env
```

Or create a `.env` file manually with:

```env
DATABASE_URL=postgresql://cleantrack_user:CleanTrack2024SecurePass@db:5432/cleantrack
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-change-this-in-production
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
```

2. Start everything:

```bash
docker-compose up -d
```

That's it! The setup will automatically:
- Start PostgreSQL database
- Create database tables (migrations)
- Seed with sample data
- Start the web application

## Access

- **Web App**: http://localhost:3000
- **Database**: localhost:5432

## Default Login

- **Admin**: admin@cleantrack.com / admin123
- **Cleaner**: cleaner@cleantrack.com / cleaner123
- **User**: user@cleantrack.com / user123

## Stop

```bash
docker-compose down
```

## Reset Database

```bash
docker-compose down -v
docker-compose up -d
```

## View Logs

```bash
docker-compose logs -f
``` 