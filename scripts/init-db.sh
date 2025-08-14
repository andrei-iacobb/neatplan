#!/bin/bash
set -e

# This script runs after PostgreSQL initialization
# It's executed by the PostgreSQL Docker container during startup

echo "🔧 Starting NeatPlan database initialization..."

# Wait a moment for PostgreSQL to fully start
sleep 2

# Check if the database is accessible
echo "📋 Checking database connection..."
until pg_isready -h localhost -p 5432 -U neatplan_user -d neatplan
do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "✅ Database is ready!"

# Set permissions on the neatplan database
echo "🔐 Setting up database permissions..."
psql -U neatplan_user -d neatplan -c "
-- Ensure neatplan_user has all necessary permissions
GRANT ALL PRIVILEGES ON DATABASE neatplan TO neatplan_user;
GRANT ALL ON SCHEMA public TO neatplan_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO neatplan_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO neatplan_user;

-- Grant future permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO neatplan_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO neatplan_user;
"

echo "✅ Database initialization completed successfully!"
echo "🚀 NeatPlan database is ready for use!" 