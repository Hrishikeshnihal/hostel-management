require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("INSERT INTO rooms (room_number, capacity, price_per_month) VALUES ('TEST1', 2, 5000)")
    .then(res => { console.log('success'); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
