const API_BASE_URL = 'http://localhost:8000';

        // Global state
        let currentManagerData = null;
        let homeTeachers = [];
        let commissions = [];
        let transactionHistory = [];

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
                    loadHomeTeachers(),
                    loadCommissions(),
                    loadTransactionHistory()
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
                    currentManagerData.emp_name || 'Field Manager';
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
                // Get current user details first
                const userResponse = await apiCall(`/get_emp_details/${currentManagerData.emp_id}`);
                if (userResponse.status === 'good') {
                    const userData = userResponse.detail.data;
                    if (userData.manager_id) {
                        // Get manager details
                        const managerResponse = await apiCall(`/get_emp_details/${userData.manager_id}`);
                        if (managerResponse.status === 'good') {
                            const managerData = managerResponse.detail.data;
                            document.getElementById('manager-name').textContent = managerData.name;
                            document.getElementById('manager-id').textContent = userData.manager_id;
                            document.getElementById('manager-email').textContent = managerData.email;
                        }
                    } else {
                        document.getElementById('manager-name').textContent = 'No Manager Assigned';
                        document.getElementById('manager-id').textContent = 'N/A';
                        document.getElementById('manager-email').textContent = 'N/A';
                    }
                }
            } catch (error) {
                console.error('Failed to load manager info:', error);
                document.getElementById('manager-name').textContent = 'Error loading';
                document.getElementById('manager-id').textContent = 'Error loading';
                document.getElementById('manager-email').textContent = 'Error loading';
            }
        }

        // Load home teachers
        async function loadHomeTeachers() {
            try {
                const response = await apiCall('/get_all_employees');
                if (response.status === 'success') {
                    homeTeachers = response.employees.filter(emp => emp.role === 'home-teacher');
                    updateHomeTeachersTable();
                }
            } catch (error) {
                console.error('Failed to load home teachers:', error);
                showToast('Failed to load home teachers', 'error');
            }
        }

        // Load commissions
        async function loadCommissions() {
            try {
                const response = await apiCall(`/get_commisions/${currentManagerData.emp_id}`);
                if (response.status === 'good') {
                    commissions = response.detail;
                    updateCommissionsTable();
                }
            } catch (error) {
                console.error('Failed to load commissions:', error);
                showToast('Failed to load commissions', 'error');
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
                
                if (response.status === 'good') {
                    transactionHistory = response.detail.transactions || [];
                    updateTransactionHistoryTable();
                }
            } catch (error) {
                console.error('Failed to load transaction history:', error);
                showToast('Failed to load transaction history', 'error');
            }
        }

        // Update dashboard stats
        function updateDashboardStats() {
            document.getElementById('total-home-teachers').textContent = homeTeachers.length;
            
            const totalCommissions = commissions.reduce((sum, c) => 
                sum + (c.field_manager_commision || 0), 0);
            document.getElementById('total-commissions').textContent = `₹${totalCommissions}`;
        }

        // Update home teachers table
        function updateHomeTeachersTable() {
            const tbody = document.getElementById('home-teachers-table-body');
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
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>${formatDate(teacher.created_at)}</td>
                `;
                tbody.appendChild(row);
            });
        }

        // Update commissions table
        function updateCommissionsTable() {
            const tbody = document.getElementById('commissions-table-body');
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

        // Update transaction history table
        function updateTransactionHistoryTable() {
            const tbody = document.getElementById('transactions-table-body');
            tbody.innerHTML = '';
            
            if (transactionHistory.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5">
                            <div class="empty-state">
                                <i class="fas fa-history"></i>
                                <h3>No Transactions Found</h3>
                                <p>No transaction history available</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            transactionHistory.forEach(transaction => {
                const row = document.createElement('tr');
                const isSent = transaction.sender_id === currentManagerData.emp_id;
                const isReceived = transaction.reciever_id === currentManagerData.emp_id;
                
                let type = 'Unknown';
                let fromTo = 'Unknown';
                let statusClass = 'status-received';
                
                if (isSent) {
                    type = 'Sent';
                    fromTo = transaction.reciever_name || 'Unknown';
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
                    <td>₹${transaction.transferred_amount}</td>
                    <td><span class="status-badge status-received">Completed</span></td>
                `;
                tbody.appendChild(row);
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

        // Filter transactions
        async function filterTransactions() {
            showLoading(true);
            await loadTransactionHistory();
            showLoading(false);
        }

        // Clear transaction filters
        function clearFilters() {
            document.getElementById('start-date').value = '';
            document.getElementById('end-date').value = '';
            loadTransactionHistory();
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
                const response = await apiCall(`/get_commisions/${currentManagerData.emp_id}`);
                
                if (response.status === 'good') {
                    const allCommissions = response.detail;
                    const monthlyCommissions = filterCommissionsByMonth(allCommissions, month, year);
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
                                <strong>Field Manager</strong>
                            </div>
                            <div class="info-item">
                                <span>Department:</span>
                                <strong>Field Operations</strong>
                            </div>
                            <div class="info-item">
                                <span>Salary Period:</span>
                                <strong>${monthName} ${year}</strong>
                            </div>
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
                                    <td colspan="3"><strong>GROSS SALARY</strong></td>
                                    <td><strong>₹${totalSalary}</strong></td>
                                </tr>
                                <tr class="total-row">
                                    <td colspan="3"><strong>DEDUCTIONS</strong></td>
                                    <td><strong>₹0</strong></td>
                                </tr>
                                <tr class="total-row" style="background: var(--field-manager-primary); color: white;">
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
                        <p><strong>Note:</strong> This salary is calculated based on commission structure for Field Manager role.</p>
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

        // Print salary slip
        function printSalarySlip() {
            const printContent = document.querySelector('.salary-slip').innerHTML;
            const originalContent = document.body.innerHTML;
            
            document.body.innerHTML = `
                <html>
                <head>
                    <title>Salary Slip</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .salary-header { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #16a085; }
                        .salary-info { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
                        .info-section { background: #f8f9fa; padding: 1.5rem; border-radius: 10px; }
                        .info-item { display: flex; justify-content: space-between; margin-bottom: 0.5rem; padding: 0.3rem 0; border-bottom: 1px solid #e0e0e0; }
                        .breakdown-table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
                        .breakdown-table th, .breakdown-table td { padding: 0.8rem; border: 1px solid #ddd; text-align: left; }
                        .breakdown-table th { background: #16a085; color: white; }
                        .total-row { font-weight: bold; background: #f0f0f0; }
                        .salary-total { text-align: center; margin: 2rem 0; }
                    </style>
                </head>
                <body>
                    <div class="salary-slip">${printContent}</div>
                </body>
                </html>
            `;
            
            window.print();
            document.body.innerHTML = originalContent;
            location.reload();
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
            
            sidebar.classList.add('mobile-open');
            overlay.classList.add('show');
        }

        function closeMobileSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.querySelector('.mobile-overlay');
            
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('show');
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
            overlay.style.display = show ? 'flex' : 'none';
        }

        // function showToast(message, type = 'info') {
        //     const toastContainer = document.getElementById('toast-container');
        //     const toast = document.createElement('div');
        //     toast.className = `toast ${type}`;
            
        //     let icon = 'fas fa-info-circle';
        //     switch(type) {
        //         case 'success':
        //             icon = 'fas fa-check-circle';
        //             break;
        //         case 'error':
        //             icon = 'fas fa-exclamation-circle';
        //             break;
        //         case 'warning':
        //             icon = 'fas fa-exclamation-triangle';
        //             break;
        //     }
            
        //     toast.innerHTML = `
        //         <i class="${icon}"></i>
        //         <span>${message}</span>
        //     `;
            
        //     toastContainer.style="padding: 1rem; background: var(--field-manager-primary); color: white; margin: 0;">
        //             <i class="fas fa-user-tie"></i> Manager Information
        //         </h3>
        //         <table class="data-table">
        //             <tbody id="manager-info-table">
        //                 <tr>
        //                     <td><strong>Manager Name:</strong></td>
        //                     <td id="manager-name">Loading...</td>
        //                 </tr>
        //                 <tr>
        //                     <td><strong>Manager ID:</strong></td>
        //                     <td id="manager-id">Loading...</td>
        //                 </tr>
        //                 <tr>
        //                     <td><strong>Manager Email:</strong></td>
        //                     <td id="manager-email">Loading...</td>
        //                 </tr>
        //             </tbody>
        //         </table>
        //     </div>
        // </section>

        // <!-- Home Teachers Section -->
        // <section id="home-teachers-section" class="content-section">
        //     <div class="section-header">
        //         <h1><i class="fas fa-chalkboard-teacher"></i> My Home Teachers</h1>
        //         <p>Home teachers under your supervision</p>
        //         <div style="margin-top: 1rem;">
        //             <input type="text" id="home-teacher-search" placeholder="Search home teachers..."
        //                 class="search-input" style="max-width: 400px;">
        //         </div>
        //     </div>

        //     <div class="table-container">
        //         <table class="data-table">
        //             <thead>
        //                 <tr>
        //                     <th>Employee ID</th>
        //                     <th>Name</th>
        //                     <th>Email</th>
        //                     <th>Phone</th>
        //                     <th>City</th>
        //                     <th>State</th>
        //                     <th>Created Date</th>
        //                 </tr>
        //             </thead>
        //             <tbody id="home-teachers-table-body">
        //                 <!-- Dynamic content -->
        //             </tbody>
        //         </table>
        //     </div>
        // </section>

        // <!-- Commissions Section -->
        // <section id="commissions-section" class="content-section">
        //     <div class="section-header">
        //         <h1><i class="fas fa-coins"></i> My Commissions</h1>
        //         <p>View and generate salary slips based on your commission earnings</p>
                
        //         <div class="form-row" style="margin-top: 1rem;">
        //             <div class="form-group">
        //                 <label for="salary-month">Select Month:</label>
        //                 <select id="salary-month" class="form-input">
        //                     <option value="">Select Month</option>
        //                     <option value="1">January</option>
        //                     <option value="2">February</option>
        //                     <option value="3">March</option>
        //                     <option value="4">April</option>
        //                     <option value="5">May</option>
        //                     <option value="6">June</option>
        //                     <option value="7">July</option>
        //                     <option value="8">August</option>
        //                     <option value="9">September</option>
        //                     <option value="10">October</option>
        //                     <option value="11">November</option>
        //                     <option value="12">December</option>
        //                 </select>
        //             </div>
        //             <div class="form-group">
        //                 <label for="salary-year">Select Year:</label>
        //                 <select id="salary-year" class="form-input">
        //                     <option value="">Select Year</option>
        //                     <option value="2024">2024</option>
        //                     <option value="2025">2025</option>
        //                 </select>
        //             </div>
        //             <div class="form-group">
        //                 <label style="visibility: hidden;">Action:</label>
        //                 <button onclick="generateSalarySlip()" class="btn btn-success">
        //                     <i class="fas fa-receipt"></i> Generate Salary Slip
        //                 </button>
        //             </div>
        //         </div>
        //     </div>