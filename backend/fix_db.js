require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixDB() {
    try {
        await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;');
        console.log("Constraint dropped successfully.");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
fixDB();
