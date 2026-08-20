const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// 1. Onboarding a student
code = code.replace(
    'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    'INSERT INTO users (full_name, email, password_hash, role, owner_id) VALUES ($1, $2, $3, $4, $5)'
);
code = code.replace(
    '[full_name, email, hashedPassword, \'Student\']',
    '[full_name, email, hashedPassword, \'Student\', req.user.id]'
);

// 2. Add Room
code = code.replace(
    'INSERT INTO rooms (room_number, capacity, price_per_month) VALUES ($1, $2, $3)',
    'INSERT INTO rooms (room_number, capacity, price_per_month, owner_id) VALUES ($1, $2, $3, $4)'
);
code = code.replace(
    '[room_number, capacity, price_per_month]',
    '[room_number, capacity, price_per_month, req.user.id]'
);

// 3. Get Rooms
code = code.replace(
    'SELECT * FROM rooms ORDER BY room_number ASC',
    'SELECT * FROM rooms WHERE owner_id = $1 ORDER BY room_number ASC'
);
code = code.replace(
    'const rooms = await pool.query(query);',
    'const rooms = await pool.query(query, [req.user.id]);'
);

// 4. Admin Allocations
code = code.replace(
    /FROM allocations a\s+JOIN users u ON a.student_id = u.id\s+JOIN rooms r ON a.room_id = r.id\s+ORDER BY r.room_number/g,
    `FROM allocations a
             JOIN users u ON a.student_id = u.id
             JOIN rooms r ON a.room_id = r.id
             WHERE r.owner_id = $1
             ORDER BY r.room_number`
);
code = code.replace(
    'const allocations = await pool.query(',
    'const allocations = await pool.query(\n`SELECT \n                u.full_name as student_name, \n                r.room_number, \n                \'Main\' as block, \n                TO_CHAR(a.assigned_at, \'DD Mon YYYY\') as move_in_date\n             FROM allocations a\n             JOIN users u ON a.student_id = u.id\n             JOIN rooms r ON a.room_id = r.id\n             WHERE r.owner_id = $1\n             ORDER BY r.room_number`, [req.user.id]); // '
);

// 5. Admin Allocate (POST)
// Ensure they can only allocate their own students to their own rooms.
code = code.replace(
    '"SELECT role FROM users WHERE id = $1"',
    '"SELECT role, owner_id FROM users WHERE id = $1 AND owner_id = $2"'
);
code = code.replace(
    '[student_id]',
    '[student_id, req.user.id]'
);
code = code.replace(
    /SELECT id FROM rooms WHERE room_number = \$1/g,
    'SELECT id, owner_id FROM rooms WHERE room_number = $1 AND owner_id = $2'
);
code = code.replace(
    /\[room_number\]/g,
    '[room_number, req.user.id]'
);

// 6. Admin Complaints
code = code.replace(
    /SELECT c.*, u.full_name, u.room_number \s+FROM complaints c \s+JOIN users u ON c.student_id = u.id \s+ORDER BY c.created_at DESC/g,
    `SELECT c.*, u.full_name, u.room_number FROM complaints c JOIN users u ON c.student_id = u.id WHERE u.owner_id = $1 ORDER BY c.created_at DESC`
);
code = code.replace(
    /await pool.query\(`\s*SELECT c.*, u.full_name, u.room_number FROM complaints c JOIN users u ON c.student_id = u.id WHERE u.owner_id = \$1 ORDER BY c.created_at DESC\s*`\)/g,
    `await pool.query(\`SELECT c.*, u.full_name, u.room_number FROM complaints c JOIN users u ON c.student_id = u.id WHERE u.owner_id = $1 ORDER BY c.created_at DESC\`, [req.user.id])`
);

// 7. Admin Leave
code = code.replace(
    /SELECT l.*, u.full_name as name, u.room_number \s+FROM leave_requests l \s+JOIN users u ON l.student_id = u.id \s+WHERE l.status = 'Pending' \s+ORDER BY l.created_at ASC/g,
    `SELECT l.*, u.full_name as name, u.room_number FROM leave_requests l JOIN users u ON l.student_id = u.id WHERE l.status = 'Pending' AND u.owner_id = $1 ORDER BY l.created_at ASC`
);
code = code.replace(
    /await pool.query\(`\s*SELECT l.*, u.full_name as name, u.room_number FROM leave_requests l JOIN users u ON l.student_id = u.id WHERE l.status = 'Pending' AND u.owner_id = \$1 ORDER BY l.created_at ASC\s*`\)/g,
    `await pool.query(\`SELECT l.*, u.full_name as name, u.room_number FROM leave_requests l JOIN users u ON l.student_id = u.id WHERE l.status = 'Pending' AND u.owner_id = $1 ORDER BY l.created_at ASC\`, [req.user.id])`
);

// 8. Notices
code = code.replace(
    'SELECT * FROM notices ORDER BY created_at DESC',
    'SELECT * FROM notices WHERE owner_id = $1 ORDER BY created_at DESC'
);
code = code.replace(
    /await pool.query\("SELECT \* FROM notices WHERE owner_id = \$1 ORDER BY created_at DESC"\)/g,
    'await pool.query("SELECT * FROM notices WHERE owner_id = $1 ORDER BY created_at DESC", [req.user.role === "Admin" ? req.user.id : req.user.owner_id])'
);
code = code.replace(
    'INSERT INTO notices (title, content, type) VALUES ($1, $2, $3)',
    'INSERT INTO notices (title, content, type, owner_id) VALUES ($1, $2, $3, $4)'
);
code = code.replace(
    '[title, content, type]',
    '[title, content, type, req.user.id]'
);

// 9. Fix Login to fetch owner_id
code = code.replace(
    'SELECT id, password_hash, role FROM users WHERE email = $1',
    'SELECT id, password_hash, role, owner_id FROM users WHERE email = $1'
);
code = code.replace(
    /token = jwt.sign\(\{\s*id: user.id,\s*role: user.role\s*\},/g,
    'token = jwt.sign({ id: user.id, role: user.role, owner_id: user.owner_id },'
);

fs.writeFileSync('server.js', code);
console.log("Patched server.js!");
