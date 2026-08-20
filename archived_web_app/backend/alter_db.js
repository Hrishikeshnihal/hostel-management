require('dotenv').config({ path: 'd:/HOSTEL MANAGEMENT/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        await pool.query(`ALTER TABLE rooms ALTER COLUMN price_per_month DROP NOT NULL;`);
        await pool.query(`ALTER TABLE rooms ALTER COLUMN price_per_month SET DEFAULT 5000;`);
        console.log("Fixed price_per_month column in rooms table.");
    } catch (err) {
        console.error("Error inspecting database:", err.message);
    } finally {
        await pool.end();
    }
}

main();
