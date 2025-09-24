// admin-dashboard.js

// Global variables
const BASE_URL = 'http://localhost:8000';
let currentEmployeeData = null;
let currentCommissionEmployee = null;
let allEmployees = [];
let isMobile = false;

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Check for authentication token
const token = getCookie("access_token");
const role = getCookie("user_role");
if (!token || role !== "admin") {
    window.location.href = '/client/Dashboard/templates/login.html';
}

// API Headers
const getHeaders = () => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function () {
    initializeResponsiveness();
    initializeSidebar();
    initializeNavigation();
    loadDashboardData();
    setupEventListeners();
});

// Initialize responsiveness
function initializeResponsiveness() {
    isMobile = window.innerWidth <= 768;

    window.addEventListener('resize', () => {
        const wasmobile = isMobile;
        isMobile = window.innerWidth <= 768;

        if (wasModal !== isMobile) {
            handleResponsiveChanges();
        }
    });
}

// Initialize sidebar functionality
function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mainContent = document.getElementById('mainContent');

    // Desktop sidebar toggle
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('sidebar-collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }

    // Mobile menu toggle
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
            document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : 'auto';
        });
    }

    // Overlay click to close sidebar on mobile
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    // Restore sidebar state
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed && !isMobile) {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('sidebar-collapsed');
    }

    // Close mobile sidebar on navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (isMobile) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });
    });
}

// Handle responsive changes
function handleResponsiveChanges() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mainContent = document.getElementById('mainContent');

    if (isMobile) {
        sidebar.classList.remove('collapsed');
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        mainContent.classList.remove('sidebar-collapsed');
        document.body.style.overflow = 'auto';
    } else {
        const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (sidebarCollapsed) {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('sidebar-collapsed');
        }
    }
}

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
    switch (section) {
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
        case 'commissions':
            // Commission data is loaded on demand when searching
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
                    <button class="btn btn-primary btn-small" onclick="viewEmployee('${emp.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-success btn-small" onclick="quickAddFunds('${emp.id}', '${emp.name}')" title="Add Funds">
                        <i class="fas fa-plus"></i>
                    </button>
                    ${(emp.role === 'manager' || emp.role === 'field-manager') ?
            `<button class="btn btn-secondary btn-small" onclick="quickCommissionReport('${emp.id}', '${emp.name}')" title="Commission Report">
                            <i class="fas fa-chart-line"></i>
                        </button>` : ''
        }
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

// Commission Report Functions

// Search employee for commission report
async function searchEmployeeCommission() {
    const empId = document.getElementById('commission-emp-search').value.trim();
    if (!empId) {
        showToast('Please enter an employee ID', 'warning');
        return;
    }

    try {
        showLoading();

        // First get employee details
        const empResponse = await fetch(`${BASE_URL}/get_emp_details/${empId}`, {
            headers: getHeaders()
        });

        if (!empResponse.ok) throw new Error('Failed to fetch employee details');

        const empData = await empResponse.json();
        if (empData.status === 'bad') {
            showToast('Employee not found', 'error');
            document.getElementById('commission-employee-details').style.display = 'none';
            document.getElementById('generate-report-btn').disabled = true;
            return;
        }

        const employee = { id: empId, ...empData.detail.data };

        // Check if employee is manager or field-manager
        if (employee.role !== 'manager' && employee.role !== 'field-manager') {
            showToast('Commission reports are only available for Managers and Field Managers', 'warning');
            document.getElementById('commission-employee-details').style.display = 'none';
            document.getElementById('generate-report-btn').disabled = true;
            return;
        }

        // Get commission data
        const commissionResponse = await fetch(`${BASE_URL}/get_commisions/${empId}`, {
            headers: getHeaders()
        });

        if (!commissionResponse.ok) throw new Error('Failed to fetch commission data');

        const commissionData = await commissionResponse.json();

        currentCommissionEmployee = {
            ...employee,
            commissions: commissionData.detail || []
        };
        console.log(commissionData)

        displayCommissionEmployeeDetails(currentCommissionEmployee);

    } catch (error) {
        showToast('Failed to fetch employee commission data', 'error');
        console.error('Error searching employee commission:', error);
    } finally {
        hideLoading();
    }
}

// Display commission employee details
function displayCommissionEmployeeDetails(employee) {
    if (!employee || !employee.commissions || employee.commissions.length === 0) {
        document.getElementById('commission-employee-details').innerHTML =
            '<p class="text-center">No commission data available</p>';
        document.getElementById('generate-report-btn').disabled = true;
        return;
    }

    const commissions = employee.commissions;

    // Compute total commission
    const totalCommission = commissions.reduce((sum, comm) => {
        return sum + (comm.manager_commision || 0) + (comm.field_manager_commision || 0);
    }, 0);

    const container = document.getElementById('commission-employee-details');
    container.innerHTML = `
        <h4><i class="fas fa-user"></i> Employee Commission Details</h4>
        <p><strong>Name:</strong> ${employee.name}</p>
        <p><strong>ID:</strong> ${employee.id}</p>
        <p><strong>Role:</strong> ${employee.role}</p>
        <p><strong>Total Commissions:</strong> <span class="funds-amount">₹${totalCommission.toLocaleString()}</span></p>
        <p><strong>Commission Records:</strong> <span>${commissions.length}</span></p>
    `;

    container.style.display = 'block';
    document.getElementById('generate-report-btn').disabled = false;

    displayCommissionHistory(commissions);
}


// Display commission history
function displayCommissionHistory(commissions) {
    const tbody = document.getElementById('commissions-table-body');
    if (!commissions || commissions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No commission records found</td></tr>';
        return;
    }

    tbody.innerHTML = commissions.map(comm => `
        <tr>
            <td>${formatDate(comm.created_at)}</td>
            <td>${comm.manager_id || comm.field_manager_id || 'N/A'}</td>
            <td><span class="role-badge role-${comm.manager_id ? 'manager' : 'field-manager'}">
                ${comm.manager_id ? 'Manager' : 'Field Manager'}
            </span></td>
            <td class="funds-amount">₹${parseFloat(comm.manager_commision || comm.field_manager_commision || 0).toLocaleString()}</td>
            <td>${comm.description || 'Commission payment'}</td>
        </tr>
    `).join('');
}



// Generate Commission PDF Report
function generateCommissionPDF() {
    if (!currentCommissionEmployee) {
        showToast('No employee selected for commission report', 'error');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const employee = currentCommissionEmployee;
        const commissions = employee.commissions || [];

        // Calculate total commission
        const totalCommission = commissions.reduce((sum, comm) => {
            return sum + (parseFloat(comm.manager_commision || 0)) + (parseFloat(comm.field_manager_commision || 0));
        }, 0);


        // Header with NGO Details
        doc.setFontSize(20);
        doc.setTextColor(44, 62, 80);
        doc.text('SBEDUCATIONAL', 20, 25);

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text('NGO Commission Report', 20, 35);
        doc.text('Making a difference together', 20, 42);

        // Report title
        doc.setFontSize(16);
        doc.setTextColor(44, 62, 80);
        doc.text('COMMISSION STATEMENT', 20, 60);

        // Employee Details Box
        doc.setDrawColor(200, 200, 200);
        doc.rect(20, 70, 170, 50);

        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('Employee Details:', 25, 80);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Name: ${employee.name}`, 25, 90);
        doc.text(`Employee ID: ${employee.id}`, 25, 97);
        doc.text(`Role: ${employee.role.charAt(0).toUpperCase() + employee.role.slice(1).replace('-', ' ')}`, 25, 104);
        doc.text(`Email: ${employee.email}`, 25, 111);

        // Report Period and Summary
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text('Commission Summary:', 25, 135);

        doc.setFontSize(10);
        doc.text(`Total Commission Records: ${commissions.length}`, 25, 145);
        doc.text(`Total Commission Amount: ₹${totalCommission.toLocaleString()}`, 25, 152);
        doc.text(`Report Generated: ${new Date().toLocaleDateString('en-IN')}`, 25, 159);

        // Commission Details Table
        if (commissions.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(44, 62, 80);
            doc.text('Commission Details:', 20, 175);

            // Table Headers
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.setFillColor(44, 62, 80);
            doc.rect(20, 185, 170, 8, 'F');
            doc.text('Date', 22, 190);
            doc.text('Amount', 60, 190);
            doc.text('Type', 100, 190);
            doc.text('Details', 140, 190);

            // Table Rows
            let yPos = 195;
            doc.setTextColor(60, 60, 60);
            doc.setFontSize(8);

            const normalizedCommissions = (commissions || []).map(c => ({
                date: c.created_at || c.date || '',
                amount: parseFloat(c.manager_commision || c.field_manager_commision || 0),
                type: c.manager_id ? 'Manager' : 'Field Manager',
                details: (c.description || c.details || 'Commission payment').substring(0, 25)
            }));

            normalizedCommissions.forEach((comm, index) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }

                const bgColor = index % 2 === 0 ? [248, 249, 250] : [255, 255, 255];
                doc.setFillColor(...bgColor);
                doc.rect(20, yPos - 5, 170, 8, 'F');

                doc.text(formatDate(comm.date), 22, yPos);
                doc.text(`₹${comm.amount.toLocaleString()}`, 60, yPos);
                doc.text(comm.type, 100, yPos);
                doc.text(comm.details, 140, yPos);

                yPos += 8;
            });

        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${i} of ${pageCount}`, 170, 285);
            doc.text('Generated by Sbeducational Admin System', 20, 285);
            doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN')}`, 20, 290);
        }

        // Save the PDF
        const fileName = `Commission_Report_${employee.name.replace(/\s+/g, '_')}_${employee.id}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);

        showToast('Commission report downloaded successfully!', 'success');

    } catch (error) {
        console.error('Error generating PDF:', error);
        showToast('Failed to generate commission report PDF', 'error');
    }
}

// Quick commission report from employee table
function quickCommissionReport(empId, empName) {
    // Switch to commissions section
    document.querySelector('[data-section="commissions"]').click();

    // Set employee ID
    document.getElementById('commission-emp-search').value = empId;

    // Search for employee commission
    setTimeout(() => {
        searchEmployeeCommission();
    }, 100);

    showToast(`Loading commission report for ${empName}`, 'success');
}

// Validate fund amount input
function validateFundAmount() {
    const amount = parseFloat(comm.manager_commision || comm.field_manager_commision || 0);
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
                ...getHeaders(),
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
            <td>${transfer.sender_name} ${transfer.sender_id === null ? "" : `(${transfer.sender_id})`}</td>
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
        let api_path = "";
        let empData = { ...employeeData };
        if (employeeData.role === "branch") {
            api_path = "create_branch_emp";
        }
        if (employeeData.role == "manager") {
            api_path = "create_manager";
            delete empData.role;
            console.log("role deleted");

        }
        console.log(empData)
        const response = await fetch(`${BASE_URL}/${api_path}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(empData)
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
        // remove cookies by setting them expired
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict";
        document.cookie = "user_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict";
        document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; SameSite=Strict";

        window.location.href = '/client/Dashboard/templates/login.html';
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
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

// Get toast icon based on type
function getToastIcon(type) {
    switch (type) {
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
window.addEventListener('unhandledrejection', function (event) {
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
            window.location.href = '/client/Dashboard/templates/login.html';
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
window.searchEmployeeCommission = searchEmployeeCommission;
window.generateCommissionPDF = generateCommissionPDF;
window.quickCommissionReport = quickCommissionReport;