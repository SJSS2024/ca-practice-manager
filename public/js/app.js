// Main Application
class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.user = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkAuth();
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        
        if (!token) {
            this.showLogin();
            return;
        }

        try {
            const user = await api.getMe();
            this.user = user;
            this.showMainApp();
            this.updateUserInfo();
            this.navigateToPage(this.currentPage);
        } catch (error) {
            this.showLogin();
        }
    }

    showLogin() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }

    showMainApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
    }

    updateUserInfo() {
        if (this.user) {
            document.getElementById('userName').textContent = this.user.name;
            document.getElementById('userRole').textContent = this.user.role;
            document.getElementById('topUserName').textContent = this.user.name;
        }
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin(e);
        });

        // Toggle password visibility
        document.querySelector('.toggle-password').addEventListener('click', (e) => {
            const passwordInput = document.getElementById('password');
            const icon = e.target.closest('button').querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                passwordInput.type = 'password';
                icon.className = 'fas fa-eye';
            }
        });

        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        // Navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                this.navigateToPage(page);
            });
        });

        // User dropdown
        document.getElementById('userMenuBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('userDropdown').classList.toggle('show');
        });

        // Notification dropdown
        document.getElementById('notificationBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('notificationDropdown').classList.toggle('show');
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.getElementById('userDropdown').classList.remove('show');
            document.getElementById('notificationDropdown').classList.remove('show');
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            const page = e.state?.page || 'dashboard';
            this.navigateToPage(page, false);
        });

        // Mobile sidebar
        if (window.innerWidth <= 768) {
            document.getElementById('sidebarToggle').addEventListener('click', () => {
                document.getElementById('sidebar').classList.toggle('show');
            });
        }
    }

    async handleLogin(e) {
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            showLoading();
            const response = await api.login(email, password);
            
            api.setToken(response.token);
            this.user = response.user;
            
            hideLoading();
            showToast('Login successful', 'success', 'Welcome!');
            
            this.showMainApp();
            this.updateUserInfo();
            this.navigateToPage('dashboard');
        } catch (error) {
            hideLoading();
            showToast(error.message, 'error', 'Login Failed');
        }
    }

    logout() {
        api.removeToken();
        this.user = null;
        this.showLogin();
        showToast('You have been logged out', 'info');
    }

    navigateToPage(page, pushState = true) {
        // Update URL without page reload
        if (pushState) {
            history.pushState({ page }, '', `#${page}`);
        }

        // Update active menu item
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeMenuItem = document.querySelector(`[data-page="${page}"]`);
        if (activeMenuItem) {
            activeMenuItem.classList.add('active');
        }

        // Update page title
        const pageTitles = {
            dashboard: 'Dashboard',
            clients: 'Client Management',
            tasks: 'Task Management',
            recurring: 'Recurring Compliance',
            staff: 'Staff & Articles',
            billing: 'Billing & Collection',
            followups: 'Follow-up Management',
            'income-expenses': 'Income & Expenses',
            documents: 'Document Checklists',
            reports: 'Reports & Analytics',
            settings: 'Settings & Customization'
        };
        
        document.getElementById('pageTitle').textContent = pageTitles[page] || 'CA Practice Manager';

        // Load page content
        this.loadPageContent(page);
        this.currentPage = page;
    }

    async loadPageContent(page) {
        const pageContent = document.getElementById('pageContent');
        
        try {
            showLoading();

            // Load page-specific content
            switch (page) {
                case 'dashboard':
                    await this.loadDashboard();
                    break;
                case 'clients':
                    await this.loadClients();
                    break;
                case 'tasks':
                    await this.loadTasks();
                    break;
                case 'recurring':
                    await this.loadRecurring();
                    break;
                case 'staff':
                    await this.loadStaff();
                    break;
                case 'billing':
                    await this.loadBilling();
                    break;
                case 'followups':
                    await this.loadFollowups();
                    break;
                case 'income-expenses':
                    await this.loadIncomeExpenses();
                    break;
                case 'documents':
                    await this.loadDocuments();
                    break;
                case 'reports':
                    await this.loadReports();
                    break;
                case 'settings':
                    await this.loadSettings();
                    break;
                default:
                    pageContent.innerHTML = '<div class="alert alert-error">Page not found</div>';
            }

            hideLoading();
        } catch (error) {
            hideLoading();
            pageContent.innerHTML = `<div class="alert alert-error">Error loading page: ${error.message}</div>`;
        }
    }

    async loadDashboard() {
        if (typeof DashboardPage !== 'undefined') {
            const dashboard = new DashboardPage();
            await dashboard.render();
        }
    }

    async loadClients() {
        if (typeof ClientsPage !== 'undefined') {
            const clients = new ClientsPage();
            await clients.render();
        }
    }

    async loadTasks() {
        if (typeof TasksPage !== 'undefined') {
            const tasks = new TasksPage();
            await tasks.render();
        }
    }

    async loadRecurring() {
        if (typeof RecurringPage !== 'undefined') {
            const recurring = new RecurringPage();
            await recurring.render();
        }
    }

    async loadStaff() {
        if (typeof StaffPage !== 'undefined') {
            const staff = new StaffPage();
            await staff.render();
        }
    }

    async loadBilling() {
        if (typeof BillingPage !== 'undefined') {
            const billing = new BillingPage();
            await billing.render();
        }
    }

    async loadFollowups() {
        if (typeof FollowupsPage !== 'undefined') {
            const followups = new FollowupsPage();
            await followups.render();
        }
    }

    async loadIncomeExpenses() {
        if (typeof IncomeExpensesPage !== 'undefined') {
            const incomeExpenses = new IncomeExpensesPage();
            await incomeExpenses.render();
        }
    }

    async loadDocuments() {
        if (typeof DocumentsPage !== 'undefined') {
            const documents = new DocumentsPage();
            await documents.render();
        }
    }

    async loadReports() {
        if (typeof ReportsPage !== 'undefined') {
            const reports = new ReportsPage();
            await reports.render();
        }
    }

    async loadSettings() {
        if (typeof SettingsPage !== 'undefined') {
            const settings = new SettingsPage();
            await settings.render();
        }
    }
}

// Utility functions for common table operations
const createDataTable = (data, columns, options = {}) => {
    const { 
        searchable = true, 
        sortable = true, 
        pagination = true, 
        pageSize = 10,
        actions = null,
        className = ''
    } = options;

    let filteredData = [...data];
    let currentPage = 1;
    let sortColumn = null;
    let sortDirection = 'asc';

    const container = document.createElement('div');
    container.className = `table-container ${className}`;

    // Search functionality
    if (searchable) {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'table-header';
        searchContainer.innerHTML = `
            <div class="search-box">
                <input type="text" placeholder="Search..." class="form-control search-input">
                <i class="fas fa-search"></i>
            </div>
            ${actions ? `<div class="table-actions">${actions}</div>` : ''}
        `;
        container.appendChild(searchContainer);

        const searchInput = searchContainer.querySelector('.search-input');
        searchInput.addEventListener('input', debounce((e) => {
            const searchTerm = e.target.value.toLowerCase();
            filteredData = data.filter(row => 
                columns.some(col => {
                    const value = col.render ? col.render(row) : row[col.key];
                    return String(value).toLowerCase().includes(searchTerm);
                })
            );
            currentPage = 1;
            renderTable();
        }, 300));
    }

    const tableElement = document.createElement('table');
    tableElement.className = 'table';

    const renderTable = () => {
        // Calculate pagination
        const totalPages = Math.ceil(filteredData.length / pageSize);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageData = pagination ? filteredData.slice(startIndex, endIndex) : filteredData;

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.title;
            
            if (sortable && col.sortable !== false) {
                th.style.cursor = 'pointer';
                th.addEventListener('click', () => {
                    if (sortColumn === col.key) {
                        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortColumn = col.key;
                        sortDirection = 'asc';
                    }
                    
                    filteredData.sort((a, b) => {
                        let aVal = col.render ? col.render(a) : a[col.key];
                        let bVal = col.render ? col.render(b) : b[col.key];
                        
                        if (typeof aVal === 'string') {
                            aVal = aVal.toLowerCase();
                            bVal = bVal.toLowerCase();
                        }
                        
                        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                        return 0;
                    });
                    
                    renderTable();
                });

                if (sortColumn === col.key) {
                    const icon = document.createElement('i');
                    icon.className = `fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'}`;
                    th.appendChild(icon);
                }
            }

            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);

        // Create body
        const tbody = document.createElement('tbody');
        pageData.forEach(row => {
            const tr = document.createElement('tr');
            
            columns.forEach(col => {
                const td = document.createElement('td');
                const value = col.render ? col.render(row) : row[col.key];
                td.innerHTML = value;
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        // Clear and rebuild table
        tableElement.innerHTML = '';
        tableElement.appendChild(thead);
        tableElement.appendChild(tbody);

        // Add pagination
        if (pagination && totalPages > 1) {
            const paginationContainer = container.querySelector('.pagination') || document.createElement('div');
            paginationContainer.className = 'pagination';
            paginationContainer.innerHTML = '';

            // Previous button
            const prevBtn = document.createElement('button');
            prevBtn.className = 'pagination-btn';
            prevBtn.textContent = 'Previous';
            prevBtn.disabled = currentPage === 1;
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderTable();
                }
            });
            paginationContainer.appendChild(prevBtn);

            // Page numbers
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                    const pageBtn = document.createElement('button');
                    pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
                    pageBtn.textContent = i;
                    pageBtn.addEventListener('click', () => {
                        currentPage = i;
                        renderTable();
                    });
                    paginationContainer.appendChild(pageBtn);
                } else if (i === currentPage - 3 || i === currentPage + 3) {
                    const dots = document.createElement('span');
                    dots.textContent = '...';
                    dots.className = 'pagination-dots';
                    paginationContainer.appendChild(dots);
                }
            }

            // Next button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'pagination-btn';
            nextBtn.textContent = 'Next';
            nextBtn.disabled = currentPage === totalPages;
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderTable();
                }
            });
            paginationContainer.appendChild(nextBtn);

            if (!container.contains(paginationContainer)) {
                container.appendChild(paginationContainer);
            }
        }
    };

    container.appendChild(tableElement);
    renderTable();

    return {
        element: container,
        refresh: (newData) => {
            data = newData;
            filteredData = [...data];
            currentPage = 1;
            renderTable();
        }
    };
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Export utilities
window.createDataTable = createDataTable;