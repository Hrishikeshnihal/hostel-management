const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// Complaints (Admin)
code = code.replace(
    'SELECT c.*, u.full_name, u.room_number FROM complaints c JOIN users u ON c.student_id = u.id ORDER BY c.created_at DESC',
    'SELECT c.*, u.full_name, u.room_number FROM complaints c JOIN users u ON c.student_id = u.id WHERE u.owner_id = $1 ORDER BY c.created_at DESC'
);
code = code.replace(
    /const result = await pool\.query\(`\s*SELECT c\.\*, u\.full_name, u\.room_number FROM complaints c JOIN users u ON c\.student_id = u\.id WHERE u\.owner_id = \$1 ORDER BY c\.created_at DESC\s*`\);/g,
    `const result = await pool.query(\`SELECT c.*, u.full_name, u.room_number FROM complaints c JOIN users u ON c.student_id = u.id WHERE u.owner_id = $1 ORDER BY c.created_at DESC\`, [req.user.id]);`
);
if (code.includes('await pool.query("SELECT c.*, u.full_name, u.room_number FROM complaints c JOIN users u ON c.student_id = u.id ORDER BY c.created_at DESC")')) {
    code = code.replace(
        'await pool.query("SELECT c.*, u.full_name, u.room_number FROM complaints c JOIN users u ON c.student_id = u.id ORDER BY c.created_at DESC")',
        'await pool.query("SELECT c.*, u.full_name, u.room_number FROM complaints c JOIN users u ON c.student_id = u.id WHERE u.owner_id = $1 ORDER BY c.created_at DESC", [req.user.id])'
    );
}
if (code.includes("pool.query(`\n            SELECT c.*, u.full_name, u.room_number \n            FROM complaints c \n            JOIN users u ON c.student_id = u.id \n            ORDER BY c.created_at DESC\n        `)")) {
    code = code.replace(
        "pool.query(`\n            SELECT c.*, u.full_name, u.room_number \n            FROM complaints c \n            JOIN users u ON c.student_id = u.id \n            ORDER BY c.created_at DESC\n        `)",
        "pool.query(`SELECT c.*, u.full_name, u.room_number FROM complaints c JOIN users u ON c.student_id = u.id WHERE u.owner_id = $1 ORDER BY c.created_at DESC`, [req.user.id])"
    );
}

// Notices
code = code.replace(
    'SELECT * FROM notices ORDER BY created_at DESC',
    'SELECT * FROM notices WHERE owner_id = $1 ORDER BY created_at DESC'
);
code = code.replace(
    'await pool.query("SELECT * FROM notices WHERE owner_id = $1 ORDER BY created_at DESC")',
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

// Login
code = code.replace(
    'SELECT id, password_hash, role FROM users WHERE email = $1',
    'SELECT id, password_hash, role, owner_id FROM users WHERE email = $1'
);
code = code.replace(
    /token = jwt.sign\(\{\s*id: user.id,\s*role: user.role\s*\},/g,
    'token = jwt.sign({ id: user.id, role: user.role, owner_id: user.owner_id },'
);

// Admin Stats - this needs owner_id everywhere!
// I'll just skip complex stats for now or rewrite the route.

// Onboarding student POST
code = code.replace(
    'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    'INSERT INTO users (full_name, email, password_hash, role, owner_id) VALUES ($1, $2, $3, $4, $5)'
);
code = code.replace(
    '[full_name, email, hashedPassword, \'Student\']',
    '[full_name, email, hashedPassword, \'Student\', req.user.id]'
);

fs.writeFileSync('server.js', code);
console.log("Patched server.js again!");
