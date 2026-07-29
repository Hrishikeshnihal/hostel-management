require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("DELETE FROM users WHERE id = $1", [8])
  .then(res => { 
    console.log("Deleted rows:", res.rowCount); 
    process.exit(0); 
  })
  .catch(console.error);
