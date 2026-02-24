// frontend/js/auth.js

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Auth.js loaded');
    
    // Check if user is logged in and on dashboard
    if (window.location.pathname.includes('dashboard.html')) {
        console.log('On dashboard page, checking authentication...');
        requireAuth();
        loadUserData();
    }

    // Close modal when clicking outside
    window.onclick = function(event) {
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        
        if (event.target === loginModal) {
            loginModal.style.display = 'none';
        }
        if (event.target === registerModal) {
            registerModal.style.display = 'none';
        }
    };
});

// Show login modal
function showLoginModal() {
    console.log('Showing login modal');
    document.getElementById('loginModal').style.display = 'block';
}

// Show register modal
function showRegisterModal() {
    console.log('Showing register modal');
    document.getElementById('registerModal').style.display = 'block';
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Switch from login to register
function switchToRegister() {
    closeModal('loginModal');
    showRegisterModal();
}

// Switch from register to login
function switchToLogin() {
    closeModal('registerModal');
    showLoginModal();
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    console.log('Login form submitted');
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Validate inputs
    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    try {
        console.log('Attempting login with:', { email });
        
        const response = await apiRequest('/auth/login', 'POST', { email, password });
        
        if (response.success) {
            // Store token and user data
            localStorage.setItem('token', response.token);
            setUserData(response.user);
            
            showToast('Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard after 1 second
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showToast(response.message || 'Login failed', 'error');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message || 'Login failed. Please try again.', 'error');
    }
}

// Handle register form submission
async function handleRegister(event) {
    event.preventDefault();
    console.log('Register form submitted');
    
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
    // Validate inputs
    if (!name || !email || !password || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    try {
        console.log('Attempting registration with:', { name, email });
        
        const response = await apiRequest('/auth/register', 'POST', { 
            name, 
            email, 
            password 
        });
        
        if (response.success) {
            showToast('Registration successful! Please login.', 'success');
            
            // Close register modal and open login modal
            setTimeout(() => {
                closeModal('registerModal');
                showLoginModal();
            }, 1500);
        } else {
            showToast(response.message || 'Registration failed', 'error');
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        showToast(error.message || 'Registration failed. Please try again.', 'error');
    }
}

// Load user data in dashboard
function loadUserData() {
    const userData = getUserData();
    console.log('Loading user data:', userData);
    
    if (userData && userData.name) {
        const displayNameElement = document.getElementById('userDisplayName');
        if (displayNameElement) {
            displayNameElement.textContent = userData.name;
        }
    }
}

// Logout function
function logout() {
    console.log('Logging out...');
    clearUserData();
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}