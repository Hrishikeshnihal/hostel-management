require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    try {
        console.log("Starting multi-tenancy migration...");

        // 1. Add owner_id to users
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
        console.log("Added owner_id to users.");

        // 2. Add owner_id to rooms
        await pool.query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
        console.log("Added owner_id to rooms.");

        // 3. Add owner_id to notices
        await pool.query(`ALTER TABLE notices ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
        console.log("Added owner_id to notices.");

        // 4. Add owner_id to hostel_settings
        await pool.query(`ALTER TABLE hostel_settings ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
        console.log("Added owner_id to hostel_settings.");

        // 5. Update existing records to belong to Admin ID 2
        console.log("Assigning existing records to Admin ID 2...");
        await pool.query(`UPDATE users SET owner_id = 2 WHERE role = 'Student'`);
        await pool.query(`UPDATE rooms SET owner_id = 2`);
        await pool.query(`UPDATE notices SET owner_id = 2`);
        await pool.query(`UPDATE hostel_settings SET owner_id = 2`);

        console.log("Migration complete!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit(0);
    }
}

migrate();
