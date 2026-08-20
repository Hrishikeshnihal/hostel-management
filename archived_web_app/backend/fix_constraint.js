require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixConstraint() {
    try {
        await pool.query('ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check');
        await pool.query("ALTER TABLE rooms ADD CONSTRAINT rooms_status_check CHECK (status IN ('available', 'full', 'maintenance', 'Available', 'Occupied', 'Maintenance'))");
        console.log('Constraint updated');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
fixConstraint();
