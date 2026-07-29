const http = require('http');

async function runTests() {
    console.log("🚀 Starting System Audit...");
    
    // 1. Test Login
    const loginPayload = JSON.stringify({ email: 'aryan@hostel.com', password: 'admin123' });
    const loginRes = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: loginPayload
    });
    
    if (!loginRes.ok) {
        console.error("❌ Login Failed", await loginRes.text());
        return;
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log("✅ Login Successful, JWT obtained.");

    const endpoints = [
        { name: "Admin Stats", url: "http://localhost:3000/admin/stats" },
        { name: "Unpaid Dues", url: "http://localhost:3000/unpaid-dues?month=2026-07" },
        { name: "Allocations", url: "http://localhost:3000/admin/allocations" },
        { name: "Complaints", url: "http://localhost:3000/admin/complaints" },
        { name: "Gate Passes", url: "http://localhost:3000/admin/leave" }
    ];

    let allPassed = true;
    for (const ep of endpoints) {
        try {
            const res = await fetch(ep.url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                console.log(`✅ [${res.status}] ${ep.name} loaded successfully.`);
            } else {
                console.error(`❌ [${res.status}] ${ep.name} failed: ${await res.text()}`);
                allPassed = false;
            }
        } catch (err) {
            console.error(`❌ ${ep.name} threw an error: ${err.message}`);
            allPassed = false;
        }
    }
    
    if (allPassed) {
        console.log("🎉 ALL DASHBOARD FUNCTIONS ARE 100% OPERATIONAL!");
    } else {
        console.log("⚠️ SOME ENDPOINTS FAILED.");
    }
}

runTests();
