// Clients Page
class ClientsPage {
    constructor() {
        this.clients = [];
        this.selectedClient = null;
        this.currentView = 'list'; // list, detail
    }

    async render() {
        const pageContent = document.getElementById('pageContent');
        
        try {
            this.clients = await api.getClients();
            
            pageContent.innerHTML = `
                <div class="clients-container">
                    <div class="clients-header">
                        <h2>Client Management</h2>
                        <button class="btn btn-primary" onclick="clientsPage.showAddClientModal()">
                            <i class="fas fa-plus"></i>
                            Add New Client
                        </button>
                    </div>
                    
                    <div class="clients-content">
                        <div class="clients-list" id="clientsList">
                            ${this.renderClientsList()}
                        </div>
                        
                        <div class="client-detail" id="clientDetail" style="display: none;">
                            <!-- Client detail will be loaded here -->
                        </div>
                    </div>
                </div>
                
                <style>
                    .clients-container {
                        height: 100%;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .clients-header {
                        display: flex;
                        justify-content: between;
                        align-items: center;
                        margin-bottom: 24px;
                    }
                    
                    .clients-content {
                        flex: 1;
                        display: flex;
                        gap: 24px;
                        min-height: 0;
                    }
                    
                    .clients-list {
                        flex: 1;
                        min-width: 0;
                    }
                    
                    .client-detail {
                        width: 500px;
                        min-height: 100%;
                    }
                    
                    .client-card {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        padding: 20px;
                        margin-bottom: 16px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }
                    
                    .client-card:hover {
                        border-color: var(--primary-color);
                        box-shadow: var(--shadow-md);
                    }
                    
                    .client-card.selected {
                        border-color: var(--primary-color);
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    }
                    
                    .client-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 12px;
                    }
                    
                    .client-name {
                        font-size: 18px;
                        font-weight: 600;
                        color: var(--dark-text);
                        margin-bottom: 4px;
                    }
                    
                    .client-type {
                        font-size: 12px;
                        padding: 4px 8px;
                        background: var(--light-bg);
                        color: var(--light-text);
                        border-radius: 12px;
                        text-transform: uppercase;
                        font-weight: 500;
                    }
                    
                    .client-contact {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 12px;
                        margin-bottom: 12px;
                    }
                    
                    .contact-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 14px;
                        color: var(--light-text);
                    }
                    
                    .contact-item i {
                        width: 16px;
                        color: var(--primary-color);
                    }
                    
                    .client-actions {
                        display: flex;
                        gap: 8px;
                        margin-top: 12px;
                        padding-top: 12px;
                        border-top: 1px solid var(--border-color);
                    }
                    
                    @media (max-width: 768px) {
                        .clients-content {
                            flex-direction: column;
                        }
                        
                        .client-detail {
                            width: 100%;
                        }
                    }
                </style>
            `;

            // Store reference for global access
            window.clientsPage = this;

        } catch (error) {
            pageContent.innerHTML = `<div class="alert alert-error">Error loading clients: ${error.message}</div>`;
        }
    }

    renderClientsList() {
        if (this.clients.length === 0) {
            return `
                <div class="card">
                    <div class="card-body text-center">
                        <i class="fas fa-users" style="font-size: 48px; color: var(--light-text); margin-bottom: 16px;"></i>
                        <h3>No Clients Found</h3>
                        <p class="text-muted">Start by adding your first client to the system.</p>
                        <button class="btn btn-primary" onclick="clientsPage.showAddClientModal()">
                            <i class="fas fa-plus"></i>
                            Add Client
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="filters-container">
                <div class="filters-grid">
                    <div class="search-box">
                        <input type="text" placeholder="Search clients..." class="form-control" id="clientSearch">
                        <i class="fas fa-search"></i>
                    </div>
                    <select class="form-control" id="businessTypeFilter">
                        <option value="">All Business Types</option>
                        <option value="Private Limited">Private Limited</option>
                        <option value="Partnership">Partnership</option>
                        <option value="LLP">LLP</option>
                        <option value="Sole Proprietorship">Sole Proprietorship</option>
                    </select>
                </div>
            </div>
            
            <div id="clientsGrid">
                ${this.clients.map(client => this.renderClientCard(client)).join('')}
            </div>
        `;
    }

    renderClientCard(client) {
        return `
            <div class="client-card" onclick="clientsPage.selectClient(${client.id})">
                <div class="client-header">
                    <div>
                        <div class="client-name">${client.name}</div>
                        <div class="client-type">${client.business_type || 'N/A'}</div>
                    </div>
                </div>
                
                <div class="client-contact">
                    ${client.email ? `
                        <div class="contact-item">
                            <i class="fas fa-envelope"></i>
                            <span>${client.email}</span>
                        </div>
                    ` : ''}
                    ${client.phone ? `
                        <div class="contact-item">
                            <i class="fas fa-phone"></i>
                            <span>${client.phone}</span>
                        </div>
                    ` : ''}
                    ${client.gstin ? `
                        <div class="contact-item">
                            <i class="fas fa-receipt"></i>
                            <span>${client.gstin}</span>
                        </div>
                    ` : ''}
                    ${client.pan ? `
                        <div class="contact-item">
                            <i class="fas fa-id-card"></i>
                            <span>${client.pan}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="client-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-primary" onclick="clientsPage.showEditClientModal(${client.id})">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="clientsPage.viewClientDetail(${client.id})">
                        <i class="fas fa-eye"></i>
                        View Details
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="clientsPage.deleteClient(${client.id})">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    selectClient(clientId) {
        // Remove previous selection
        document.querySelectorAll('.client-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Add selection to clicked card
        event.target.closest('.client-card').classList.add('selected');
        
        this.selectedClient = this.clients.find(c => c.id === clientId);
    }

    async viewClientDetail(clientId) {
        try {
            showLoading();
            
            const [client, tasks, bills, followups] = await Promise.all([
                api.getClient(clientId),
                api.getTasks({ client: clientId }),
                api.getBills(),
                api.getFollowups()
            ]);
            
            const clientBills = bills.filter(b => b.client_id === clientId);
            const clientFollowups = followups.filter(f => f.client_id === clientId);
            
            const clientDetail = document.getElementById('clientDetail');
            clientDetail.style.display = 'block';
            clientDetail.innerHTML = this.renderClientDetail(client, tasks, clientBills, clientFollowups);
            
            hideLoading();
        } catch (error) {
            hideLoading();
            showToast('Error loading client details', 'error');
        }
    }

    renderClientDetail(client, tasks, bills, followups) {
        const totalBilled = bills.reduce((sum, bill) => sum + parseFloat(bill.total_amount || 0), 0);
        const totalPaid = bills.filter(b => b.status === 'paid').reduce((sum, bill) => sum + parseFloat(bill.total_amount || 0), 0);
        const pendingAmount = totalBilled - totalPaid;
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">${client.name}</h3>
                    <button class="btn btn-sm btn-secondary" onclick="document.getElementById('clientDetail').style.display = 'none'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="card-body">
                    <div class="tabs">
                        <div class="tab-list">
                            <button class="tab-button active" onclick="clientsPage.switchTab(event, 'info')">
                                <i class="fas fa-info-circle"></i>
                                Information
                            </button>
                            <button class="tab-button" onclick="clientsPage.switchTab(event, 'tasks')">
                                <i class="fas fa-tasks"></i>
                                Tasks (${tasks.length})
                            </button>
                            <button class="tab-button" onclick="clientsPage.switchTab(event, 'bills')">
                                <i class="fas fa-file-invoice"></i>
                                Bills (${bills.length})
                            </button>
                            <button class="tab-button" onclick="clientsPage.switchTab(event, 'followups')">
                                <i class="fas fa-phone"></i>
                                Follow-ups (${followups.length})
                            </button>
                        </div>
                        
                        <div id="info" class="tab-content active">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">Client Name</label>
                                    <div class="form-control" style="background: var(--light-bg);">${client.name}</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Business Type</label>
                                    <div class="form-control" style="background: var(--light-bg);">${client.business_type || 'N/A'}</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Email</label>
                                    <div class="form-control" style="background: var(--light-bg);">${client.email || 'N/A'}</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Phone</label>
                                    <div class="form-control" style="background: var(--light-bg);">${client.phone || 'N/A'}</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">PAN</label>
                                    <div class="form-control" style="background: var(--light-bg);">${client.pan || 'N/A'}</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">GSTIN</label>
                                    <div class="form-control" style="background: var(--light-bg);">${client.gstin || 'N/A'}</div>
                                </div>
                                
                                <div class="form-group" style="grid-column: 1 / -1;">
                                    <label class="form-label">Address</label>
                                    <div class="form-control" style="background: var(--light-bg); min-height: 80px;">${client.address || 'N/A'}</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Contact Person</label>
                                    <div class="form-control" style="background: var(--light-bg);">${client.contact_person || 'N/A'}</div>
                                </div>
                            </div>
                            
                            <div class="stats-grid" style="margin-top: 24px;">
                                <div class="stat-card">
                                    <div class="stat-icon primary">
                                        <i class="fas fa-file-invoice-dollar"></i>
                                    </div>
                                    <div class="stat-details">
                                        <div class="stat-value">${formatCurrency(totalBilled)}</div>
                                        <div class="stat-label">Total Billed</div>
                                    </div>
                                </div>
                                
                                <div class="stat-card">
                                    <div class="stat-icon success">
                                        <i class="fas fa-check-circle"></i>
                                    </div>
                                    <div class="stat-details">
                                        <div class="stat-value">${formatCurrency(totalPaid)}</div>
                                        <div class="stat-label">Total Paid</div>
                                    </div>
                                </div>
                                
                                <div class="stat-card">
                                    <div class="stat-icon ${pendingAmount > 0 ? 'warning' : 'success'}">
                                        <i class="fas fa-clock"></i>
                                    </div>
                                    <div class="stat-details">
                                        <div class="stat-value">${formatCurrency(pendingAmount)}</div>
                                        <div class="stat-label">Pending</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="tasks" class="tab-content">
                            ${this.renderClientTasks(tasks)}
                        </div>
                        
                        <div id="bills" class="tab-content">
                            ${this.renderClientBills(bills)}
                        </div>
                        
                        <div id="followups" class="tab-content">
                            ${this.renderClientFollowups(followups)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderClientTasks(tasks) {
        if (tasks.length === 0) {
            return '<p class="text-muted text-center">No tasks found for this client.</p>';
        }

        return `
            <div class="task-list">
                ${tasks.map(task => `
                    <div class="task-item">
                        <div class="task-header">
                            <h4>${task.title}</h4>
                            <span class="status-badge ${getStatusBadge(task.status)}">${task.status.replace('_', ' ')}</span>
                        </div>
                        <div class="task-details">
                            <div class="task-meta">
                                <span><i class="fas fa-user"></i> ${task.assigned_name || 'Unassigned'}</span>
                                <span><i class="fas fa-calendar"></i> Due: ${formatDate(task.due_date)}</span>
                                <span class="priority-badge ${getPriorityBadge(task.priority)}">${task.priority}</span>
                            </div>
                            ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <style>
                .task-list {
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .task-item {
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    padding: 16px;
                    margin-bottom: 12px;
                }
                
                .task-header {
                    display: flex;
                    justify-content: between;
                    align-items: flex-start;
                    margin-bottom: 12px;
                }
                
                .task-header h4 {
                    margin: 0;
                    font-size: 16px;
                    color: var(--dark-text);
                }
                
                .task-meta {
                    display: flex;
                    gap: 16px;
                    font-size: 12px;
                    color: var(--light-text);
                    margin-bottom: 8px;
                }
                
                .task-meta span {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .task-description {
                    font-size: 14px;
                    color: var(--light-text);
                    margin: 0;
                }
            </style>
        `;
    }

    renderClientBills(bills) {
        if (bills.length === 0) {
            return '<p class="text-muted text-center">No bills found for this client.</p>';
        }

        return `
            <div class="bill-list">
                ${bills.map(bill => `
                    <div class="bill-item">
                        <div class="bill-header">
                            <h4>${bill.bill_number}</h4>
                            <span class="status-badge ${getStatusBadge(bill.status)}">${bill.status}</span>
                        </div>
                        <div class="bill-details">
                            <div class="bill-meta">
                                <span><i class="fas fa-calendar"></i> ${formatDate(bill.bill_date)}</span>
                                <span><i class="fas fa-calendar-alt"></i> Due: ${formatDate(bill.due_date)}</span>
                                <span><i class="fas fa-rupee-sign"></i> ${formatCurrency(bill.total_amount)}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderClientFollowups(followups) {
        if (followups.length === 0) {
            return '<p class="text-muted text-center">No follow-ups found for this client.</p>';
        }

        return `
            <div class="followup-list">
                ${followups.map(followup => `
                    <div class="followup-item">
                        <div class="followup-header">
                            <h4>${followup.subject}</h4>
                            <span class="status-badge ${getStatusBadge(followup.status)}">${followup.status}</span>
                        </div>
                        <div class="followup-details">
                            <div class="followup-meta">
                                <span><i class="fas fa-calendar"></i> Due: ${formatDate(followup.due_date)}</span>
                                <span class="priority-badge ${getPriorityBadge(followup.priority)}">${followup.priority}</span>
                            </div>
                            ${followup.description ? `<p class="followup-description">${followup.description}</p>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    switchTab(event, tabName) {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        event.target.classList.add('active');
        document.getElementById(tabName).classList.add('active');
    }

    showAddClientModal() {
        const modalBody = `
            <form id="addClientForm">
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Client Name *</label>
                        <input type="text" name="name" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Business Type</label>
                        <select name="business_type" class="form-control">
                            <option value="">Select Type</option>
                            <option value="Private Limited">Private Limited</option>
                            <option value="Partnership">Partnership</option>
                            <option value="LLP">LLP</option>
                            <option value="Sole Proprietorship">Sole Proprietorship</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" name="email" class="form-control">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Phone</label>
                        <input type="tel" name="phone" class="form-control">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">PAN</label>
                        <input type="text" name="pan" class="form-control" style="text-transform: uppercase;" maxlength="10">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">GSTIN</label>
                        <input type="text" name="gstin" class="form-control" style="text-transform: uppercase;" maxlength="15">
                    </div>
                    
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Address</label>
                        <textarea name="address" class="form-control" rows="3"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Contact Person</label>
                        <input type="text" name="contact_person" class="form-control">
                    </div>
                </div>
            </form>
        `;

        const modalFooter = `
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('modalOverlay').classList.remove('show')">
                Cancel
            </button>
            <button type="submit" form="addClientForm" class="btn btn-primary">
                <i class="fas fa-plus"></i>
                Add Client
            </button>
        `;

        const { closeModal } = showModal('Add New Client', modalBody, modalFooter);

        document.getElementById('addClientForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddClient(e, closeModal);
        });
    }

    showEditClientModal(clientId) {
        const client = this.clients.find(c => c.id === clientId);
        if (!client) return;

        const modalBody = `
            <form id="editClientForm">
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Client Name *</label>
                        <input type="text" name="name" class="form-control" value="${client.name}" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Business Type</label>
                        <select name="business_type" class="form-control">
                            <option value="">Select Type</option>
                            <option value="Private Limited" ${client.business_type === 'Private Limited' ? 'selected' : ''}>Private Limited</option>
                            <option value="Partnership" ${client.business_type === 'Partnership' ? 'selected' : ''}>Partnership</option>
                            <option value="LLP" ${client.business_type === 'LLP' ? 'selected' : ''}>LLP</option>
                            <option value="Sole Proprietorship" ${client.business_type === 'Sole Proprietorship' ? 'selected' : ''}>Sole Proprietorship</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" name="email" class="form-control" value="${client.email || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Phone</label>
                        <input type="tel" name="phone" class="form-control" value="${client.phone || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">PAN</label>
                        <input type="text" name="pan" class="form-control" value="${client.pan || ''}" style="text-transform: uppercase;" maxlength="10">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">GSTIN</label>
                        <input type="text" name="gstin" class="form-control" value="${client.gstin || ''}" style="text-transform: uppercase;" maxlength="15">
                    </div>
                    
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Address</label>
                        <textarea name="address" class="form-control" rows="3">${client.address || ''}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Contact Person</label>
                        <input type="text" name="contact_person" class="form-control" value="${client.contact_person || ''}">
                    </div>
                </div>
            </form>
        `;

        const modalFooter = `
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('modalOverlay').classList.remove('show')">
                Cancel
            </button>
            <button type="submit" form="editClientForm" class="btn btn-primary">
                <i class="fas fa-save"></i>
                Update Client
            </button>
        `;

        const { closeModal } = showModal('Edit Client', modalBody, modalFooter);

        document.getElementById('editClientForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEditClient(e, clientId, closeModal);
        });
    }

    async handleAddClient(event, closeModal) {
        try {
            showLoading();
            const formData = new FormData(event.target);
            const clientData = Object.fromEntries(formData.entries());
            
            await api.createClient(clientData);
            
            closeModal();
            hideLoading();
            showToast('Client added successfully', 'success');
            
            // Refresh the page
            await this.render();
        } catch (error) {
            hideLoading();
            showToast(error.message, 'error');
        }
    }

    async handleEditClient(event, clientId, closeModal) {
        try {
            showLoading();
            const formData = new FormData(event.target);
            const clientData = Object.fromEntries(formData.entries());
            
            await api.updateClient(clientId, clientData);
            
            closeModal();
            hideLoading();
            showToast('Client updated successfully', 'success');
            
            // Refresh the page
            await this.render();
        } catch (error) {
            hideLoading();
            showToast(error.message, 'error');
        }
    }

    async deleteClient(clientId) {
        const client = this.clients.find(c => c.id === clientId);
        if (!client) return;

        const confirmed = await confirmDialog(
            `Are you sure you want to delete "${client.name}"? This action cannot be undone.`,
            'Delete Client'
        );

        if (confirmed) {
            try {
                showLoading();
                await api.deleteClient(clientId);
                hideLoading();
                showToast('Client deleted successfully', 'success');
                
                // Refresh the page
                await this.render();
            } catch (error) {
                hideLoading();
                showToast(error.message, 'error');
            }
        }
    }
}

// Export for use in app.js
window.ClientsPage = ClientsPage;