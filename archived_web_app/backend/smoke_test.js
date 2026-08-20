const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ id: 2, role: 'Admin', owner_id: null }, process.env.JWT_SECRET || 'supersecretjwtkey');

async function test(label, url, expectOk = true) {
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const status = res.ok ? '✅' : '❌';
        console.log(`${status} ${label}: HTTP ${res.status}`);
        if (!res.ok) { const body = await res.text(); console.log(`   ${body.substring(0, 200)}`); }
    } catch (err) {
        console.log(`❌ ${label}: ${err.message}`);
    }
}

(async () => {
    await test('GET /rooms', 'http://localhost:3000/rooms');
    await test('GET /admin/stats', 'http://localhost:3000/admin/stats');
    await test('GET /admin/complaints', 'http://localhost:3000/admin/complaints');
    await test('GET /admin/payments', 'http://localhost:3000/admin/payments');
    await test('GET /admin/allocations', 'http://localhost:3000/admin/allocations');
    await test('GET /admin/leave', 'http://localhost:3000/admin/leave');
    await test('GET /admin/settings', 'http://localhost:3000/admin/settings');
    await test('GET /notices', 'http://localhost:3000/notices');
    process.exit(0);
})();
