// frontend/js/config.js
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api'                    // Local development
    : 'https://taskmaster-backend-pgcm.onrender.com/api';  // Production (Render)