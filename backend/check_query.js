require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
    SELECT 
        u.full_name as student_name, 
        r.room_number, 
        'Main' as block, 
        TO_CHAR(a.assigned_at, 'DD Mon YYYY') as move_in_date
    FROM allocations a
    JOIN users u ON a.student_id = u.id
    JOIN rooms r ON a.room_id = r.id
    ORDER BY r.room_number
`).then(res => { console.log(res.rows); process.exit(0); }).catch(console.error);
