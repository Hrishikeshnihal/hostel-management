const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Priority: 1) Environment variable (Vercel), 2) Local file (development)
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Vercel deployment: parse from environment variable
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e.message);
    }
} else {
    // Local development: read from file
    try {
        serviceAccount = require('../wingmate-fd161-firebase-adminsdk-fbsvc-f527a9a37d.json');
    } catch (e) {
        console.warn('Firebase service account file not found. Firebase Auth will not work.');
    }
}

if (serviceAccount && !admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully');
} else if (!serviceAccount) {
    console.warn('Firebase Admin SDK NOT initialized: no service account available');
}

module.exports = admin;
