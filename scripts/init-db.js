const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function initializeDatabase() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create housekeepers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS housekeepers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        assigned_to INTEGER REFERENCES housekeepers(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scheduled_for TIMESTAMP
      )
    `);

    // Create issues table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id),
        description TEXT NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'medium',
        is_resolved BOOLEAN DEFAULT false,
        reported_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      )
    `);

    console.log('Database initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase();