require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("ALTER TABLE rooms ALTER COLUMN status SET DEFAULT 'Available'")
    .then(res => { console.log('success'); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
