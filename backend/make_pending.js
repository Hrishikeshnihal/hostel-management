require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function makePending() {
    try {
        // Find one payment and make it pending
        await pool.query("UPDATE payments SET status = 'pending' WHERE id = (SELECT id FROM payments LIMIT 1)");
        console.log("Successfully changed one payment to 'pending'.");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
makePending();
