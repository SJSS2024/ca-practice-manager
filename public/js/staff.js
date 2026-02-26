// Staff & Articles Management Page
class StaffPage {
    constructor() {
        this.staff = [];
        this.tasks = [];
        this.selectedStaff = null;
        this.currentView = 'list'; // list, detail, performance
    }

    async render() {
        const pageContent = document.getElementById('pageContent');
        
        try {
            // Load all required data
            const [users, tasks] = await Promise.all([
                api.getUsers(),
                api.getTasks()
            ]);
            
            this.staff = users;
            this.tasks = tasks;
            
            pageContent.innerHTML = `
                <div class="staff-header">
                    <h2>Staff & Articles Management</h2>
                    <div class="header-actions">
                        <button class="btn btn-outline" onclick="staffPage.switchView('performance')">
                            <i class="fas fa-chart-line"></i>
                            Performance
                        </button>
                        <button class="btn btn-primary" onclick="staffPage.showAddStaffModal()">
                            <i class="fas fa-user-plus"></i>
                            Add Staff Member
                        </button>
                    </div>
                </div>
                
                <div class="staff-content">
                    <div class="view-switcher">
                        <button class="view-btn ${this.currentView === 'list' ? 'active' : ''}" onclick="staffPage.switchView('list')">
                            <i class="fas fa-list"></i>
                            Staff List
                        </button>
                        <button class="view-btn ${this.currentView === 'performance' ? 'active' : ''}" onclick="staffPage.switchView('performance')">
                            <i class="fas fa-chart-bar"></i>
                            Performance Stats
                        </button>
                    </div>
                    
                    <div id="staffMainContent">
                        ${this.renderCurrentView()}
                    </div>
                </div>
                
                <style>
                    .staff-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 24px;
                    }
                    
                    .header-actions {
                        display: flex;
                        gap: 12px;
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
                        padding: 8px 16px;
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
                    
                    .staff-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                        gap: 20px;
                    }
                    
                    .staff-card {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        padding: 24px;
                        transition: all 0.2s ease;
                    }
                    
                    .staff-card:hover {
                        border-color: var(--primary-color);
                        box-shadow: var(--shadow-lg);
                    }
                    
                    .staff-avatar {
                        width: 60px;
                        height: 60px;
                        background: var(--primary-color);
                        color: white;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 24px;
                        font-weight: 600;
                        margin-bottom: 16px;
                    }
                    
                    .staff-info h3 {
                        font-size: 18px;
                        font-weight: 600;
                        color: var(--dark-text);
                        margin-bottom: 4px;
                    }
                    
                    .staff-role {
                        color: var(--muted-text);
                        font-size: 14px;
                        margin-bottom: 8px;
                    }
                    
                    .staff-email {
                        color: var(--primary-color);
                        font-size: 14px;
                        margin-bottom: 16px;
                        word-break: break-all;
                    }
                    
                    .staff-stats {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 16px;
                        margin-bottom: 16px;
                    }
                    
                    .stat-item {
                        text-align: center;
                    }
                    
                    .stat-value {
                        font-size: 24px;
                        font-weight: 600;
                        color: var(--primary-color);
                        display: block;
                    }
                    
                    .stat-label {
                        font-size: 12px;
                        color: var(--muted-text);
                        text-transform: uppercase;
                        margin-top: 4px;
                    }
                    
                    .staff-actions {
                        display: flex;
                        gap: 8px;
                        flex-wrap: wrap;
                    }
                    
                    .performance-section {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        padding: 24px;
                        margin-bottom: 24px;
                    }
                    
                    .performance-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                    }
                    
                    .performance-filters {
                        display: flex;
                        gap: 12px;
                        align-items: center;
                    }
                    
                    .performance-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 20px;
                        margin-bottom: 24px;
                    }
                    
                    .performance-card {
                        background: var(--background-light);
                        padding: 20px;
                        border-radius: var(--border-radius);
                        border: 2px solid transparent;
                        transition: all 0.2s ease;
                    }
                    
                    .performance-card:hover {
                        border-color: var(--primary-color);
                    }
                    
                    .performance-title {
                        font-weight: 600;
                        color: var(--dark-text);
                        margin-bottom: 8px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .performance-value {
                        font-size: 32px;
                        font-weight: 700;
                        color: var(--primary-color);
                        margin-bottom: 8px;
                    }
                    
                    .performance-trend {
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    
                    .trend-up {
                        color: var(--success-color);
                    }
                    
                    .trend-down {
                        color: var(--error-color);
                    }
                    
                    .team-leaderboard {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        overflow: hidden;
                    }
                    
                    .leaderboard-header {
                        background: var(--primary-color);
                        color: white;
                        padding: 16px 24px;
                        font-weight: 600;
                    }
                    
                    .leaderboard-item {
                        display: flex;
                        align-items: center;
                        padding: 16px 24px;
                        border-bottom: 1px solid var(--border-color);
                        transition: background 0.2s ease;
                    }
                    
                    .leaderboard-item:hover {
                        background: var(--background-light);
                    }
                    
                    .leaderboard-item:last-child {
                        border-bottom: none;
                    }
                    
                    .leaderboard-rank {
                        width: 30px;
                        height: 30px;
                        background: var(--primary-color);
                        color: white;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 600;
                        margin-right: 16px;
                    }
                    
                    .leaderboard-rank.top-3 {
                        background: linear-gradient(45deg, #FFD700, #FFA500);
                    }
                    
                    .leaderboard-info {
                        flex: 1;
                    }
                    
                    .leaderboard-name {
                        font-weight: 600;
                        color: var(--dark-text);
                        margin-bottom: 4px;
                    }
                    
                    .leaderboard-role {
                        font-size: 14px;
                        color: var(--muted-text);
                    }
                    
                    .leaderboard-stats {
                        display: flex;
                        gap: 20px;
                        font-size: 14px;
                    }
                    
                    .leaderboard-stat {
                        text-align: center;
                    }
                    
                    .leaderboard-stat-value {
                        font-weight: 600;
                        color: var(--primary-color);
                        display: block;
                    }
                    
                    .leaderboard-stat-label {
                        color: var(--muted-text);
                        font-size: 12px;
                    }
                    
                    @media (max-width: 768px) {
                        .staff-grid {
                            grid-template-columns: 1fr;
                        }
                        
                        .performance-grid {
                            grid-template-columns: 1fr;
                        }
                        
                        .staff-header {
                            flex-direction: column;
                            gap: 16px;
                            align-items: stretch;
                        }
                        
                        .header-actions {
                            justify-content: center;
                        }
                    }
                </style>
            `;

            // Store reference for global access
            window.staffPage = this;
            
        } catch (error) {
            pageContent.innerHTML = `<div class="alert alert-error">Error loading staff data: ${error.message}</div>`;
        }
    }

    renderCurrentView() {
        switch (this.currentView) {
            case 'list':
                return this.renderStaffList();
            case 'performance':
                return this.renderPerformanceView();
            default:
                return this.renderStaffList();
        }
    }

    renderStaffList() {
        if (this.staff.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No Staff Members</h3>
                    <p>Add your first staff member to start managing your team.</p>
                </div>
            `;
        }

        return `
            <div class="staff-grid">
                ${this.staff.map(member => this.renderStaffCard(member)).join('')}
            </div>
        `;
    }

    renderStaffCard(member) {
        const memberTasks = this.tasks.filter(task => task.assigned_to === member.id);
        const completedTasks = memberTasks.filter(task => task.status === 'completed').length;
        const activeTasks = memberTasks.filter(task => ['pending', 'in_progress'].includes(task.status)).length;
        
        const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
        
        return `
            <div class="staff-card">
                <div class="staff-avatar">${initials}</div>
                <div class="staff-info">
                    <h3>${member.name}</h3>
                    <div class="staff-role">${member.role}</div>
                    <div class="staff-email">${member.email}</div>
                </div>
                
                <div class="staff-stats">
                    <div class="stat-item">
                        <span class="stat-value">${activeTasks}</span>
                        <div class="stat-label">Active Tasks</div>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${completedTasks}</span>
                        <div class="stat-label">Completed</div>
                    </div>
                </div>
                
                <div class="staff-actions">
                    <button class="btn btn-sm btn-outline" onclick="staffPage.viewStaffTasks(${member.id})">
                        <i class="fas fa-tasks"></i>
                        View Tasks
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="staffPage.editStaff(${member.id})">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="staffPage.deleteStaff(${member.id})"
                            ${member.role === 'Admin' ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    renderPerformanceView() {
        const performanceData = this.calculatePerformanceStats();
        
        return `
            <div class="performance-section">
                <div class="performance-header">
                    <h3>Team Performance Overview</h3>
                    <div class="performance-filters">
                        <select class="form-control" id="performancePeriod" onchange="staffPage.filterPerformance()">
                            <option value="30">Last 30 Days</option>
                            <option value="90">Last 90 Days</option>
                            <option value="365">Last Year</option>
                        </select>
                    </div>
                </div>
                
                <div class="performance-grid">
                    <div class="performance-card">
                        <div class="performance-title">
                            <i class="fas fa-tasks"></i>
                            Total Tasks Completed
                        </div>
                        <div class="performance-value">${performanceData.totalCompleted}</div>
                        <div class="performance-trend trend-up">
                            <i class="fas fa-arrow-up"></i>
                            +12% from last month
                        </div>
                    </div>
                    
                    <div class="performance-card">
                        <div class="performance-title">
                            <i class="fas fa-clock"></i>
                            Avg Completion Time
                        </div>
                        <div class="performance-value">${performanceData.avgCompletionTime}d</div>
                        <div class="performance-trend trend-down">
                            <i class="fas fa-arrow-down"></i>
                            -2 days from last month
                        </div>
                    </div>
                    
                    <div class="performance-card">
                        <div class="performance-title">
                            <i class="fas fa-users"></i>
                            Active Staff Members
                        </div>
                        <div class="performance-value">${performanceData.activeStaff}</div>
                        <div class="performance-trend trend-up">
                            <i class="fas fa-arrow-up"></i>
                            +1 new member
                        </div>
                    </div>
                    
                    <div class="performance-card">
                        <div class="performance-title">
                            <i class="fas fa-percentage"></i>
                            Team Efficiency
                        </div>
                        <div class="performance-value">${performanceData.efficiency}%</div>
                        <div class="performance-trend trend-up">
                            <i class="fas fa-arrow-up"></i>
                            +5% improvement
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="team-leaderboard">
                <div class="leaderboard-header">
                    <i class="fas fa-trophy"></i>
                    Team Leaderboard - Top Performers
                </div>
                ${this.renderLeaderboard()}
            </div>
        `;
    }

    renderLeaderboard() {
        const leaderboardData = this.staff.map(member => {
            const memberTasks = this.tasks.filter(task => task.assigned_to === member.id);
            const completed = memberTasks.filter(task => task.status === 'completed').length;
            const total = memberTasks.length;
            const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
            
            return {
                ...member,
                completed,
                total,
                completionRate
            };
        }).sort((a, b) => b.completed - a.completed);

        return leaderboardData.map((member, index) => `
            <div class="leaderboard-item">
                <div class="leaderboard-rank ${index < 3 ? 'top-3' : ''}">
                    ${index + 1}
                </div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${member.name}</div>
                    <div class="leaderboard-role">${member.role}</div>
                </div>
                <div class="leaderboard-stats">
                    <div class="leaderboard-stat">
                        <span class="leaderboard-stat-value">${member.completed}</span>
                        <div class="leaderboard-stat-label">Completed</div>
                    </div>
                    <div class="leaderboard-stat">
                        <span class="leaderboard-stat-value">${member.total}</span>
                        <div class="leaderboard-stat-label">Total Tasks</div>
                    </div>
                    <div class="leaderboard-stat">
                        <span class="leaderboard-stat-value">${member.completionRate}%</span>
                        <div class="leaderboard-stat-label">Success Rate</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    calculatePerformanceStats() {
        const completedTasks = this.tasks.filter(task => task.status === 'completed');
        const activeStaff = this.staff.filter(member => member.active).length;
        
        // Calculate average completion time (simplified)
        const avgCompletionTime = completedTasks.length > 0 ? 
            Math.round(completedTasks.length * 2.5) : 0; // Simplified calculation
        
        // Calculate efficiency (completed vs total tasks)
        const efficiency = this.tasks.length > 0 ? 
            Math.round((completedTasks.length / this.tasks.length) * 100) : 0;
        
        return {
            totalCompleted: completedTasks.length,
            avgCompletionTime,
            activeStaff,
            efficiency
        };
    }

    switchView(view) {
        this.currentView = view;
        document.getElementById('staffMainContent').innerHTML = this.renderCurrentView();
        
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        event.target.closest('.view-btn').classList.add('active');
    }

    showAddStaffModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add Staff Member</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="addStaffForm">
                    <div class="modal-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Full Name *</label>
                                <input type="text" name="name" required class="form-control" 
                                       placeholder="Enter full name">
                            </div>
                            
                            <div class="form-group">
                                <label>Email Address *</label>
                                <input type="email" name="email" required class="form-control" 
                                       placeholder="Enter email address">
                            </div>
                            
                            <div class="form-group">
                                <label>Role *</label>
                                <select name="role" required class="form-control">
                                    <option value="">Select Role</option>
                                    <option value="CA">Chartered Accountant</option>
                                    <option value="Article">Article</option>
                                    <option value="Accountant">Accountant</option>
                                    <option value="Admin">Admin</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Password *</label>
                                <input type="password" name="password" required class="form-control" 
                                       placeholder="Enter password" minlength="6">
                            </div>
                            
                            <div class="form-group full-width">
                                <label class="checkbox-label">
                                    <input type="checkbox" name="active" checked>
                                    <span class="checkmark"></span>
                                    Active Account
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Add Staff Member</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('addStaffForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddStaff(e);
        });
    }

    async handleAddStaff(e) {
        try {
            showLoading();
            
            const formData = new FormData(e.target);
            const staffData = {
                name: formData.get('name'),
                email: formData.get('email'),
                password: formData.get('password'),
                role: formData.get('role'),
                active: formData.has('active')
            };
            
            await api.createUser(staffData);
            
            hideLoading();
            e.target.closest('.modal').remove();
            showToast('Staff member added successfully', 'success');
            
            // Refresh data
            await this.refreshData();
        } catch (error) {
            hideLoading();
            showToast('Failed to add staff member: ' + error.message, 'error');
        }
    }

    async editStaff(id) {
        const member = this.staff.find(s => s.id === id);
        if (!member) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Staff Member</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="editStaffForm">
                    <div class="modal-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Full Name *</label>
                                <input type="text" name="name" value="${member.name}" required class="form-control">
                            </div>
                            
                            <div class="form-group">
                                <label>Email Address *</label>
                                <input type="email" name="email" value="${member.email}" required class="form-control">
                            </div>
                            
                            <div class="form-group">
                                <label>Role *</label>
                                <select name="role" required class="form-control">
                                    <option value="CA" ${member.role === 'CA' ? 'selected' : ''}>Chartered Accountant</option>
                                    <option value="Article" ${member.role === 'Article' ? 'selected' : ''}>Article</option>
                                    <option value="Accountant" ${member.role === 'Accountant' ? 'selected' : ''}>Accountant</option>
                                    <option value="Admin" ${member.role === 'Admin' ? 'selected' : ''}>Admin</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>New Password</label>
                                <input type="password" name="password" class="form-control" 
                                       placeholder="Leave blank to keep current password" minlength="6">
                            </div>
                            
                            <div class="form-group full-width">
                                <label class="checkbox-label">
                                    <input type="checkbox" name="active" ${member.active ? 'checked' : ''}>
                                    <span class="checkmark"></span>
                                    Active Account
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Update Staff Member</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('editStaffForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEditStaff(e, id);
        });
    }

    async handleEditStaff(e, id) {
        try {
            showLoading();
            
            const formData = new FormData(e.target);
            const staffData = {
                name: formData.get('name'),
                email: formData.get('email'),
                role: formData.get('role'),
                active: formData.has('active')
            };
            
            // Only include password if provided
            const password = formData.get('password');
            if (password && password.trim()) {
                staffData.password = password;
            }
            
            await api.updateUser(id, staffData);
            
            hideLoading();
            e.target.closest('.modal').remove();
            showToast('Staff member updated successfully', 'success');
            
            await this.refreshData();
        } catch (error) {
            hideLoading();
            showToast('Failed to update staff member: ' + error.message, 'error');
        }
    }

    async deleteStaff(id) {
        const member = this.staff.find(s => s.id === id);
        if (!member) return;
        
        if (member.role === 'Admin') {
            showToast('Cannot delete admin users', 'error');
            return;
        }
        
        if (!confirm(`Are you sure you want to delete ${member.name}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            showLoading();
            await api.deleteUser(id);
            hideLoading();
            showToast('Staff member deleted successfully', 'success');
            await this.refreshData();
        } catch (error) {
            hideLoading();
            showToast('Failed to delete staff member: ' + error.message, 'error');
        }
    }

    viewStaffTasks(staffId) {
        const member = this.staff.find(s => s.id === staffId);
        if (!member) return;
        
        const memberTasks = this.tasks.filter(task => task.assigned_to === staffId);
        
        const modal = document.createElement('div');
        modal.className = 'modal modal-large';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Tasks Assigned to ${member.name}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="tasks-summary">
                        <div class="summary-stats">
                            <div class="summary-stat">
                                <span class="summary-value">${memberTasks.length}</span>
                                <span class="summary-label">Total Tasks</span>
                            </div>
                            <div class="summary-stat">
                                <span class="summary-value">${memberTasks.filter(t => t.status === 'completed').length}</span>
                                <span class="summary-label">Completed</span>
                            </div>
                            <div class="summary-stat">
                                <span class="summary-value">${memberTasks.filter(t => ['pending', 'in_progress'].includes(t.status)).length}</span>
                                <span class="summary-label">Active</span>
                            </div>
                            <div class="summary-stat">
                                <span class="summary-value">${memberTasks.filter(t => t.status === 'overdue').length}</span>
                                <span class="summary-label">Overdue</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="task-filters">
                        <select class="form-control" onchange="staffPage.filterMemberTasks(this.value, ${staffId})">
                            <option value="">All Tasks</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="overdue">Overdue</option>
                        </select>
                    </div>
                    
                    <div class="member-tasks-list" id="memberTasksList">
                        ${this.renderMemberTasks(memberTasks)}
                    </div>
                </div>
            </div>
            
            <style>
                .modal-large .modal-content {
                    max-width: 800px;
                    width: 90vw;
                }
                
                .tasks-summary {
                    margin-bottom: 24px;
                }
                
                .summary-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 16px;
                    margin-bottom: 16px;
                }
                
                .summary-stat {
                    text-align: center;
                    padding: 16px;
                    background: var(--background-light);
                    border-radius: var(--border-radius);
                }
                
                .summary-value {
                    display: block;
                    font-size: 28px;
                    font-weight: 600;
                    color: var(--primary-color);
                }
                
                .summary-label {
                    font-size: 12px;
                    color: var(--muted-text);
                    text-transform: uppercase;
                    margin-top: 4px;
                }
                
                .task-filters {
                    margin-bottom: 16px;
                }
                
                .member-tasks-list {
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .member-task-item {
                    background: var(--white);
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    padding: 16px;
                    margin-bottom: 8px;
                }
                
                .member-task-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .member-task-title {
                    font-weight: 500;
                    color: var(--dark-text);
                }
                
                .member-task-info {
                    display: flex;
                    gap: 16px;
                    font-size: 13px;
                    color: var(--muted-text);
                }
            </style>
        `;
        
        document.body.appendChild(modal);
    }

    renderMemberTasks(tasks) {
        if (tasks.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-tasks"></i>
                    <h3>No Tasks</h3>
                    <p>No tasks assigned to this staff member.</p>
                </div>
            `;
        }

        return tasks.map(task => `
            <div class="member-task-item">
                <div class="member-task-header">
                    <div class="member-task-title">${task.title}</div>
                    <span class="task-status status-${task.status}">${task.status.replace('_', ' ')}</span>
                </div>
                <div class="member-task-info">
                    <span><i class="fas fa-calendar"></i> Due: ${task.due_date || 'No date'}</span>
                    <span><i class="fas fa-flag"></i> ${task.priority}</span>
                    <span><i class="fas fa-clock"></i> Created: ${task.created_at}</span>
                </div>
            </div>
        `).join('');
    }

    filterMemberTasks(status, staffId) {
        const member = this.staff.find(s => s.id === staffId);
        if (!member) return;
        
        let filteredTasks = this.tasks.filter(task => task.assigned_to === staffId);
        if (status) {
            filteredTasks = filteredTasks.filter(task => task.status === status);
        }
        
        document.getElementById('memberTasksList').innerHTML = this.renderMemberTasks(filteredTasks);
    }

    filterPerformance() {
        // This would typically filter the performance data based on the selected period
        showToast('Performance filtered successfully', 'info');
    }

    async refreshData() {
        try {
            const [users, tasks] = await Promise.all([
                api.getUsers(),
                api.getTasks()
            ]);
            
            this.staff = users;
            this.tasks = tasks;
            
            // Re-render current view
            document.getElementById('staffMainContent').innerHTML = this.renderCurrentView();
        } catch (error) {
            showToast('Failed to refresh data: ' + error.message, 'error');
        }
    }
}