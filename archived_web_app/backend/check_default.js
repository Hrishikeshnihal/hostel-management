require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT column_default FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'status'")
    .then(res => { console.log(res.rows); process.exit(0); })
    .catch(console.error);
