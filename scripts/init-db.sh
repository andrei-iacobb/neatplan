#!/bin/bash
set -e

# This script runs after PostgreSQL initialization
# It's executed by the PostgreSQL Docker container during startup

echo "🔧 Starting CleanTrack database initialization..."

# Wait a moment for PostgreSQL to fully start
sleep 2

# Check if the database is accessible
echo "📋 Checking database connection..."
until pg_isready -h localhost -p 5432 -U cleantrack_user -d cleantrack
do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "✅ Database is ready!"

# Set permissions on the cleantrack database
echo "🔐 Setting up database permissions..."
psql -U cleantrack_user -d cleantrack -c "
-- Ensure cleantrack_user has all necessary permissions
GRANT ALL PRIVILEGES ON DATABASE cleantrack TO cleantrack_user;
GRANT ALL ON SCHEMA public TO cleantrack_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cleantrack_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cleantrack_user;

-- Grant future permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cleantrack_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cleantrack_user;
"

echo "✅ Database initialization completed successfully!"
echo "🚀 CleanTrack database is ready for use!" 