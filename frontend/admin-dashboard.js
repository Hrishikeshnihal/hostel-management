document.addEventListener('DOMContentLoaded', async () => {
    let token = localStorage.getItem('adminToken');
    const role = localStorage.getItem('role');
    
    // Backward compatibility for cached app.js (if they didn't hard refresh the login page)
    if (!token && localStorage.getItem('token') && role !== 'Student') {
        token = localStorage.getItem('token');
        localStorage.setItem('adminToken', token); // upgrade it
    }

    // Boot out anyone who isn't an Admin or Accountant
    if (!token || role === 'Student') {
        window.location.href = 'index.html';
        return;
    }

    // 1. Setup Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('role');
        window.location.href = 'index.html';
    });

    // 2. Fetch Unpaid Dues Logic
    async function fetchUnpaidDues(monthString) {
        const tbody = document.getElementById('unpaidDuesTable');
        if (!tbody) return;
        try {
            const res = await fetch(`/unpaid-dues?month=${monthString}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                    tbody.innerHTML = data.map(d => `
                        <tr>
                            <td style="padding: 16px 8px; color: var(--text); font-weight: 500;">${d.student_name}</td>
                            <td style="padding: 16px 8px; color: var(--text);"><span class="mono-num">${d.room_number}</span></td>
                            <td style="padding: 16px 8px; color: var(--text);"><span class="mono-num">₹${d.balance_pending}</span></td>
                            <td style="padding: 16px 8px; color: var(--text-muted); font-size: 0.9rem;">5th ${monthString.split(' ')[0]}</td>
                            <td style="padding: 16px 8px;"><span class="status-pill status-overdue" style="font-size:0.75rem; font-weight:bold; padding:4px 10px; border-radius:999px; background:rgba(239, 68, 68, 0.1); color:#ef4444;">Overdue</span></td>
                        </tr>
                    `).join('');
                    
                    const totalOwed = data.reduce((sum, item) => sum + Number(item.balance_pending), 0);
                    document.getElementById('statPendingAmount').innerHTML = `₹${totalOwed}`;
                } else {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px 16px; color:var(--text-muted);">No unpaid dues for ${monthString}. Everyone is paid up!</td></tr>`;
                    document.getElementById('statPendingAmount').innerHTML = `₹0`;
                }
            } else {
                const data = await res.json().catch(() => ({}));
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px 16px; color:#ef4444;">Failed to load dues: ${data.error || res.statusText}</td></tr>`;
                document.getElementById('statPendingAmount').innerHTML = `--`;
            }
        } catch (error) {
            console.error("Dues fetch error:", error);
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px 16px; color:#ef4444;">Connection error. Is the backend server running?</td></tr>`;
            document.getElementById('statPendingAmount').innerHTML = `--`;
        }
    }

    // 3. Connect the Date Picker UI to the Fetch Function
    const monthFilter = document.getElementById('monthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', (e) => {
            // Converts standard "2026-08" HTML input to "August 2026"
            const date = new Date(e.target.value);
            const monthName = date.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
            const year = date.getUTCFullYear();
            fetchUnpaidDues(`${monthName} ${year}`);
        });
    }

    // Load August 2026 by default when the page opens
    fetchUnpaidDues('August 2026');

    // 4. Fetch Complaints (Admin View)
    async function fetchComplaints() {
        try {
            const res = await fetch('/admin/complaints', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (res.ok) {
                // Update top stat card
                const openCount = data.filter(c => c.status === 'Pending').length;
                document.getElementById('statOpenComplaints').innerHTML = `${openCount}`;
                
                // Populate Table
                const tbody = document.getElementById('complaintsTable');
                if (data.length > 0) {
                    tbody.innerHTML = data.map(c => {
                        // If pending, show a clickable button. If resolved, show a static pill.
                        const statusHTML = c.status === 'Pending' 
                            ? `<button class="status-pill status-pending resolve-btn" data-id="${c.id}" style="cursor:pointer; font-family:'IBM Plex Mono', monospace; font-size:.7rem; padding:4px 10px; border-radius:999px;">Mark Resolved</button>`
                            : `<span class="status-pill status-paid" style="font-family:'IBM Plex Mono', monospace; font-size:.7rem; padding:4px 10px; border-radius:999px;">Resolved</span>`;
                        
                        return `
                        <tr>
                            <td>${c.student_name}</td>
                            <td><span class="mono-num">${c.room_number}</span></td>
                            <td>${c.issue}</td>
                            <td>${c.date}</td>
                            <td>${statusHTML}</td>
                        </tr>
                        `;
                    }).join('');
                    
                    // Attach click listeners to the new "Mark Resolved" buttons
                    document.querySelectorAll('.resolve-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const complaintId = e.target.getAttribute('data-id');
                            await resolveComplaint(complaintId);
                        });
                    });
                    
                } else {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No open maintenance complaints!</td></tr>`;
                }
            }
        } catch (error) {
            console.error("Complaints fetch error:", error);
        }
    }

    // 5. API Call to Update Complaint Status
    async function resolveComplaint(id) {
        try {
            const res = await fetch(`/admin/complaints/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ status: 'Resolved' })
            });
            
            if (res.ok) {
                fetchComplaints(); // Refresh the table automatically
            }
        } catch (err) {
            console.error("Failed to resolve complaint:", err);
        }
    }

    // Call the fetch function when the page loads
    fetchComplaints();

    // 7. Fetch Room Allocations
    async function fetchAllocations() {
        try {
            const res = await fetch('/admin/allocations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const tbody = document.getElementById('allocationsTable');
            
            if (res.ok && data.length > 0) {
                tbody.innerHTML = data.map(a => `
                    <tr>
                        <td class="mono-num">${a.student_id}</td>
                        <td style="font-weight: 500;">${a.student_name}</td>
                        <td>
                            <a href="tel:${a.student_phone || ''}" style="color: var(--primary); text-decoration: none; font-weight: 500;">
                                📞 ${a.student_phone || 'N/A'}
                            </a>
                        </td>
                        <td style="color: var(--text-muted);">${a.student_email}</td>
                        <td><span class="mono-num">${a.room_number}</span></td>
                        <td><span style="color: #34d399; font-weight: 600;">₹${a.calculated_rent || 'N/A'}</span></td>
                        <td>${a.move_in_date}</td>
                        <td>
                            <button onclick="deallocateStudent(${a.student_id})" class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Remove
                            </button>
                        </td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No rooms allocated yet.</td></tr>`;
            }
        } catch (error) {
            console.error("Allocations fetch error:", error);
        }
    }

    window.deallocateStudent = async (studentId) => {
        if (!(await showConfirmModal("Are you sure you want to remove this student and delete all their allocations, payments, and tickets?"))) return;
        try {
            const res = await fetch(`/admin/allocate/${studentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || "Student removed successfully.");
                fetchAllocations();
                fetchAdminRooms();
                fetchAdminStats();
                fetchUnpaidDues();
                fetchAllPayments();
            } else {
                showToast(data.error || "Failed to remove student.");
            }
        } catch (error) {
            console.error("Error deallocating student:", error);
            showToast("Server error during student removal.");
        }
    };

    fetchAllocations();

    // 8. Fetch Live Admin Stats with Count-Up Animation
    function animateValue(id, start, end, duration, prefix) {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const currentVal = Math.floor(progress * (end - start) + start);
            obj.innerHTML = prefix ? `${prefix}${currentVal.toLocaleString('en-IN')}` : currentVal;
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }

    async function fetchAdminStats() {
        try {
            const res = await fetch('/admin/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const stats = await res.json();

            animateValue('statTotalStudents', 0, stats.totalStudents  || 0, 1000, null);
            animateValue('statOccupiedRooms', 0, stats.occupiedRooms  || 0, 1000, null);
            animateValue('statPendingAmount', 0, stats.pendingRevenue || 0, 1200, '₹');
            animateValue('statOpenComplaints', 0, stats.openComplaints || 0, 800,  null);
        } catch (err) {
            console.error('Admin stats error:', err);
            ['statTotalStudents','statOccupiedRooms','statPendingAmount','statOpenComplaints']
                .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '--'; });
        }
    }

    fetchAdminStats();

    // ---------- Sidebar Navigation Logic ----------
    const navLinks = document.querySelectorAll('.nav-link');
    const tableCards = {
        'Dashboard': ['card-dues', 'card-allocations', 'card-complaints', 'card-admin-notices'],
        'Dues & Payments': ['card-dues'],
        'Allocations': ['card-allocations'],
        'Rooms': ['card-rooms'],
        'Complaints': ['card-complaints'],
        'Notices': ['card-admin-notices'],
        'Gate Passes': ['card-admin-gatepass'],
        'Settings': ['card-settings']
    };

    window.switchAdminTab = function(navText) {
        // 1. Swap the active styling class
        navLinks.forEach(l => {
            l.classList.remove('active');
            if (l.textContent.trim().toLowerCase() === navText.toLowerCase()) {
                l.classList.add('active');
            }
        });
        
        // 2. Hide all tables initially
        document.querySelectorAll('.bento-card').forEach(card => {
            card.style.display = 'none';
        });
        
        // 3. Show only the tables requested by the active tab
        const matchedKey = Object.keys(tableCards).find(k => k.toLowerCase() === navText.toLowerCase());
        const cardsToShow = tableCards[matchedKey];
        if (cardsToShow) {
            cardsToShow.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'block';
            });
        }
        
        // 4. Fetch data dynamically
        if (matchedKey === 'Gate Passes' && typeof fetchPendingLeaves === 'function') {
            fetchPendingLeaves();
        }
        if (['Dashboard', 'Notices'].includes(matchedKey)) {
            fetchAdminNotices();
        }
        if (matchedKey === 'Rooms' && typeof fetchAdminRooms === 'function') {
            fetchAdminRooms();
        }
        if (matchedKey === 'Onboarding' && typeof fetchAvailableRoomsForOnboarding === 'function') {
            fetchAvailableRoomsForOnboarding();
        }
        if (['Dashboard', 'Dues & Payments'].includes(matchedKey) && typeof fetchAllPayments === 'function') {
            fetchAllPayments();
        }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchAdminTab(link.textContent.trim());
        });
    });

    // Ensure only the main dashboard shows when the page first loads
    switchAdminTab('Dashboard');

    // Handle Room Allocation Form Submission
    const allocateRoomForm = document.getElementById('allocateRoomForm');
    if (allocateRoomForm) {
        allocateRoomForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                student_id: document.getElementById('allocStudentId').value,
                room_number: document.getElementById('allocRoomId').value,
                move_in_date: document.getElementById('allocMoveInDate').value
            };

            const msgElement = document.getElementById('allocationMessage');
            if (msgElement) msgElement.style.display = 'none';

            try {
                const res = await fetch('/admin/allocate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (res.ok) {
                    allocateRoomForm.reset();
                    if (msgElement) {
                        msgElement.textContent = 'Room allocated successfully!';
                        msgElement.style.color = '#34d399';
                        msgElement.style.display = 'block';
                    }
                    fetchAllocations();
                    fetchAdminRooms();
                    fetchAdminStats();
                    fetchUnpaidDues();
                    fetchAllPayments();
                } else {
                    if (msgElement) {
                        msgElement.textContent = data.error || 'Failed to allocate room.';
                        msgElement.style.color = '#f87171';
                        msgElement.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error("Error allocating room:", error);
            }
        });
    }

    // ---------- Financial Ledger (Admin Payments) ----------
    async function fetchAllPayments() {
        const tableBody = document.getElementById('adminPaymentsTableBody');
        try {
            const res = await fetch('/admin/payments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                const payments = await res.json();
                if (!tableBody) return;
                
                if (payments.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px 16px; color:var(--text-muted);">No payment records found.</td></tr>`;
                    return;
                }

                tableBody.innerHTML = payments.map(p => {
                    const formattedStudentId = String(p.student_id).padStart(4, '0');
                    return `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 16px 8px;">
                            <span style="font-weight: 500; color: var(--text); display: block;">${p.student_name || 'Student'}</span>
                            <span class="mono-num" style="font-size: 0.75rem; color: var(--text-muted);">#${formattedStudentId}</span>
                        </td>
                        <td style="padding: 16px 8px; color: var(--text);">${p.fee_type}</td>
                        <td class="mono-num" style="padding: 16px 8px; color: var(--text);">₹${p.amount}</td>
                        <td style="padding: 16px 8px; color: var(--text-muted); font-size: 0.9rem;">${p.due_date}</td>
                        <td style="padding: 16px 8px;">
                            ${p.status === 'Paid' 
                                ? `<span style="color: #34d399; font-size: 0.8rem; font-weight:500;">Paid</span>` 
                                : `<span style="color: #fbbf24; font-size: 0.8rem; font-weight:500;">Pending</span>`}
                        </td>
                        <td style="padding: 16px 8px; text-align: right;">
                            <div style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;">
                                ${p.status !== 'Paid' ? `
                                    <button onclick="markAsPaid(${p.id})" style="padding: 6px 12px; background: #00ffaa; color: #000; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold;">
                                        Mark Paid
                                    </button>
                                ` : `<span style="color: #34d399; font-size: 0.8rem; font-weight: 500;">Paid ✓</span>`}
                                <button onclick="deletePayment(${p.id})" style="padding: 6px 12px; background: transparent; color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                }).join('');
            } else {
                const data = await res.json().catch(() => ({}));
                if (tableBody) {
                    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px 16px; color:#ef4444;">Failed to load payments: ${data.error || res.statusText}</td></tr>`;
                }
            }
        } catch (error) {
            console.error("Error fetching admin payments:", error);
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px 16px; color:#ef4444;">Connection error. Is the backend server running?</td></tr>`;
            }
        }
    }

    fetchAllPayments();

    // Issue Fee Form Handler
    const issueFeeForm = document.getElementById('issueFeeForm');
    if (issueFeeForm) {
        issueFeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                student_id: document.getElementById('feeStudentId').value,
                fee_type: document.getElementById('feeType').value,
                amount: document.getElementById('feeAmount').value,
                due_date: document.getElementById('feeDueDate').value
            };

            try {
                const res = await fetch('/admin/payments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    issueFeeForm.reset();
                    fetchAllPayments();
                } else {
                    const data = await res.json();
                    await showAlertModal(`Failed to issue fee: ${data.error || 'Check Student ID.'}`);
                }
            } catch (error) {
                console.error("Error issuing fee:", error);
            }
        });
    }

    // Broadcast Notice Form Handler
    const issueNoticeForm = document.getElementById('issueNoticeForm');
    if (issueNoticeForm) {
        issueNoticeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                title: document.getElementById('noticeTitle').value,
                content: document.getElementById('noticeContent').value
            };

            try {
                const res = await fetch('/admin/notices', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    issueNoticeForm.reset();
                    await showAlertModal('Notice broadcasted successfully!');
                    fetchAdminNotices();
                } else {
                    await showAlertModal('Failed to post notice.');
                }
            } catch (error) {
                console.error("Error posting notice:", error);
            }
        });
    }

    // Fetch and display Admin Notices
    async function fetchAdminNotices() {
        window.fetchAdminNotices = fetchAdminNotices;
        const list = document.getElementById('adminNoticesList');
        if (!list) return;
        try {
            const res = await fetch('/notices', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const notices = await res.json();
                if (notices.length === 0) {
                    list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No existing announcements.</p>';
                } else {
                    list.innerHTML = notices.map(n => `
                        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <div>
                                    <h4 style="margin: 0; color: var(--text); font-size: 1rem;">${n.title}</h4>
                                    <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(n.created_at).toLocaleString()}</span>
                                </div>
                                <button onclick="deleteAdminNotice(${n.id})" style="padding: 4px 8px; background: transparent; color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Delete</button>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0; line-height: 1.4;">${n.content}</p>
                        </div>
                    `).join('');
                }
            } else {
                const data = await res.json().catch(() => ({}));
                list.innerHTML = `<p style="color: #ef4444; font-size: 0.9rem;">Failed to load announcements: ${data.error || res.statusText}</p>`;
            }
        } catch (err) {
            console.error(err);
            list.innerHTML = '<p style="color: #ef4444; font-size: 0.9rem;">Connection error. Is the backend server running?</p>';
        }
    };

    window.deleteAdminNotice = async function(id) {
        if (!(await showConfirmModal('Delete this notice?'))) return;
        try {
            const res = await fetch(`/admin/notices/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchAdminNotices();
        } catch (err) {
            console.error(err);
        }
    };

    // Global Mark as Paid Handler
    window.markAsPaid = async function(id) {
        if (!(await showConfirmModal('Mark this fee as paid?'))) return;
        try {
            const res = await fetch(`/admin/payments/${id}/pay`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                fetchAllPayments();
            } else {
                await showAlertModal('Failed to mark as paid.');
            }
        } catch (error) {
            console.error("Error updating payment:", error);
        }
    };

    // Global Delete Payment Handler
    window.deletePayment = async function(id) {
        if (!(await showConfirmModal('Are you sure you want to delete this invoice? This cannot be undone.'))) return;
        try {
            const res = await fetch(`/admin/payments/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchAllPayments();
            } else {
                const data = await res.json().catch(() => ({}));
                await showAlertModal(`Failed to delete: ${data.error || res.status}`);
            }
        } catch (error) {
            console.error("Error deleting payment:", error);
            await showAlertModal('Could not connect to server.');
        }
    };

    // ---------- Global Settings Logic ----------
    async function fetchAdminSettings() {
        try {
            const res = await fetch('/admin/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const settings = await res.json();
                document.getElementById('configHostelName').value = settings.hostel_name || '';
                document.getElementById('configDefaultRent').value = settings.default_rent || '';
                if (settings.hostel_name) {
                    document.querySelectorAll('.brand-name').forEach(el => el.textContent = settings.hostel_name);
                }
            }
        } catch (err) {
            console.error("Failed to load settings:", err);
        }
    }

    window.updateAdminSettings = async function(event) {
        event.preventDefault();
        
        const hostel_name = document.getElementById('configHostelName').value;
        const default_rent = document.getElementById('configDefaultRent').value;
        const msgBox = document.getElementById('settingsMessage');
        
        msgBox.innerHTML = '<span style="color: var(--text-muted);">Saving changes...</span>';

        try {
            const res = await fetch('/admin/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ hostel_name, default_rent })
            });

            if (res.ok) {
                msgBox.innerHTML = `<span style="color: #00ffaa; font-weight: bold;">✓ Settings updated globally</span>`;
                if (hostel_name) {
                    document.querySelectorAll('.brand-name').forEach(el => el.textContent = hostel_name);
                }
                setTimeout(() => { msgBox.innerHTML = ''; }, 3000);
            } else {
                msgBox.innerHTML = `<span style="color: #ef4444; font-weight: bold;">✗ Failed to update settings</span>`;
            }
        } catch (err) {
            msgBox.innerHTML = '<span style="color: #ef4444; font-weight: bold;">✗ Connection error</span>';
        }
    };

    // Load settings on boot
    fetchAdminSettings();

    // Admin Gate Pass Logic
    async function fetchPendingLeaves() {
        const feed = document.getElementById('adminLeaveFeed');
        if (!feed) return;
        try {
            const res = await fetch('/admin/leave', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const leaves = await res.json();
                if (leaves.length === 0) {
                    feed.innerHTML = `<p style="color: var(--text-muted);">No pending requests.</p>`;
                    return;
                }
                feed.innerHTML = leaves.map(l => `
                    <div style="padding: 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-alt); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="color: var(--text); font-size: 1rem; margin: 0 0 4px 0;">${l.name} (Room ${l.room_number || 'TBD'})</h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 4px 0;"><strong>Out:</strong> ${new Date(l.departure_date).toLocaleDateString()} | <strong>In:</strong> ${new Date(l.return_date).toLocaleDateString()}</p>
                            <p style="font-size: 0.85rem; color: var(--text); margin: 0;"><em>"${l.reason}"</em></p>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="updateLeaveStatus(${l.id}, 'Approved')" style="background: #00ffaa; color: #000; padding: 6px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Approve</button>
                            <button onclick="updateLeaveStatus(${l.id}, 'Rejected')" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 6px 16px; border-radius: 6px; cursor: pointer;">Reject</button>
                        </div>
                    </div>
                `).join('');
            } else {
                const data = await res.json().catch(() => ({}));
                feed.innerHTML = `<p style="color: #ef4444;">Failed to load requests: ${data.error || res.statusText}</p>`;
            }
        } catch (err) {
            console.error(err);
            feed.innerHTML = `<p style="color: #ef4444;">Connection error. Is the backend server running?</p>`;
        }
    }

    window.updateLeaveStatus = async function(id, status) {
        if (!(await showConfirmModal(`Are you sure you want to ${status.toLowerCase()} this pass?`))) return;
        try {
            const res = await fetch(`/admin/leave/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                fetchPendingLeaves(); // Refresh the list automatically
            }
        } catch (err) {
            console.error(err);
        }
    };

    fetchPendingLeaves();



    // ---------- Room Management Command Center ----------
    async function fetchAdminRooms() {
        window.fetchAdminRooms = fetchAdminRooms;
        try {
            const res = await fetch('/rooms', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch rooms');
            
            const rooms = await res.json();
            const grid = document.getElementById('roomsGrid');
            if (!grid) return;

            if (rooms.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-muted);">No rooms found. Add your first room above!</div>';
                return;
            }

            grid.innerHTML = rooms.map(r => `
                <div style="background: var(--surface-alt); padding: 16px; border-radius: 12px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 1.2rem; color: var(--text);">${r.room_number}</h3>
                        <span style="font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; background: ${r.status === 'Available' ? 'var(--accent-dim)' : 'rgba(239, 68, 68, 0.1)'}; color: ${r.status === 'Available' ? 'var(--accent)' : '#ef4444'};">
                            ${r.status}
                        </span>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">
                        Capacity: <strong>${r.capacity} Beds</strong>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">
                        Rent: <strong>$${r.price_per_month}/mo</strong>
                    </div>
                    <div style="margin-top: auto; padding-top: 12px; display: flex; justify-content: flex-end;">
                        <button onclick="deleteRoom(${r.id})" style="padding: 6px 12px; background: transparent; color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">
                            Delete
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error("Error fetching rooms:", error);
            const grid = document.getElementById('roomsGrid');
            if (grid) grid.innerHTML = '<div style="color: #ef4444;">Error loading rooms.</div>';
        }
    };

    window.deleteRoom = async function(id) {
        if (!(await showConfirmModal('Are you sure you want to delete this room? This action is permanent.'))) return;
        
        try {
            const res = await fetch(`/rooms/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                fetchAdminRooms();
            } else {
                const data = await res.json().catch(() => ({}));
                await showAlertModal(`Failed to delete room: ${data.error || 'Server error'}`);
            }
        } catch (error) {
            console.error("Error deleting room:", error);
        }
    };

    const addRoomForm = document.getElementById('addRoomForm');
    if (addRoomForm) {
        addRoomForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                room_number: document.getElementById('addRoomNumber').value,
                capacity: document.getElementById('addRoomCapacity').value,
                price_per_month: document.getElementById('addRoomPrice').value
            };

            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Adding...';
            btn.disabled = true;

            try {
                const res = await fetch('/rooms', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    addRoomForm.reset();
                    fetchAdminRooms();
                } else {
                    const data = await res.json().catch(() => ({}));
                    await showAlertModal(`Failed to add room: ${data.error || 'Check details.'}`);
                }
            } catch (error) {
                console.error("Error adding room:", error);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

});

// Toggle mobile sidebar
window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
};

// Close the sidebar automatically when a tab is clicked on mobile
document.querySelectorAll('.nav-link').forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.classList.remove('active');
        }
    });
});
