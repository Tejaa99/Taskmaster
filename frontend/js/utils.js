// frontend/js/utils.js

// API Base URL - Make sure this matches your backend
// const API_BASE_URL = 'http://localhost:5000/api';

// Toast notification system
function showToast(message, type = 'success') {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Add to body
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'No date';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Format date for comment display
function formatDateTime(dateString) {
    if (!dateString) return '';
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Check if date is overdue
function isOverdue(dateString) {
    if (!dateString) return false;
    const dueDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
}

// Get status badge HTML
function getStatusBadge(status) {
    const badges = {
        'pending': '⏳ Pending',
        'in-progress': '🔄 In Progress',
        'completed': '✅ Completed'
    };
    return badges[status] || badges.pending;
}

// Store user data in localStorage
function setUserData(userData) {
    localStorage.setItem('user', JSON.stringify(userData));
}

// Get user data from localStorage
function getUserData() {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
}

// Clear user data from localStorage
function clearUserData() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('theme');
}

// Check if user is authenticated
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

// Redirect to login if not authenticated
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
    }
}

// Make API request with authentication
async function apiRequest(endpoint, method = 'GET', data = null) {
    const token = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        method,
        headers,
        mode: 'cors'
    };
    
    if (data) {
        config.body = JSON.stringify(data);
    }
    
    try {
        console.log(`📡 Making ${method} request to ${API_BASE_URL}${endpoint}`);
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const result = await response.json();
        
        console.log('📦 Response:', result);
        
        if (!response.ok) {
            throw new Error(result.message || 'Something went wrong');
        }
        
        return result;
    } catch (error) {
        console.error('❌ API Request Error:', error);
        showToast(error.message, 'error');
        throw error;
    }
}

// Test API connection
async function testAPIConnection() {
    try {
        const response = await fetch('http://localhost:5000/api/test');
        const data = await response.json();
        console.log('API Connection Test:', data);
        if (data.success) {
            console.log('✅ Backend connection successful!');
            return true;
        }
    } catch (error) {
        console.error('❌ Backend connection failed:', error);
        showToast('Cannot connect to backend server. Make sure it\'s running on port 5000', 'error');
        return false;
    }
}

// ==================== DARK MODE FUNCTIONS ====================

// Initialize theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// Toggle theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    if (isAuthenticated()) {
        saveThemePreference(newTheme);
    }
}

// Update theme icon
function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

// Save theme preference to backend
async function saveThemePreference(theme) {
    try {
        await apiRequest('/user/preferences', 'PUT', { theme });
    } catch (error) {
        console.error('Failed to save theme preference:', error);
    }
}

// Load theme preference from backend
async function loadThemePreference() {
    if (!isAuthenticated()) return;
    
    try {
        const response = await apiRequest('/user/preferences');
        if (response.success && response.preferences.theme) {
            const theme = response.preferences.theme;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            updateThemeIcon(theme);
        }
    } catch (error) {
        console.error('Failed to load theme preference:', error);
    }
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    
    if (window.location.pathname.includes('dashboard.html')) {
        loadThemePreference();
    } else {
        testAPIConnection();
    }
});