// manager-dashboard.js - Complete implementation for manager dashboard

const API_BASE_URL = 'http://localhost:8000';
let currentManagerData = {};
let fieldManagers = [];
let homeTeachers = [];
let allEmployees = [];

// Authentication and initialization
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    initializeNavigation();
    initializeMobileMenu();
    loadDashboardData();
    initializeDateSelectors();
    initializeFormHandlers();
});

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Check if user is authenticated and is a manager
function checkAuthentication() {
    const token = getCookie('access_token');
    const role = getCookie("user_role");
    
    if (!token || role !== "manager") {
        redirectToLogin();
        return;
    }

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
        
        document.getElementById('manager-name').textContent = `Manager (${payload.emp_id})`;
        
    } catch (error) {
        console.error('Token parsing error:', error);
        redirectToLogin();
    }
}

function redirectToLogin() {
    window.location.href = '/client/Dashboard/templates/login.html';
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict";
        document.cookie = "user_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict";
        document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict";
        window.location.href = '/client/Dashboard/templates/login.html';
    }
}

// Initialize navigation
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
            
            // Update active nav item
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Update page title
            const title = this.querySelector('span').textContent;
            document.getElementById('page-title').textContent = title;
            
            // Close mobile menu if open
            closeMobileMenu();
        });
    });
}

// Mobile menu functions
function initializeMobileMenu() {
    // Mobile menu toggle is handled by onclick in HTML
}

function openMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    sidebar.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function toggleSidebar() {
    closeMobileMenu();
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
            case 'home-teachers':
                loadHomeTeachers();
                break;
            case 'add-employee':
                loadFieldManagersForSelect();
                break;
            case 'transaction-history':
                loadTransactionHistory();
                break;
        }
    }
}

// Load dashboard data
async function loadDashboardData() {
    showLoading(true);
    
    try {
        await loadManagerFunds();
        await loadEmployeeStats();
        await loadCommissions();
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
        }
    } catch (error) {
        console.error('Error loading funds:', error);
    }
}

// Load employee statistics
async function loadEmployeeStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_all_employees`, {
            headers: {
                'Authorization': `Bearer ${getCookie('access_token')}`
            }
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            allEmployees = data.employees;
            fieldManagers = data.employees.filter(emp => emp.role === 'field-manager');
            homeTeachers = data.employees.filter(emp => emp.role === 'home-teacher');
            
            document.getElementById('total-field-managers').textContent = fieldManagers.length;
            document.getElementById('total-home-teachers').textContent = homeTeachers.length;
        }
    } catch (error) {
        console.error('Error loading employee stats:', error);
    }
}

// Load commissions
async function loadCommissions() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_commisions/${currentManagerData.emp_id}`, {
            headers: {
                'Authorization': `Bearer ${getCookie('access_token')}`
            }
        });
        
        const data = await response.json();
        if (data.status === 'good') {
            const totalCommissions = data.detail.reduce((sum, comm) => {
                return sum + (comm.manager_commision || 0);
            }, 0);
            document.getElementById('total-commissions').textContent = `₹${totalCommissions}`;
        }
    } catch (error) {
        console.error('Error loading commissions:', error);
    }
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
        }
    } catch (error) {
        console.error('Error loading field managers:', error);
        showToast('Error loading field managers', 'error');
    } finally {
        showLoading(false);
    }
}

// Display field managers in table
function displayFieldManagers(managers) {
    const tbody = document.getElementById('field-managers-table-body');
    
    if (managers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-state"><i class="fas fa-users-cog"></i><h3>No Field Managers</h3><p>Create your first field manager</p></div></td></tr>';
        return;
    }
    
    tbody.innerHTML = managers.map(fm => {
        const homeTeachersCount = allEmployees.filter(emp => 
            emp.role === 'home-teacher' && emp.manager_id === fm.id
        ).length;
        
        return `
            <tr>
                <td>${fm.id}</td>
                <td>${fm.name}</td>
                <td>${fm.email}</td>
                <td>-</td>
                <td>₹${fm.funds || 0}</td>
                <td>${homeTeachersCount}</td>
                <td>${new Date(fm.created_at).toLocaleDateString()}</td>
            </tr>
        `;
    }).join('');
}

// Load home teachers
async function loadHomeTeachers() {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/get_all_employees`, {
            headers: {
                'Authorization': `Bearer ${getCookie('access_token')}`
            }
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            const homeTeachers = data.employees.filter(emp => emp.role === 'home-teacher');
            displayHomeTeachers(homeTeachers);
        }
    } catch (error) {
        console.error('Error loading home teachers:', error);
        showToast('Error loading home teachers', 'error');
    } finally {
        showLoading(false);
    }
}

// Display home teachers in table
function displayHomeTeachers(teachers) {
    const tbody = document.getElementById('home-teachers-table-body');
    
    if (teachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state"><i class="fas fa-chalkboard-teacher"></i><h3>No Home Teachers</h3><p>Create your first home teacher</p></div></td></tr>';
        return;
    }
    
    tbody.innerHTML = teachers.map(ht => `
        <tr>
            <td>${ht.id}</td>
            <td>${ht.name}</td>
            <td>${ht.email}</td>
            <td>-</td>
            <td>${ht.manager_name || 'N/A'}</td>
            <td>${new Date(ht.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

// Load field managers for select dropdown
async function loadFieldManagersForSelect() {
    try {
        const response = await fetch(`${API_BASE_URL}/get_field_managers_under_manager/${currentManagerData.emp_id}`, {
            headers: {
                'Authorization': `Bearer ${getCookie('access_token')}`
            }
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            const select = document.getElementById('manager-select');
            select.innerHTML = '<option value="">Select Field Manager</option>';
            
            data.field_managers.forEach(fm => {
                const option = document.createElement('option');
                option.value = fm.id;
                option.textContent = `${fm.name} (${fm.id})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading field managers for select:', error);
    }
}

// Initialize date selectors for salary slip
function initializeDateSelectors() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Populate year dropdown
    const yearSelect = document.getElementById('salary-year');
    yearSelect.innerHTML = '';
    for (let year = currentYear; year >= currentYear - 5; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
    
    // Set current month and year as default
    document.getElementById('salary-month').value = currentMonth;
    document.getElementById('salary-year').value = currentYear;
}

// Initialize form handlers
function initializeFormHandlers() {
    const form = document.getElementById('create-employee-form');
    if (form) {
        form.addEventListener('submit', handleCreateEmployee);
    }
}

// Handle role change in add employee form
function handleRoleChange() {
    const role = document.getElementById('emp-role').value;
    const fieldManagerGroup = document.getElementById('field-manager-group');
    const managerSelect = document.getElementById('manager-select');
    
    if (role === 'home-teacher') {
        fieldManagerGroup.style.display = 'block';
        managerSelect.setAttribute('required', 'required');
    } else {
        fieldManagerGroup.style.display = 'none';
        managerSelect.removeAttribute('required');
        managerSelect.value = '';
    }
}

// Handle create employee form submission
async function handleCreateEmployee(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const role = formData.get('role');
    
    // Validate passwords match
    const password = document.getElementById('emp-password').value;
    const confirmPassword = document.getElementById('emp-confirm-password').value;
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    // Prepare data object
    const data = {
        role: role,
        name: formData.get('name'),
        fname: formData.get('fname'),
        mname: formData.get('mname'),
        dob: formData.get('dob'),
        addr: formData.get('addr'),
        city: formData.get('city'),
        district: formData.get('district'),
        state: formData.get('state'),
        email: formData.get('email'),
        phn: formData.get('phn'),
        pwd: formData.get('pwd')
    };
    
    // Add manager_id for home-teacher
    if (role === 'home-teacher') {
        data.manager_id = formData.get('manager_id');
        if (!data.manager_id) {
            showToast('Please select a field manager', 'error');
            return;
        }
    }
    
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
            showToast(`${role.replace('-', ' ')} created successfully!`, 'success');
            resetForm();
            // Refresh dashboard data
            loadDashboardData();
        } else {
            showToast(result.detail?.message || 'Failed to create employee', 'error');
        }
    } catch (error) {
        console.error('Error creating employee:', error);
        showToast('Error creating employee', 'error');
    } finally {
        showLoading(false);
    }
}

// Reset form
function resetForm() {
    const form = document.getElementById('create-employee-form');
    if (form) {
        form.reset();
        handleRoleChange(); // Hide field manager group if shown
    }
}

// Generate salary slip
async function generateSalarySlip() {
    const month = document.getElementById('salary-month').value;
    const year = document.getElementById('salary-year').value;
    
    if (!month || !year) {
        showToast('Please select month and year', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        // Get commissions for the selected month
        const response = await fetch(`${API_BASE_URL}/get_commisions/${currentManagerData.emp_id}`, {
            headers: {
                'Authorization': `Bearer ${getCookie('access_token')}`
            }
        });
        
        const data = await response.json();
        if (data.status === 'good') {
            const commissions = data.detail;
            const monthlyCommissions = filterCommissionsByMonth(commissions, month, year);
            displaySalarySlip(monthlyCommissions, month, year);
        }
    } catch (error) {
        console.error('Error generating salary slip:', error);
        showToast('Error generating salary slip', 'error');
    } finally {
        showLoading(false);
    }
}

// Filter commissions by month and year
function filterCommissionsByMonth(commissions, month, year) {
    return commissions.filter(commission => {
        const commissionDate = new Date(commission.registered_at);
        return commissionDate.getMonth() + 1 == month && commissionDate.getFullYear() == year;
    });
}

// Display salary slip
function displaySalarySlip(commissions, month, year) {
    const container = document.getElementById('salary-slip-container');
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    
    const fieldManagerRegistrations = commissions.filter(c => c.created_role === 'field-manager');
    const homeTeacherRegistrations = commissions.filter(c => c.created_role === 'home-teacher');
    
    const totalSalary = commissions.reduce((sum, c) => sum + (c.manager_commision || 0), 0);
    
    container.innerHTML = `
        <div class="salary-slip">
            <div class="salary-header">
                <h1>SBC Education</h1>
                <p>A Non-Governmental Organization</p>
                <p>Address: Noida, Uttar Pradesh 201301</p>
                <p>Contact: contact@sbceducational.org | +91-0000000000</p>
                <br>
                <p><strong>MONTHLY SALARY SLIP</strong></p>
                <p>Salary Period: ${monthName} ${year}</p>
                <p>Generated on: ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="salary-info">
                <div class="info-section">
                    <h3>Employee Information</h3>
                    <div class="info-item">
                        <span>Employee ID:</span>
                        <strong>${currentManagerData.emp_id}</strong>
                    </div>
                    <div class="info-item">
                        <span>Designation:</span>
                        <strong>Regional Manager</strong>
                    </div>
                    <div class="info-item">
                        <span>Department:</span>
                        <strong>Field Operations & Development</strong>
                    </div>
                    <div class="info-item">
                        <span>Salary Period:</span>
                        <strong>${monthName} ${year}</strong>
                    </div>
                </div>
                
                <div class="info-section">
                    <h3>Performance Summary</h3>
                    <div class="info-item">
                        <span>Field Managers Recruited:</span>
                        <strong>${fieldManagerRegistrations.length}</strong>
                    </div>
                    <div class="info-item">
                        <span>Home Teachers Recruited:</span>
                        <strong>${homeTeacherRegistrations.length}</strong>
                    </div>
                    <div class="info-item">
                        <span>Total New Registrations:</span>
                        <strong>${commissions.length}</strong>
                    </div>
                    <div class="info-item">
                        <span>Commission Rate:</span>
                        <strong>₹50 per registration</strong>
                    </div>
                </div>
            </div>
            
            <div class="salary-breakdown">
                <h3>Detailed Commission Breakdown</h3>
                <table class="breakdown-table">
                    <thead>
                        <tr>
                            <th>Registration Type</th>
                            <th>Employee ID</th>
                            <th>Registration Date</th>
                            <th>Commission Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${commissions.map(commission => `
                            <tr>
                                <td>${commission.created_role.replace('-', ' ').toUpperCase()}</td>
                                <td>${commission.created_id}</td>
                                <td>${new Date(commission.registered_at).toLocaleDateString('en-IN')}</td>
                                <td>₹${commission.manager_commision || 0}</td>
                            </tr>
                        `).join('')}
                        ${commissions.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #666; padding: 2rem;">No registrations found for this period</td></tr>' : ''}
                        <tr class="total-row">
                            <td colspan="3"><strong>GROSS SALARY</strong></td>
                            <td><strong>₹${totalSalary}</strong></td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="3"><strong>DEDUCTIONS</strong></td>
                            <td><strong>₹0</strong></td>
                        </tr>
                        <tr class="total-row" style="background: var(--manager-primary); color: white;">
                            <td colspan="3"><strong>NET SALARY PAYABLE</strong></td>
                            <td><strong>₹${totalSalary}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="salary-total">
                <h3>Net Salary for ${monthName} ${year}: ₹${totalSalary}</h3>
                <p>Amount in words: ${numberToWords(totalSalary)} Rupees Only</p>
            </div>
            
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.9rem; color: #666;">
                <p><strong>Note:</strong> This salary is calculated based on performance metrics and commission structure of SBC Educational NGO.</p>
                <p><strong>Payment Method:</strong> Bank Transfer</p>
                <p><strong>Next Review Date:</strong> ${new Date(year, month, 0).toLocaleDateString('en-IN')}</p>
            </div>
        </div>
        
        <div class="print-actions">
            <button onclick="printSalarySlip()" class="btn btn-primary">
                <i class="fas fa-print"></i> Print Salary Slip
            </button>
            <button onclick="downloadSalarySlip('${monthName}_${year}')" class="btn btn-secondary">
                <i class="fas fa-download"></i> Download PDF
            </button>
        </div>
    `;
    
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

// Convert number to words (basic implementation)
function numberToWords(num) {
    if (num === 0) return "Zero";
    
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const thousands = ["", "Thousand", "Lakh", "Crore"];
    
    function convertHundreds(n) {
        let result = "";
        if (n >= 100) {
            result += ones[Math.floor(n / 100)] + " Hundred ";
            n %= 100;
        }
        if (n >= 20) {
            result += tens[Math.floor(n / 10)] + " ";
            n %= 10;
        } else if (n >= 10) {
            result += teens[n - 10] + " ";
            return result.trim();
        }
        if (n > 0) {
            result += ones[n] + " ";
        }
        return result.trim();
    }
    
    if (num < 1000) {
        return convertHundreds(num);
    }
    
    // Simplified for basic amounts
    let result = "";
    if (num >= 10000000) {
        result += convertHundreds(Math.floor(num / 10000000)) + " Crore ";
        num %= 10000000;
    }
    if (num >= 100000) {
        result += convertHundreds(Math.floor(num / 100000)) + " Lakh ";
        num %= 100000;
    }
    if (num >= 1000) {
        result += convertHundreds(Math.floor(num / 1000)) + " Thousand ";
        num %= 1000;
    }
    if (num > 0) {
        result += convertHundreds(num);
    }
    
    return result.trim();
}

// Print salary slip
function printSalarySlip() {
    window.print();
}

// Download salary slip (basic implementation)
function downloadSalarySlip(filename) {
    showToast('PDF download feature coming soon', 'info');
}

// Load transaction history
async function loadTransactionHistory() {
    showLoading(true);
    
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
        if (data.status === 'good') {
            displayTransactionHistory(data.detail.transactions);
        } else {
            showToast('No transaction history found', 'info');
            displayTransactionHistory([]);
        }
    } catch (error) {
        console.error('Error loading transaction history:', error);
        showToast('Error loading transaction history', 'error');
        displayTransactionHistory([]);
    } finally {
        showLoading(false);
    }
}

// Display transaction history
function displayTransactionHistory(transactions) {
    const tbody = document.getElementById('transactions-table-body');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="empty-state"><i class="fas fa-history"></i><h3>No Transactions</h3><p>No transaction history available</p></div></td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${new Date(transaction.transferred_at).toLocaleDateString('en-IN')}</td>
            <td>Fund Transfer</td>
            <td>
                <strong>From:</strong> ${transaction.sender_name || transaction.sender_id}<br>
                <strong>To:</strong> ${transaction.reciever_name || transaction.reciever_id}
            </td>
            <td>₹${transaction.transferred_amount}</td>
            <td><span class="badge success">Completed</span></td>
        </tr>
    `).join('');
}

// Filter transactions
function filterTransactions() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    if (!startDate || !endDate) {
        showToast('Please select both start and end dates', 'warning');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        showToast('Start date cannot be after end date', 'error');
        return;
    }
    
    loadFilteredTransactionHistory(startDate, endDate);
}

// Load filtered transaction history
async function loadFilteredTransactionHistory(startDate, endDate) {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/funds_transfer_history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCookie('access_token')}`
            },
            body: JSON.stringify({
                start_date: startDate,
                end_date: endDate
            })
        });
        
        const data = await response.json();
        if (data.status === 'good') {
            displayTransactionHistory(data.detail.transactions);
            showToast(`Found ${data.detail.transactions.length} transactions`, 'success');
        } else {
            displayTransactionHistory([]);
            showToast('No transactions found for selected period', 'info');
        }
    } catch (error) {
        console.error('Error loading filtered transactions:', error);
        showToast('Error loading transactions', 'error');
    } finally {
        showLoading(false);
    }
}

// Clear filters
function clearFilters() {
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    loadTransactionHistory();
}

// Refresh all data
async function refreshData() {
    showToast('Refreshing data...', 'info');
    await loadDashboardData();
    
    // Refresh current section data
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection) {
        const sectionId = activeSection.id.replace('-section', '');
        showSection(sectionId);
    }
    
    showToast('Data refreshed successfully', 'success');
}

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}    `;
    
    const icon = getToastIcon(type);
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function getToastIcon(type) {
    switch(type) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        default: return 'fas fa-info-circle';
    }
}

// Add some CSS for badges if not present
function addBadgeStyles() {
    if (!document.getElementById('badge-styles')) {
        const style = document.createElement('style');
        style.id = 'badge-styles';
        style.textContent = `
            .badge {
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
            }
            .badge.success {
                background: var(--success-color);
                color: white;
            }
            .badge.warning {
                background: var(--warning-color);
                color: white;
            }
            .badge.error {
                background: var(--danger-color);
                color: white;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize badge styles when DOM loads
document.addEventListener('DOMContentLoaded', addBadgeStyles);