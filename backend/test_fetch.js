const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ id: 2, role: 'Admin' }, process.env.JWT_SECRET || 'supersecretjwtkey');

fetch('http://localhost:3000/admin/allocations', {
    headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log).catch(console.error);
