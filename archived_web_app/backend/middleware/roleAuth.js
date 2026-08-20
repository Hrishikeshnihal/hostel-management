function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        // Check if the user's role is in the list of allowed roles
        const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());
        if (!req.user || !req.user.role || !normalizedAllowed.includes(req.user.role.toLowerCase())) {
            return res.status(403).json({ 
                error: "Forbidden. You do not have permission to perform this action." 
            });
        }
        
        // If they are allowed, let them through
        next();
    };
}

module.exports = authorizeRoles;
