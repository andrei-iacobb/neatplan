#!/bin/sh

echo "Starting NeatPlan application..."

# Wait for database to be ready
echo "Waiting for database connection..."
until pg_isready -h db -p 5432 -U neatplan_user; do
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