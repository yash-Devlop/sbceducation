const API_BASE_URL = 'http://localhost:8000';

// Global state
let currentBranchData = null;
let allEmployees = [];
let employeeHierarchy = [];
let allCommissions = [];
let allTransactions = [];
let dashboardStats = {};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventListeners();
    initializeDashboard();
    setupMobileResponsiveness();
});

// Authentication check
function checkAuthentication() {
    const token = getCookie('access_token');
    if (!token) {
        window.location.href = '/client/Dashboard/templates/login.html';
        return;
    }
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role !== 'branch') {
            showToast('Unauthorized access', 'error');
            logout();
            return;
        }
        currentBranchData = payload;
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

function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });

    // Search functionality
    const searchInput = document.getElementById('employee-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterEmployees);
    }

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', handleRoleFilter);
    });

    // Date inputs
    setupDateInputs();
}

// Setup date inputs with defaults
function setupDateInputs() {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Commission date inputs
    const commissionEndDate = document.getElementById('commission-end-date');
    const commissionStartDate = document.getElementById('commission-start-date');
    if (commissionEndDate && commissionStartDate) {
        commissionEndDate.value = today;
        commissionStartDate.value = thirtyDaysAgo;
    }

    // Transaction date inputs
    const transactionEndDate = document.getElementById('transaction-end-date');
    const transactionStartDate = document.getElementById('transaction-start-date');
    if (transactionEndDate && transactionStartDate) {
        transactionEndDate.value = today;
        transactionStartDate.value = thirtyDaysAgo;
    }
}

// Mobile responsiveness setup
function setupMobileResponsiveness() {
    const mobileHeader = document.querySelector('.mobile-header');
    const sidebar = document.getElementById('sidebar');
    
    function checkScreenSize() {
        if (window.innerWidth <= 768) {
            if (mobileHeader) mobileHeader.style.display = 'flex';
            if (sidebar) sidebar.classList.remove('mobile-open');
        } else {
            if (mobileHeader) mobileHeader.style.display = 'none';
            if (sidebar) sidebar.classList.remove('mobile-open');
            const overlay = document.querySelector('.mobile-overlay');
            if (overlay) overlay.classList.remove('show');
        }
    }

    window.addEventListener('resize', checkScreenSize);
    checkScreenSize();
}

// Mobile sidebar functions
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    
    if (sidebar) sidebar.classList.add('mobile-open');
    if (overlay) overlay.classList.add('show');
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('show');
}

// Desktop sidebar toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleIcon = document.getElementById('toggleIcon');
    
    if (sidebar && mainContent) {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        
        if (toggleIcon) {
            toggleIcon.classList.toggle('fa-angle-left');
            toggleIcon.classList.toggle('fa-angle-right');
        }
    }
}

// Initialize dashboard data
async function initializeDashboard() {
    showLoading(true);
    try {
        await Promise.all([
            loadDashboardStats(),
            loadAllEmployees(),
            loadEmployeeHierarchy(),
            loadCommissionHistory(),
            loadTransactionHistory()
        ]);
        updateDashboardDisplay();
    } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        showToast('Failed to load dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

// Update user display
function updateUserDisplay() {
    if (currentBranchData) {
        const branchNameElement = document.getElementById('branch-name');
        if (branchNameElement) {
            branchNameElement.textContent = currentBranchData.emp_name || 'Branch Manager';
        }
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
    
    const targetSectionElement = document.getElementById(`${targetSection}-section`);
    if (targetSectionElement) {
        targetSectionElement.classList.add('active');
    }
    
    // Close mobile sidebar if open
    if (window.innerWidth <= 768) {
        closeMobileSidebar();
    }

    // Load section-specific data
    handleSectionSpecificLoading(targetSection);
}

// Handle section-specific data loading
function handleSectionSpecificLoading(section) {
    switch(section) {
        case 'employees':
            updateEmployeesTable();
            break;
        case 'hierarchy':
            updateHierarchyDisplay();
            break;
        case 'commissions':
            updateCommissionsTable();
            break;
        case 'transactions':
            updateTransactionsTable();
            break;
        case 'analytics':
            updateAnalyticsDisplay();
            break;
    }
}

// API call wrapper
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

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const response = await apiCall('/get_dashboard_stats');
        if (response.status === 'success') {
            dashboardStats = response.stats;
        }
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        // Initialize empty stats
        dashboardStats = {
            total_managers: 0,
            total_field_managers: 0,
            total_home_teachers: 0,
            total_funds_distributed: 0
        };
    }
}

// Load all employees
async function loadAllEmployees() {
    try {
        const response = await apiCall('/get_all_employees');
        if (response.status === 'success') {
            allEmployees = response.employees;
        }
    } catch (error) {
        console.error('Failed to load employees:', error);
        allEmployees = [];
    }
}

// Load employee hierarchy
async function loadEmployeeHierarchy() {
    try {
        const response = await apiCall('/get_employee_hierarchy');
        if (response.status === 'success') {
            employeeHierarchy = response.hierarchy;
        }
    } catch (error) {
        console.error('Failed to load hierarchy:', error);
        employeeHierarchy = [];
    }
}

// Load commission history
async function loadCommissionHistory() {
    try {
        const startDate = document.getElementById('commission-start-date')?.value;
        const endDate = document.getElementById('commission-end-date')?.value;
        
        const payload = {
            start_date: startDate || null,
            end_date: endDate || null
        };

        const response = await apiCall('/post/get_manager_commission_history', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (response.status === 'success') {
            allCommissions = response.commission_history || [];
            updateCommissionSummary(response.summary);
        }
    } catch (error) {
        console.error('Failed to load commissions:', error);
        allCommissions = [];
    }
}

// Load transaction history
async function loadTransactionHistory() {
    try {
        const startDate = document.getElementById('transaction-start-date')?.value;
        const endDate = document.getElementById('transaction-end-date')?.value;
        
        const payload = {
            start_date: startDate || null,
            end_date: endDate || null
        };

        const response = await apiCall('/funds_transfer_history', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (response.status === 'good') {
            allTransactions = response.detail.transactions || [];
            updateTransactionSummary();
        }
    } catch (error) {
        console.error('Failed to load transactions:', error);
        allTransactions = [];
    }
}

// Update dashboard display
function updateDashboardDisplay() {
    // Update stats
    const totalManagersEl = document.getElementById('total-managers');
    const totalFieldManagersEl = document.getElementById('total-field-managers');
    const totalHomeTeachersEl = document.getElementById('total-home-teachers');
    const totalFundsEl = document.getElementById('total-funds');

    if (totalManagersEl) totalManagersEl.textContent = dashboardStats.total_managers || 0;
    if (totalFieldManagersEl) totalFieldManagersEl.textContent = dashboardStats.total_field_managers || 0;
    if (totalHomeTeachersEl) totalHomeTeachersEl.textContent = dashboardStats.total_home_teachers || 0;
    if (totalFundsEl) totalFundsEl.textContent = `₹${dashboardStats.total_funds_distributed || 0}`;

    // Update recent activities and commissions
    updateRecentActivitiesTable();
    updateRecentCommissionsTable();
}

// Update recent activities table
function updateRecentActivitiesTable() {
    const tbody = document.getElementById('recent-activities-table');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    const recentActivities = allTransactions.slice(0, 5);

    if (recentActivities.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fas fa-clock"></i>
                        <h3>No Recent Activities</h3>
                        <p>No recent activities to display</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    recentActivities.forEach(activity => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(activity.transferred_at)}</td>
            <td>Fund Transfer</td>
            <td>${activity.sender_name || 'Admin'}</td>
            <td>Transfer to ${activity.reciever_name}</td>
            <td>₹${activity.transferred_amount}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update recent commissions table
function updateRecentCommissionsTable() {
    const tbody = document.getElementById('recent-commissions-table');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    const recentCommissions = allCommissions.slice(0, 5);

    if (recentCommissions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="empty-state">
                        <i class="fas fa-coins"></i>
                        <h3>No Recent Commissions</h3>
                        <p>No recent commissions to display</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    recentCommissions.forEach(commission => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(commission.registered_at)}</td>
            <td>${commission.manager_name || 'Unknown'}</td>
            <td>${commission.created_role.replace('-', ' ').toUpperCase()}</td>
            <td>₹${commission.manager_commision || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Handle role filter
function handleRoleFilter(event) {
    const selectedRole = event.target.getAttribute('data-role');
    
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter and update table
    updateEmployeesTable(selectedRole);
}

// Update employees table
function updateEmployeesTable(filterRole = 'all') {
    const tbody = document.getElementById('employees-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    let filteredEmployees = allEmployees;
    if (filterRole !== 'all') {
        filteredEmployees = allEmployees.filter(emp => emp.role === filterRole);
    }
    
    if (filteredEmployees.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>No Employees Found</h3>
                        <p>No employees match the selected criteria</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    filteredEmployees.forEach(employee => {
        const row = document.createElement('tr');
        const roleBadgeClass = `role-${employee.role}`;
        row.innerHTML = `
            <td>${employee.id}</td>
            <td>${employee.name}</td>
            <td>${employee.email}</td>
            <td><span class="role-badge ${roleBadgeClass}">${employee.role.replace('-', ' ').toUpperCase()}</span></td>
            <td>${employee.manager_name || 'N/A'}</td>
            <td>₹${employee.funds || 0}</td>
            <td>${formatDate(employee.created_at)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Filter employees by search
function filterEmployees() {
    const searchInput = document.getElementById('employee-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const rows = document.querySelectorAll('#employees-table-body tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Update hierarchy display
function updateHierarchyDisplay() {
    const container = document.getElementById('hierarchy-container');
    if (!container) return;

    container.innerHTML = '';

    if (employeeHierarchy.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sitemap"></i>
                <h3>No Hierarchy Data</h3>
                <p>No organizational hierarchy available</p>
            </div>
        `;
        return;
    }

    employeeHierarchy.forEach(manager => {
        const managerElement = createManagerHierarchyElement(manager);
        container.appendChild(managerElement);
    });
}

// Create manager hierarchy element
function createManagerHierarchyElement(manager) {
    const managerDiv = document.createElement('div');
    managerDiv.className = 'hierarchy-manager';
    
    const totalFieldManagers = manager.field_managers ? manager.field_managers.length : 0;
    const totalHomeTeachers = manager.field_managers ? 
        manager.field_managers.reduce((sum, fm) => sum + (fm.home_teachers ? fm.home_teachers.length : 0), 0) : 0;

    managerDiv.innerHTML = `
        <div class="manager-header">
            <div class="manager-info">
                <div class="manager-name">${manager.name}</div>
                <div class="manager-details">${manager.id} • ${manager.email}</div>
            </div>
            <div class="manager-stats">
                <div class="stat-item">
                    <span class="stat-number">${totalFieldManagers}</span>
                    <span class="stat-label">Field Managers</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${totalHomeTeachers}</span>
                    <span class="stat-label">Home Teachers</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">₹${manager.funds || 0}</span>
                    <span class="stat-label">Funds</span>
                </div>
            </div>
        </div>
        <div class="field-managers-container">
            <div class="field-manager-grid">
                ${manager.field_managers ? manager.field_managers.map(fm => `
                    <div class="field-manager-card">
                        <div class="field-manager-header">
                            <div class="fm-avatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="fm-info">
                                <h4>${fm.name}</h4>
                                <p>${fm.id} • ${fm.email}</p>
                            </div>
                        </div>
                        <div class="fm-stats">
                            <span>Home Teachers: <span>${fm.home_teachers ? fm.home_teachers.length : 0}</span></span>
                            <span>Funds: <span>₹${fm.funds || 0}</span></span>
                        </div>
                    </div>
                `).join('') : '<p>No field managers under this manager</p>'}
            </div>
        </div>
    `;

    return managerDiv;
}

// Update commissions table
function updateCommissionsTable() {
    const tbody = document.getElementById('all-commissions-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (allCommissions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-coins"></i>
                        <h3>No Commissions Found</h3>
                        <p>No commission records available for the selected period</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    allCommissions.forEach(commission => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(commission.registered_at)}</td>
            <td>${commission.manager_name || 'Unknown'}</td>
            <td>${commission.field_manager_name || 'N/A'}</td>
            <td>${commission.created_role.replace('-', ' ').toUpperCase()}</td>
            <td>${commission.created_employee_name || 'Unknown'}</td>
            <td>₹${commission.manager_commision || 0}</td>
            <td>₹${commission.field_manager_commision || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update commission summary
function updateCommissionSummary(summary) {
    const totalManagerCommissionEl = document.getElementById('total-manager-commission');
    const totalFieldManagerCommissionEl = document.getElementById('total-field-manager-commission');
    const totalRegistrationsEl = document.getElementById('total-registrations');

    if (summary) {
        if (totalManagerCommissionEl) {
            totalManagerCommissionEl.textContent = `₹${summary.total_commission || 0}`;
        }
        if (totalFieldManagerCommissionEl) {
            const fieldManagerCommission = allCommissions.reduce((sum, c) => sum + (c.field_manager_commision || 0), 0);
            totalFieldManagerCommissionEl.textContent = `₹${fieldManagerCommission}`;
        }
        if (totalRegistrationsEl) {
            totalRegistrationsEl.textContent = summary.total_registrations || 0;
        }
    } else {
        // Calculate from allCommissions if no summary provided
        const totalManagerCommission = allCommissions.reduce((sum, c) => sum + (c.manager_commision || 0), 0);
        const totalFieldManagerCommission = allCommissions.reduce((sum, c) => sum + (c.field_manager_commision || 0), 0);
        
        if (totalManagerCommissionEl) totalManagerCommissionEl.textContent = `₹${totalManagerCommission}`;
        if (totalFieldManagerCommissionEl) totalFieldManagerCommissionEl.textContent = `₹${totalFieldManagerCommission}`;
        if (totalRegistrationsEl) totalRegistrationsEl.textContent = allCommissions.length;
    }
}

// Update transactions table
function updateTransactionsTable() {
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (allTransactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fas fa-exchange-alt"></i>
                        <h3>No Transactions Found</h3>
                        <p>No transaction records available for the selected period</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    allTransactions.forEach(transaction => {
        const row = document.createElement('tr');
        
        // Get receiver role from allEmployees if available
        const receiver = allEmployees.find(emp => emp.id === transaction.reciever_id);
        const receiverRole = receiver ? receiver.role.replace('-', ' ').toUpperCase() : 'Unknown';
        
        row.innerHTML = `
            <td>${formatDate(transaction.transferred_at)}</td>
            <td>${transaction.sender_name || 'Admin'}</td>
            <td>${transaction.reciever_name}</td>
            <td>₹${transaction.transferred_amount}</td>
            <td>${receiverRole}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update transaction summary
function updateTransactionSummary() {
    const totalTransfersEl = document.getElementById('total-transfers');
    const totalAmountTransferredEl = document.getElementById('total-amount-transferred');

    if (totalTransfersEl) {
        totalTransfersEl.textContent = allTransactions.length;
    }
    
    if (totalAmountTransferredEl) {
        const totalAmount = allTransactions.reduce((sum, t) => sum + (t.transferred_amount || 0), 0);
        totalAmountTransferredEl.textContent = `₹${totalAmount}`;
    }
}

// Update analytics display
function updateAnalyticsDisplay() {
    updateTopPerformers();
    // Chart placeholders remain as they are for now
}

// Update top performers
function updateTopPerformers() {
    const topManagerEl = document.getElementById('top-manager');
    const topFieldManagerEl = document.getElementById('top-field-manager');
    const avgGrowthEl = document.getElementById('avg-growth');

    // Calculate top performing manager by commission
    if (allCommissions.length > 0) {
        const managerCommissions = {};
        allCommissions.forEach(commission => {
            const managerId = commission.manager_id;
            if (!managerCommissions[managerId]) {
                managerCommissions[managerId] = {
                    name: commission.manager_name,
                    total: 0,
                    count: 0
                };
            }
            managerCommissions[managerId].total += commission.manager_commision || 0;
            managerCommissions[managerId].count += 1;
        });

        const topManager = Object.values(managerCommissions).reduce((prev, current) => 
            (prev.total > current.total) ? prev : current
        );

        if (topManagerEl) {
            topManagerEl.innerHTML = `
                <strong>${topManager.name}</strong><br>
                <small>₹${topManager.total} commission • ${topManager.count} registrations</small>
            `;
        }
    } else {
        if (topManagerEl) topManagerEl.textContent = 'No data available';
    }

    // Calculate most active field manager
    if (allCommissions.length > 0) {
        const fieldManagerActivity = {};
        allCommissions.forEach(commission => {
            if (commission.field_manager_id) {
                const fmId = commission.field_manager_id;
                if (!fieldManagerActivity[fmId]) {
                    fieldManagerActivity[fmId] = {
                        name: commission.field_manager_name,
                        count: 0
                    };
                }
                fieldManagerActivity[fmId].count += 1;
            }
        });

        if (Object.keys(fieldManagerActivity).length > 0) {
            const topFieldManager = Object.values(fieldManagerActivity).reduce((prev, current) => 
                (prev.count > current.count) ? prev : current
            );

            if (topFieldManagerEl) {
                topFieldManagerEl.innerHTML = `
                    <strong>${topFieldManager.name}</strong><br>
                    <small>${topFieldManager.count} home teacher registrations</small>
                `;
            }
        } else {
            if (topFieldManagerEl) topFieldManagerEl.textContent = 'No field manager activity';
        }
    } else {
        if (topFieldManagerEl) topFieldManagerEl.textContent = 'No data available';
    }

    // Calculate average growth (simplified - based on recent registrations)
    if (allEmployees.length > 0) {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const thisMonthRegistrations = allEmployees.filter(emp => {
            if (!emp.created_at) return false;
            const createdDate = new Date(emp.created_at);
            return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
        }).length;

        if (avgGrowthEl) {
            avgGrowthEl.innerHTML = `
                <strong>${thisMonthRegistrations} new employees</strong><br>
                <small>This month</small>
            `;
        }
    } else {
        if (avgGrowthEl) avgGrowthEl.textContent = 'No growth data';
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide and remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => container.removeChild(toast), 300);
    }, 4000);
}

function logout() {
    deleteCookie('access_token');
    deleteCookie('user_role');
    deleteCookie('user_name');
    window.location.href = '/client/Dashboard/templates/login.html';
}

// Global functions for button clicks
window.loadCommissionHistory = loadCommissionHistory;
window.loadTransactionHistory = loadTransactionHistory;
window.toggleSidebar = toggleSidebar;
window.toggleMobileSidebar = toggleMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.logout = logout;