// manager-dashboard.js

const API_BASE_URL = 'http://localhost:8000';
let currentManagerData = {};

// Authentication and initialization
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    initializeNavigation();
    loadDashboardData();
});

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}


// Check if user is authenticated and is a manager
function checkAuthentication() {
    const token = getCookie('access_token');
    const role = getCookie("user_role")
    if (!token || role !== "manager") {
        redirectToLogin();
        return;
    }

    // Decode token to check role
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'manager') {
            showToast('Access denied. Manager access required.', 'error');
            redirectToLogin();
            return;
        }
        
        currentManagerData = {
            emp_id: payload.emp_id,
            role: payload.role
        };
        
        // Set manager name in navigation
        document.getElementById('manager-name').textContent = `Manager (${payload.emp_id})`;
        
    } catch (error) {
        console.error('Token parsing error:', error);
        redirectToLogin();
    }
}

// Redirect to login page
function redirectToLogin() {
    window.location.href = '/client/Dashboard/templates/login.html';
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // remove cookies by setting them expired
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict";
        document.cookie = "user_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict";
        document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict";

        window.location.href = '/client/Dashboard/templates/login.html';
    }
}


// Initialize navigation
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
            
            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Show specific section
function showSection(sectionName) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.remove('active'));
    
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Load section-specific data
        switch(sectionName) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'field-managers':
                loadFieldManagers();
                break;
            case 'funds':
                loadFundsData();
                break;
        }
    }
}

// Load dashboard data
async function loadDashboardData() {
    showLoading(true);
    
    try {
        // Load manager funds
        await loadManagerFunds();
        
        // Load field managers
        await loadFieldManagersStats();
        
        // Load recent transfers
        await loadRecentTransfers();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

// Load manager funds
async function loadManagerFunds() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_emp_funds`, {
            headers: {
                'Authorization': `Bearer ${getCookie('access_token')}`
            }
        });
        
        const data = await response.json();
        if (data.status === 'good') {
            const funds = data.detail.funds || 0;
            document.getElementById('manager-funds').textContent = `₹${funds}`;
            document.getElementById('available-funds').textContent = `₹${funds}`;
            document.getElementById('current-funds-display').textContent = `₹${funds}`;
        }
    } catch (error) {
        console.error('Error loading funds:', error);
    }
}

// Load field managers statistics
async function loadFieldManagersStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_all_employees`, {
            headers: {
                'Authorization': `Bearer ${getCookie('access_token')}`
            }
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            const employees = data.employees;
            const fieldManagers = employees.filter(emp => emp.role === 'field-manager');
            const homeTeachers = employees.filter(emp => emp.role === 'home-teacher');
            
            document.getElementById('total-field-managers').textContent = fieldManagers.length;
            document.getElementById('total-home-teachers').textContent = homeTeachers.length;
        }
    } catch (error) {
        console.error('Error loading employee stats:', error);
    }
}

// Load recent transfers
async function loadRecentTransfers() {
    try {
        const response = await fetch(`${API_BASE_URL}/funds_transfer_history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCookie('access_token')}`
            },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        if (data.transactions) {
            displayRecentTransfers(data.transactions.slice(0, 5)); // Show only last 5
            document.getElementById('recent-transfers').textContent = data.transactions.length;
        }
    } catch (error) {
        console.error('Error loading recent transfers:', error);
    }
}

// Display recent transfers
function displayRecentTransfers(transfers) {
    const container = document.getElementById('recent-transfers-list');
    
    if (transfers.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exchange-alt"></i><h3>No Recent Transfers</h3><p>No transfer history found</p></div>';
        return;
    }
    
    container.innerHTML = transfers.map(transfer => `
        <div class="activity-item">
            <div class="activity-info">
                <div class="activity-icon">
                    <i class="fas fa-arrow-right"></i>
                </div>
                <div class="activity-details">
                    <h4>${transfer.sender_name} → ${transfer.reciever_name}</h4>
                    <p>${new Date(transfer.transferred_at).toLocaleDateString()}</p>
                </div>
            </div>
            <div class="activity-amount">₹${transfer.transferred_amount}</div>
        </div>
    `).join('');
}

// Load field managers
async function loadFieldManagers() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/get_all_employees`, {
            headers: {
                'Authorization': `Bearer ${getCookie('access_token')}`
            }
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            const fieldManagers = data.employees.filter(emp => emp.role === 'field-manager');
            displayFieldManagers(fieldManagers);
            populateFieldManagerSelect(fieldManagers);
        }
    } catch (error) {
        console.error('Error loading field managers:', error);
        showToast('Error loading field managers', 'error');
    } finally {
        showLoading(false);
    }
}

// Display field managers in table
function displayFieldManagers(fieldManagers) {
    const tbody = document.getElementById('field-managers-table-body');
    
    if (fieldManagers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-users-cog"></i><h3>No Field Managers</h3><p>Create your first field manager</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = fieldManagers.map(fm => `
        <tr>
            <td>${fm.id}</td>
            <td>${fm.name}</td>
            <td>${fm.email}</td>
            <td>-</td>
            <td class="funds-amount">₹${fm.funds || 0}</td>
            <td>-</td>
            <td>${new Date(fm.created_at).toLocaleDateString()}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-small" onclick="viewEmployeeDetails('${fm.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Populate field manager select dropdown
function populateFieldManagerSelect(fieldManagers) {
    const select = document.getElementById('field-manager-select');
    select.innerHTML = '<option value="">Select Field Manager</option>';
    
    fieldManagers.forEach(fm => {
        select.innerHTML += `<option value="${fm.id}">${fm.name} (${fm.id})</option>`;
    });
}

// Load funds data
async function loadFundsData() {
    await loadManagerFunds();
    await loadFieldManagers();
    await loadTransactionHistory();
}

// Transfer funds
async function transferFunds() {
    const receiverId = document.getElementById('field-manager-select').value;
    const amount = document.getElementById('transfer-amount').value;
    
    if (!receiverId) {
        showToast('Please select a field manager', 'warning');
        return;
    }
    
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/add_funds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCookie('access_token')}`
            },
            body: JSON.stringify({
                receiver_id: receiverId,
                amount: parseInt(amount)
            })
        });
        
        const data = await response.json();
        
        if (data.status === 'good') {
            showToast('Funds transferred successfully!', 'success');
            document.getElementById('transfer-amount').value = '';
            document.getElementById('field-manager-select').value = '';
            
            // Refresh data
            await loadManagerFunds();
            await loadFieldManagers();
            await loadTransactionHistory();
        } else {
            showToast(data.detail?.message || 'Failed to transfer funds', 'error');
        }
    } catch (error) {
        console.error('Error transferring funds:', error);
        showToast('Error transferring funds', 'error');
    } finally {
        showLoading(false);
    }
}

// Refresh funds
async function refreshFunds() {
    await loadManagerFunds();
    showToast('Funds refreshed', 'success');
}

// Load transaction history
async function loadTransactionHistory() {
    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        const requestBody = {};
        if (startDate) requestBody.start_date = startDate;
        if (endDate) requestBody.end_date = endDate;
        
        const response = await fetch(`${API_BASE_URL}/funds_transfer_history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCookie('access_token')}`
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        if (data.transactions) {
            displayTransactionHistory(data.transactions);
        }
    } catch (error) {
        console.error('Error loading transaction history:', error);
        showToast('Error loading transaction history', 'error');
    }
}

// Display transaction history
function displayTransactionHistory(transactions) {
    const tbody = document.getElementById('transfers-table-body');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><i class="fas fa-history"></i><h3>No Transactions</h3><p>No transaction history found</p></td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const date = new Date(transaction.transferred_at).toLocaleDateString();
        const isOutgoing = transaction.sender_id === currentManagerData.emp_id;
        const type = isOutgoing ? 'Sent' : 'Received';
        const otherParty = isOutgoing ? transaction.reciever_name : transaction.sender_name;
        const statusClass = isOutgoing ? 'status-sent' : 'status-received';
        
        return `
            <tr>
                <td>${date}</td>
                <td><span class="status-badge ${statusClass}">${type}</span></td>
                <td>${otherParty}</td>
                <td class="funds-amount">₹${transaction.transferred_amount}</td>
                <td><i class="fas fa-check text-success"></i> Completed</td>
            </tr>
        `;
    }).join('');
}

// Filter transactions
function filterTransactions() {
    loadTransactionHistory();
}

// Clear filters
function clearFilters() {
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    loadTransactionHistory();
}

// Create field manager
document.getElementById('create-field-manager-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const password = document.getElementById('fm-password').value;
    const confirmPassword = document.getElementById('fm-confirm-password').value;
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data.role = 'field-manager'; // Set role explicitly
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/create_employee`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCookie('access_token')}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.status === 'good') {
            showToast('Field manager created successfully!', 'success');
            resetCreateForm();
            
            // Refresh field managers data
            await loadFieldManagers();
            await loadDashboardData();
        } else {
            showToast(result.detail?.message || 'Failed to create field manager', 'error');
        }
    } catch (error) {
        console.error('Error creating field manager:', error);
        showToast('Error creating field manager', 'error');
    } finally {
        showLoading(false);
    }
});

// Reset create form
function resetCreateForm() {
    document.getElementById('create-field-manager-form').reset();
}

// Search employee details
async function searchEmployeeDetails() {
    const employeeId = document.getElementById('employee-id-search').value.trim();
    
    if (!employeeId) {
        showToast('Please enter an employee ID', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/get_emp_details/${employeeId}`, {
            headers: {
                'Authorization': `Bearer ${getCookie('access_token')}`
            }
        });
        
        const data = await response.json();
        
        if (data.status === 'good') {
            displayEmployeeDetails(data.detail.data);
        } else {
            showToast('Employee not found', 'error');
            hideEmployeeDetails();
        }
    } catch (error) {
        console.error('Error searching employee:', error);
        showToast('Error searching employee', 'error');
        hideEmployeeDetails();
    } finally {
        showLoading(false);
    }
}

// Display employee details
function displayEmployeeDetails(employee) {
    const resultsDiv = document.getElementById('employee-search-results');
    
    resultsDiv.innerHTML = `
        <h4><i class="fas fa-user"></i> Employee Details</h4>
        <div class="employee-detail-grid">
            <div class="employee-detail-item">
                <span>Name:</span>
                <strong>${employee.name}</strong>
            </div>
            <div class="employee-detail-item">
                <span>Father's Name:</span>
                <strong>${employee.fname}</strong>
            </div>
            <div class="employee-detail-item">
                <span>Mother's Name:</span>
                <strong>${employee.mname}</strong>
            </div>
            <div class="employee-detail-item">
                <span>Email:</span>
                <strong>${employee.email}</strong>
            </div>
            <div class="employee-detail-item">
                <span>Phone:</span>
                <strong>${employee.phn}</strong>
            </div>
            <div class="employee-detail-item">
                <span>Role:</span>
                <strong class="role-badge role-${employee.role.replace('-', '')}">${employee.role.replace('-', ' ').toUpperCase()}</strong>
            </div>
            <div class="employee-detail-item">
                <span>Date of Birth:</span>
                <strong>${new Date(employee.DOB).toLocaleDateString()}</strong>
            </div>
            <div class="employee-detail-item">
                <span>Address:</span>
                <strong>${employee.addr}</strong>
            </div>
            <div class="employee-detail-item">
                <span>City:</span>
                <strong>${employee.city}</strong>
            </div>
            <div class="employee-detail-item">
                <span>District:</span>
                <strong>${employee.district}</strong>
            </div>
            <div class="employee-detail-item">
                <span>State:</span>
                <strong>${employee.state}</strong>
            </div>
            <div class="employee-detail-item">
                <span>Manager ID:</span>
                <strong>${employee.manager_id || 'N/A'}</strong>
            </div>
        </div>
    `;
    
    resultsDiv.style.display = 'block';
}

// Hide employee details
function hideEmployeeDetails() {
    document.getElementById('employee-search-results').style.display = 'none';
}

// View employee details (from table action)
async function viewEmployeeDetails(employeeId) {
    document.getElementById('employee-id-search').value = employeeId;
    showSection('employee-search');
    
    // Update active nav
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector('[data-section="employee-search"]').classList.add('active');
    
    await searchEmployeeDetails();
}

// Show transfer modal (simplified - using prompt for now)
function showTransferModal(receiverId, receiverName) {
    const amount = prompt(`Enter amount to transfer to ${receiverName}:`);
    if (amount && !isNaN(amount) && amount > 0) {
        document.getElementById('field-manager-select').value = receiverId;
        document.getElementById('transfer-amount').value = amount;
        showSection('funds');
        
        // Update active nav
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        document.querySelector('[data-section="funds"]').classList.add('active');
    }
}

// Search functionality for field managers
document.getElementById('field-manager-search').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#field-managers-table-body tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
});

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 type === 'warning' ? 'fa-exclamation-triangle' : 
                 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => container.removeChild(toast), 300);
    }, 5000);
}

// Handle enter key in search fields
document.getElementById('employee-id-search').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchEmployeeDetails();
    }
});

// Initialize date inputs with current date as max
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').setAttribute('max', today);
    document.getElementById('end-date').setAttribute('max', today);
});