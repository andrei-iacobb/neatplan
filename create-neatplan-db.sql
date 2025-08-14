-- NeatPlan Database Setup SQL Script
-- Run this in pgAdmin Query Tool or psql as postgres user

-- Create user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'neatplan_user') THEN
        CREATE USER neatplan_user WITH PASSWORD 'NeatPlan2024SecurePass';
    ELSE
        ALTER USER neatplan_user WITH PASSWORD 'NeatPlan2024SecurePass';
    END IF;
END
$$;

-- Create database
CREATE DATABASE neatplan OWNER neatplan_user;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE neatplan TO neatplan_user;

-- Connect to the neatplan database to set up permissions
\c neatplan

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO neatplan_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO neatplan_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO neatplan_user;

-- Grant future permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO neatplan_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO neatplan_user;

-- Display success message
SELECT 'NeatPlan database and user created successfully!' AS result;


