-- CleanTrack Database Setup SQL Script
-- Run this in pgAdmin Query Tool or psql as postgres user

-- Create user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cleantrack_user') THEN
        CREATE USER cleantrack_user WITH PASSWORD 'CleanTrack2024SecurePass';
    ELSE
        ALTER USER cleantrack_user WITH PASSWORD 'CleanTrack2024SecurePass';
    END IF;
END
$$;

-- Create database
CREATE DATABASE cleantrack OWNER cleantrack_user;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE cleantrack TO cleantrack_user;

-- Connect to the cleantrack database to set up permissions
\c cleantrack

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO cleantrack_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cleantrack_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cleantrack_user;

-- Grant future permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cleantrack_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cleantrack_user;

-- Display success message
SELECT 'CleanTrack database and user created successfully!' AS result; 