document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) return window.location.href = 'index.html';

    // 1. Setup Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = 'index.html';
    });

    // 2. Fetch Room Details
    try {
        const roomRes = await fetch('/my-room', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const roomData = await roomRes.json();
        
        if (roomRes.ok && roomData.assigned) {
            const { room, roommates } = roomData;

            // Populate dashboard mini-stats
            const statRoom = document.getElementById('statRoomNumber');
            if (statRoom) {
                statRoom.classList.remove('stat-skel');
                statRoom.innerHTML = `<span class="mono-num">${room.room_number}</span>`;
            }
            
            // Populate dashboard mini-card
            document.getElementById('roomDetails').innerHTML = `
                <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom:1px solid var(--border);">
                    <span style="font-size: .85rem; color: var(--text-muted);">Room Number</span>
                    <span class="mono-num">${room.room_number}</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding: 8px 0;">
                    <span style="font-size: .85rem; color: var(--text-muted);">Block</span>
                    <span>${room.block}</span>
                </div>
            `;

            // Populate the full My Room view
            document.getElementById('fullRoomDetails').innerHTML = `
                <div>
                    <span class="section-label">Room Number</span>
                    <div style="font-size: 1.4rem; font-weight: 600; font-family: 'IBM Plex Mono', monospace;">${room.room_number}</div>
                </div>
                <div>
                    <span class="section-label">Block</span>
                    <div style="font-size: 1.1rem; font-weight: 500;">${room.block}</div>
                </div>
                <div>
                    <span class="section-label">Move-in Date</span>
                    <div style="font-size: 1.1rem; font-weight: 500;">${room.move_in_date}</div>
                </div>
            `;

            if (roommates && roommates.length > 0) {
                document.getElementById('roommatesList').innerHTML = roommates.map(rm => `
                    <tr>
                        <td>${rm.name}</td>
                        <td style="color: var(--text-muted);">${rm.email}</td>
                    </tr>
                `).join('');
            } else {
                document.getElementById('roommatesList').innerHTML = `<tr><td colspan="2" style="text-align:center;">You have the room to yourself!</td></tr>`;
            }

        } else {
            // Unassigned state
            const unassignedMsg = `<div style="padding: 20px 0; color: var(--text-muted); text-align: center;">You have not been assigned a room yet.</div>`;
            document.getElementById('roomDetails').innerHTML = unassignedMsg;
            document.getElementById('fullRoomDetails').innerHTML = unassignedMsg;
            document.getElementById('roommatesList').innerHTML = `<tr><td colspan="2" style="text-align:center;">Unassigned</td></tr>`;
            
            const statRoom = document.getElementById('statRoomNumber');
            if (statRoom) {
                statRoom.classList.remove('stat-skel');
                statRoom.innerHTML = '--';
            }
        }
    } catch (error) {
        console.error("Room fetch error:", error);
    }

    // 3. Fetch Payment History
    try {
        const payRes = await fetch('/my-payments', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const payData = await payRes.json();
        
        if (payRes.ok && payData.length > 0) {
            const pendingPayments = payData.filter(p => (p.status || '').toLowerCase() !== 'paid' && (p.status || '').toLowerCase() !== 'completed');
            const totalDue = pendingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

            const statRent = document.getElementById('statRentDue');
            if (statRent) {
                statRent.classList.remove('stat-skel');
                statRent.innerHTML = `₹${totalDue}`;
            }

            const statNext = document.getElementById('statNextDueDate');
            if (statNext) {
                statNext.classList.remove('stat-skel');
                if (pendingPayments.length > 0) {
                    statNext.innerHTML = `${pendingPayments[0].due_date}`;
                } else {
                    statNext.innerHTML = `No Dues`;
                }
            }

            const payElem = document.getElementById('paymentHistory');
            if (payElem) {
                payElem.innerHTML = payData.map(p => `
                    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);">
                        <span style="font-size: .87rem; color: var(--text);">${p.fee_type || p.payment_month || 'Hostel Fee'}</span>
                        <span class="mono-num" style="font-weight: 500; color: var(--text);">₹${p.amount}</span>
                    </div>
                `).join('');
            }
        } else {
            const statRent = document.getElementById('statRentDue');
            if (statRent) {
                statRent.classList.remove('stat-skel');
                statRent.innerHTML = `₹0`;
            }
            const statNext = document.getElementById('statNextDueDate');
            if (statNext) {
                statNext.classList.remove('stat-skel');
                statNext.innerHTML = `No Dues`;
            }
            const payElem = document.getElementById('paymentHistory');
            if (payElem) payElem.innerHTML = 'No payment history found.';
        }
    } catch (error) {
        console.error("Payment fetch error:", error);
    }

    // 4. Fetch Tickets / Complaints
    async function fetchComplaints() {
        try {
            const compRes = await fetch('/my-complaints', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const tickets = await compRes.json();
            
            if (compRes.ok) {
                // Update top stat card
                const openCount = tickets.filter(c => c.status === 'Pending' || c.status === 'Open').length;
                const statElem = document.getElementById('statOpenComplaints');
                if (statElem) {
                    statElem.classList.remove('stat-skel');
                    statElem.innerHTML = `${openCount}`;
                }
                
                const feed = document.getElementById('ticketFeed');
                if (feed) {
                    if (tickets.length === 0) {
                        feed.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No active or past tickets.</p>`;
                    } else {
                        const getTicketBadge = (status) => {
                            const s = (status || '').toLowerCase();
                            if (s === 'resolved') return `<span style="padding: 4px 8px; border-radius: 4px; background: rgba(52, 211, 153, 0.1); color: #34d399; font-size: 0.75rem;">Resolved</span>`;
                            if (s === 'in progress') return `<span style="padding: 4px 8px; border-radius: 4px; background: rgba(96, 165, 250, 0.1); color: #60a5fa; font-size: 0.75rem;">In Progress</span>`;
                            return `<span style="padding: 4px 8px; border-radius: 4px; background: rgba(156, 163, 175, 0.1); color: #9ca3af; font-size: 0.75rem;">Open</span>`;
                        };

                        feed.innerHTML = tickets.map(t => `
                            <div style="padding: 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); margin-bottom: 8px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="font-weight: 500; color: var(--text);">${t.category || 'General'}</span>
                                    ${getTicketBadge(t.status)}
                                </div>
                                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 12px;">${t.description || t.issue}</p>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">${t.date}</span>
                            </div>
                        `).join('');
                    }
                }
            }
        } catch (error) {
            console.error("Complaints fetch error:", error);
        }
    }
    fetchComplaints();

    // 5. Clear placeholders for remaining unbuilt features
    const statNextFinal = document.getElementById('statNextDueDate');
    if (statNextFinal && statNextFinal.classList.contains('stat-skel')) {
        statNextFinal.classList.remove('stat-skel');
        if (!statNextFinal.innerHTML) statNextFinal.innerHTML = `No Dues`;
    }

    // 6. Tab Navigation Logic with Auto Data Refresh
    function handleTabSwitch(targetId) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
        if (activeLink) activeLink.classList.add('active');
        
        document.querySelectorAll('.nav-section').forEach(s => s.style.display = 'none');
        const targetElem = document.getElementById(targetId);
        if (targetElem) {
            if (targetId === 'view-profile') {
                targetElem.style.display = 'flex';
            } else {
                targetElem.style.display = 'block';
            }
        } else {
            console.error(`Section with ID "${targetId}" not found.`);
        }

        // Trigger data refreshes on tab switch
        if (targetId === 'view-payments') fetchPayments();
        if (targetId === 'view-notices') fetchNotices();
        if (targetId === 'view-complaints') fetchComplaints();
        if (targetId === 'view-profile') fetchProfile();
        if (targetId === 'view-gate-pass') fetchGatePasses();
    }

    window.switchTab = handleTabSwitch;

    document.querySelectorAll('.nav-link[data-target]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = e.currentTarget.getAttribute('data-target');
            handleTabSwitch(targetId);
        });
    });

    // 7. Submit New Maintenance Ticket
    const ticketForm = document.getElementById('ticketForm');
    if (ticketForm) {
        ticketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const category = document.getElementById('ticketCategory').value;
            const description = document.getElementById('ticketDescription').value;
            const btn = e.target.querySelector('button');
            const origText = btn.textContent;
            btn.textContent = 'Submitting...';
            btn.disabled = true;

            try {
                const res = await fetch('/complaints', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ category, description })
                });
                if (res.ok) {
                    ticketForm.reset();
                    fetchComplaints();
                }
            } catch (err) {
                console.error(err);
            } finally {
                btn.textContent = origText;
                btn.disabled = false;
            }
        });
    } // <-- RE-ADDED THIS BRACE

    // 8. Fetch Profile Details (Cyber Card Integration)
    async function fetchProfile() {
        try {
            const res = await fetch('/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                
                // Split the name to put First Name on top, Last Name on bottom
                const nameParts = (data.name || '').split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                const rawId = data.student_id || data.id;
                const formattedId = String(rawId).padStart(4, '0');

                // Inject the data into the Cyber Card
                const nameElem = document.getElementById('cyberCardName');
                const idElem = document.getElementById('cyberCardId');
                
                if (nameElem) {
                    nameElem.innerHTML = `${firstName.toUpperCase()}<br />${lastName.toUpperCase()}`;
                }
                if (idElem) {
                    idElem.innerText = `#${formattedId}`;
                }
            }
        } catch (error) {
            console.error("Profile fetch error:", error);
        }
    }

    fetchProfile();

    // 9. Fetch Payment Ledger
    async function fetchPayments() {
        const paymentFeed = document.getElementById('paymentFeed');

        try {
            const res = await fetch('/my-payments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                if (paymentFeed) paymentFeed.innerHTML = `<div style="padding: 24px 8px; color: #ef4444;">Backend Error: Failed to fetch payments (${res.status})</div>`;
                return;
            }

            const payments = await res.json();

            if (!paymentFeed) return;

            if (!payments || payments.length === 0) {
                paymentFeed.innerHTML = `
                    <div style="padding: 24px 8px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
                        No payment records found.
                    </div>`;
                return;
            }

            paymentFeed.innerHTML = payments.map(p => {
                const statusStr = (p.status || 'pending').toLowerCase();
                const isPaid = (statusStr === 'paid' || statusStr === 'completed');
                
                // The Right Side Action HTML
                let actionHTML = '';
                
                if (isPaid) {
                    actionHTML = `<span style="padding: 4px 12px; border-radius: 12px; background: rgba(0, 255, 170, 0.1); color: #00ffaa; font-weight: bold; font-size: 0.8rem; border: 1px solid #00ffaa;">PAID</span>`;
                } else {
                    // Inject the New Uiverse Pay Button
                    actionHTML = `
                    <div class="pay-btn-container" onclick="studentPay(${p.id})" style="margin: -25px -40px;">
                        <div class="pay-btn-left-side">
                            <div class="pay-btn-card">
                                <div class="pay-btn-card-line"></div>
                                <div class="pay-btn-buttons"></div>
                            </div>
                            <div class="pay-btn-post">
                                <div class="pay-btn-post-line"></div>
                                <div class="pay-btn-screen"><div class="pay-btn-dollar">₹</div></div>
                                <div class="pay-btn-numbers"></div>
                                <div class="pay-btn-numbers-line2"></div>
                            </div>
                        </div>
                        <div class="pay-btn-right-side">
                            <div class="pay-btn-new">Pay ₹${p.amount}</div>
                            <svg viewBox="0 0 451.846 451.847" height="20" width="20" xmlns="http://www.w3.org/2000/svg" class="pay-btn-arrow"><path fill="#cfcfcf" d="M345.441 248.292L151.154 442.573c-12.359 12.365-32.397 12.365-44.75 0-12.354-12.354-12.354-32.391 0-44.744L278.318 225.92 106.409 54.017c-12.354-12.359-12.354-32.394 0-44.748 12.354-12.359 32.391-12.359 44.75 0l194.287 194.284c6.177 6.18 9.262 14.271 9.262 22.366 0 8.099-3.091 16.196-9.267 22.373z"></path></svg>
                        </div>
                    </div>`;
                }

                return `
                <div style="padding: 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-hover, var(--surface)); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; min-height: 70px;">
                    <div>
                        <h3 style="color: var(--text); font-size: 1rem; margin: 0 0 4px 0;">${p.fee_type || 'Hostel Rent'}</h3>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${p.payment_month || 'N/A'}</span>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: flex-end; min-width: 150px;">
                        ${actionHTML}
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error("Payments fetch error:", error);
            if (paymentFeed) {
                paymentFeed.innerHTML = `<div style="padding: 16px 8px; color: #ef4444;">Failed to connect to the server.</div>`;
            }
        }
    }

    // Student Pay Handler (Simulated Gateway)
    window.studentPay = async function(paymentId) {
        if (!(await showConfirmModal('Confirm payment? This will mark the invoice as paid.'))) return;
        try {
            const res = await fetch(`/student/payments/${paymentId}/pay`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                showAlertModal('Payment Successful!');
                fetchPayments();
            } else {
                const data = await res.json().catch(() => ({}));
                showAlertModal(`Payment failed: ${data.error || res.status}`);
            }
        } catch (err) {
            console.error('Student pay error:', err);
            showAlertModal('Could not connect to server.');
        }
    };

    fetchPayments();

    // 10. Fetch and Display Notices
    async function fetchNotices() {
        try {
            const res = await fetch('/notices', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                const notices = await res.json();
                const feed = document.getElementById('noticeFeed');
                const noticeBoard = document.getElementById('noticeBoard');
                
                if (notices.length === 0) {
                    if (feed) feed.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No active announcements right now.</p>`;
                    if (noticeBoard) noticeBoard.innerHTML = `No new notices.`;
                    return;
                }

                if (feed) {
                    feed.innerHTML = notices.map(n => `
                        <div style="padding: 20px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                                <h3 style="color: var(--text); font-size: 1.1rem; margin: 0; font-weight: 500;">${n.title}</h3>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">${n.date}</span>
                            </div>
                            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px; line-height: 1.6;">${n.content}</p>
                            <span style="font-size: 0.75rem; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">By ${n.posted_by || 'Warden Office'}</span>
                        </div>
                    `).join('');
                }

                if (noticeBoard) {
                    const latest = notices[0];
                    noticeBoard.innerHTML = `<strong>${latest.title}</strong>: ${latest.content.substring(0, 80)}...`;
                }
            }
        } catch (error) {
            console.error("Error fetching notices:", error);
        }
    }

    fetchNotices();
});

// Handle Password Update Form Submission
async function updatePassword(event) {
    event.preventDefault(); // Prevent the page from refreshing
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const msgBox = document.getElementById('passwordMessage');
    const token = localStorage.getItem('token');

    // Show loading state
    msgBox.innerHTML = '<span style="color: var(--text-muted);">Processing update...</span>';

    try {
        const res = await fetch('/student/profile/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();

        if (res.ok) {
            // Success styling
            msgBox.innerHTML = `<span style="color: #00ffaa; font-weight: bold;">✓ ${data.message}</span>`;
            document.getElementById('passwordUpdateForm').reset(); // Clear the inputs
            
            // Clear message after 4 seconds
            setTimeout(() => { msgBox.innerHTML = ''; }, 4000);
        } else {
            // Error styling
            msgBox.innerHTML = `<span style="color: #ef4444; font-weight: bold;">✗ ${data.error}</span>`;
        }
    } catch (err) {
        console.error("Password update failed:", err);
        msgBox.innerHTML = '<span style="color: #ef4444; font-weight: bold;">✗ Connection error to server</span>';
    }
}

async function submitLeaveRequest(event) {
    event.preventDefault();
    const reason = document.getElementById('leaveReason').value;
    const departure_date = document.getElementById('leaveDeparture').value;
    const return_date = document.getElementById('leaveReturn').value;

    try {
        const res = await fetch('/student/leave', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ reason, departure_date, return_date })
        });
        if (res.ok) {
            await showAlertModal("Gate pass request submitted to Warden!");
            document.getElementById('leaveRequestForm').reset();
            fetchGatePasses();
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchGatePasses() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('gatePassFeed');
    if (!container) return;
    try {
        const res = await fetch('/student/leave', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const passes = await res.json();
            if (passes.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No gate passes requested yet.</p>';
            } else {
                container.innerHTML = passes.map(p => {
                    let statusColor = p.status === 'Approved' ? '#5de2a3' : (p.status === 'Rejected' ? '#ef4444' : '#f59e0b');
                    return `
                    <div style="background: var(--surface-hover); border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-weight: 500; color: var(--text);">Dates: ${p.departure_date} to ${p.return_date}</span>
                            <span style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">${p.status}</span>
                        </div>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Reason: ${p.reason}</p>
                    </div>`;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Failed to fetch gate passes', err);
        container.innerHTML = '<p style="color: #ef4444; font-size: 0.9rem;">Failed to load gate passes.</p>';
    }
}

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
