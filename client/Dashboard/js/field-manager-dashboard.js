const API_BASE_URL = 'http://localhost:8000';

// Global state
let currentManagerData = null;
let homeTeachers = [];
let commissions = [];
let managerInfo = null;

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
        if (payload.role !== 'field-manager') {
            showToast('Unauthorized access', 'error');
            logout();
            return;
        }
        currentManagerData = payload;
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
    const searchInput = document.getElementById('home-teacher-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterHomeTeachers);
    }
}

// Mobile responsiveness setup
function setupMobileResponsiveness() {
    const mobileHeader = document.querySelector('.mobile-header');
    const sidebar = document.getElementById('sidebar');
    
    function checkScreenSize() {
        if (window.innerWidth <= 768) {
            mobileHeader.style.display = 'flex';
            sidebar.classList.remove('mobile-open');
        } else {
            mobileHeader.style.display = 'none';
            sidebar.classList.remove('mobile-open');
            document.querySelector('.mobile-overlay').classList.remove('show');
        }
    }

    window.addEventListener('resize', checkScreenSize);
    checkScreenSize();
}

// Initialize dashboard data
async function initializeDashboard() {
    showLoading(true);
    try {
        await Promise.all([
            loadManagerInfo(),
            loadFieldManagerData()
        ]);
        updateDashboardStats();
    } catch (error) {
        console.error('Failed to initialize dashboard:', error);
        showToast('Failed to load dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

// Update user display
function updateUserDisplay() {
    if (currentManagerData) {
        document.getElementById('field-manager-name').textContent = 
            currentManagerData.emp_name || currentManagerData.emp_id || 'Field Manager';
    }
}

// Load field manager data (home teachers and commissions)
async function loadFieldManagerData() {
    try {
        const response = await apiCall(`/get_field_manager_data/${currentManagerData.emp_id}`);
        if (response.status === 'success') {
            homeTeachers = response.data.home_teachers;
            commissions = response.data.commissions;
            
            updateHomeTeachersTable();
            updateCommissionsTable();
            updateAllCommissionsTable();
        }
    } catch (error) {
        console.error('Failed to load field manager data:', error);
        showToast('Failed to load field manager data', 'error');
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

// Load manager information
async function loadManagerInfo() {
    try {
        // Get current field manager details first
        const userResponse = await apiCall(`/get_emp_details/${currentManagerData.emp_id}`);
        if (userResponse.status === 'good') {
            const userData = userResponse.detail.data;
            if (userData.manager_id) {
                // Get manager details
                const managerResponse = await apiCall(`/get_emp_details/${userData.manager_id}`);
                if (managerResponse.status === 'good') {
                    managerInfo = managerResponse.detail.data;
                    managerInfo.manager_id = userData.manager_id; // Store the actual manager ID
                    updateManagerInfoDisplay();
                }
            } else {
                managerInfo = null;
                updateManagerInfoDisplay();
            }
        }
    } catch (error) {
        console.error('Failed to load manager info:', error);
        managerInfo = null;
        updateManagerInfoDisplay();
    }
}

// Update manager info display
function updateManagerInfoDisplay() {
    const managerNameEl = document.getElementById('manager-name');
    const managerIdEl = document.getElementById('manager-id');
    const managerEmailEl = document.getElementById('manager-email');

    if (managerInfo) {
        if (managerNameEl) managerNameEl.textContent = managerInfo.name;
        if (managerIdEl) managerIdEl.textContent = managerInfo.manager_id;
        if (managerEmailEl) managerEmailEl.textContent = managerInfo.email;
    } else {
        if (managerNameEl) managerNameEl.textContent = 'No Manager Assigned';
        if (managerIdEl) managerIdEl.textContent = 'N/A';
        if (managerEmailEl) managerEmailEl.textContent = 'N/A';
    }
}

// Load field manager data (home teachers and commissions)
async function loadFieldManagerData() {
    try {
        const response = await apiCall(`/get_field_manager_data/${currentManagerData.emp_id}`);
        if (response.status === 'success') {
            homeTeachers = response.data.home_teachers;
            commissions = response.data.commissions;
            
            updateHomeTeachersTable();
            updateCommissionsTable();
            updateAllCommissionsTable();
        }
    } catch (error) {
        console.error('Failed to load field manager data:', error);
        showToast('Failed to load field manager data', 'error');
    }
}

// Load home teachers under this field manager
async function loadHomeTeachers() {
    // This is now handled by loadFieldManagerData
    return;
}

// Load field manager commissions
async function loadCommissions() {
    // This is now handled by loadFieldManagerData
    return;
}

// Update dashboard stats
function updateDashboardStats() {
    const totalHomeTeachersEl = document.getElementById('total-home-teachers');
    const totalCommissionsEl = document.getElementById('total-commissions');
    
    if (totalHomeTeachersEl) {
        totalHomeTeachersEl.textContent = homeTeachers.length;
    }
    
    if (totalCommissionsEl) {
        const totalCommissions = commissions.reduce((sum, c) => 
            sum + (c.field_manager_commision || 0), 0);
        totalCommissionsEl.textContent = `₹${totalCommissions}`;
    }
}

// Update home teachers table
function updateHomeTeachersTable() {
    const tbody = document.getElementById('home-teachers-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (homeTeachers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-chalkboard-teacher"></i>
                        <h3>No Home Teachers Found</h3>
                        <p>No home teachers under your supervision</p>
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
            <td>${teacher.phn || '-'}</td>
            <td>${teacher.city || '-'}</td>
            <td>${teacher.state || '-'}</td>
            <td>${formatDate(teacher.created_at)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update all commissions table
function updateAllCommissionsTable() {
    const tbody = document.getElementById('all-commissions-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (commissions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fas fa-coins"></i>
                        <h3>No Commissions Found</h3>
                        <p>No commission records available</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    commissions.forEach(commission => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(commission.registered_at)}</td>
            <td>${commission.created_role.replace('-', ' ').toUpperCase()}</td>
            <td>${commission.created_id}</td>
            <td>${commission.created_employee_name || '-'}</td>
            <td>₹${commission.field_manager_commision || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update commissions table (recent commissions on dashboard)
function updateCommissionsTable() {
    const tbody = document.getElementById('commissions-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (commissions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fas fa-coins"></i>
                        <h3>No Commissions Found</h3>
                        <p>No commission records available</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Show recent 10 commissions
    const recentCommissions = commissions.slice(-10).reverse();
    
    recentCommissions.forEach(commission => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(commission.registered_at)}</td>
            <td>${commission.created_role.replace('-', ' ').toUpperCase()}</td>
            <td>${commission.created_id}</td>
            <td>-</td>
            <td>₹${commission.field_manager_commision || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Filter home teachers
function filterHomeTeachers() {
    const searchInput = document.getElementById('home-teacher-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const rows = document.querySelectorAll('#home-teachers-table-body tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Print current month commission slip
async function printCurrentMonthSlip() {
    const monthSelect = document.getElementById('salary-month');
    const yearSelect = document.getElementById('salary-year');
    
    if (!monthSelect || !yearSelect) {
        showToast('Month and year selection not available', 'error');
        return;
    }
    
    const month = monthSelect.value;
    const year = yearSelect.value;
    
    if (!month || !year) {
        showToast('Please select month and year first', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiCall(`/get_field_manager_monthly_commissions/${currentManagerData.emp_id}/${year}/${month}`);
        
        if (response.status === 'success') {
            printCommissionSlip(response.commissions, month, year, response.summary);
        }
    } catch (error) {
        console.error('Error loading commission data for print:', error);
        showToast('Error loading commission data', 'error');
    } finally {
        showLoading(false);
    }
}

// Generate salary/commission slip
async function generateSalarySlip() {
    const monthSelect = document.getElementById('salary-month');
    const yearSelect = document.getElementById('salary-year');
    
    if (!monthSelect || !yearSelect) {
        showToast('Month and year selection not available', 'error');
        return;
    }
    
    const month = monthSelect.value;
    const year = yearSelect.value;
    
    if (!month || !year) {
        showToast('Please select month and year', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiCall(`/get_field_manager_monthly_commissions/${currentManagerData.emp_id}/${year}/${month}`);
        
        if (response.status === 'success') {
            displaySalarySlip(response.commissions, month, year, response.summary);
        }
    } catch (error) {
        console.error('Error generating commission slip:', error);
        showToast('Error generating commission slip', 'error');
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
    if (!container) return;
    
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    
    const homeTeacherRegistrations = commissions.filter(c => c.created_role === 'home-teacher');
    
    const totalSalary = commissions.reduce((sum, c) => sum + (c.field_manager_commision || 0), 0);
    
    container.innerHTML = `
        <div class="salary-slip">
            <div class="salary-header">
                <h1>SBC Education</h1>
                <p>A Non-Governmental Organization</p>
                <p>Address: Noida, Uttar Pradesh 201301</p>
                <p>Contact: contact@sbceducational.org | +91-0000000000</p>
                <br>
                <p><strong>MONTHLY COMMISSION SLIP</strong></p>
                <p>Commission Period: ${monthName} ${year}</p>
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
                        <strong>Field Manager</strong>
                    </div>
                    <div class="info-item">
                        <span>Department:</span>
                        <strong>Field Operations</strong>
                    </div>
                    <div class="info-item">
                        <span>Commission Period:</span>
                        <strong>${monthName} ${year}</strong>
                    </div>
                    ${managerInfo ? `
                    <div class="info-item">
                        <span>Reporting Manager:</span>
                        <strong>${managerInfo.name}</strong>
                    </div>
                    ` : ''}
                </div>
                
                <div class="info-section">
                    <h3>Performance Summary</h3>
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
                        <strong>₹150 per home teacher registration</strong>
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
                                <td>₹${commission.field_manager_commision || 0}</td>
                            </tr>
                        `).join('')}
                        ${commissions.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #666; padding: 2rem;">No registrations found for this period</td></tr>' : ''}
                        <tr class="total-row">
                            <td colspan="3"><strong>GROSS COMMISSION</strong></td>
                            <td><strong>₹${totalSalary}</strong></td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="3"><strong>DEDUCTIONS</strong></td>
                            <td><strong>₹0</strong></td>
                        </tr>
                        <tr class="total-row" style="background: var(--field-manager-primary); color: white;">
                            <td colspan="3"><strong>NET COMMISSION PAYABLE</strong></td>
                            <td><strong>₹${totalSalary}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="salary-total">
                <h3>Net Commission for ${monthName} ${year}: ₹${totalSalary}</h3>
                <p>Amount in words: ${numberToWords(totalSalary)} Rupees Only</p>
            </div>
            
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.9rem; color: #666;">
                <p><strong>Note:</strong> This commission is calculated based on home teacher registrations under your supervision.</p>
                <p><strong>Payment Method:</strong> Bank Transfer</p>
                <p><strong>Next Review Date:</strong> ${new Date(year, month, 0).toLocaleDateString('en-IN')}</p>
                ${managerInfo ? `<p><strong>Approved by:</strong> ${managerInfo.name} (${managerInfo.manager_id || 'Manager'})</p>` : ''}
            </div>
        </div>
        
        <div class="print-actions">
            <button onclick="printSalarySlip()" class="btn btn-primary">
                <i class="fas fa-print"></i> Print Commission Slip
            </button>
            <button onclick="downloadSalarySlip('${monthName}_${year}')" class="btn btn-secondary">
                <i class="fas fa-download"></i> Download PDF
            </button>
        </div>
    `;
    
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

// Print salary slip (from generated slip)
function printSalarySlip() {
    const salarySlipElement = document.querySelector('.salary-slip');
    if (!salarySlipElement) {
        showToast('Please generate a commission slip first', 'warning');
        return;
    }
    
    const printContent = salarySlipElement.innerHTML;
    
    // Create print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Field Manager Commission Slip</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    line-height: 1.4;
                }
                .salary-slip { max-width: 800px; margin: 0 auto; }
                .salary-header { 
                    text-align: center; 
                    margin-bottom: 2rem; 
                    padding-bottom: 1rem; 
                    border-bottom: 3px solid #16a085; 
                }
                .salary-header h1 { 
                    color: #16a085; 
                    font-size: 2rem; 
                    margin-bottom: 0.5rem; 
                }
                .salary-info { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 2rem; 
                    margin-bottom: 2rem; 
                }
                .info-section { 
                    background: #f8f9fa; 
                    padding: 1.5rem; 
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;
                }
                .info-section h3 {
                    color: #16a085;
                    margin-bottom: 1rem;
                    font-size: 1.2rem;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 0.5rem;
                }
                .info-item { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 0.5rem; 
                    padding: 0.3rem 0; 
                    border-bottom: 1px solid #e0e0e0; 
                }
                .info-item:last-child { border-bottom: none; }
                .breakdown-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 1rem 0; 
                    border: 1px solid #ddd;
                }
                .breakdown-table th, .breakdown-table td { 
                    padding: 0.8rem; 
                    border: 1px solid #ddd; 
                    text-align: left; 
                    font-size: 0.9rem;
                }
                .breakdown-table th { 
                    background: #16a085; 
                    color: white; 
                    font-weight: bold;
                }
                .total-row { 
                    font-weight: bold; 
                    background: #f0f0f0; 
                }
                .salary-total { 
                    text-align: center; 
                    margin: 2rem 0; 
                    padding: 1rem;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                .salary-total h3 {
                    color: #16a085;
                    margin-bottom: 0.5rem;
                }
                @media print {
                    body { margin: 0; padding: 15px; }
                    .salary-slip { max-width: none; }
                    @page { margin: 0.5in; }
                }
            </style>
        </head>
        <body>
            <div class="salary-slip">${printContent}</div>
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    }
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Print commission slip directly
function printCommissionSlip(commissions, month, year, summary = null) {
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const homeTeacherRegistrations = commissions.filter(c => c.created_role === 'home-teacher');
    const totalSalary = summary ? summary.total_commission : commissions.reduce((sum, c) => sum + (c.field_manager_commision || 0), 0);
    
    const printContent = `
        <div class="salary-slip">
            <div class="salary-header">
                <h1>SBC Education</h1>
                <p>A Non-Governmental Organization</p>
                <p>Address: Noida, Uttar Pradesh 201301</p>
                <p>Contact: contact@sbceducational.org | +91-0000000000</p>
                <br>
                <p><strong>MONTHLY COMMISSION SLIP</strong></p>
                <p>Commission Period: ${monthName} ${year}</p>
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
                        <span>Name:</span>
                        <strong>${currentManagerData.emp_name || 'Field Manager'}</strong>
                    </div>
                    <div class="info-item">
                        <span>Designation:</span>
                        <strong>Field Manager</strong>
                    </div>
                    <div class="info-item">
                        <span>Department:</span>
                        <strong>Field Operations</strong>
                    </div>
                    <div class="info-item">
                        <span>Commission Period:</span>
                        <strong>${monthName} ${year}</strong>
                    </div>
                    ${managerInfo ? `
                    <div class="info-item">
                        <span>Reporting Manager:</span>
                        <strong>${managerInfo.name}</strong>
                    </div>
                    ` : ''}
                </div>
                
                <div class="info-section">
                    <h3>Performance Summary</h3>
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
                        <strong>₹150 per home teacher registration</strong>
                    </div>
                    <div class="info-item">
                        <span>Monthly Target:</span>
                        <strong>5 Home Teachers</strong>
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
                            <th>Employee Name</th>
                            <th>Registration Date</th>
                            <th>Commission Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${commissions.map(commission => `
                            <tr>
                                <td>${commission.created_role.replace('-', ' ').toUpperCase()}</td>
                                <td>${commission.created_id}</td>
                                <td>${commission.created_employee_name || '-'}</td>
                                <td>${new Date(commission.registered_at).toLocaleDateString('en-IN')}</td>
                                <td>₹${commission.field_manager_commision || 0}</td>
                            </tr>
                        `).join('')}
                        ${commissions.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #666; padding: 2rem;">No registrations found for this period</td></tr>' : ''}
                        <tr class="total-row">
                            <td colspan="4"><strong>GROSS COMMISSION</strong></td>
                            <td><strong>₹${totalSalary}</strong></td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="4"><strong>DEDUCTIONS</strong></td>
                            <td><strong>₹0</strong></td>
                        </tr>
                        <tr class="total-row" style="background: #16a085; color: white;">
                            <td colspan="4"><strong>NET COMMISSION PAYABLE</strong></td>
                            <td><strong>₹${totalSalary}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="salary-total">
                <h3>Net Commission for ${monthName} ${year}: ₹${totalSalary}</h3>
                <p>Amount in words: ${numberToWords(totalSalary)} Rupees Only</p>
            </div>
            
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.9rem; color: #666;">
                <p><strong>Note:</strong> This commission is calculated based on home teacher registrations under your supervision.</p>
                <p><strong>Commission Structure:</strong> ₹150 per home teacher successfully recruited and registered.</p>
                <p><strong>Payment Method:</strong> Bank Transfer</p>
                <p><strong>Next Review Date:</strong> ${new Date(year, month, 0).toLocaleDateString('en-IN')}</p>
                ${managerInfo ? `<p><strong>Approved by:</strong> ${managerInfo.name} (Manager)</p>` : ''}
                <p><strong>Generated by:</strong> SBC Education Management System</p>
            </div>
        </div>
    `;
    
    // Create print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>Field Manager Commission Slip - ${monthName} ${year}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    line-height: 1.4;
                }
                .salary-slip { max-width: 800px; margin: 0 auto; }
                .salary-header { 
                    text-align: center; 
                    margin-bottom: 2rem; 
                    padding-bottom: 1rem; 
                    border-bottom: 3px solid #16a085; 
                }
                .salary-header h1 { 
                    color: #16a085; 
                    font-size: 2rem; 
                    margin-bottom: 0.5rem; 
                }
                .salary-info { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 2rem; 
                    margin-bottom: 2rem; 
                }
                .info-section { 
                    background: #f8f9fa; 
                    padding: 1.5rem; 
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;
                }
                .info-section h3 {
                    color: #16a085;
                    margin-bottom: 1rem;
                    font-size: 1.2rem;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 0.5rem;
                }
                .info-item { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 0.5rem; 
                    padding: 0.3rem 0; 
                    border-bottom: 1px solid #e0e0e0; 
                }
                .info-item:last-child { border-bottom: none; }
                .breakdown-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 1rem 0; 
                    border: 1px solid #ddd;
                }
                .breakdown-table th, .breakdown-table td { 
                    padding: 0.8rem; 
                    border: 1px solid #ddd; 
                    text-align: left; 
                    font-size: 0.9rem;
                }
                .breakdown-table th { 
                    background: #16a085; 
                    color: white; 
                    font-weight: bold;
                }
                .total-row { 
                    font-weight: bold; 
                    background: #f0f0f0; 
                }
                .salary-total { 
                    text-align: center; 
                    margin: 2rem 0; 
                    padding: 1rem;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                .salary-total h3 {
                    color: #16a085;
                    margin-bottom: 0.5rem;
                }
                @media print {
                    body { margin: 0; padding: 15px; }
                    .salary-slip { max-width: none; }
                    @page { margin: 0.5in; }
                }
            </style>
        </head>
        <body>
            ${printContent}
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    }
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Download salary slip as PDF (placeholder)
function downloadSalarySlip(filename) {
    showToast('PDF download feature will be implemented soon', 'info');
}

// Convert number to words
function numberToWords(num) {
    if (num === 0) return "Zero";
    
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    
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

// Sidebar controls
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const toggleIcon = document.getElementById('toggleIcon');
    
    if (!sidebar || !mainContent || !toggleIcon) return;
    
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
    
    if (sidebar.classList.contains('collapsed')) {
        toggleIcon.classList.replace('fa-angle-left', 'fa-angle-right');
    } else {
        toggleIcon.classList.replace('fa-angle-right', 'fa-angle-left');
    }
}

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

// Logout function
function logout() {
    deleteCookie('access_token');
    deleteCookie('user_role');
    deleteCookie('user_name');
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
        day: 'numeric'
    });
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
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
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide and remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3000);
}