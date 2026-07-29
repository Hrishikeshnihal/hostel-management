// 1. Import necessary packages
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const authenticateToken = require('./middleware/auth');
const authorizeRoles = require('./middleware/roleAuth');
let firebaseAuth = null;
let firebaseInitError = null;
try {
    const fb = require('./firebaseAdmin');
    firebaseAuth = fb.firebaseAuth;
    firebaseInitError = fb.firebaseInitError;
} catch (e) {
    firebaseInitError = 'Module load failed: ' + e.message;
    console.error('FATAL: Failed to load firebaseAdmin module:', e.message);
}

// 2. Initialize the Express application
const app = express();
const path = require('path');

// Allow the server to read JSON data sent in requests
app.use(cors());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// 3. Configure the Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('supabase') || process.env.DATABASE_URL.includes('neon') || process.env.DATABASE_URL.includes('render'))
        ? { rejectUnauthorized: false }
        : false
});

// Debug endpoint to verify Firebase Admin initialization (always available)
app.get('/debug/firebase', (req, res) => {
    if (firebaseInitError) {
        return res.status(500).json({ error: firebaseInitError });
    }
    if (!firebaseAuth) {
        return res.status(500).json({ error: 'firebaseAuth is null (no error reported)' });
    }
    res.json({ status: 'Firebase Admin initialized successfully' });
});



// Prevent database connection issues from crashing the node server process
pool.on('error', (err) => {
    console.error('Unexpected database client error:', err.message || err);
});

// 4. Create a test route to verify the connection
app.get('/test-connection', async (req, res) => {
    try {
        // This asks Postgres for the current time just to prove it's listening
        const result = await pool.query('SELECT NOW()'); 
        res.status(200).json({
            message: "Database connected successfully!",
            time: result.rows[0].now
        });
    } catch (err) {
        console.error("Connection error:", err.message);
        res.status(500).json({ error: "Failed to connect to the database" });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body || {};

        // 1. Basic validation
        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // 2. Hash the password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Insert user into the database
        // The $1, $2 are parameterized queries to prevent SQL injection hacking
        const newUser = await pool.query(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role",
            [name, email, hashedPassword, role]
        );

        // 4. Send success response (notice we don't send the password back)
        res.status(201).json({ message: "User registered successfully!", user: newUser.rows[0] });

    } catch (err) {
        // Error code 23505 means the email violates our UNIQUE constraint
        if (err.code === '23505') {
            return res.status(400).json({ error: "A user with this email already exists" });
        }
        console.error("Registration error:", err.message);
        res.status(500).json({ error: "Server error during registration" });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};

        // 1. Check if email and password were provided
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        // 2. Check if the user exists in the database
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        const user = userResult.rows[0];

        // 3. Compare the typed password with the hashed password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // 4. Generate the JWT "Wristband"
        // We lock the user's ID and Role inside the token
        const token = jwt.sign(
            { id: user.id, role: user.role, owner_id: user.owner_id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' } // Token expires in 24 hours
        );

        // 5. Send success response with the token
        res.status(200).json({
            message: "Logged in successfully!",
            token: token,
            user: { id: user.id, name: user.full_name, role: user.role }
        });

    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ error: "Server error during login" });
    }
});

app.get('/dashboard', authenticateToken, (req, res) => {
    // Because of the middleware, we now have access to req.user here!
    res.status(200).json({ 
        message: `Welcome to the protected dashboard!`,
        userRole: req.user.role,
        userId: req.user.id
    });
});

// ====== Firebase Authentication Route ======
// This route verifies a Firebase ID token (from Google or email/password sign-in)
// and issues our own JWT for all subsequent API calls.
app.post('/auth/firebase', async (req, res) => {
    try {
        // Guard: check that Firebase Admin loaded
        if (!firebaseAuth || firebaseInitError) {
            return res.status(500).json({ error: 'Firebase Admin SDK not available: ' + (firebaseInitError || 'unknown') });
        }

        const { idToken, selectedRole, hostelName } = req.body || {};

        if (!idToken) {
            return res.status(400).json({ error: 'Firebase ID token is required' });
        }

        // 1. Verify the Firebase ID token
        const decodedToken = await firebaseAuth.verifyIdToken(idToken);
        const firebaseEmail = decodedToken.email;
        const firebaseName = decodedToken.name || decodedToken.email.split('@')[0];
        const firebaseUid = decodedToken.uid;

        if (!firebaseEmail) {
            return res.status(400).json({ error: 'No email found in Firebase token' });
        }

        // 2. Look up user in our database by email
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [firebaseEmail]);

        let user;
        if (userResult.rows.length > 0) {
            // Existing user — use their stored role and owner_id
            user = userResult.rows[0];
        } else {
            // New user — create account with the selected role
            const dbRole = (selectedRole === 'hostel-owner') ? 'Admin' : 'Student';

            // Create a placeholder password hash (Firebase manages auth, not us)
            const placeholderHash = await bcrypt.hash(firebaseUid + Date.now(), 10);

            let ownerId = null;
            if (dbRole === 'Student') {
                // Assign to the first admin (single-owner setup)
                const ownerResult = await pool.query(
                    "SELECT id FROM users WHERE LOWER(role) = 'admin' ORDER BY created_at ASC LIMIT 1"
                );
                if (ownerResult.rows.length > 0) {
                    ownerId = ownerResult.rows[0].id;
                }
            }

            const newUser = await pool.query(
                'INSERT INTO users (full_name, email, password_hash, role, owner_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [firebaseName, firebaseEmail, placeholderHash, dbRole, ownerId]
            );
            user = newUser.rows[0];

            // For a new Admin, set owner_id to their own id & create default hostel settings
            if (dbRole === 'Admin') {
                await pool.query('UPDATE users SET owner_id = $1 WHERE id = $1', [user.id]);
                user.owner_id = user.id;

                const nameForHostel = hostelName || `${firebaseName}'s Hostel`;
                await pool.query(
                    `INSERT INTO hostel_settings (setting_key, setting_value, owner_id)
                     VALUES ('hostel_name', $1, $2), ('default_rent', '5000', $2)
                     ON CONFLICT (owner_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
                    [nameForHostel, user.id]
                );
            }
        }

        // 3. Issue our own JWT (same shape as the existing /login route)
        const token = jwt.sign(
            { id: user.id, role: user.role, owner_id: user.owner_id || user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // 4. Return token + user info (same format as /login)
        res.status(200).json({
            message: 'Authenticated successfully!',
            token: token,
            user: { id: user.id, name: user.full_name, role: user.role }
        });

    } catch (err) {
        console.error('Firebase auth error:', err.message);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'A user with this email already exists' });
        }
        res.status(401).json({ error: 'Firebase authentication failed: ' + err.message });
    }
});

// CREATE a new room (Admin Only)
app.post('/rooms', authenticateToken, authorizeRoles('Admin', 'Warden'), async (req, res) => {
    try {
        const { room_number, capacity, price_per_month } = req.body || {};
        const ownerId = req.user.owner_id || req.user.id;
        
        const newRoom = await pool.query(
            "INSERT INTO rooms (room_number, capacity, price_per_month, owner_id) VALUES ($1, $2, $3, $4) RETURNING *",
            [room_number, capacity, price_per_month, ownerId]
        );
        res.status(201).json({ message: "Room added!", room: newRoom.rows[0] });
    } catch (err) {
        console.error("Error creating room:", err);
        if (err.code === '23505') return res.status(400).json({ error: "Room number already exists" });
        res.status(500).json({ error: "Server error" });
    }
});

// READ all rooms (Any logged-in user)
app.get('/rooms', authenticateToken, async (req, res) => {
    try {
        const ownerId = req.user.role.toLowerCase() === 'student' ? req.user.owner_id : (req.user.owner_id || req.user.id);
        const allRooms = await pool.query("SELECT * FROM rooms WHERE owner_id = $1 ORDER BY room_number ASC", [ownerId]);
        res.status(200).json(allRooms.rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// UPDATE a room's status or price (Admin Only)
app.put('/rooms/:id', authenticateToken, authorizeRoles('Admin', 'Warden'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, price_per_month } = req.body || {};
        const ownerId = req.user.owner_id || req.user.id;

        const updatedRoom = await pool.query(
            "UPDATE rooms SET status = $1, price_per_month = $2 WHERE id = $3 AND owner_id = $4 RETURNING *",
            [status, price_per_month, id, ownerId]
        );

        if (updatedRoom.rows.length === 0) {
            return res.status(404).json({ error: "Room not found" });
        }
        res.status(200).json({ message: "Room updated!", room: updatedRoom.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// DELETE a room (Admin Only)
app.delete('/rooms/:id', authenticateToken, authorizeRoles('Admin', 'Warden'), async (req, res) => {
    try {
        const { id } = req.params;
        const ownerId = req.user.owner_id || req.user.id;
        
        const deletedRoom = await pool.query("DELETE FROM rooms WHERE id = $1 AND owner_id = $2 RETURNING *", [id, ownerId]);
        
        if (deletedRoom.rows.length === 0) {
            return res.status(404).json({ error: "Room not found" });
        }
        res.status(200).json({ message: "Room deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});



// RECORD a payment (Accountant & Admin Only)
app.post('/payments', authenticateToken, authorizeRoles('Accountant', 'Admin'), async (req, res) => {
    try {
        const { student_id, amount, payment_month, status = 'completed' } = req.body || {};

        // 1. Verify the student exists
        const studentCheck = await pool.query("SELECT role, owner_id FROM users WHERE id = $1 AND owner_id = $2", [student_id, req.user.id]);
        if (studentCheck.rows.length === 0 || studentCheck.rows[0].role !== 'Student') {
            return res.status(400).json({ error: "Invalid ID or user is not a Student." });
        }

        // 2. Insert the payment record
        const newPayment = await pool.query(
            "INSERT INTO payments (student_id, amount, payment_month, status) VALUES ($1, $2, $3, $4) RETURNING *",
            [student_id, amount, payment_month, status]
        );

        res.status(201).json({ 
            message: "Payment recorded successfully!", 
            payment: newPayment.rows[0] 
        });
    } catch (err) {
        console.error("Error recording payment:", err);
        res.status(500).json({ error: "Server error recording payment." });
    }
});

// VIEW all payments ledger (Accountant & Admin Only)
app.get('/payments', authenticateToken, authorizeRoles('Accountant', 'Admin'), async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id AS receipt_number,
                u.full_name AS student_name,
                u.email,
                p.amount,
                p.payment_month,
                p.status,
                p.recorded_at
            FROM payments p
            JOIN users u ON p.student_id = u.id
            ORDER BY p.recorded_at DESC;
        `;
        
        const results = await pool.query(query);
        res.status(200).json(results.rows);
    } catch (err) {
        console.error("Error fetching payments:", err);
        res.status(500).json({ error: "Server error fetching payments." });
    }
});



// VIEW students with unpaid dues for a specific month (Accountant & Admin)
app.get('/unpaid-dues', authenticateToken, authorizeRoles('Accountant', 'Admin'), async (req, res) => {
    try {
        // This grabs the month from the URL (e.g., /unpaid-dues?month=August 2026)
        const { month } = req.query; 

        if (!month) {
            return res.status(400).json({ error: "Please provide a month (e.g., ?month=August 2026)." });
        }

        const ownerId = req.user.owner_id || req.user.id;
        const query = `
            SELECT 
                u.full_name AS student_name,
                u.email,
                r.room_number,
                r.price_per_month AS rent_due,
                COALESCE(SUM(p.amount), 0) AS amount_paid,
                (r.price_per_month - COALESCE(SUM(p.amount), 0)) AS balance_pending
            FROM allocations a
            JOIN users u ON a.student_id = u.id
            JOIN rooms r ON a.room_id = r.id
            -- LEFT JOIN ensures we keep the student even if they have 0 payments
            LEFT JOIN payments p ON p.student_id = u.id AND p.payment_month = $1 AND p.status = 'completed'
            WHERE u.owner_id = $2 AND LOWER(u.role) = 'student'
            GROUP BY u.id, u.full_name, u.email, r.room_number, r.price_per_month
            HAVING (r.price_per_month - COALESCE(SUM(p.amount), 0)) > 0
            ORDER BY r.room_number ASC;
        `;

        const results = await pool.query(query, [month, ownerId]);
        res.status(200).json(results.rows);
        
    } catch (err) {
        console.error("Error fetching unpaid dues:", err);
        res.status(500).json({ error: "Server error fetching unpaid dues." });
    }
});

// POST: Student creates a new complaint
// POST: Student submits a new maintenance ticket
app.post('/complaints', authenticateToken, async (req, res) => {
    try {
        if (req.user.role && req.user.role.toLowerCase() !== 'student') {
            return res.status(403).json({ error: 'Only students can log complaints.' });
        }

        const { category, description, issue } = req.body;
        const ticketDesc = description || issue;
        const ticketCategory = category || 'General';

        if (!ticketDesc) return res.status(400).json({ error: 'Issue description is required.' });

        const newTicket = await pool.query(
            `INSERT INTO complaints (student_id, category, description, issue) 
             VALUES ($1, $2, $3, $3) 
             RETURNING *`,
            [req.user.id, ticketCategory, ticketDesc]
        ).catch(async () => {
            return await pool.query(
                `INSERT INTO complaints (student_id, issue) 
                 VALUES ($1, $2) RETURNING *`,
                [req.user.id, ticketDesc]
            );
        });

        res.status(201).json({ message: 'Ticket submitted', ticket: newTicket.rows[0] });
    } catch (err) {
        console.error("Error submitting ticket:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET: Student views their ticket history
app.get('/my-complaints', authenticateToken, async (req, res) => {
    try {
        const complaintsQuery = await pool.query(
            `SELECT id, 
                    COALESCE(category, 'General') as category, 
                    COALESCE(description, issue) as description, 
                    COALESCE(issue, description) as issue,
                    status, 
                    TO_CHAR(created_at, 'DD Mon YYYY') as date 
             FROM complaints 
             WHERE student_id = $1 
             ORDER BY created_at DESC`,
            [req.user.id]
        ).catch(async () => {
            return await pool.query(
                `SELECT id, 'General' as category, issue as description, issue, status, TO_CHAR(created_at, 'DD Mon YYYY') as date 
                 FROM complaints 
                 WHERE student_id = $1 
                 ORDER BY created_at DESC`,
                [req.user.id]
            );
        });
        
        res.json(complaintsQuery.rows);
    } catch (err) {
        console.error("Error fetching tickets:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET: Student views their own room details and roommates
app.get('/my-room', authenticateToken, async (req, res) => {
    try {
        // 1. Find the logged-in student's room allocation
        const roomQuery = await pool.query(
            `SELECT 
                r.id as room_id, 
                r.room_number, 
                r.block, 
                TO_CHAR(a.assigned_at, 'DD Mon YYYY') as move_in_date
             FROM allocations a
             JOIN rooms r ON a.room_id = r.id
             JOIN users u ON a.student_id = u.id
             WHERE u.id = $1`,
            [req.user.id]
        );

        // If they aren't assigned a room yet, handle it gracefully
        if (roomQuery.rows.length === 0) {
            return res.json({ assigned: false });
        }

        const roomData = roomQuery.rows[0];

        // 2. Find roommates by looking for anyone else sharing this room_id
        const roommatesQuery = await pool.query(
            `SELECT u.full_name as name, u.email, u.id as student_id 
             FROM allocations a
             JOIN users u ON a.student_id = u.id
             WHERE a.room_id = $1 AND u.id != $2`,
            [roomData.room_id, req.user.id]
        );

        // 3. Package it all up and send it to the frontend
        res.json({
            assigned: true,
            room: roomData,
            roommates: roommatesQuery.rows
        });

    } catch (err) {
        console.error("Error fetching room details:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET: Fetch student profile details
app.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userQuery = await pool.query(
            `SELECT id, id as student_id, full_name as name, email, role, TO_CHAR(created_at, 'DD Mon YYYY') as joined_date 
             FROM users 
             WHERE id = $1`,
            [req.user.id]
        );

        if (userQuery.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(userQuery.rows[0]);
    } catch (err) {
        console.error("Profile fetch error:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET: Student views their payment ledger
app.get('/my-payments', authenticateToken, async (req, res) => {
    try {
        const paymentsQuery = await pool.query(
            `SELECT p.id, 
                    COALESCE(p.fee_type, 'Hostel Rent') as fee_type, 
                    p.amount, 
                    p.status, 
                    COALESCE(p.payment_month, TO_CHAR(p.due_date, 'Month YYYY')) as payment_month,
                    TO_CHAR(p.due_date, 'DD Mon YYYY') as due_date,
                    TO_CHAR(p.paid_date, 'DD Mon YYYY') as paid_date
             FROM payments p
             JOIN users u ON p.student_id = u.id
             WHERE u.id = $1
             ORDER BY p.due_date DESC`,
            [req.user.id]
        );
        
        res.json(paymentsQuery.rows);
    } catch (err) {
        if (err.code === '42P01') {
            return res.json([]);
        }
        console.error("Error fetching payments:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET: Admin views all complaints
app.get('/admin/complaints', authenticateToken, async (req, res) => {
    try {
        // Protect this route
        if (req.user.role === 'Student') {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const ownerId = req.user.owner_id || req.user.id;
        const allComplaints = await pool.query(
            `SELECT 
                c.id, 
                c.issue, 
                c.status, 
                TO_CHAR(c.created_at, 'DD Mon YYYY') as date,
                u.full_name as student_name,
                COALESCE(r.room_number, 'Unassigned') as room_number
             FROM complaints c
             JOIN users u ON c.student_id = u.id
             LEFT JOIN allocations a ON u.id = a.student_id
             LEFT JOIN rooms r ON a.room_id = r.id
             WHERE u.owner_id = $1 AND LOWER(u.role) = 'student'
             ORDER BY 
                CASE WHEN c.status = 'Pending' THEN 1 ELSE 2 END,
                c.created_at DESC`,
            [ownerId]
        );

        res.json(allComplaints.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT: Admin updates complaint status (e.g., marks as 'Resolved')
app.put('/admin/complaints/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'Student' || req.user.role.toLowerCase() === 'student') {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const { id } = req.params;
        
        await pool.query("UPDATE complaints SET status = 'Resolved' WHERE id = $1", [id]);

        res.json({ message: "Complaint resolved successfully." });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET: Admin views all current room allocations
app.get('/admin/allocations', authenticateToken, async (req, res) => {
    try {
        // Ensure only Admins/Accountants can view this
        if (req.user.role === 'Student') {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const allocations = await pool.query(
`SELECT 
                u.full_name as student_name, 
                r.room_number, 
                'Main' as block, 
                TO_CHAR(a.assigned_at, 'DD Mon YYYY') as move_in_date
             FROM allocations a
             JOIN users u ON a.student_id = u.id
             JOIN rooms r ON a.room_id = r.id
             WHERE r.owner_id = $1
             ORDER BY r.room_number`, [req.user.id]);

        res.json(allocations.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST: Admin assigns a student to a room
app.post('/admin/allocate', authenticateToken, async (req, res) => {
    if (req.user.role && req.user.role.toLowerCase() === 'student') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const { student_id, room_number } = req.body; // room_number comes from frontend payload

    try {
        // 1. Check if the student is already allocated a room
        const existingAllocation = await pool.query(
            `SELECT * FROM allocations WHERE student_id = $1`,
            [student_id]
        );

        if (existingAllocation.rows.length > 0) {
            return res.status(400).json({ error: 'Student is already assigned to a room' });
        }
        
        // 1.5 Get the actual room's database ID from the room number
        const roomResult = await pool.query("SELECT id, owner_id FROM rooms WHERE room_number = $1 AND owner_id = $2", [room_number, req.user.id]);
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ error: "Room number not found." });
        }
        const actualRoomId = roomResult.rows[0].id;

        // 2. Create the allocation in allocations table
        const newAllocation = await pool.query(
            `INSERT INTO allocations (student_id, room_id, assigned_at) 
             VALUES ($1, $2, NOW()) 
             RETURNING *`,
            [student_id, actualRoomId]
        );
        
        const ownerId = req.user.owner_id || req.user.id;

        // 3. Update the user's room assignment & owner_id
        await pool.query("UPDATE users SET room_number = $1, owner_id = $2 WHERE id = $3", [room_number, ownerId, student_id]);
        
        // 4. Update the room status to occupied
        await pool.query("UPDATE rooms SET status = 'Occupied' WHERE room_number = $1 AND owner_id = $2", [room_number, ownerId]);
        
        res.status(201).json({ message: 'Room allocated successfully', allocation: newAllocation.rows[0] });
    } catch (err) {
        console.error("ALLOCATION ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET: Admin views all payments
app.get('/admin/payments', authenticateToken, async (req, res) => {
    try {
        if (req.user.role && req.user.role.toLowerCase() === 'student') {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const ownerId = req.user.role.toLowerCase() === 'student' ? req.user.owner_id : (req.user.owner_id || req.user.id);
        const payments = await pool.query(
            `SELECT p.id, 
                    u.full_name as student_name, 
                    p.student_id, 
                    p.fee_type, 
                    p.amount, 
                    p.status, 
                    TO_CHAR(p.due_date, 'DD Mon YYYY') as due_date
             FROM payments p
             JOIN users u ON p.student_id = u.id
             WHERE u.owner_id = $1 AND LOWER(u.role) = 'student'
             ORDER BY p.due_date DESC`,
            [ownerId]
        );
        res.json(payments.rows);
    } catch (err) {
        if (err.code === '42P01') {
            return res.json([]);
        }
        console.error("Error fetching admin payments:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST: Admin issues a new fee to a student
app.post('/admin/payments', authenticateToken, async (req, res) => {
    if (req.user.role && req.user.role.toLowerCase() === 'student') {
        return res.status(403).json({ error: 'Access denied.' });
    }

    const { student_id, fee_type, amount, due_date } = req.body;

    try {
        if (!student_id || !fee_type || !amount || !due_date) {
            return res.status(400).json({ error: 'All fields (Student ID, Fee Type, Amount, Due Date) are required.' });
        }

        // Clean raw input (e.g. "0005" -> 5 or "WM-0005" -> 5)
        const parsedId = parseInt(String(student_id).replace(/\D/g, ''), 10);
        const searchId = isNaN(parsedId) ? student_id : parsedId;

        // Verify student exists in users table (cast everything to text to avoid type mismatch)
        const userCheck = await pool.query(
            `SELECT id, full_name FROM users WHERE id::text = $1::text`,
            [String(searchId)]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: `Student ID "${student_id}" not found in database.` });
        }

        const validStudentId = userCheck.rows[0].id;

        const newPayment = await pool.query(
            `INSERT INTO payments (student_id, fee_type, amount, due_date, payment_month, status) 
             VALUES ($1, $2, $3, $4, TO_CHAR($4::date, 'Month YYYY'), 'pending') 
             RETURNING *`,
            [validStudentId, fee_type, amount, due_date]
        );
        
        res.status(201).json({ message: 'Fee issued successfully', payment: newPayment.rows[0] });
    } catch (err) {
        console.error("Error issuing fee:", err.message);
        res.status(500).json({ error: err.message || 'Server error' });
    }
});

// ADMIN: Get Live Dashboard Statistics
app.get('/admin/stats', authenticateToken, async (req, res) => {
    if (req.user.role && req.user.role.toLowerCase() === 'student') {
        return res.status(403).json({ error: 'Access denied' });
    }
    try {
        const ownerId = req.user.owner_id || req.user.id;
        const [studentCount, roomCount, pendingDues, complaintCount] = await Promise.all([
            pool.query("SELECT COUNT(*) AS total FROM users WHERE LOWER(role) = 'student' AND owner_id = $1", [ownerId]),
            pool.query("SELECT COUNT(DISTINCT room_number) AS total FROM users WHERE LOWER(role) = 'student' AND room_number IS NOT NULL AND owner_id = $1", [ownerId]),
            pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments p JOIN users u ON p.student_id = u.id WHERE LOWER(p.status) = 'pending' AND u.owner_id = $1 AND LOWER(u.role) = 'student'", [ownerId]),
            pool.query("SELECT COUNT(*) AS total FROM complaints c JOIN users u ON c.student_id = u.id WHERE LOWER(c.status) != 'resolved' AND u.owner_id = $1 AND LOWER(u.role) = 'student'", [ownerId])
        ]);

        res.json({
            totalStudents:  parseInt(studentCount.rows[0].total),
            occupiedRooms:  parseInt(roomCount.rows[0].total),
            pendingRevenue: parseInt(pendingDues.rows[0].total),
            openComplaints: parseInt(complaintCount.rows[0].total)
        });
    } catch (err) {
        console.error("Stats error:", err.message);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// ADMIN: Mark a payment as Paid
app.put('/admin/payments/:id/pay', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin' && req.user.role.toLowerCase() !== 'warden') return res.status(403).send('Access denied');
    try {
        await pool.query("UPDATE payments SET status = 'Paid' WHERE id = $1", [req.params.id]);
        res.json({ message: 'Payment marked as paid' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// STUDENT: Update Password
app.put('/student/profile/password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Both fields are required" });
    }

    try {
        const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: "Incorrect current password" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashedPassword, req.user.id]);
        res.json({ message: "Password updated successfully!" });
        
    } catch (err) {
        console.error("Password Update Error:", err);
        res.status(500).json({ error: "Server error while updating password" });
    }
});

// ADMIN: Delete a payment
app.delete('/admin/payments/:id', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin' && req.user.role.toLowerCase() !== 'warden') return res.status(403).send('Access denied');
    try {
        await pool.query("DELETE FROM payments WHERE id = $1", [req.params.id]);
        res.json({ message: 'Payment deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// STUDENT: Process a payment (Simulated Gateway)
app.put('/student/payments/:id/pay', authenticateToken, async (req, res) => {
    try {
        // In a real app, this would hit Stripe/Razorpay first. For now, we instantly update the DB.
        await pool.query("UPDATE payments SET status = 'Paid' WHERE id = $1", [req.params.id]);
        res.json({ message: 'Payment successful' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: Fetch all notices (Viewable by Students and Admins)
app.get('/notices', authenticateToken, async (req, res) => {
    try {
        let ownerId = req.user.owner_id || req.user.id;

        // If student, check if their assigned room links to an owner
        if (req.user.role && req.user.role.toLowerCase() === 'student') {
            const allocRes = await pool.query(
                `SELECT r.owner_id FROM allocations a 
                 JOIN rooms r ON a.room_id = r.id 
                 WHERE a.student_id = $1 
                 ORDER BY a.assigned_at DESC LIMIT 1`,
                [req.user.id]
            );
            if (allocRes.rows.length > 0) {
                ownerId = allocRes.rows[0].owner_id;
            }
        }

        const noticesQuery = await pool.query(
            `SELECT id, title, content, posted_by, 
                    TO_CHAR(created_at, 'DD Mon YYYY, HH:MI AM') as date
             FROM notices 
             WHERE owner_id = $1
             ORDER BY created_at DESC`,
            [ownerId]
        );
        res.json(noticesQuery.rows);
    } catch (err) {
        if (err.code === '42P01') {
            return res.json([]);
        }
        console.error("Error fetching notices:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST: Admin creates a new notice
app.post('/admin/notices', authenticateToken, async (req, res) => {
    if (req.user.role && req.user.role.toLowerCase() === 'student') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const { title, content } = req.body;

    try {
        const newNotice = await pool.query(
            `INSERT INTO notices (title, content, owner_id) 
             VALUES ($1, $2, $3) 
             RETURNING *`,
            [title, content, req.user.id]
        );
        res.status(201).json({ message: 'Notice posted', notice: newNotice.rows[0] });
    } catch (err) {
        console.error("Error posting notice:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE: Admin deletes a notice
app.delete('/admin/notices/:id', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() === 'student') return res.status(403).json({ error: 'Access denied' });
    try {
        const deletedNotice = await pool.query(
            "DELETE FROM notices WHERE id = $1 AND owner_id = $2 RETURNING *", 
            [req.params.id, req.user.id]
        );
        if (deletedNotice.rows.length === 0) {
            return res.status(404).json({ error: "Notice not found" });
        }
        res.json({ message: "Notice deleted" });
    } catch (err) {
        console.error("Error deleting notice:", err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// ADMIN: Get Global Hostel Settings
app.get('/admin/settings', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin' && req.user.role.toLowerCase() !== 'warden') return res.status(403).send('Access denied');
    try {
        const ownerId = req.user.owner_id || req.user.id;
        const result = await pool.query("SELECT setting_key, setting_value FROM hostel_settings WHERE owner_id = $1", [ownerId]);
        // Convert array of rows into a simple object: { hostel_name: "Wingmate", default_rent: "5000" }
        const settings = {};
        result.rows.forEach(row => { settings[row.setting_key] = row.setting_value; });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN: Update Global Hostel Settings
app.put('/admin/settings', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin' && req.user.role.toLowerCase() !== 'warden') return res.status(403).send('Access denied');
    const { hostel_name, default_rent } = req.body;
    
    try {
        const ownerId = req.user.owner_id || req.user.id;
        if (hostel_name) {
            await pool.query("UPDATE hostel_settings SET setting_value = $1 WHERE setting_key = 'hostel_name' AND owner_id = $2", [hostel_name, ownerId]);
        }
        if (default_rent) {
            await pool.query("UPDATE hostel_settings SET setting_value = $1 WHERE setting_key = 'default_rent' AND owner_id = $2", [default_rent, ownerId]);
        }
        res.json({ message: "Settings updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ==========================================
// GATE PASS SYSTEM
// ==========================================

// STUDENT: Submit a new leave request
app.post('/student/leave', authenticateToken, async (req, res) => {
    const { reason, departure_date, return_date } = req.body;
    try {
        await pool.query(
            "INSERT INTO leave_requests (student_id, reason, departure_date, return_date) VALUES ($1, $2, $3, $4)",
            [req.user.id, reason, departure_date, return_date]
        );
        res.json({ message: "Leave request submitted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// STUDENT: Fetch their own leave history
app.get('/student/leave', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM leave_requests WHERE student_id = $1 ORDER BY created_at DESC", 
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN: Fetch all pending leave requests
app.get('/admin/leave', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin' && req.user.role.toLowerCase() !== 'warden') return res.status(403).send('Access denied');
    try {
        const ownerId = req.user.owner_id || req.user.id;
        const result = await pool.query(`SELECT l.*, u.full_name as name, u.room_number FROM leave_requests l JOIN users u ON l.student_id = u.id WHERE l.status = 'Pending' AND u.owner_id = $1 AND LOWER(u.role) = 'student' ORDER BY l.created_at ASC`, [ownerId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN: Update leave status (Approve/Reject)
app.put('/admin/leave/:id/status', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin' && req.user.role.toLowerCase() !== 'warden') return res.status(403).send('Access denied');
    const { status } = req.body; // Expects 'Approved' or 'Rejected'
    try {
        await pool.query("UPDATE leave_requests SET status = $1 WHERE id = $2", [status, req.params.id]);
        res.json({ message: `Request marked as ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN: Register a new student
app.post('/admin/students', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin' && req.user.role.toLowerCase() !== 'warden') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const { full_name, email, phone, room_number } = req.body;
    if (!full_name || !email) {
        return res.status(400).json({ error: 'Full name and email are required.' });
    }

    try {
        // Default password is 'wingmate123'
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('wingmate123', salt);

        const ownerId = req.user.owner_id || req.user.id;
        const newStudent = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role, owner_id, phone) 
             VALUES ($1, $2, $3, 'Student', $4, $5) 
             RETURNING id, full_name, email, role, phone`,
            [full_name, email, hashedPassword, ownerId, phone]
        );

        const student = newStudent.rows[0];
        let allocation = null;

        // If a room number was specified, auto-allocate it
        if (room_number) {
            const roomResult = await pool.query(
                "SELECT id FROM rooms WHERE room_number = $1 AND owner_id = $2 AND status = 'Available'", 
                [room_number, ownerId]
            );
            if (roomResult.rows.length > 0) {
                const roomId = roomResult.rows[0].id;
                
                // Create allocation record
                const allocResult = await pool.query(
                    `INSERT INTO allocations (student_id, room_id, assigned_at) 
                     VALUES ($1, $2, NOW()) 
                     RETURNING *`,
                    [student.id, roomId]
                );
                
                // Update user room assignment
                await pool.query("UPDATE users SET room_number = $1 WHERE id = $2", [room_number, student.id]);
                
                // Update room status
                await pool.query("UPDATE rooms SET status = 'Occupied' WHERE id = $1", [roomId]);
                
                allocation = { room_number, id: allocResult.rows[0].id };
            }
        }

        res.status(201).json({ message: 'Student registered successfully.', student, allocation });
    } catch (err) {
        console.error("Error registering student:", err);
        if (err.code === '23505') { // Postgres unique violation error code
            return res.status(400).json({ error: 'Email already exists.' });
        }
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// 5. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is up and running on http://localhost:${PORT}`);
    const os = require('os');
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`Network access: http://${net.address}:${PORT}`);
            }
        }
    }
});

module.exports = app;
