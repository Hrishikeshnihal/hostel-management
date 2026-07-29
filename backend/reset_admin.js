require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function resetPasswords() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('admin123', salt);
        
        await pool.query("UPDATE users SET password_hash = $1 WHERE role = 'Admin'", [hash]);
        console.log("Successfully reset all Admin passwords to 'admin123'");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
resetPasswords();
