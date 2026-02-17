#!/bin/sh

echo "Starting NeatPlan application..."

# Wait for database to be ready using DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set"
  exit 1
fi

echo "Waiting for database connection..."
# pg_isready does not accept Prisma query params like ?schema=...
DB_READY_URL="${DATABASE_URL%%\?*}"
until pg_isready -d "$DB_READY_URL"; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready!"

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Seed database if needed (optional, uncomment if you want initial data)
# echo "Seeding database..."
# npm run prisma:seed

echo "Starting development server..."
exec npm run dev 
