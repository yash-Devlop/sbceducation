// home-teacher-dashboard.js

const API_BASE_URL = 'http://localhost:8000';

// Authentication and state management
let currentUser = null;
let transactionHistory = [];
let managerInfo = null;

// Initialize dashboard when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventListeners();
    initializeDashboard();
});

// Check if user is authenticated
function checkAuthentication() {
    const token = getCookie('access_token');
    if (!token) {
        window.location.href = '/clientDasboard/templates/login.html';
        return;
    }
    
    // Decode token to get user info (basic check)
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

// Get cookie value
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Set cookie
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

// Delete cookie
function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
    
    // Mobile menu toggle
    const navToggle = document.querySelector('.nav-toggle');
    if (navToggle) {
        navToggle.addEventListener('click', toggleMobileMenu);
    }
}

// Initialize dashboard
async function initializeDashboard() {
    showLoading(true);
    try {
        await Promise.all([
            loadUserFunds(),
            loadTransactionHistory(),
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
        document.getElementById('home-teacher-name').textContent = currentUser.emp_name || 'Home Teacher';
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
    
    // Load section-specific data
    loadSectionData(targetSection);
}

// Load section-specific data
async function loadSectionData(section) {
    switch(section) {
        case 'dashboard':
            await updateDashboardStats();
            break;
        case 'funds':
            await loadTransactionHistory();
            await loadUserFunds();
            break;
        case 'manager-info':
            await loadManagerInfo();
            break;
        default:
            break;
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

// Load user funds
async function loadUserFunds() {
    try {
        const response = await apiCall('/get_emp_funds');
        const funds = response.detail?.funds || 0;
        
        // Update all fund displays
        document.getElementById('home-teacher-funds').textContent = `₹${funds}`;
        document.getElementById('current-balance-display').textContent = `₹${funds}`;
        document.getElementById('dashboard-funds').textContent = `₹${funds}`;
    } catch (error) {
        console.error('Failed to load funds:', error);
        showToast('Failed to load funds', 'error');
    }
}

// Load transaction history
async function loadTransactionHistory() {
    try {
        const startDate = document.getElementById('start-date')?.value;
        const endDate = document.getElementById('end-date')?.value;
        
        const requestBody = {};
        if (startDate) requestBody.start_date = startDate;
        if (endDate) requestBody.end_date = endDate;
        
        const response = await apiCall('/funds_transfer_history', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
        
        transactionHistory = response.transactions || [];
        updateTransactionHistoryTable();
    } catch (error) {
        console.error('Failed to load transaction history:', error);
        showToast('Failed to load transaction history', 'error');
    }
}

// Update transaction history table
function updateTransactionHistoryTable() {
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Filter only received transactions for home teacher
    const receivedTransactions = transactionHistory.filter(t => t.reciever_id === currentUser.emp_id);
    
    if (receivedTransactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <h3>No Transactions Found</h3>
                        <p>No fund transfers to display</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    receivedTransactions.forEach(transaction => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(transaction.transferred_at)}</td>
            <td>${transaction.sender_name || 'Admin'}</td>
            <td class="funds-amount">₹${transaction.transferred_amount}</td>
            <td><span class="status-badge status-received">Completed</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Load manager information
async function loadManagerInfo() {
    try {
        if (!currentUser?.emp_id) return;
        
        // Get current user details to find manager_id
        const response = await apiCall(`/get_emp_details/${currentUser.emp_id}`);
        
        if (response.status === 'good' && response.detail.data.manager_id) {
            const managerId = response.detail.data.manager_id;
            
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
                <span>${currentUser.emp_id ? managerInfo.manager_id || 'N/A' : 'N/A'}</span>
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
                <span>${managerInfo.role.charAt(0).toUpperCase() + managerInfo.role.slice(1).replace('-', ' ')}</span>
            </div>
            <div class="manager-detail-item">
                <strong>Location:</strong>
                <span>${managerInfo.city}, ${managerInfo.state}</span>
            </div>
        `;
    }
}

// Update dashboard stats
async function updateDashboardStats() {
    try {
        // Calculate received transactions stats
        const receivedTransactions = transactionHistory.filter(t => t.reciever_id === currentUser.emp_id);
        
        // Total received amount
        const totalReceived = receivedTransactions.reduce((sum, t) => 
            sum + parseFloat(t.transferred_amount || 0), 0);
        
        document.getElementById('total-received').textContent = `₹${totalReceived}`;
        document.getElementById('transaction-count').textContent = receivedTransactions.length;
        
        // Update recent activity list
        updateRecentActivityList(receivedTransactions);
        
    } catch (error) {
        console.error('Failed to update dashboard stats:', error);
    }
}

// Update recent activity list
function updateRecentActivityList(transactions) {
    const activityList = document.getElementById('recent-transactions-list');
    if (!activityList) return;
    
    activityList.innerHTML = '';
    
    if (transactions.length === 0) {
        activityList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <h3>No Recent Activity</h3>
                <p>No recent fund transactions to display</p>
            </div>
        `;
        return;
    }
    
    // Show last 5 transactions
    const recentTransactions = transactions
        .sort((a, b) => new Date(b.transferred_at) - new Date(a.transferred_at))
        .slice(0, 5);
    
    recentTransactions.forEach(transaction => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-info">
                <div class="activity-icon">
                    <i class="fas fa-arrow-down"></i>
                </div>
                <div class="activity-details">
                    <h4>Fund Received</h4>
                    <p>Received from ${transaction.sender_name || 'Admin'} • ${formatDate(transaction.transferred_at)}</p>
                </div>
            </div>
            <div class="activity-amount">₹${transaction.transferred_amount}</div>
        `;
        activityList.appendChild(activityItem);
    });
}

// Search employee details
async function searchEmployeeDetails() {
    const employeeId = document.getElementById('employee-id-search').value.trim();
    const resultsContainer = document.getElementById('employee-search-results');
    
    if (!employeeId) {
        showToast('Please enter an employee ID', 'warning');
        return;
    }
    
    showLoading(true);
    try {
        const response = await apiCall(`/get_emp_details/${employeeId}`);
        
        if (response.status === 'good') {
            const employee = response.detail.data;
            displayEmployeeSearchResults(employee);
            resultsContainer.style.display = 'block';
        } else {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-times"></i>
                    <h3>Employee Not Found</h3>
                    <p>No employee found with ID: ${employeeId}</p>
                </div>
            `;
            resultsContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('Failed to search employee:', error);
        showToast(error.message || 'Failed to search employee', 'error');
        resultsContainer.style.display = 'none';
    } finally {
        showLoading(false);
    }
}

// Display employee search results
function displayEmployeeSearchResults(employee) {
    const resultsContainer = document.getElementById('employee-search-results');
    
    resultsContainer.innerHTML = `
        <h4><i class="fas fa-user"></i> Employee Details</h4>
        <div class="employee-detail-grid">
            <div class="employee-detail-item">
                <span><strong>Name:</strong></span>
                <span>${employee.name}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>Role:</strong></span>
                <span>${employee.role.charAt(0).toUpperCase() + employee.role.slice(1).replace('-', ' ')}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>Email:</strong></span>
                <span>${employee.email}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>Phone:</strong></span>
                <span>${employee.phn}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>Father's Name:</strong></span>
                <span>${employee.fname}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>Mother's Name:</strong></span>
                <span>${employee.mname}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>Date of Birth:</strong></span>
                <span>${formatDate(employee.DOB)}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>Address:</strong></span>
                <span>${employee.addr}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>City:</strong></span>
                <span>${employee.city}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>District:</strong></span>
                <span>${employee.district}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>State:</strong></span>
                <span>${employee.state}</span>
            </div>
            <div class="employee-detail-item">
                <span><strong>Manager ID:</strong></span>
                <span>${employee.manager_id || 'N/A'}</span>
            </div>
        </div>
    `;
}

// Filter transactions
async function filterTransactions() {
    await loadTransactionHistory();
}

// Clear transaction filters
function clearFilters() {
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';
    
    loadTransactionHistory();
}

// Refresh functions
async function refreshFunds() {
    showLoading(true);
    await loadUserFunds();
    showLoading(false);
    showToast('Funds refreshed', 'success');
}

// Mobile menu toggle
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.toggle('active');
}

// Logout function
function logout() {
    deleteCookie('access_token');
    deleteCookie('user_name');
    deleteCookie('user_role');
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = '/Dashboard/templates/login.html';
    }, 1000);
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

// Auto-refresh data every 10 minutes (less frequent for home teachers)
setInterval(async function() {
    try {
        await Promise.all([
            loadUserFunds(),
            loadTransactionHistory()
        ]);
    } catch (error) {
        console.error('Auto-refresh failed:', error);
    }
}, 10 * 60 * 1000);