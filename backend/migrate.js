const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = `
CREATE TABLE IF NOT EXISTS hostel_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value VARCHAR(255) NOT NULL
);
INSERT INTO hostel_settings (setting_key, setting_value) 
VALUES 
    ('hostel_name', 'Wingmate Cyber Hostel'),
    ('default_rent', '5000')
ON CONFLICT (setting_key) DO NOTHING;
`;
pool.query(sql).then(() => { console.log('Migration successful'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
