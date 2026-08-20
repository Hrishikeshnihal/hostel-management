require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkData() {
    try {
        const users = await pool.query("SELECT id, full_name, role, room_number FROM users WHERE role = 'Student'");
        console.log("Users:", users.rows);

        const rooms = await pool.query("SELECT * FROM rooms");
        console.log("Rooms:", rooms.rows);

        const allocations = await pool.query("SELECT * FROM allocations");
        console.log("Allocations:", allocations.rows);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
checkData();
