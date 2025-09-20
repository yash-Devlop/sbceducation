// admin-dashboard.js

// Global variables
const BASE_URL = 'http://localhost:8000';
let currentEmployeeData = null;
let allEmployees = [];

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Check for authentication token
const token = getCookie("access_token");
const role = getCookie("user_role");
if (!token || role !== "admin") {
    window.location.href = '/Dashboard/templates/login.html';
}

// API Headers
const getHeaders = () => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    loadDashboardData();
    setupEventListeners();
});

// Navigation functionality
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links and sections
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Show corresponding section
            const sectionId = link.dataset.section + '-section';
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                
                // Load section-specific data
                loadSectionData(link.dataset.section);
            }
        });
    });
}

// Load section-specific data
function loadSectionData(section) {
    switch(section) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'employees':
            loadAllEmployees();
            break;
        case 'hierarchy':
            loadHierarchy();
            break;
        case 'funds':
            loadTransferHistory();
            break;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Employee search
    const employeeSearch = document.getElementById('employee-search');
    if (employeeSearch) {
        employeeSearch.addEventListener('input', filterEmployees);
    }
    
    // Role filter
    const roleFilter = document.getElementById('role-filter');
    if (roleFilter) {
        roleFilter.addEventListener('change', filterEmployees);
    }
    
    // Create employee form
    const createForm = document.getElementById('create-employee-form');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateEmployee);
    }
    
    // Fund amount input
    const fundAmountInput = document.getElementById('fund-amount');
    if (fundAmountInput) {
        fundAmountInput.addEventListener('input', validateFundAmount);
    }
}

// Load initial dashboard data
async function loadDashboardData() {
    await Promise.all([
        loadDashboardStats(),
        loadAllEmployees()
    ]);
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        showLoading();
        const response = await fetch(`${BASE_URL}/get_dashboard_stats`, {
            headers: getHeaders()
        });
        
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const data = await response.json();
        updateDashboardStats(data.stats);
        updateRecentTransfers(data.stats.recent_transfers);
        
    } catch (error) {
        showToast('Failed to load dashboard statistics', 'error');
        console.error('Error loading dashboard stats:', error);
    } finally {
        hideLoading();
    }
}

// Update dashboard statistics display
function updateDashboardStats(stats) {
    document.getElementById('total-managers').textContent = stats.total_managers;
    document.getElementById('total-field-managers').textContent = stats.total_field_managers;
    document.getElementById('total-home-teachers').textContent = stats.total_home_teachers;
    document.getElementById('total-funds').textContent = `₹${stats.total_funds_distributed.toLocaleString()}`;
}

// Update recent transfers display
function updateRecentTransfers(transfers) {
    const container = document.getElementById('recent-transfers');
    if (!transfers || transfers.length === 0) {
        container.innerHTML = '<p class="no-data">No recent transfers found.</p>';
        return;
    }
    
    container.innerHTML = transfers.map(transfer => `
        <div class="activity-item">
            <div class="activity-info">
                <div class="activity-icon">
                    <i class="fas fa-exchange-alt"></i>
                </div>
                <div class="activity-details">
                    <h4>${transfer[2]} → ${transfer[3]}</h4>
                    <p>${formatDateTime(transfer[1])}</p>
                </div>
            </div>
            <div class="activity-amount">₹${transfer[0]}</div>
        </div>
    `).join('');
}

// Load all employees
async function loadAllEmployees() {
    try {
        showLoading();
        const response = await fetch(`${BASE_URL}/get_all_employees`, {
            headers: getHeaders()
        });
        
        if (!response.ok) throw new Error('Failed to fetch employees');
        
        const data = await response.json();
        allEmployees = data.employees;
        displayEmployees(allEmployees);
        
    } catch (error) {
        showToast('Failed to load employees', 'error');
        console.error('Error loading employees:', error);
    } finally {
        hideLoading();
    }
}

// Display employees in table
function displayEmployees(employees) {
    const tbody = document.getElementById('employees-table-body');
    if (!employees || employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No employees found</td></tr>';
        return;
    }
    
    tbody.innerHTML = employees.map(emp => `
        <tr>
            <td><strong>${emp.id}</strong></td>
            <td>${emp.name}</td>
            <td>${emp.email}</td>
            <td><span class="role-badge role-${emp.role.replace('-', '-')}">${emp.role}</span></td>
            <td>${emp.manager_name || 'N/A'}</td>
            <td class="funds-amount">₹${(emp.funds || 0).toLocaleString()}</td>
            <td>${formatDate(emp.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-small" onclick="viewEmployee('${emp.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-success btn-small" onclick="quickAddFunds('${emp.id}', '${emp.name}')">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Filter employees
function filterEmployees() {
    const searchTerm = document.getElementById('employee-search').value.toLowerCase();
    const roleFilter = document.getElementById('role-filter').value;
    
    const filtered = allEmployees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm) || 
                            emp.email.toLowerCase().includes(searchTerm) ||
                            emp.id.toLowerCase().includes(searchTerm);
        const matchesRole = !roleFilter || emp.role === roleFilter;
        return matchesSearch && matchesRole;
    });
    
    displayEmployees(filtered);
}

// Load organizational hierarchy
async function loadHierarchy() {
    try {
        showLoading();
        const response = await fetch(`${BASE_URL}/get_employee_hierarchy`, {
            headers: getHeaders()
        });
        
        if (!response.ok) throw new Error('Failed to fetch hierarchy');
        
        const data = await response.json();
        displayHierarchy(data.hierarchy);
        
    } catch (error) {
        showToast('Failed to load hierarchy', 'error');
        console.error('Error loading hierarchy:', error);
    } finally {
        hideLoading();
    }
}

// Display organizational hierarchy
function displayHierarchy(hierarchy) {
    const container = document.getElementById('hierarchy-container');
    if (!hierarchy || hierarchy.length === 0) {
        container.innerHTML = '<p class="no-data">No hierarchy data found.</p>';
        return;
    }
    
    let html = '';
    
    hierarchy.forEach(manager => {
        html += `
            <div class="hierarchy-level">
                <div class="hierarchy-title">
                    <i class="fas fa-user-tie"></i> Manager
                </div>
                <div class="hierarchy-card manager-card">
                    <h4><i class="fas fa-user-tie"></i> ${manager.name}</h4>
                    <p><strong>ID:</strong> ${manager.id}</p>
                    <p><strong>Email:</strong> ${manager.email}</p>
                    <p><strong>Funds:</strong> <span class="funds-display">₹${(manager.funds || 0).toLocaleString()}</span></p>
                    <p><strong>Joined:</strong> ${formatDate(manager.created_at)}</p>
                </div>
        `;
        
        if (manager.field_managers && manager.field_managers.length > 0) {
            html += `
                <div class="hierarchy-title" style="margin-top: 2rem;">
                    <i class="fas fa-users-cog"></i> Field Managers
                </div>
                <div class="hierarchy-grid">
            `;
            
            manager.field_managers.forEach(fm => {
                html += `
                    <div class="hierarchy-card field-manager-card">
                        <h4><i class="fas fa-users-cog"></i> ${fm.name}</h4>
                        <p><strong>ID:</strong> ${fm.id}</p>
                        <p><strong>Email:</strong> ${fm.email}</p>
                        <p><strong>Funds:</strong> <span class="funds-display">₹${(fm.funds || 0).toLocaleString()}</span></p>
                        <p><strong>Joined:</strong> ${formatDate(fm.created_at)}</p>
                    </div>
                `;
                
                if (fm.home_teachers && fm.home_teachers.length > 0) {
                    fm.home_teachers.forEach(ht => {
                        html += `
                            <div class="hierarchy-card home-teacher-card">
                                <h4><i class="fas fa-chalkboard-teacher"></i> ${ht.name}</h4>
                                <p><strong>ID:</strong> ${ht.id}</p>
                                <p><strong>Email:</strong> ${ht.email}</p>
                                <p><strong>Funds:</strong> <span class="funds-display">₹${(ht.funds || 0).toLocaleString()}</span></p>
                                <p><strong>Joined:</strong> ${formatDate(ht.created_at)}</p>
                            </div>
                        `;
                    });
                }
            });
            
            html += '</div>';
        }
        
        html += '</div>';
    });
    
    container.innerHTML = html;
}

// Search employee by ID
async function searchEmployee() {
    const empId = document.getElementById('emp-id-search').value.trim();
    if (!empId) {
        showToast('Please enter an employee ID', 'warning');
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${BASE_URL}/get_emp_details/${empId}`, {
            headers: getHeaders()
        });
        
        if (!response.ok) throw new Error('Failed to fetch employee details');
        
        const data = await response.json();
        if (data.status === 'bad') {
            showToast('Employee not found', 'error');
            document.getElementById('employee-details').style.display = 'none';
            return;
        }
        
        currentEmployeeData = { id: empId, ...data.detail.data };
        displayEmployeeDetails(currentEmployeeData);
        
    } catch (error) {
        showToast('Failed to fetch employee details', 'error');
        console.error('Error searching employee:', error);
    } finally {
        hideLoading();
    }
}

// Display employee details
function displayEmployeeDetails(employee) {
    const container = document.getElementById('employee-details');
    container.innerHTML = `
        <h4><i class="fas fa-user"></i> Employee Details</h4>
        <p><strong>Name:</strong> <span>${employee.name}</span></p>
        <p><strong>ID:</strong> <span>${employee.id || 'N/A'}</span></p>
        <p><strong>Email:</strong> <span>${employee.email}</span></p>
        <p><strong>Phone:</strong> <span>${employee.phn}</span></p>
        <p><strong>Role:</strong> <span class="role-badge role-${employee.role.replace('-', '-')}">${employee.role}</span></p>
        <p><strong>Father's Name:</strong> <span>${employee.fname}</span></p>
        <p><strong>Mother's Name:</strong> <span>${employee.mname}</span></p>
        <p><strong>DOB:</strong> <span>${formatDate(employee.DOB)}</span></p>
        <p><strong>Address:</strong> <span>${employee.addr}, ${employee.city}, ${employee.district}, ${employee.state}</span></p>
        <p><strong>Manager ID:</strong> <span>${employee.manager_id || 'N/A'}</span></p>
    `;
    
    container.style.display = 'block';
    
    // Enable fund transfer
    document.getElementById('receiver-id').value = employee.id || empId;
    document.getElementById('add-funds-btn').disabled = false;
}

// Validate fund amount input
function validateFundAmount() {
    const amount = parseInt(document.getElementById('fund-amount').value);
    const btn = document.getElementById('add-funds-btn');
    
    if (amount && amount > 0) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

// Add funds to employee
async function addFunds() {
    const receiverId = document.getElementById('receiver-id').value;
    const amount = parseInt(document.getElementById('fund-amount').value);
    
    if (!receiverId || !amount || amount <= 0) {
        showToast('Please select an employee and enter a valid amount', 'warning');
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`${BASE_URL}/add_funds`, {
            method: 'POST',
            headers: {
                ...getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount,
                receiver_id: receiverId
            })
        });

        console.log(response)
        
        if (!response.ok) throw new Error('Failed to add funds');
        
        const data = await response.json();
        showToast(data.detail.message, 'success');
        
        // Reset form
        document.getElementById('fund-amount').value = '';
        document.getElementById('add-funds-btn').disabled = true;
        
        // Reload data
        loadTransferHistory();
        loadDashboardStats();
        
    } catch (error) {
        showToast('Failed to add funds', 'error');
        console.error('Error adding funds:', error);
    } finally {
        hideLoading();
    }
}

// Quick add funds from employee table
function quickAddFunds(empId, empName) {
    // Switch to funds section
    document.querySelector('[data-section="funds"]').click();
    
    // Set employee ID
    document.getElementById('emp-id-search').value = empId;
    
    // Search for employee
    setTimeout(() => {
        searchEmployee();
    }, 100);
    
    showToast(`Ready to add funds to ${empName}`, 'success');
}

// View employee details
function viewEmployee(empId) {
    // Switch to funds section for now (could create a dedicated view section)
    document.querySelector('[data-section="funds"]').click();
    
    // Set employee ID and search
    document.getElementById('emp-id-search').value = empId;
    setTimeout(() => {
        searchEmployee();
    }, 100);
}

// Load transfer history
async function loadTransferHistory() {
    try {
        const response = await fetch(`${BASE_URL}/funds_transfer_history`, {
            method: 'POST',
            headers: {
                ...getHeaders(), // includes auth
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (!response.ok) throw new Error('Failed to fetch transfer history');
        
        const data = await response.json();
        displayTransferHistory(data.transactions);
        
    } catch (error) {
        showToast('Failed to load transfer history', 'error');
        console.error('Error loading transfer history:', error);
    }
}

// Display transfer history
function displayTransferHistory(transfers) {
    const tbody = document.getElementById('transfers-table-body');
    if (!transfers || transfers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No transfers found</td></tr>';
        return;
    }
    
    tbody.innerHTML = transfers.map(transfer => `
        <tr>
            <td>${formatDateTime(transfer.transferred_at)}</td>
            <td>${transfer.sender_name} ${transfer.sender_id === null? "":"(transfer.sender_id)"}</td>
            <td>${transfer.reciever_name} (${transfer.reciever_id})</td>
            <td class="funds-amount">₹${transfer.transferred_amount.toLocaleString()}</td>
        </tr>
    `).join('');
}

// Handle create employee form submission
async function handleCreateEmployee(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const employeeData = Object.fromEntries(formData.entries());
    
    try {
        showLoading();
        const response = await fetch(`${BASE_URL}/create_employee`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(employeeData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || 'Failed to create employee');
        }
        
        const data = await response.json();
        showToast(data.detail.message, 'success');
        
        // Reset form
        resetForm();
        
        // Reload data
        loadAllEmployees();
        loadDashboardStats();
        
    } catch (error) {
        showToast(error.message, 'error');
        console.error('Error creating employee:', error);
    } finally {
        hideLoading();
    }
}

// Reset create employee form
function resetForm() {
    document.getElementById('create-employee-form').reset();
}

// Logout functionality
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict";

        window.location.href = '/Dashboard/templates/login.html';
    }
}


// Utility Functions

// Show loading overlay
function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

// Show toast notification
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = getToastIcon(type);
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Hide toast after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, 4000);
}

// Get toast icon based on type
function getToastIcon(type) {
    switch(type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format datetime for display
function formatDateTime(dateString) {
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

// Handle API errors globally
window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message) {
        showToast(event.reason.message, 'error');
    }
});

// Handle network errors
function handleNetworkError(error) {
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        showToast('Session expired. Please login again.', 'error');
        setTimeout(() => {
            localStorage.removeItem('access_token');
            window.location.href = 'login.html';
        }, 2000);
    } else {
        showToast('Network error. Please check your connection.', 'error');
    }
}

// Auto-refresh data every 5 minutes
setInterval(() => {
    const activeSection = document.querySelector('.nav-link.active').dataset.section;
    loadSectionData(activeSection);
}, 300000); // 5 minutes

// Export functions for global access
window.searchEmployee = searchEmployee;
window.addFunds = addFunds;
window.quickAddFunds = quickAddFunds;
window.viewEmployee = viewEmployee;
window.resetForm = resetForm;
window.logout = logout;