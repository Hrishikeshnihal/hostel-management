require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT pg_get_constraintdef(oid) AS constraint_def FROM pg_constraint WHERE conname = 'rooms_status_check'")
    .then(res => { console.log(res.rows); process.exit(0); })
    .catch(console.error);
