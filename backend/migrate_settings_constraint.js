require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    try {
        console.log("Starting migration to adjust hostel_settings unique constraint...");
        
        // 1. Drop existing unique constraint on setting_key
        await pool.query(`ALTER TABLE hostel_settings DROP CONSTRAINT IF EXISTS hostel_settings_setting_key_key;`);
        console.log("Dropped global unique constraint on setting_key.");

        // 2. Add composite unique constraint on (owner_id, setting_key)
        // Note: For PG, if we want to ensure uniqueness per owner, we can use:
        await pool.query(`ALTER TABLE hostel_settings ADD CONSTRAINT hostel_settings_owner_id_setting_key_key UNIQUE (owner_id, setting_key);`);
        console.log("Added composite unique constraint on (owner_id, setting_key).");

        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

migrate();
