const { Pool } = require("pg")
const bcrypt = require("bcrypt")

// Create a new pool instance
const db = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number.parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "secret",
  database: process.env.DB_NAME || "housekeeper",
})

async function initializeDatabase() {
  try {
    console.log("Starting database initialization...")

    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'housekeeper',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Users table created or already exists")

    // Create housekeepers table
    await db.query(`
      CREATE TABLE IF NOT EXISTS housekeepers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Housekeepers table created or already exists")

    // Create scanned_documents table
    await db.query(`
      CREATE TABLE IF NOT EXISTS scanned_documents (
        id SERIAL PRIMARY KEY,
        file_path VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        uploaded_by INTEGER REFERENCES users(id),
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Scanned documents table created or already exists")

    // Create tasks table
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES scanned_documents(id),
        title VARCHAR(100) NOT NULL,
        location VARCHAR(100),
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        assigned_to INTEGER REFERENCES housekeepers(id),
        scheduled_for TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Tasks table created or already exists")

    // Create issues table
    await db.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id),
        description TEXT NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium',
        reported_by INTEGER REFERENCES users(id),
        is_resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Issues table created or already exists")

    // Check if admin user exists
    const adminCheck = await db.query("SELECT * FROM users WHERE username = 'admin'")

    if (adminCheck.rows.length === 0) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash("admin123", 10)
      const adminResult = await db.query(
        "INSERT INTO users (username, password, role) VALUES ('admin', $1, 'admin') RETURNING id",
        [hashedPassword],
      )
      console.log("Default admin user created")
    } else {
      console.log("Admin user already exists")
    }

    // Check if demo housekeeper user exists
    const demoUserCheck = await db.query("SELECT * FROM users WHERE username = 'demo'")

    if (demoUserCheck.rows.length === 0) {
      // Create demo housekeeper user
      const hashedPassword = await bcrypt.hash("demo123", 10)
      const demoUserResult = await db.query(
        "INSERT INTO users (username, password, role) VALUES ('demo', $1, 'housekeeper') RETURNING id",
        [hashedPassword],
      )

      // Create housekeeper record for demo user
      await db.query("INSERT INTO housekeepers (user_id, name) VALUES ($1, 'Demo User')", [demoUserResult.rows[0].id])
      console.log("Demo housekeeper user created")
    } else {
      console.log("Demo user already exists")
    }

    console.log("Database initialization completed successfully")
  } catch (error) {
    console.error("Error initializing database:", error)
  } finally {
    await db.end()
  }
}

initializeDatabase()

