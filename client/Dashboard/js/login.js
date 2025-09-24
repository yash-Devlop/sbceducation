const BASE_URL = 'http://localhost:8000';
let currentLoginType = 'admin';

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    checkExistingLogin();
});

function initializeEventListeners() {
    // Login type selector buttons
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchLoginType(this.dataset.type);
        });
    });

    // Form submissions
    document.getElementById('admin-form').addEventListener('submit', handleAdminLogin);
    document.getElementById('manager-form').addEventListener('submit', (e) => handleEmployeeLogin(e, 'manager'));
    document.getElementById('field-manager-form').addEventListener('submit', (e) => handleEmployeeLogin(e, 'field-manager'));
    document.getElementById('home-teacher-form').addEventListener('submit', (e) => handleEmployeeLogin(e, 'home-teacher'));
    document.getElementById('branch-form').addEventListener('submit', (e) => handleEmployeeLogin(e, 'branch'));
}

function switchLoginType(type) {
    currentLoginType = type;
    
    // Update active button
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('active');
    
    // Show corresponding form
    document.querySelectorAll('.login-form').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById(`${type}-form`).classList.add('active');
    
    clearMessage();
}

async function handleAdminLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const loginData = {
        username: formData.get('username'),
        pwd: formData.get('password')
    };

    await performLogin('/admin_login', loginData);
}

async function handleEmployeeLogin(e, role) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const loginData = {
        email: formData.get('email'),
        pwd: formData.get('password'),
        role: role
    };

    await performLogin('/emp_login', loginData);
}

async function performLogin(endpoint, data) {
    showLoading(true);
    clearMessage();

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.status === 'good' && result.access_token) {
            // Store token in cookie
            setCookie('access_token', result.access_token, 7); // 7 days expiry
            setCookie('user_role', result.role, 7);
            if (result.emp_name) {
                setCookie('user_name', result.emp_name, 7);
            }

            showMessage('Login successful! Redirecting...', 'success');
            
            // Redirect based on role
            setTimeout(() => {
                redirectToDashboard(result.role);
            }, 1500);
        } else {
            showMessage(result.matches || 'Login failed. Please check your credentials.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Connection error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function redirectToDashboard(role) {
    // Customize these redirect URLs based on your application structure
    const dashboardUrls = {
        'admin': '/client/Dashboard/templates/admin-dashboard.html',
        'manager': '/client/Dashboard/templates/manager-dashboard.html',
        'field-manager': '/client/Dashboard/templates/field-manager-dashboard.html',
        'home-teacher': '/client/Dashboard/templates/home-teacher-dashboard.html',
        'branch': '/client/Dashboard/templates/branch-dashboard.html'
    };
    
    window.location.href = dashboardUrls[role] || '/dashboard';
}

function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function checkExistingLogin() {
    const token = getCookie('access_token');
    const role = getCookie('user_role');
    
    if (token && role) {
        // User is already logged in, redirect to dashboard
        redirectToDashboard(role);
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    const forms = document.querySelector('.forms-container');
    
    if (show) {
        loading.classList.remove('hidden');
        forms.style.opacity = '0.5';
    } else {
        loading.classList.add('hidden');
        forms.style.opacity = '1';
    }
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove('hidden');
}

function clearMessage() {
    const messageDiv = document.getElementById('message');
    messageDiv.classList.add('hidden');
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function showForgotPassword() {
    alert('Please contact your administrator for password reset assistance.');
}

function showHelp() {
    const helpMessage = `
Contact Information:
📞 Phone: +91 8888888888
📧 Email: contact@sbceducational.org
🕒 Support Hours: 9:00 AM - 6:00 PM (Mon-Fri)

Login Issues:
• Admin: Contact IT Administrator
• Employees: Contact HR Department

For technical support, please include your role and employee ID in your message.
    `;
    alert(helpMessage);
}

window.logout = function() {
    setCookie('access_token', '', -1);
    setCookie('user_role', '', -1);
    setCookie('user_name', '', -1);

    window.location.href = '/client/Dashboard/templates/login';
}