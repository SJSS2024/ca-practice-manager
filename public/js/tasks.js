// Tasks Page
class TasksPage {
    constructor() {
        this.tasks = [];
        this.clients = [];
        this.services = [];
        this.users = [];
        this.filters = {
            status: '',
            priority: '',
            client: '',
            assigned_to: '',
            service: ''
        };
    }

    async render() {
        const pageContent = document.getElementById('pageContent');
        
        try {
            // Load all required data
            const [tasks, clients, services, users] = await Promise.all([
                api.getTasks(),
                api.getClients(),
                api.getServices(),
                api.getUsers()
            ]);
            
            this.tasks = tasks;
            this.clients = clients;
            this.services = services;
            this.users = users;
            
            pageContent.innerHTML = `
                <div class="tasks-header">
                    <h2>Task Management</h2>
                    <button class="btn btn-primary" onclick="tasksPage.showAddTaskModal()">
                        <i class="fas fa-plus"></i>
                        Add New Task
                    </button>
                </div>
                
                ${this.renderFilters()}
                ${this.renderTasksTable()}
            `;

            // Store reference for global access
            window.tasksPage = this;
            
            // Setup event listeners
            this.setupEventListeners();

        } catch (error) {
            pageContent.innerHTML = `<div class="alert alert-error">Error loading tasks: ${error.message}</div>`;
        }
    }

    renderFilters() {
        return `
            <div class="filters-container">
                <div class="filters-grid">
                    <div class="search-box">
                        <input type="text" placeholder="Search tasks..." class="form-control" id="taskSearch">
                        <i class="fas fa-search"></i>
                    </div>
                    
                    <select class="form-control" id="statusFilter">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="overdue">Overdue</option>
                    </select>
                    
                    <select class="form-control" id="priorityFilter">
                        <option value="">All Priorities</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                    
                    <select class="form-control" id="clientFilter">
                        <option value="">All Clients</option>
                        ${this.clients.map(client => `
                            <option value="${client.id}">${client.name}</option>
                        `).join('')}
                    </select>
                    
                    <select class="form-control" id="assignedFilter">
                        <option value="">All Staff</option>
                        ${this.users.map(user => `
                            <option value="${user.id}">${user.name}</option>
                        `).join('')}
                    </select>
                    
                    <select class="form-control" id="serviceFilter">
                        <option value="">All Services</option>
                        ${this.services.map(service => `
                            <option value="${service.id}">${service.name}</option>
                        `).join('')}
                    </select>
                    
                    <button class="btn btn-secondary" onclick="tasksPage.clearFilters()">
                        <i class="fas fa-times"></i>
                        Clear Filters
                    </button>
                </div>
            </div>
        `;
    }

    renderTasksTable() {
        const columns = [
            {
                key: 'title',
                title: 'Task Title',
                render: (task) => `
                    <div>
                        <strong>${task.title}</strong>
                        ${task.description ? `<br><small class="text-muted">${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</small>` : ''}
                    </div>
                `
            },
            {
                key: 'client_name',
                title: 'Client',
                render: (task) => task.client_name || 'N/A'
            },
            {
                key: 'service_name',
                title: 'Service',
                render: (task) => task.service_name || 'N/A'
            },
            {
                key: 'assigned_name',
                title: 'Assigned To',
                render: (task) => task.assigned_name || 'Unassigned'
            },
            {
                key: 'status',
                title: 'Status',
                render: (task) => `<span class="status-badge ${getStatusBadge(task.status)}">${task.status.replace('_', ' ')}</span>`
            },
            {
                key: 'priority',
                title: 'Priority',
                render: (task) => `<span class="priority-badge ${getPriorityBadge(task.priority)}">${task.priority}</span>`
            },
            {
                key: 'due_date',
                title: 'Due Date',
                render: (task) => {
                    if (!task.due_date) return 'N/A';
                    const dueDate = new Date(task.due_date);
                    const today = new Date();
                    const isOverdue = dueDate < today && task.status !== 'completed';
                    return `
                        <span class="${isOverdue ? 'text-danger' : ''}">
                            ${formatDate(task.due_date)}
                            ${isOverdue ? '<i class="fas fa-exclamation-triangle"></i>' : ''}
                        </span>
                    `;
                }
            },
            {
                key: 'actions',
                title: 'Actions',
                sortable: false,
                render: (task) => `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="tasksPage.showEditTaskModal(${task.id})" title="Edit Task">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-success" onclick="tasksPage.toggleTaskStatus(${task.id})" title="${task.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}">
                            <i class="fas ${task.status === 'completed' ? 'fa-undo' : 'fa-check'}"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="tasksPage.deleteTask(${task.id})" title="Delete Task">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    
                    <style>
                        .btn-group {
                            display: flex;
                            gap: 4px;
                        }
                    </style>
                `
            }
        ];

        const actions = `
            <button class="btn btn-success btn-sm" onclick="tasksPage.markSelectedCompleted()">
                <i class="fas fa-check"></i>
                Mark Selected Complete
            </button>
            <button class="btn btn-secondary btn-sm" onclick="tasksPage.exportTasks()">
                <i class="fas fa-download"></i>
                Export
            </button>
        `;

        const filteredTasks = this.getFilteredTasks();
        const dataTable = createDataTable(filteredTasks, columns, { 
            searchable: true, 
            sortable: true, 
            pagination: true,
            pageSize: 15,
            actions: actions
        });

        return `<div id="tasksTableContainer">${dataTable.element.outerHTML}</div>`;
    }

    getFilteredTasks() {
        return this.tasks.filter(task => {
            const searchTerm = document.getElementById('taskSearch')?.value?.toLowerCase() || '';
            const statusFilter = this.filters.status || document.getElementById('statusFilter')?.value || '';
            const priorityFilter = this.filters.priority || document.getElementById('priorityFilter')?.value || '';
            const clientFilter = this.filters.client || document.getElementById('clientFilter')?.value || '';
            const assignedFilter = this.filters.assigned_to || document.getElementById('assignedFilter')?.value || '';
            const serviceFilter = this.filters.service || document.getElementById('serviceFilter')?.value || '';

            const matchesSearch = !searchTerm || 
                task.title.toLowerCase().includes(searchTerm) ||
                (task.description && task.description.toLowerCase().includes(searchTerm)) ||
                (task.client_name && task.client_name.toLowerCase().includes(searchTerm)) ||
                (task.service_name && task.service_name.toLowerCase().includes(searchTerm)) ||
                (task.assigned_name && task.assigned_name.toLowerCase().includes(searchTerm));

            const matchesStatus = !statusFilter || task.status === statusFilter;
            const matchesPriority = !priorityFilter || task.priority === priorityFilter;
            const matchesClient = !clientFilter || task.client_id == clientFilter;
            const matchesAssigned = !assignedFilter || task.assigned_to == assignedFilter;
            const matchesService = !serviceFilter || task.service_id == serviceFilter;

            return matchesSearch && matchesStatus && matchesPriority && 
                   matchesClient && matchesAssigned && matchesService;
        });
    }

    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('taskSearch');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(() => {
                this.refreshTasksTable();
            }, 300));
        }

        // Filters
        ['statusFilter', 'priorityFilter', 'clientFilter', 'assignedFilter', 'serviceFilter'].forEach(filterId => {
            const filterElement = document.getElementById(filterId);
            if (filterElement) {
                filterElement.addEventListener('change', () => {
                    this.filters[filterId.replace('Filter', '')] = filterElement.value;
                    this.refreshTasksTable();
                });
            }
        });
    }

    refreshTasksTable() {
        const container = document.getElementById('tasksTableContainer');
        if (container) {
            container.innerHTML = this.renderTasksTable();
            this.setupEventListeners();
        }
    }

    clearFilters() {
        this.filters = {
            status: '',
            priority: '',
            client: '',
            assigned_to: '',
            service: ''
        };

        // Clear form inputs
        document.getElementById('taskSearch').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('priorityFilter').value = '';
        document.getElementById('clientFilter').value = '';
        document.getElementById('assignedFilter').value = '';
        document.getElementById('serviceFilter').value = '';

        this.refreshTasksTable();
    }

    showAddTaskModal() {
        const modalBody = `
            <form id="addTaskForm">
                <div class="form-grid">
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Task Title *</label>
                        <input type="text" name="title" class="form-control" required>
                    </div>
                    
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Description</label>
                        <textarea name="description" class="form-control" rows="3"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Client</label>
                        <select name="client_id" class="form-control">
                            <option value="">Select Client</option>
                            ${this.clients.map(client => `
                                <option value="${client.id}">${client.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Service</label>
                        <select name="service_id" class="form-control">
                            <option value="">Select Service</option>
                            ${this.services.map(service => `
                                <option value="${service.id}">${service.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Assign To</label>
                        <select name="assigned_to" class="form-control">
                            <option value="">Select Staff Member</option>
                            ${this.users.map(user => `
                                <option value="${user.id}">${user.name} (${user.role})</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Priority</label>
                        <select name="priority" class="form-control">
                            <option value="low">Low</option>
                            <option value="medium" selected>Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Due Date</label>
                        <input type="date" name="due_date" class="form-control" min="${new Date().toISOString().split('T')[0]}">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select name="status" class="form-control">
                            <option value="pending" selected>Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Notes</label>
                        <textarea name="notes" class="form-control" rows="2"></textarea>
                    </div>
                </div>
            </form>
        `;

        const modalFooter = `
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('modalOverlay').classList.remove('show')">
                Cancel
            </button>
            <button type="submit" form="addTaskForm" class="btn btn-primary">
                <i class="fas fa-plus"></i>
                Add Task
            </button>
        `;

        const { closeModal } = showModal('Add New Task', modalBody, modalFooter);

        document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddTask(e, closeModal);
        });
    }

    showEditTaskModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const modalBody = `
            <form id="editTaskForm">
                <div class="form-grid">
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Task Title *</label>
                        <input type="text" name="title" class="form-control" value="${task.title}" required>
                    </div>
                    
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Description</label>
                        <textarea name="description" class="form-control" rows="3">${task.description || ''}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Client</label>
                        <select name="client_id" class="form-control">
                            <option value="">Select Client</option>
                            ${this.clients.map(client => `
                                <option value="${client.id}" ${task.client_id == client.id ? 'selected' : ''}>${client.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Service</label>
                        <select name="service_id" class="form-control">
                            <option value="">Select Service</option>
                            ${this.services.map(service => `
                                <option value="${service.id}" ${task.service_id == service.id ? 'selected' : ''}>${service.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Assign To</label>
                        <select name="assigned_to" class="form-control">
                            <option value="">Select Staff Member</option>
                            ${this.users.map(user => `
                                <option value="${user.id}" ${task.assigned_to == user.id ? 'selected' : ''}>${user.name} (${user.role})</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Priority</label>
                        <select name="priority" class="form-control">
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                            <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Due Date</label>
                        <input type="date" name="due_date" class="form-control" value="${task.due_date || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select name="status" class="form-control">
                            <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="overdue" ${task.status === 'overdue' ? 'selected' : ''}>Overdue</option>
                        </select>
                    </div>
                    
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Notes</label>
                        <textarea name="notes" class="form-control" rows="2">${task.notes || ''}</textarea>
                    </div>
                </div>
                
                ${task.completion_date ? `
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle"></i>
                        This task was completed on ${formatDateTime(task.completion_date)}
                    </div>
                ` : ''}
            </form>
        `;

        const modalFooter = `
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('modalOverlay').classList.remove('show')">
                Cancel
            </button>
            <button type="submit" form="editTaskForm" class="btn btn-primary">
                <i class="fas fa-save"></i>
                Update Task
            </button>
        `;

        const { closeModal } = showModal('Edit Task', modalBody, modalFooter);

        document.getElementById('editTaskForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEditTask(e, taskId, closeModal);
        });
    }

    async handleAddTask(event, closeModal) {
        try {
            showLoading();
            const formData = new FormData(event.target);
            const taskData = Object.fromEntries(formData.entries());
            
            // Convert empty strings to null
            Object.keys(taskData).forEach(key => {
                if (taskData[key] === '') taskData[key] = null;
            });
            
            await api.createTask(taskData);
            
            closeModal();
            hideLoading();
            showToast('Task created successfully', 'success');
            
            // Refresh tasks
            this.tasks = await api.getTasks();
            this.refreshTasksTable();
        } catch (error) {
            hideLoading();
            showToast(error.message, 'error');
        }
    }

    async handleEditTask(event, taskId, closeModal) {
        try {
            showLoading();
            const formData = new FormData(event.target);
            const taskData = Object.fromEntries(formData.entries());
            
            // Convert empty strings to null
            Object.keys(taskData).forEach(key => {
                if (taskData[key] === '') taskData[key] = null;
            });
            
            await api.updateTask(taskId, taskData);
            
            closeModal();
            hideLoading();
            showToast('Task updated successfully', 'success');
            
            // Refresh tasks
            this.tasks = await api.getTasks();
            this.refreshTasksTable();
        } catch (error) {
            hideLoading();
            showToast(error.message, 'error');
        }
    }

    async toggleTaskStatus(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        
        try {
            showLoading();
            await api.updateTask(taskId, { ...task, status: newStatus });
            
            hideLoading();
            showToast(`Task marked as ${newStatus}`, 'success');
            
            // Refresh tasks
            this.tasks = await api.getTasks();
            this.refreshTasksTable();
        } catch (error) {
            hideLoading();
            showToast(error.message, 'error');
        }
    }

    async deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const confirmed = await confirmDialog(
            `Are you sure you want to delete the task "${task.title}"? This action cannot be undone.`,
            'Delete Task'
        );

        if (confirmed) {
            try {
                showLoading();
                await api.deleteTask(taskId);
                hideLoading();
                showToast('Task deleted successfully', 'success');
                
                // Refresh tasks
                this.tasks = await api.getTasks();
                this.refreshTasksTable();
            } catch (error) {
                hideLoading();
                showToast(error.message, 'error');
            }
        }
    }

    async markSelectedCompleted() {
        showToast('Feature coming soon: Bulk task completion', 'info');
    }

    exportTasks() {
        const filteredTasks = this.getFilteredTasks();
        
        if (filteredTasks.length === 0) {
            showToast('No tasks to export', 'warning');
            return;
        }

        // Create CSV content
        const headers = ['Title', 'Client', 'Service', 'Assigned To', 'Status', 'Priority', 'Due Date', 'Created Date'];
        const csvContent = [
            headers.join(','),
            ...filteredTasks.map(task => [
                `"${task.title}"`,
                `"${task.client_name || 'N/A'}"`,
                `"${task.service_name || 'N/A'}"`,
                `"${task.assigned_name || 'Unassigned'}"`,
                task.status,
                task.priority,
                task.due_date || 'N/A',
                formatDate(task.created_at)
            ].join(','))
        ].join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `tasks_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        showToast('Tasks exported successfully', 'success');
    }
}

// Export for use in app.js
window.TasksPage = TasksPage;