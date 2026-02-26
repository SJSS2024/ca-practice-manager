// API Helper Functions
class ApiClient {
    constructor() {
        this.baseURL = '/api';
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    removeToken() {
        this.token = null;
        localStorage.removeItem('token');
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (response.status === 401) {
                this.removeToken();
                window.location.reload();
                return;
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'An error occurred');
            }

            return data;
        } catch (error) {
            throw error;
        }
    }

    // Auth API
    async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    async getMe() {
        return this.request('/auth/me');
    }

    // Users API
    async getUsers() {
        return this.request('/users');
    }

    async createUser(userData) {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updateUser(id, userData) {
        return this.request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(id) {
        return this.request(`/users/${id}`, {
            method: 'DELETE'
        });
    }

    // Clients API
    async getClients() {
        return this.request('/clients');
    }

    async getClient(id) {
        return this.request(`/clients/${id}`);
    }

    async createClient(clientData) {
        return this.request('/clients', {
            method: 'POST',
            body: JSON.stringify(clientData)
        });
    }

    async updateClient(id, clientData) {
        return this.request(`/clients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(clientData)
        });
    }

    async deleteClient(id) {
        return this.request(`/clients/${id}`, {
            method: 'DELETE'
        });
    }

    // Services API
    async getServices() {
        return this.request('/services');
    }

    async createService(serviceData) {
        return this.request('/services', {
            method: 'POST',
            body: JSON.stringify(serviceData)
        });
    }

    async updateService(id, serviceData) {
        return this.request(`/services/${id}`, {
            method: 'PUT',
            body: JSON.stringify(serviceData)
        });
    }

    async deleteService(id) {
        return this.request(`/services/${id}`, {
            method: 'DELETE'
        });
    }

    // Tasks API
    async getTasks(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/tasks?${params}`);
    }

    async createTask(taskData) {
        return this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    }

    async updateTask(id, taskData) {
        return this.request(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
    }

    async deleteTask(id) {
        return this.request(`/tasks/${id}`, {
            method: 'DELETE'
        });
    }

    // Recurring Rules API
    async getRecurringRules() {
        return this.request('/recurring-rules');
    }

    async createRecurringRule(ruleData) {
        return this.request('/recurring-rules', {
            method: 'POST',
            body: JSON.stringify(ruleData)
        });
    }

    async updateRecurringRule(id, ruleData) {
        return this.request(`/recurring-rules/${id}`, {
            method: 'PUT',
            body: JSON.stringify(ruleData)
        });
    }

    async deleteRecurringRule(id) {
        return this.request(`/recurring-rules/${id}`, {
            method: 'DELETE'
        });
    }

    // Bills API
    async getBills() {
        return this.request('/bills');
    }

    async getBill(id) {
        return this.request(`/bills/${id}`);
    }

    async createBill(billData) {
        return this.request('/bills', {
            method: 'POST',
            body: JSON.stringify(billData)
        });
    }

    async updateBill(id, billData) {
        return this.request(`/bills/${id}`, {
            method: 'PUT',
            body: JSON.stringify(billData)
        });
    }

    async deleteBill(id) {
        return this.request(`/bills/${id}`, {
            method: 'DELETE'
        });
    }

    // Payments API
    async getPayments() {
        return this.request('/payments');
    }

    async createPayment(paymentData) {
        return this.request('/payments', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }

    // Followups API
    async getFollowups() {
        return this.request('/followups');
    }

    async createFollowup(followupData) {
        return this.request('/followups', {
            method: 'POST',
            body: JSON.stringify(followupData)
        });
    }

    async updateFollowup(id, followupData) {
        return this.request(`/followups/${id}`, {
            method: 'PUT',
            body: JSON.stringify(followupData)
        });
    }

    async deleteFollowup(id) {
        return this.request(`/followups/${id}`, {
            method: 'DELETE'
        });
    }

    // Income API
    async getIncome() {
        return this.request('/income');
    }

    async createIncome(incomeData) {
        return this.request('/income', {
            method: 'POST',
            body: JSON.stringify(incomeData)
        });
    }

    async updateIncome(id, incomeData) {
        return this.request(`/income/${id}`, {
            method: 'PUT',
            body: JSON.stringify(incomeData)
        });
    }

    async deleteIncome(id) {
        return this.request(`/income/${id}`, {
            method: 'DELETE'
        });
    }

    // Expenses API
    async getExpenses() {
        return this.request('/expenses');
    }

    async createExpense(expenseData) {
        return this.request('/expenses', {
            method: 'POST',
            body: JSON.stringify(expenseData)
        });
    }

    async updateExpense(id, expenseData) {
        return this.request(`/expenses/${id}`, {
            method: 'PUT',
            body: JSON.stringify(expenseData)
        });
    }

    async deleteExpense(id) {
        return this.request(`/expenses/${id}`, {
            method: 'DELETE'
        });
    }

    // Document Templates API
    async getDocumentTemplates() {
        return this.request('/document-templates');
    }

    async createDocumentTemplate(templateData) {
        return this.request('/document-templates', {
            method: 'POST',
            body: JSON.stringify(templateData)
        });
    }

    async updateDocumentTemplate(id, templateData) {
        return this.request(`/document-templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(templateData)
        });
    }

    async deleteDocumentTemplate(id) {
        return this.request(`/document-templates/${id}`, {
            method: 'DELETE'
        });
    }

    // Dropdown Options API
    async getDropdownOptions(category = null) {
        const params = category ? `?category=${encodeURIComponent(category)}` : '';
        return this.request(`/dropdown-options${params}`);
    }

    async createDropdownOption(data) {
        return this.request('/dropdown-options', { method: 'POST', body: JSON.stringify(data) });
    }

    async updateDropdownOption(id, data) {
        return this.request(`/dropdown-options/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    }

    async deleteDropdownOption(id) {
        return this.request(`/dropdown-options/${id}`, { method: 'DELETE' });
    }

    // Dashboard API
    async getDashboard() {
        return this.request('/dashboard');
    }

    // Activity Logs API
    async getActivityLogs() {
        return this.request('/activity-logs');
    }

    // Reports API
    async getProductivityReport(startDate, endDate) {
        const params = new URLSearchParams({ startDate, endDate });
        return this.request(`/reports/productivity?${params}`);
    }

    async getRevenueReport(startDate, endDate) {
        const params = new URLSearchParams({ startDate, endDate });
        return this.request(`/reports/revenue?${params}`);
    }
}

// Utility Functions
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
};

const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-IN');
};

const getStatusBadge = (status) => {
    const badges = {
        completed: 'success',
        paid: 'success',
        pending: 'warning',
        overdue: 'danger',
        'in-progress': 'primary',
        'in_progress': 'primary',
        cancelled: 'secondary'
    };
    return badges[status] || 'secondary';
};

const getPriorityBadge = (priority) => {
    const badges = {
        low: 'secondary',
        medium: 'primary',
        high: 'warning',
        urgent: 'danger'
    };
    return badges[priority] || 'secondary';
};

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const showToast = (message, type = 'info', title = null) => {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="toast-icon ${icons[type] || icons.info}"></i>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Show animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Auto remove after 5 seconds
    const removeToast = () => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    };
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', removeToast);
    
    // Auto close
    setTimeout(removeToast, 5000);
};

const showLoading = () => {
    document.getElementById('loadingSpinner').style.display = 'flex';
};

const hideLoading = () => {
    document.getElementById('loadingSpinner').style.display = 'none';
};

const showModal = (title, body, footer = null) => {
    const modal = document.getElementById('modal');
    const modalOverlay = document.getElementById('modalOverlay');
    
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    
    if (footer) {
        document.getElementById('modalFooter').innerHTML = footer;
        document.getElementById('modalFooter').style.display = 'block';
    } else {
        document.getElementById('modalFooter').style.display = 'none';
    }
    
    modalOverlay.classList.add('show');
    
    // Close modal handlers
    const closeModal = () => {
        modalOverlay.classList.remove('show');
    };
    
    document.getElementById('modalClose').onclick = closeModal;
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    };
    
    return { modal, closeModal };
};

const confirmDialog = (message, title = 'Confirm') => {
    return new Promise((resolve) => {
        const footer = `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').classList.remove('show'); resolve(false);">Cancel</button>
            <button class="btn btn-danger" onclick="this.closest('.modal-overlay').classList.remove('show'); resolve(true);">Confirm</button>
        `;
        
        showModal(title, `<p>${message}</p>`, footer);
        
        // Add resolve to global scope temporarily
        window.resolve = resolve;
    });
};

// Global API instance
const api = new ApiClient();

// Export for use in other files
window.api = api;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.getStatusBadge = getStatusBadge;
window.getPriorityBadge = getPriorityBadge;
window.debounce = debounce;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showModal = showModal;
window.closeModal = () => { const m = document.querySelector('.modal-overlay'); if (m) m.classList.remove('show'); };
window.confirmDialog = confirmDialog;