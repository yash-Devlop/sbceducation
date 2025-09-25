// home-teacher-dashboard.js - Updated with Sidebar and Salary Slip

const API_BASE_URL = 'http://localhost:8000';

// Authentication and state management
let currentUser = null;
let managerInfo = null;

let employmentDate = null;

// Initialize dashboard when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventListeners();
    initializeDashboard();
    updateCurrentTime();
    populateYearSelector();
    setCurrentMonthYear();
});

// Check if user is authenticated
function checkAuthentication() {
    const token = getCookie('access_token');
    if (!token) {
        window.location.href = '/client/Dashboard/templates/login.html';
        return;
    }
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'home-teacher') {
            showToast('Unauthorized access', 'error');
            logout();
            return;
        }
        currentUser = payload;
        updateUserDisplay();
    } catch (error) {
        console.error('Invalid token:', error);
        logout();
    }
}

// Cookie utilities
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// Setup event listeners
function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
    
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('overlay');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleSidebar);
    }
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', closeSidebar);
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }
    
    // Handle window resize
    window.addEventListener('resize', handleResize);
}

// Initialize dashboard
async function initializeDashboard() {
    showLoading(true);
    try {
        await Promise.all([
            loadManagerInfo(),
            updateDashboardStats()
        ]);
    } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        showToast('Failed to load dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

// Update user display
function updateUserDisplay() {
    if (currentUser) {
        const name = currentUser.emp_name || 'Home Teacher';
        document.getElementById('home-teacher-name').textContent = name;
        document.getElementById('welcome-name').textContent = name;
    }
}

// Handle navigation
function handleNavigation(event) {
    event.preventDefault();
    const targetSection = event.currentTarget.getAttribute('data-section');
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Show target section
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${targetSection}-section`).classList.add('active');
    
    // Update page title
    const titles = {
        'dashboard': 'Dashboard',
        'salary': 'Salary Slip',
        'manager-info': 'My Manager'
    };
    document.getElementById('pageTitle').textContent = titles[targetSection] || 'Dashboard';
    
    // Load section-specific data
    loadSectionData(targetSection);
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}

// Load section-specific data
async function loadSectionData(section) {
    switch(section) {
        case 'dashboard':
            await updateDashboardStats();
            break;
        case 'manager-info':
            await loadManagerInfo();
            break;
        case 'salary':
            // Salary section is static, no data to load
            break;
        default:
            break;
    }
}

// Sidebar functions
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
}

function handleResize() {
    if (window.innerWidth > 768) {
        closeSidebar();
    }
}

// Update current time
function updateCurrentTime() {
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        const now = new Date();
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        timeElement.textContent = now.toLocaleDateString('en-IN', options);
    }
}

// API call wrapper with authentication
async function apiCall(endpoint, options = {}) {
    const token = getCookie('access_token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, mergedOptions);
    
    if (response.status === 401) {
        showToast('Session expired. Please login again.', 'error');
        logout();
        return;
    }
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail?.message || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
}

// Load manager information
async function loadManagerInfo() {
    try {
        if (!currentUser?.emp_id) return;
        
        // Get current user details to find manager_id
        const response = await apiCall(`/get_emp_details/${currentUser.emp_id}`);
        
        if (response.status === 'good' && response.detail.data.manager_id) {
            const managerId = response.detail.data.manager_id;
            
            // Store employment date
            employmentDate = response.detail.data.created_at || new Date().toISOString();
            updateEmploymentDuration(employmentDate);
            
            // Get manager details
            const managerResponse = await apiCall(`/get_emp_details/${managerId}`);
            
            if (managerResponse.status === 'good') {
                managerInfo = managerResponse.detail.data;
                updateManagerDisplay();
            }
        }
    } catch (error) {
        console.error('Failed to load manager info:', error);
        showToast('Failed to load manager information', 'error');
    }
}

// Update manager display
function updateManagerDisplay() {
    if (!managerInfo) return;
    
    // Update manager name in stats
    const managerNameShort = document.getElementById('manager-name-short');
    if (managerNameShort) {
        const firstName = managerInfo.name.split(' ')[0];
        managerNameShort.textContent = firstName;
    }
    
    // Update manager details section
    const managerDetails = document.getElementById('manager-details');
    if (managerDetails) {
        managerDetails.innerHTML = `
            <div class="manager-detail-item">
                <strong>Name:</strong>
                <span>${managerInfo.name}</span>
            </div>
            <div class="manager-detail-item">
                <strong>Employee ID:</strong>
                <span>${managerInfo.manager_id || currentUser.emp_id || 'N/A'}</span>
            </div>
            <div class="manager-detail-item">
                <strong>Email:</strong>
                <span>${managerInfo.email}</span>
            </div>
            <div class="manager-detail-item">
                <strong>Phone:</strong>
                <span>${managerInfo.phn}</span>
            </div>
            <div class="manager-detail-item">
                <strong>Role:</strong>
                <span>Field Manager</span>
            </div>
            <div class="manager-detail-item">
                <strong>Location:</strong>
                <span>${managerInfo.city}, ${managerInfo.state}</span>
            </div>
        `;
    }
}

// Update employment duration
function updateEmploymentDuration(employmentDate) {
    const empElement = document.getElementById('employment-duration');
    const accountCreatedTime = document.getElementById('account-created-time');
    
    if (empElement || accountCreatedTime) {
        const startDate = new Date(employmentDate);
        const currentDate = new Date();
        const diffTime = Math.abs(currentDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffMonths = Math.floor(diffDays / 30);
        
        let duration;
        if (diffMonths < 1) {
            duration = `${diffDays} days`;
        } else {
            duration = `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
        }
        
        if (empElement) {
            empElement.textContent = duration;
        }
        
        if (accountCreatedTime) {
            accountCreatedTime.textContent = formatDate(employmentDate);
        }
    }
}

// Update dashboard stats
async function updateDashboardStats() {
    try {
        // Update time every minute
        updateCurrentTime();
        setInterval(updateCurrentTime, 60000);
    } catch (error) {
        console.error('Failed to update dashboard stats:', error);
    }
}

// Salary slip functions
function populateYearSelector() {
    const yearSelect = document.getElementById('salary-year');
    if (!yearSelect) return;
    
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5; // Allow 5 years back
    
    yearSelect.innerHTML = '';
    for (let year = currentYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

function setCurrentMonthYear() {
    const monthSelect = document.getElementById('salary-month');
    const yearSelect = document.getElementById('salary-year');
    const currentDate = new Date();
    
    if (monthSelect) {
        monthSelect.value = currentDate.getMonth() + 1;
    }
    
    if (yearSelect) {
        yearSelect.value = currentDate.getFullYear();
    }
}

function generateCurrentSalarySlip() {
    const currentDate = new Date();
    const monthSelect = document.getElementById('salary-month');
    const yearSelect = document.getElementById('salary-year');
    
    if (monthSelect && yearSelect) {
        monthSelect.value = currentDate.getMonth() + 1;
        yearSelect.value = currentDate.getFullYear();
    }
    
    // Switch to salary section
    document.querySelector('[data-section="salary"]').click();
    
    // Generate slip after a short delay to allow section transition
    setTimeout(() => {
        generateSalarySlip();
    }, 300);
}

function generateSalarySlip() {
    const month = parseInt(document.getElementById('salary-month').value, 10);
    const year = parseInt(document.getElementById('salary-year').value, 10);
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (!currentUser) {
        showToast('User information not available', 'error');
        return;
    }

    if (!employmentDate) {
        showToast('Employment date not available', 'error');
        return;
    }

    // Ensure employmentDate is a Date object
    const empDate = employmentDate instanceof Date ? employmentDate : new Date(employmentDate);
    const requestedDate = new Date(year, month - 1, 1); // 1st day of requested month

    // Compare year/month only
    const reqYear = requestedDate.getFullYear();
    const reqMonth = requestedDate.getMonth();
    const empYear = empDate.getFullYear();
    const empMonth = empDate.getMonth();

    if (reqYear < empYear || (reqYear === empYear && reqMonth < empMonth)) {
        showToast(
            `Salary slip cannot be created before joining date (${empDate.toLocaleDateString('en-IN')})`,
            'error'
        );
        return;
    }

    const slipContainer = document.getElementById('salary-slip-container');
    const slipContent = document.getElementById('salary-slip');

    const employeeName = currentUser.emp_name || 'Home Teacher';
    const employeeId = currentUser.emp_id || 'HT001';
    const currentDate = new Date();

    const salarySlipHTML = `
        <div class="slip-header">
            <div class="organization-name">SBC Educational</div>
            <div class="slip-title">Salary Slip</div>
            <div class="slip-period">For the month of ${monthNames[month - 1]} ${year}</div>
        </div>

        <div class="employee-info">
            <div class="info-row">
                <span class="info-label">Employee Name:</span>
                <span class="info-value">${employeeName}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Employee ID:</span>
                <span class="info-value">${employeeId}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Designation:</span>
                <span class="info-value">Home Teacher</span>
            </div>
            <div class="info-row">
                <span class="info-label">Department:</span>
                <span class="info-value">Education</span>
            </div>
            <div class="info-row">
                <span class="info-label">Pay Period:</span>
                <span class="info-value">${monthNames[month - 1]} ${year}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Generated On:</span>
                <span class="info-value">${currentDate.toLocaleDateString('en-IN')}</span>
            </div>
        </div>

        <div class="salary-details">
            <div class="salary-breakdown">
                <div class="info-row">
                    <span class="info-label">Basic Salary:</span>
                    <span class="info-value">₹1,000</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Allowances:</span>
                    <span class="info-value">₹50</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Deductions:</span>
                    <span class="info-value">₹0</span>
                </div>
                <div class="info-row total-row">
                    <span class="info-label">Net Salary:</span>
                    <span class="info-value">₹1,050</span>
                </div>
            </div>
        </div>

        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-line"></div>
                <p>Employee Signature</p>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <p>Authorized Signatory</p>
            </div>
        </div>

        <div class="slip-footer">
            <p>This is a computer generated salary slip and does not require a signature.</p>
            <p>SBC Educational - Empowering Communities Through Education</p>
            <p>Generated on ${currentDate.toLocaleDateString('en-IN')} at ${currentDate.toLocaleTimeString('en-IN')}</p>
        </div>
    `;

    slipContent.innerHTML = salarySlipHTML;
    slipContainer.style.display = 'block';

    showToast('Salary slip generated successfully', 'success');
}


function printSalarySlip() {
    window.print();
}

function downloadSalarySlip() {
    // For download functionality, you might want to use a library like jsPDF
    showToast('Download feature will be available soon', 'info');
}

// Quick action functions
function viewManager() {
    document.querySelector('[data-section="manager-info"]').click();
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show/hide loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = show ? 'flex' : 'none';
}

// Toast notification system
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fas fa-info-circle';
    switch(type) {
        case 'success':
            icon = 'fas fa-check-circle';
            break;
        case 'error':
            icon = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            break;
    }
    
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Hide and remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Logout function
function logout() {
    deleteCookie('access_token');
    deleteCookie('user_name');
    deleteCookie('user_role');
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = '/client/Dashboard/templates/login.html';
    }, 1000);
}

// Handle API errors globally
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    if (event.reason.message.includes('401')) {
        logout();
    } else {
        showToast('An unexpected error occurred', 'error');
    }
});

// Handle online/offline status
window.addEventListener('online', function() {
    showToast('Connection restored', 'success');
});

window.addEventListener('offline', function() {
    showToast('Connection lost', 'warning');
});

// Auto-refresh manager data every 30 minutes
setInterval(async function() {
    try {
        await loadManagerInfo();
    } catch (error) {
        console.error('Auto-refresh failed:', error);
    }
}, 30 * 60 * 1000);