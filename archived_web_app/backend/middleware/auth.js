const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    // 1. Get the token from the "Authorization" header
    // It usually comes in the format: "Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // 2. If no token is found, kick them out
    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    // 3. Verify the token using your secret key
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token." });
        }

        // 4. Attach the decoded user data (id, role) to the request
        req.user = user; 
        
        // 5. Let the user proceed to the actual route
        next(); 
    });
}

module.exports = authenticateToken;
