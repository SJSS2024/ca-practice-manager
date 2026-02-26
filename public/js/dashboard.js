// Dashboard Page
class DashboardPage {
    constructor() {
        this.charts = {};
    }

    async render() {
        const pageContent = document.getElementById('pageContent');
        
        try {
            const dashboardData = await api.getDashboard();
            
            pageContent.innerHTML = `
                <div class="stats-grid">
                    ${this.renderStatsCards(dashboardData.stats)}
                </div>
                
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px; margin-bottom: 30px;">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Monthly Income Trend</h3>
                        </div>
                        <div class="card-body">
                            <div class="chart-container">
                                <canvas id="incomeChart"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Task Status Distribution</h3>
                        </div>
                        <div class="card-body">
                            <div class="chart-container">
                                <canvas id="taskChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Recent Activities</h3>
                        </div>
                        <div class="card-body">
                            ${this.renderRecentActivities(dashboardData.recentActivities)}
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Alerts & Reminders</h3>
                        </div>
                        <div class="card-body">
                            ${await this.renderAlerts()}
                        </div>
                    </div>
                </div>
            `;

            // Initialize charts after DOM is ready
            setTimeout(() => {
                this.initializeCharts(dashboardData);
            }, 100);

        } catch (error) {
            pageContent.innerHTML = `<div class="alert alert-error">Error loading dashboard: ${error.message}</div>`;
        }
    }

    renderStatsCards(stats) {
        return `
            <div class="stat-card">
                <div class="stat-icon primary">
                    <i class="fas fa-users"></i>
                </div>
                <div class="stat-details">
                    <div class="stat-value">${stats.totalClients}</div>
                    <div class="stat-label">Total Clients</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon info">
                    <i class="fas fa-tasks"></i>
                </div>
                <div class="stat-details">
                    <div class="stat-value">${stats.todayTasks}</div>
                    <div class="stat-label">Today's Tasks</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon danger">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <div class="stat-details">
                    <div class="stat-value">${stats.overdueTasks}</div>
                    <div class="stat-label">Overdue Tasks</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon warning">
                    <i class="fas fa-file-invoice"></i>
                </div>
                <div class="stat-details">
                    <div class="stat-value">${stats.pendingBills}</div>
                    <div class="stat-label">Pending Bills</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon success">
                    <i class="fas fa-arrow-up"></i>
                </div>
                <div class="stat-details">
                    <div class="stat-value">${formatCurrency(stats.monthlyIncome)}</div>
                    <div class="stat-label">Monthly Income</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon danger">
                    <i class="fas fa-arrow-down"></i>
                </div>
                <div class="stat-details">
                    <div class="stat-value">${formatCurrency(stats.monthlyExpenses)}</div>
                    <div class="stat-label">Monthly Expenses</div>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon ${stats.netProfit >= 0 ? 'success' : 'danger'}">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="stat-details">
                    <div class="stat-value">${formatCurrency(stats.netProfit)}</div>
                    <div class="stat-label">Net Profit</div>
                    <div class="stat-change ${stats.netProfit >= 0 ? 'positive' : 'negative'}">
                        ${stats.netProfit >= 0 ? '+' : ''}${((stats.netProfit / stats.monthlyIncome) * 100).toFixed(1)}%
                    </div>
                </div>
            </div>
        `;
    }

    renderRecentActivities(activities) {
        if (!activities || activities.length === 0) {
            return '<p class="text-muted text-center">No recent activities</p>';
        }

        return `
            <div class="activity-list">
                ${activities.map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon">
                            <i class="fas ${this.getActivityIcon(activity.action)}"></i>
                        </div>
                        <div class="activity-details">
                            <div class="activity-text">
                                <strong>${activity.user_name}</strong> ${activity.action.toLowerCase()} ${activity.entity_type}
                            </div>
                            <div class="activity-time">${formatDateTime(activity.created_at)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <style>
                .activity-list {
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .activity-item {
                    display: flex;
                    align-items: flex-start;
                    padding: 12px 0;
                    border-bottom: 1px solid var(--border-color);
                }
                
                .activity-item:last-child {
                    border-bottom: none;
                }
                
                .activity-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--light-bg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary-color);
                    margin-right: 12px;
                    flex-shrink: 0;
                }
                
                .activity-details {
                    flex: 1;
                }
                
                .activity-text {
                    font-size: 14px;
                    color: var(--dark-text);
                    margin-bottom: 4px;
                }
                
                .activity-time {
                    font-size: 12px;
                    color: var(--light-text);
                }
            </style>
        `;
    }

    async renderAlerts() {
        try {
            // Get overdue tasks and pending followups
            const [tasks, followups, bills] = await Promise.all([
                api.getTasks({ status: 'overdue' }),
                api.getFollowups(),
                api.getBills()
            ]);

            const alerts = [];

            // Overdue tasks
            tasks.forEach(task => {
                alerts.push({
                    type: 'danger',
                    icon: 'fas fa-exclamation-circle',
                    title: 'Overdue Task',
                    message: `${task.title} for ${task.client_name}`,
                    time: formatDate(task.due_date)
                });
            });

            // Upcoming followups
            const upcomingFollowups = followups.filter(f => {
                const dueDate = new Date(f.due_date);
                const today = new Date();
                const diff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                return diff <= 3 && diff >= 0 && f.status === 'pending';
            });

            upcomingFollowups.forEach(followup => {
                alerts.push({
                    type: 'warning',
                    icon: 'fas fa-phone',
                    title: 'Upcoming Followup',
                    message: `${followup.subject} - ${followup.client_name}`,
                    time: formatDate(followup.due_date)
                });
            });

            // Overdue bills
            const overdueBills = bills.filter(b => {
                const dueDate = new Date(b.due_date);
                return dueDate < new Date() && b.status === 'pending';
            });

            overdueBills.forEach(bill => {
                alerts.push({
                    type: 'danger',
                    icon: 'fas fa-file-invoice-dollar',
                    title: 'Overdue Bill',
                    message: `${bill.bill_number} - ${bill.client_name}`,
                    time: formatDate(bill.due_date)
                });
            });

            if (alerts.length === 0) {
                return '<p class="text-muted text-center">No alerts at this time</p>';
            }

            return `
                <div class="alert-list">
                    ${alerts.slice(0, 10).map(alert => `
                        <div class="alert-item alert-${alert.type}">
                            <div class="alert-icon">
                                <i class="${alert.icon}"></i>
                            </div>
                            <div class="alert-content">
                                <div class="alert-title">${alert.title}</div>
                                <div class="alert-message">${alert.message}</div>
                                <div class="alert-time">${alert.time}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <style>
                    .alert-list {
                        max-height: 400px;
                        overflow-y: auto;
                    }
                    
                    .alert-item {
                        display: flex;
                        align-items: flex-start;
                        padding: 12px;
                        border-radius: var(--border-radius);
                        margin-bottom: 12px;
                        border-left: 3px solid;
                    }
                    
                    .alert-item:last-child {
                        margin-bottom: 0;
                    }
                    
                    .alert-danger {
                        background: rgba(239, 68, 68, 0.1);
                        border-left-color: var(--danger-color);
                    }
                    
                    .alert-warning {
                        background: rgba(245, 158, 11, 0.1);
                        border-left-color: var(--warning-color);
                    }
                    
                    .alert-info {
                        background: rgba(59, 130, 246, 0.1);
                        border-left-color: var(--primary-color);
                    }
                    
                    .alert-icon {
                        margin-right: 12px;
                        font-size: 18px;
                    }
                    
                    .alert-danger .alert-icon {
                        color: var(--danger-color);
                    }
                    
                    .alert-warning .alert-icon {
                        color: var(--warning-color);
                    }
                    
                    .alert-info .alert-icon {
                        color: var(--primary-color);
                    }
                    
                    .alert-content {
                        flex: 1;
                    }
                    
                    .alert-title {
                        font-weight: 600;
                        font-size: 14px;
                        margin-bottom: 4px;
                    }
                    
                    .alert-message {
                        font-size: 13px;
                        color: var(--light-text);
                        margin-bottom: 4px;
                    }
                    
                    .alert-time {
                        font-size: 12px;
                        color: var(--light-text);
                    }
                </style>
            `;
        } catch (error) {
            return '<p class="text-muted text-center">Error loading alerts</p>';
        }
    }

    initializeCharts(dashboardData) {
        // Income Chart
        const incomeCtx = document.getElementById('incomeChart');
        if (incomeCtx) {
            this.charts.income = new Chart(incomeCtx, {
                type: 'line',
                data: {
                    labels: dashboardData.incomeChart.map(item => {
                        const [year, month] = item.month.split('-');
                        return new Date(year, month - 1).toLocaleDateString('en-IN', { 
                            month: 'short', 
                            year: '2-digit' 
                        });
                    }),
                    datasets: [{
                        label: 'Income',
                        data: dashboardData.incomeChart.map(item => item.total),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '₹' + value.toLocaleString('en-IN');
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return 'Income: ₹' + context.parsed.y.toLocaleString('en-IN');
                                }
                            }
                        }
                    }
                }
            });
        }

        // Task Status Chart
        const taskCtx = document.getElementById('taskChart');
        if (taskCtx && dashboardData.taskStats.length > 0) {
            const statusColors = {
                pending: '#f59e0b',
                'in-progress': '#3b82f6',
                'in_progress': '#3b82f6',
                completed: '#10b981',
                overdue: '#ef4444'
            };

            this.charts.tasks = new Chart(taskCtx, {
                type: 'doughnut',
                data: {
                    labels: dashboardData.taskStats.map(item => 
                        item.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                    ),
                    datasets: [{
                        data: dashboardData.taskStats.map(item => item.count),
                        backgroundColor: dashboardData.taskStats.map(item => 
                            statusColors[item.status] || '#64748b'
                        ),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 20
                            }
                        }
                    }
                }
            });
        }
    }

    getActivityIcon(action) {
        const icons = {
            CREATE: 'fa-plus',
            UPDATE: 'fa-edit',
            DELETE: 'fa-trash',
            LOGIN: 'fa-sign-in-alt'
        };
        return icons[action] || 'fa-info-circle';
    }
}

// Export for use in app.js
window.DashboardPage = DashboardPage;