require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT id, full_name, email FROM users WHERE full_name ILIKE '%samarth%' OR email ILIKE '%samarth%'")
  .then(res => { 
    console.log(res.rows); 
    process.exit(0); 
  })
  .catch(console.error);
