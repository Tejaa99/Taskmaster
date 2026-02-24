// frontend/js/config.js
// API Configuration - Change this based on environment
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api'
    : 'https://taskmaster-pro-backend.onrender.com/api'; // Your Render backend URL