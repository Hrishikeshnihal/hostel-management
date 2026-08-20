document.getElementById('loginForm').addEventListener('submit', async (e) => {
    // Prevent the page from refreshing when you click submit
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    try {
        // Call your backend API
        const response = await fetch('http://10.164.49.212:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // SUCCESS: Save the wristband (JWT) in the browser's memory
            if (data.user.role.toLowerCase() === 'admin' || data.user.role.toLowerCase() === 'warden') {
                localStorage.setItem('adminToken', data.token);
            } else {
                localStorage.setItem('token', data.token);
            }
            localStorage.setItem('role', data.user.role);
            
            // Redirect them to a dashboard (we will build this next)
            window.location.href = data.user.role.toLowerCase() === 'student' ? 'dashboard.html' : 'admin-dashboard.html';
        } else {
            // FAIL: Show the error message from the backend
            errorMessage.textContent = data.error;
        }
    } catch (error) {
        errorMessage.textContent = "Cannot connect to the server.";
    }
});
