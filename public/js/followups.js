// Follow-up Management Page
class FollowupsPage {
    constructor() {
        this.followups = [];
        this.clients = [];
        this.tasks = [];
        this.bills = [];
        this.users = [];
        this.selectedFollowup = null;
        this.currentView = 'upcoming'; // upcoming, overdue, completed
    }

    async render() {
        const pageContent = document.getElementById('pageContent');
        
        try {
            // Load all required data
            const [followups, clients, tasks, bills, users] = await Promise.all([
                api.getFollowups(),
                api.getClients(),
                api.getTasks(),
                api.getBills(),
                api.getUsers()
            ]);
            
            this.followups = followups;
            this.clients = clients;
            this.tasks = tasks;
            this.bills = bills;
            this.users = users;
            
            pageContent.innerHTML = `
                <div class="followups-header">
                    <h2>Follow-up Management</h2>
                    <div class="header-actions">
                        <button class="btn btn-outline" onclick="followupsPage.showCalendarView()">
                            <i class="fas fa-calendar-alt"></i>
                            Calendar View
                        </button>
                        <button class="btn btn-primary" onclick="followupsPage.showAddFollowupModal()">
                            <i class="fas fa-plus"></i>
                            Add Follow-up
                        </button>
                    </div>
                </div>
                
                <div class="followups-summary">
                    ${this.renderFollowupsSummary()}
                </div>
                
                <div class="followups-content">
                    <div class="view-switcher">
                        <button class="view-btn ${this.currentView === 'upcoming' ? 'active' : ''}" onclick="followupsPage.switchView('upcoming')">
                            <i class="fas fa-clock"></i>
                            Upcoming (${this.getUpcomingFollowups().length})
                        </button>
                        <button class="view-btn ${this.currentView === 'overdue' ? 'active' : ''}" onclick="followupsPage.switchView('overdue')">
                            <i class="fas fa-exclamation-triangle"></i>
                            Overdue (${this.getOverdueFollowups().length})
                        </button>
                        <button class="view-btn ${this.currentView === 'completed' ? 'active' : ''}" onclick="followupsPage.switchView('completed')">
                            <i class="fas fa-check"></i>
                            Completed (${this.getCompletedFollowups().length})
                        </button>
                    </div>
                    
                    <div class="followups-filters">
                        <select class="form-control" id="followupTypeFilter" onchange="followupsPage.filterFollowups()">
                            <option value="">All Types</option>
                            <option value="payment">Payment</option>
                            <option value="document">Document</option>
                            <option value="compliance">Compliance</option>
                            <option value="general">General</option>
                        </select>
                        
                        <select class="form-control" id="followupClientFilter" onchange="followupsPage.filterFollowups()">
                            <option value="">All Clients</option>
                            ${this.clients.map(client => 
                                `<option value="${client.id}">${client.name}</option>`
                            ).join('')}
                        </select>
                        
                        <input type="text" placeholder="Search follow-ups..." class="form-control" 
                               id="followupSearch" oninput="followupsPage.searchFollowups()">
                    </div>
                    
                    <div id="followupsMainContent">
                        ${this.renderCurrentView()}
                    </div>
                </div>
                
                <style>
                    .followups-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 24px;
                    }
                    
                    .header-actions {
                        display: flex;
                        gap: 12px;
                    }
                    
                    .followups-summary {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin-bottom: 32px;
                    }
                    
                    .summary-card {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        padding: 20px;
                        text-align: center;
                        transition: all 0.2s ease;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .summary-card:hover {
                        border-color: var(--primary-color);
                        box-shadow: var(--shadow-lg);
                    }
                    
                    .summary-card.urgent {
                        border-left: 4px solid var(--error-color);
                    }
                    
                    .summary-card.warning {
                        border-left: 4px solid var(--warning-color);
                    }
                    
                    .summary-card.success {
                        border-left: 4px solid var(--success-color);
                    }
                    
                    .summary-card.info {
                        border-left: 4px solid var(--info-color);
                    }
                    
                    .summary-icon {
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                        margin: 0 auto 12px;
                        color: white;
                    }
                    
                    .summary-card.urgent .summary-icon {
                        background: var(--error-color);
                    }
                    
                    .summary-card.warning .summary-icon {
                        background: var(--warning-color);
                    }
                    
                    .summary-card.success .summary-icon {
                        background: var(--success-color);
                    }
                    
                    .summary-card.info .summary-icon {
                        background: var(--info-color);
                    }
                    
                    .summary-value {
                        font-size: 32px;
                        font-weight: 700;
                        color: var(--dark-text);
                        margin-bottom: 8px;
                    }
                    
                    .summary-label {
                        font-size: 14px;
                        color: var(--muted-text);
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    
                    .view-switcher {
                        display: flex;
                        gap: 8px;
                        margin-bottom: 24px;
                        padding: 4px;
                        background: var(--background-light);
                        border-radius: var(--border-radius);
                        width: fit-content;
                    }
                    
                    .view-btn {
                        padding: 10px 16px;
                        border: none;
                        background: transparent;
                        border-radius: calc(var(--border-radius) - 2px);
                        cursor: pointer;
                        transition: all 0.2s ease;
                        font-weight: 500;
                        color: var(--muted-text);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .view-btn:hover {
                        background: var(--white);
                        color: var(--dark-text);
                    }
                    
                    .view-btn.active {
                        background: var(--white);
                        color: var(--primary-color);
                        box-shadow: var(--shadow-sm);
                    }
                    
                    .followups-filters {
                        display: flex;
                        gap: 16px;
                        margin-bottom: 24px;
                        align-items: center;
                        flex-wrap: wrap;
                    }
                    
                    .followups-grid {
                        display: grid;
                        gap: 16px;
                    }
                    
                    .followup-card {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        padding: 20px;
                        transition: all 0.2s ease;
                        position: relative;
                    }
                    
                    .followup-card:hover {
                        border-color: var(--primary-color);
                        box-shadow: var(--shadow-lg);
                    }
                    
                    .followup-card.overdue {
                        border-left: 4px solid var(--error-color);
                        background: linear-gradient(90deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%);
                    }
                    
                    .followup-card.due-soon {
                        border-left: 4px solid var(--warning-color);
                        background: linear-gradient(90deg, rgba(245, 158, 11, 0.05) 0%, transparent 100%);
                    }
                    
                    .followup-card.completed {
                        border-left: 4px solid var(--success-color);
                        background: linear-gradient(90deg, rgba(34, 197, 94, 0.05) 0%, transparent 100%);
                    }
                    
                    .followup-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 16px;
                    }
                    
                    .followup-info h3 {
                        font-size: 18px;
                        font-weight: 600;
                        color: var(--dark-text);
                        margin-bottom: 4px;
                    }
                    
                    .followup-client {
                        font-size: 14px;
                        color: var(--primary-color);
                        margin-bottom: 8px;
                    }
                    
                    .followup-type {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 500;
                        text-transform: uppercase;
                    }
                    
                    .followup-type.payment {
                        background: var(--success-light);
                        color: var(--success-color);
                    }
                    
                    .followup-type.document {
                        background: var(--info-light);
                        color: var(--info-color);
                    }
                    
                    .followup-type.compliance {
                        background: var(--warning-light);
                        color: var(--warning-color);
                    }
                    
                    .followup-type.general {
                        background: var(--background-light);
                        color: var(--muted-text);
                    }
                    
                    .followup-description {
                        color: var(--muted-text);
                        font-size: 14px;
                        line-height: 1.5;
                        margin-bottom: 16px;
                    }
                    
                    .followup-details {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 16px;
                        margin-bottom: 16px;
                        font-size: 14px;
                    }
                    
                    .followup-detail {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        color: var(--muted-text);
                    }
                    
                    .followup-detail i {
                        color: var(--primary-color);
                        width: 16px;
                    }
                    
                    .followup-priority {
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 500;
                        text-transform: uppercase;
                    }
                    
                    .followup-priority.high {
                        background: var(--error-light);
                        color: var(--error-color);
                    }
                    
                    .followup-priority.urgent {
                        background: var(--error-color);
                        color: white;
                    }
                    
                    .followup-priority.medium {
                        background: var(--warning-light);
                        color: var(--warning-color);
                    }
                    
                    .followup-priority.low {
                        background: var(--success-light);
                        color: var(--success-color);
                    }
                    
                    .followup-actions {
                        display: flex;
                        gap: 8px;
                        flex-wrap: wrap;
                    }
                    
                    .days-indicator {
                        position: absolute;
                        top: -8px;
                        right: -8px;
                        background: var(--error-color);
                        color: white;
                        border-radius: 50%;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        font-weight: 600;
                        box-shadow: var(--shadow-md);
                    }
                    
                    .days-indicator.warning {
                        background: var(--warning-color);
                    }
                    
                    .calendar-container {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        padding: 24px;
                        margin-top: 24px;
                        text-align: center;
                    }
                    
                    @media (max-width: 768px) {
                        .followups-summary {
                            grid-template-columns: repeat(2, 1fr);
                        }
                        
                        .followups-filters {
                            flex-direction: column;
                            align-items: stretch;
                        }
                        
                        .followups-header {
                            flex-direction: column;
                            gap: 16px;
                            align-items: stretch;
                        }
                        
                        .header-actions {
                            justify-content: center;
                        }
                        
                        .view-switcher {
                            width: 100%;
                            justify-content: center;
                        }
                        
                        .followup-details {
                            grid-template-columns: 1fr;
                        }
                        
                        .followup-actions {
                            justify-content: center;
                        }
                    }
                </style>
            `;

            // Store reference for global access
            window.followupsPage = this;
            
        } catch (error) {
            pageContent.innerHTML = `<div class="alert alert-error">Error loading follow-ups: ${error.message}</div>`;
        }
    }

    renderFollowupsSummary() {
        const upcomingCount = this.getUpcomingFollowups().length;
        const overdueCount = this.getOverdueFollowups().length;
        const completedCount = this.getCompletedFollowups().length;
        const dueTodayCount = this.getDueTodayFollowups().length;

        return `
            <div class="summary-card urgent">
                <div class="summary-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="summary-value">${overdueCount}</div>
                <div class="summary-label">Overdue</div>
            </div>
            
            <div class="summary-card warning">
                <div class="summary-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="summary-value">${dueTodayCount}</div>
                <div class="summary-label">Due Today</div>
            </div>
            
            <div class="summary-card info">
                <div class="summary-icon">
                    <i class="fas fa-calendar-check"></i>
                </div>
                <div class="summary-value">${upcomingCount}</div>
                <div class="summary-label">Upcoming</div>
            </div>
            
            <div class="summary-card success">
                <div class="summary-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="summary-value">${completedCount}</div>
                <div class="summary-label">Completed</div>
            </div>
        `;
    }

    renderCurrentView() {
        switch (this.currentView) {
            case 'upcoming':
                return this.renderFollowupsList(this.getUpcomingFollowups());
            case 'overdue':
                return this.renderFollowupsList(this.getOverdueFollowups());
            case 'completed':
                return this.renderFollowupsList(this.getCompletedFollowups());
            default:
                return this.renderFollowupsList(this.getUpcomingFollowups());
        }
    }

    renderFollowupsList(followups) {
        if (followups.length === 0) {
            const emptyMessages = {
                upcoming: 'No upcoming follow-ups',
                overdue: 'No overdue follow-ups',
                completed: 'No completed follow-ups'
            };
            
            return `
                <div class="empty-state">
                    <i class="fas fa-calendar-check"></i>
                    <h3>${emptyMessages[this.currentView] || 'No Follow-ups'}</h3>
                    <p>Create your first follow-up to start tracking client interactions.</p>
                </div>
            `;
        }

        return `
            <div class="followups-grid" id="followupsGrid">
                ${followups.map(followup => this.renderFollowupCard(followup)).join('')}
            </div>
        `;
    }

    renderFollowupCard(followup) {
        const client = this.clients.find(c => c.id === followup.client_id);
        const assignedUser = this.users.find(u => u.id === followup.assigned_to);
        
        // Calculate days until/since due date
        const today = new Date();
        const dueDate = new Date(followup.due_date);
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let cardClass = '';
        let daysIndicator = '';
        
        if (followup.status === 'completed') {
            cardClass = 'completed';
        } else if (diffDays < 0) {
            cardClass = 'overdue';
            daysIndicator = `<div class="days-indicator">${Math.abs(diffDays)}</div>`;
        } else if (diffDays <= 2) {
            cardClass = 'due-soon';
            if (diffDays === 0) {
                daysIndicator = `<div class="days-indicator warning">!</div>`;
            } else {
                daysIndicator = `<div class="days-indicator warning">${diffDays}</div>`;
            }
        }
        
        return `
            <div class="followup-card ${cardClass}">
                ${daysIndicator}
                <div class="followup-header">
                    <div class="followup-info">
                        <h3>${followup.subject}</h3>
                        <div class="followup-client">${client ? client.name : 'Unknown Client'}</div>
                    </div>
                    <span class="followup-type ${followup.type}">
                        <i class="fas fa-${this.getTypeIcon(followup.type)}"></i>
                        ${followup.type}
                    </span>
                </div>
                
                <div class="followup-description">
                    ${followup.description || 'No description provided'}
                </div>
                
                <div class="followup-details">
                    <div class="followup-detail">
                        <i class="fas fa-calendar"></i>
                        <span>Due: ${followup.due_date}</span>
                    </div>
                    <div class="followup-detail">
                        <i class="fas fa-user"></i>
                        <span>${assignedUser ? assignedUser.name : 'Unassigned'}</span>
                    </div>
                    <div class="followup-detail">
                        <i class="fas fa-flag"></i>
                        <span class="followup-priority ${followup.priority}">${followup.priority}</span>
                    </div>
                    <div class="followup-detail">
                        <i class="fas fa-info-circle"></i>
                        <span>${followup.status.replace('_', ' ')}</span>
                    </div>
                </div>
                
                <div class="followup-actions">
                    ${followup.status !== 'completed' ? `
                        <button class="btn btn-sm btn-success" onclick="followupsPage.completeFollowup(${followup.id})">
                            <i class="fas fa-check"></i>
                            Complete
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="followupsPage.addNextFollowup(${followup.id})">
                            <i class="fas fa-plus"></i>
                            Add Next
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-outline" onclick="followupsPage.addNextFollowup(${followup.id})">
                            <i class="fas fa-plus"></i>
                            Add Follow-up
                        </button>
                    `}
                    <button class="btn btn-sm btn-outline" onclick="followupsPage.editFollowup(${followup.id})">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="followupsPage.deleteFollowup(${followup.id})">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    getTypeIcon(type) {
        const icons = {
            payment: 'credit-card',
            document: 'file-alt',
            compliance: 'shield-alt',
            general: 'comment'
        };
        return icons[type] || 'comment';
    }

    getUpcomingFollowups() {
        const today = new Date();
        return this.followups.filter(followup => {
            if (followup.status === 'completed') return false;
            if (!followup.due_date) return true;
            const dueDate = new Date(followup.due_date);
            return dueDate >= today;
        });
    }

    getOverdueFollowups() {
        const today = new Date();
        return this.followups.filter(followup => {
            if (followup.status === 'completed') return false;
            if (!followup.due_date) return false;
            const dueDate = new Date(followup.due_date);
            return dueDate < today;
        });
    }

    getCompletedFollowups() {
        return this.followups.filter(followup => followup.status === 'completed');
    }

    getDueTodayFollowups() {
        const today = new Date().toISOString().split('T')[0];
        return this.followups.filter(followup => 
            followup.status !== 'completed' && followup.due_date === today
        );
    }

    switchView(view) {
        this.currentView = view;
        document.getElementById('followupsMainContent').innerHTML = this.renderCurrentView();
        
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        event.target.closest('.view-btn').classList.add('active');
    }

    showAddFollowupModal() {
        const modal = document.createElement('div');
        modal.className = 'modal modal-large';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add Follow-up</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="addFollowupForm">
                    <div class="modal-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Client *</label>
                                <select name="client_id" required class="form-control">
                                    <option value="">Select Client</option>
                                    ${this.clients.map(client => 
                                        `<option value="${client.id}">${client.name}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Type *</label>
                                <select name="type" required class="form-control">
                                    <option value="">Select Type</option>
                                    <option value="payment">Payment</option>
                                    <option value="document">Document</option>
                                    <option value="compliance">Compliance</option>
                                    <option value="general">General</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Subject *</label>
                                <input type="text" name="subject" required class="form-control" 
                                       placeholder="Brief description of the follow-up">
                            </div>
                            
                            <div class="form-group">
                                <label>Priority *</label>
                                <select name="priority" required class="form-control">
                                    <option value="low">Low</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Due Date</label>
                                <input type="date" name="due_date" class="form-control">
                            </div>
                            
                            <div class="form-group">
                                <label>Assign To</label>
                                <select name="assigned_to" class="form-control">
                                    <option value="">Unassigned</option>
                                    ${this.users.map(user => 
                                        `<option value="${user.id}">${user.name} (${user.role})</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div class="form-group full-width">
                                <label>Description</label>
                                <textarea name="description" class="form-control" rows="4" 
                                          placeholder="Detailed description of what needs to be followed up"></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label>Related Task</label>
                                <select name="task_id" class="form-control">
                                    <option value="">No related task</option>
                                    ${this.tasks.map(task => 
                                        `<option value="${task.id}">${task.title}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Related Bill</label>
                                <select name="bill_id" class="form-control">
                                    <option value="">No related bill</option>
                                    ${this.bills.map(bill => 
                                        `<option value="${bill.id}">Bill #${bill.bill_number}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Add Follow-up</button>
                    </div>
                </form>
            </div>
            
            <style>
                .modal-large .modal-content {
                    max-width: 800px;
                    width: 90vw;
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('addFollowupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddFollowup(e);
        });
    }

    async handleAddFollowup(e) {
        try {
            showLoading();
            
            const formData = new FormData(e.target);
            const followupData = {
                client_id: parseInt(formData.get('client_id')),
                type: formData.get('type'),
                subject: formData.get('subject'),
                description: formData.get('description'),
                priority: formData.get('priority'),
                due_date: formData.get('due_date') || null,
                assigned_to: formData.get('assigned_to') ? parseInt(formData.get('assigned_to')) : null,
                task_id: formData.get('task_id') ? parseInt(formData.get('task_id')) : null,
                bill_id: formData.get('bill_id') ? parseInt(formData.get('bill_id')) : null,
                status: 'pending'
            };
            
            await api.createFollowup(followupData);
            
            hideLoading();
            e.target.closest('.modal').remove();
            showToast('Follow-up added successfully', 'success');
            
            await this.refreshData();
        } catch (error) {
            hideLoading();
            showToast('Failed to add follow-up: ' + error.message, 'error');
        }
    }

    addNextFollowup(currentFollowupId) {
        const currentFollowup = this.followups.find(f => f.id === currentFollowupId);
        if (!currentFollowup) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add Next Follow-up</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="addNextFollowupForm">
                    <div class="modal-body">
                        <div class="current-followup-info">
                            <h4>Current Follow-up:</h4>
                            <p><strong>${currentFollowup.subject}</strong></p>
                            <p class="text-muted">${currentFollowup.description}</p>
                        </div>
                        
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Subject *</label>
                                <input type="text" name="subject" required class="form-control" 
                                       value="Follow-up: ${currentFollowup.subject}">
                            </div>
                            
                            <div class="form-group">
                                <label>Type *</label>
                                <select name="type" required class="form-control">
                                    <option value="payment" ${currentFollowup.type === 'payment' ? 'selected' : ''}>Payment</option>
                                    <option value="document" ${currentFollowup.type === 'document' ? 'selected' : ''}>Document</option>
                                    <option value="compliance" ${currentFollowup.type === 'compliance' ? 'selected' : ''}>Compliance</option>
                                    <option value="general" ${currentFollowup.type === 'general' ? 'selected' : ''}>General</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Priority *</label>
                                <select name="priority" required class="form-control">
                                    <option value="low">Low</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Due Date</label>
                                <input type="date" name="due_date" class="form-control" 
                                       value="${this.getNextWeekDate()}">
                            </div>
                            
                            <div class="form-group full-width">
                                <label>Description</label>
                                <textarea name="description" class="form-control" rows="3" 
                                          placeholder="What needs to be followed up next?"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Add Next Follow-up</button>
                    </div>
                </form>
            </div>
            
            <style>
                .current-followup-info {
                    background: var(--background-light);
                    padding: 16px;
                    border-radius: var(--border-radius);
                    margin-bottom: 20px;
                }
                
                .current-followup-info h4 {
                    margin-bottom: 8px;
                    color: var(--dark-text);
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('addNextFollowupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddNextFollowup(e, currentFollowup);
        });
    }

    async handleAddNextFollowup(e, currentFollowup) {
        try {
            showLoading();
            
            const formData = new FormData(e.target);
            const followupData = {
                client_id: currentFollowup.client_id,
                type: formData.get('type'),
                subject: formData.get('subject'),
                description: formData.get('description'),
                priority: formData.get('priority'),
                due_date: formData.get('due_date') || null,
                assigned_to: currentFollowup.assigned_to,
                task_id: currentFollowup.task_id,
                bill_id: currentFollowup.bill_id,
                status: 'pending'
            };
            
            await api.createFollowup(followupData);
            
            hideLoading();
            e.target.closest('.modal').remove();
            showToast('Next follow-up added successfully', 'success');
            
            await this.refreshData();
        } catch (error) {
            hideLoading();
            showToast('Failed to add next follow-up: ' + error.message, 'error');
        }
    }

    async completeFollowup(id) {
        if (!confirm('Mark this follow-up as completed?')) {
            return;
        }
        
        try {
            showLoading();
            await api.updateFollowup(id, { 
                status: 'completed',
                completion_date: new Date().toISOString().split('T')[0]
            });
            
            hideLoading();
            showToast('Follow-up marked as completed', 'success');
            await this.refreshData();
        } catch (error) {
            hideLoading();
            showToast('Failed to complete follow-up: ' + error.message, 'error');
        }
    }

    async deleteFollowup(id) {
        if (!confirm('Are you sure you want to delete this follow-up? This action cannot be undone.')) {
            return;
        }
        
        try {
            showLoading();
            await api.deleteFollowup(id);
            hideLoading();
            showToast('Follow-up deleted successfully', 'success');
            await this.refreshData();
        } catch (error) {
            hideLoading();
            showToast('Failed to delete follow-up: ' + error.message, 'error');
        }
    }

    filterFollowups() {
        const type = document.getElementById('followupTypeFilter').value;
        const clientId = document.getElementById('followupClientFilter').value;
        
        let filteredFollowups;
        
        switch (this.currentView) {
            case 'upcoming':
                filteredFollowups = this.getUpcomingFollowups();
                break;
            case 'overdue':
                filteredFollowups = this.getOverdueFollowups();
                break;
            case 'completed':
                filteredFollowups = this.getCompletedFollowups();
                break;
            default:
                filteredFollowups = this.getUpcomingFollowups();
        }
        
        if (type) {
            filteredFollowups = filteredFollowups.filter(f => f.type === type);
        }
        
        if (clientId) {
            filteredFollowups = filteredFollowups.filter(f => f.client_id == clientId);
        }
        
        document.getElementById('followupsGrid').innerHTML = 
            filteredFollowups.map(f => this.renderFollowupCard(f)).join('');
    }

    searchFollowups() {
        const searchTerm = document.getElementById('followupSearch').value.toLowerCase();
        
        let filteredFollowups;
        
        switch (this.currentView) {
            case 'upcoming':
                filteredFollowups = this.getUpcomingFollowups();
                break;
            case 'overdue':
                filteredFollowups = this.getOverdueFollowups();
                break;
            case 'completed':
                filteredFollowups = this.getCompletedFollowups();
                break;
            default:
                filteredFollowups = this.getUpcomingFollowups();
        }
        
        const searchResults = filteredFollowups.filter(followup => {
            const client = this.clients.find(c => c.id === followup.client_id);
            return followup.subject.toLowerCase().includes(searchTerm) ||
                   followup.description.toLowerCase().includes(searchTerm) ||
                   (client && client.name.toLowerCase().includes(searchTerm));
        });
        
        document.getElementById('followupsGrid').innerHTML = 
            searchResults.map(f => this.renderFollowupCard(f)).join('');
    }

    showCalendarView() {
        const modal = document.createElement('div');
        modal.className = 'modal modal-large';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Follow-ups Calendar</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="calendar-container">
                        <i class="fas fa-calendar-alt" style="font-size: 48px; color: var(--muted-text);"></i>
                        <h3>Calendar View</h3>
                        <p>Calendar integration would be implemented here with a proper calendar library like FullCalendar.js</p>
                        <p class="text-muted">This would show all follow-ups organized by dates with drag-and-drop functionality.</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    getNextWeekDate() {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date.toISOString().split('T')[0];
    }

    async refreshData() {
        try {
            const followups = await api.getFollowups();
            this.followups = followups;
            
            // Re-render current view and summary
            document.querySelector('.followups-summary').innerHTML = this.renderFollowupsSummary();
            document.getElementById('followupsMainContent').innerHTML = this.renderCurrentView();
            
            // Update view switcher counts
            const viewBtns = document.querySelectorAll('.view-btn');
            viewBtns.forEach(btn => {
                if (btn.onclick.toString().includes("'upcoming'")) {
                    btn.innerHTML = `<i class="fas fa-clock"></i> Upcoming (${this.getUpcomingFollowups().length})`;
                } else if (btn.onclick.toString().includes("'overdue'")) {
                    btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Overdue (${this.getOverdueFollowups().length})`;
                } else if (btn.onclick.toString().includes("'completed'")) {
                    btn.innerHTML = `<i class="fas fa-check"></i> Completed (${this.getCompletedFollowups().length})`;
                }
            });
        } catch (error) {
            showToast('Failed to refresh data: ' + error.message, 'error');
        }
    }
}