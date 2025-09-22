// field-manager-dashboard.js

const API_BASE_URL = 'http://localhost:8000';

// Authentication and state management
let currentUser = null;
let homeTeachers = [];
let transactionHistory = [];

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
        window.location.href = '/client/Dashboard/templates/login.html';
        return;
    }
    
    // Decode token to get user info (basic check)
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'field-manager') {
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

    // Form submissions
    document.getElementById('create-home-teacher-form').addEventListener('submit', handleCreateHomeTeacher);
    
    // Search functionality
    document.getElementById('home-teacher-search').addEventListener('input', filterHomeTeachers);
    
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
            loadHomeTeachers(),
            loadTransactionHistory(),
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
        document.getElementById('field-manager-name').textContent = currentUser.emp_name || 'Field Manager';
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
        case 'home-teachers':
            await loadHomeTeachers();
            break;
        case 'funds':
            await loadTransactionHistory();
            await loadUserFunds();
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
        
        document.getElementById('field-manager-funds').textContent = `₹${funds}`;
        document.getElementById('current-funds-display').textContent = `₹${funds}`;
        document.getElementById('available-funds').textContent = `₹${funds}`;
    } catch (error) {
        console.error('Failed to load funds:', error);
        showToast('Failed to load funds', 'error');
    }
}

// Load home teachers
async function loadHomeTeachers() {
    try {
        const response = await apiCall('/get_all_employees');
        if (response.status === 'success') {
            homeTeachers = response.employees.filter(emp => emp.role === 'home-teacher');
            updateHomeTeachersTable();
            updateHomeTeacherSelect();
        }
    } catch (error) {
        console.error('Failed to load home teachers:', error);
        showToast('Failed to load home teachers', 'error');
    }
}

// Update home teachers table
function updateHomeTeachersTable() {
    const tbody = document.getElementById('home-teachers-table-body');
    tbody.innerHTML = '';
    
    if (homeTeachers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-chalkboard-teacher"></i>
                        <h3>No Home Teachers Found</h3>
                        <p>Create your first home teacher to get started</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    homeTeachers.forEach(teacher => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${teacher.id}</td>
            <td>${teacher.name}</td>
            <td>${teacher.email}</td>
            <td>-</td>
            <td class="funds-amount">₹${teacher.funds || 0}</td>
            <td>-</td>
            <td>${formatDate(teacher.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-small" onclick="transferToHomeTeacher('${teacher.id}')">
                        <i class="fas fa-money-bill-wave"></i> Transfer
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update home teacher select options
function updateHomeTeacherSelect() {
    const select = document.getElementById('home-teacher-select');
    select.innerHTML = '<option value="">Select Home Teacher</option>';
    
    homeTeachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.id;
        option.textContent = `${teacher.name} (${teacher.id})`;
        select.appendChild(option);
    });
}

// Filter home teachers
function filterHomeTeachers() {
    const searchTerm = document.getElementById('home-teacher-search').value.toLowerCase();
    const rows = document.querySelectorAll('#home-teachers-table-body tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Handle create home teacher form submission
async function handleCreateHomeTeacher(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const password = document.getElementById('ht-password').value;
    const confirmPassword = document.getElementById('ht-confirm-password').value;
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    const homeTeacherData = {
        role: 'home-teacher',
        name: formData.get('name'),
        email: formData.get('email'),
        fname: formData.get('fname'),
        mname: formData.get('mname'),
        dob: formData.get('dob'),
        phn: formData.get('phn'),
        pwd: formData.get('pwd'),
        addr: formData.get('addr'),
        city: formData.get('city'),
        district: formData.get('district'),
        state: formData.get('state')
    };
    
    showLoading(true);
    try {
        const response = await apiCall('/create_employee', {
            method: 'POST',
            body: JSON.stringify(homeTeacherData)
        });
        
        if (response.status === 'good') {
            showToast('Home Teacher created successfully!', 'success');
            event.target.reset();
            await loadHomeTeachers();
            await updateDashboardStats();
        }
    } catch (error) {
        console.error('Failed to create home teacher:', error);
        showToast(error.message || 'Failed to create home teacher', 'error');
    } finally {
        showLoading(false);
    }
}

// Transfer funds to home teacher
async function transferFunds() {
    const homeTeacherId = document.getElementById('home-teacher-select').value;
    const amount = parseFloat(document.getElementById('transfer-amount').value);
    
    if (!homeTeacherId) {
        showToast('Please select a home teacher', 'warning');
        return;
    }
    
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'warning');
        return;
    }
    
    showLoading(true);
    try {
        const response = await apiCall('/add_funds', {
            method: 'POST',
            body: JSON.stringify({
                receiver_id: homeTeacherId,
                amount: amount
            })
        });
        
        if (response.status === 'good') {
            showToast('Funds transferred successfully!', 'success');
            document.getElementById('transfer-amount').value = '';
            document.getElementById('home-teacher-select').value = '';
            
            await Promise.all([
                loadUserFunds(),
                loadHomeTeachers(),
                loadTransactionHistory(),
                updateDashboardStats()
            ]);
        }
    } catch (error) {
        console.error('Failed to transfer funds:', error);
        showToast(error.message || 'Failed to transfer funds', 'error');
    } finally {
        showLoading(false);
    }
}

// Quick transfer to specific home teacher
function transferToHomeTeacher(homeTeacherId) {
    // Switch to funds section
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === 'funds') {
            link.classList.add('active');
        }
    });
    
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById('funds-section').classList.add('active');
    
    // Pre-select the home teacher
    document.getElementById('home-teacher-select').value = homeTeacherId;
    document.getElementById('transfer-amount').focus();
}

// Load transaction history
async function loadTransactionHistory() {
    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
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
    const tbody = document.getElementById('transfers-table-body');
    tbody.innerHTML = '';
    
    if (transactionHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
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
    
    transactionHistory.forEach(transaction => {
        const row = document.createElement('tr');
        const isSent = transaction.sender_id === currentUser.emp_id;
        const isReceived = transaction.reciever_id === currentUser.emp_id;
        
        let type = 'Unknown';
        let fromTo = 'Unknown';
        let statusClass = 'status-received';
        
        if (isSent) {
            type = 'Sent';
            fromTo = transaction.reciever_name;
            statusClass = 'status-sent';
        } else if (isReceived) {
            type = 'Received';
            fromTo = transaction.sender_name || 'Admin';
            statusClass = 'status-received';
        }
        
        row.innerHTML = `
            <td>${formatDate(transaction.transferred_at)}</td>
            <td><span class="status-badge ${statusClass}">${type}</span></td>
            <td>${fromTo}</td>
            <td class="funds-amount">₹${transaction.transferred_amount}</td>
            <td><span class="status-badge status-received">Completed</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Filter transactions
async function filterTransactions() {
    await loadTransactionHistory();
}

// Clear transaction filters
function clearFilters() {
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    loadTransactionHistory();
}

// Update dashboard stats
async function updateDashboardStats() {
    try {
        // Update basic stats
        document.getElementById('total-home-teachers').textContent = homeTeachers.length;
        
        // Calculate recent transfers (last 7 days)
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 7);
        
        const recentTransfers = transactionHistory.filter(t => {
            const transDate = new Date(t.transferred_at);
            return transDate >= recentDate && t.sender_id === currentUser.emp_id;
        });
        
        document.getElementById('recent-transfers').textContent = recentTransfers.length;
        
        // Calculate total distributed
        const totalDistributed = transactionHistory
            .filter(t => t.sender_id === currentUser.emp_id)
            .reduce((sum, t) => sum + parseFloat(t.transferred_amount || 0), 0);
        
        document.getElementById('total-distributed').textContent = `₹${totalDistributed}`;
        
        // Update recent activity list
        updateRecentActivityList(recentTransfers);
        
    } catch (error) {
        console.error('Failed to update dashboard stats:', error);
    }
}

// Update recent activity list
function updateRecentActivityList(recentTransfers) {
    const activityList = document.getElementById('recent-transfers-list');
    activityList.innerHTML = '';
    
    if (recentTransfers.length === 0) {
        activityList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <h3>No Recent Activity</h3>
                <p>No recent fund transfers to display</p>
            </div>
        `;
        return;
    }
    
    recentTransfers.slice(0, 5).forEach(transfer => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-info">
                <div class="activity-icon">
                    <i class="fas fa-arrow-right"></i>
                </div>
                <div class="activity-details">
                    <h4>Fund Transfer</h4>
                    <p>Transferred to ${transfer.reciever_name} • ${formatDate(transfer.transferred_at)}</p>
                </div>
            </div>
            <div class="activity-amount">₹${transfer.transferred_amount}</div>
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

// Refresh functions
async function refreshFunds() {
    showLoading(true);
    await loadUserFunds();
    showLoading(false);
    showToast('Funds refreshed', 'success');
}

async function refreshHomeTeachers() {
    showLoading(true);
    await loadHomeTeachers();
    showLoading(false);
    showToast('Home teachers list refreshed', 'success');
}

// Reset create form
function resetCreateForm() {
    document.getElementById('create-home-teacher-form').reset();
    showToast('Form reset', 'success');
}

// Mobile menu toggle
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.toggle('active');
}

// Logout function
function logout() {
    deleteCookie('access_token');
    showToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = '/client/Dashboard/templates/login.html';
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

// Auto-refresh data every 5 minutes
setInterval(async function() {
    try {
        await Promise.all([
            loadUserFunds(),
            loadHomeTeachers(),
            loadTransactionHistory()
        ]);
    } catch (error) {
        console.error('Auto-refresh failed:', error);
    }
}, 5 * 60 * 1000);