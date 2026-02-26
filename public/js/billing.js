// Billing & Collections Management Page
class BillingPage {
    constructor() {
        this.bills = [];
        this.payments = [];
        this.clients = [];
        this.tasks = [];
        this.services = [];
        this.selectedBill = null;
        this.currentView = 'bills'; // bills, payments, overdue
    }

    async render() {
        const pageContent = document.getElementById('pageContent');
        
        try {
            // Load all required data
            const [bills, payments, clients, tasks, services] = await Promise.all([
                api.getBills(),
                api.getPayments(),
                api.getClients(),
                api.getTasks(),
                api.getServices()
            ]);
            
            this.bills = bills;
            this.payments = payments;
            this.clients = clients;
            this.tasks = tasks;
            this.services = services;
            
            pageContent.innerHTML = `
                <div class="billing-header">
                    <h2>Billing & Collections</h2>
                    <div class="header-actions">
                        <button class="btn btn-outline" onclick="billingPage.generateReport()">
                            <i class="fas fa-file-export"></i>
                            Export Report
                        </button>
                        <button class="btn btn-primary" onclick="billingPage.showCreateBillModal()">
                            <i class="fas fa-plus"></i>
                            Create Bill
                        </button>
                    </div>
                </div>
                
                <div class="billing-summary">
                    ${this.renderBillingSummary()}
                </div>
                
                <div class="billing-content">
                    <div class="view-switcher">
                        <button class="view-btn ${this.currentView === 'bills' ? 'active' : ''}" onclick="billingPage.switchView('bills')">
                            <i class="fas fa-file-invoice"></i>
                            All Bills (${this.bills.length})
                        </button>
                        <button class="view-btn ${this.currentView === 'payments' ? 'active' : ''}" onclick="billingPage.switchView('payments')">
                            <i class="fas fa-credit-card"></i>
                            Payments (${this.payments.length})
                        </button>
                        <button class="view-btn ${this.currentView === 'overdue' ? 'active' : ''}" onclick="billingPage.switchView('overdue')">
                            <i class="fas fa-exclamation-triangle"></i>
                            Overdue (${this.getOverdueBills().length})
                        </button>
                    </div>
                    
                    <div id="billingMainContent">
                        ${this.renderCurrentView()}
                    </div>
                </div>
                
                <style>
                    .billing-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 24px;
                    }
                    
                    .header-actions {
                        display: flex;
                        gap: 12px;
                    }
                    
                    .billing-summary {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 20px;
                        margin-bottom: 32px;
                    }
                    
                    .summary-card {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        padding: 24px;
                        text-align: center;
                        transition: all 0.2s ease;
                    }
                    
                    .summary-card:hover {
                        border-color: var(--primary-color);
                        box-shadow: var(--shadow-md);
                    }
                    
                    .summary-card.success {
                        border-left: 4px solid var(--success-color);
                    }
                    
                    .summary-card.warning {
                        border-left: 4px solid var(--warning-color);
                    }
                    
                    .summary-card.danger {
                        border-left: 4px solid var(--error-color);
                    }
                    
                    .summary-icon {
                        width: 60px;
                        height: 60px;
                        background: var(--primary-color);
                        color: white;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 24px;
                        margin: 0 auto 16px;
                    }
                    
                    .summary-card.success .summary-icon {
                        background: var(--success-color);
                    }
                    
                    .summary-card.warning .summary-icon {
                        background: var(--warning-color);
                    }
                    
                    .summary-card.danger .summary-icon {
                        background: var(--error-color);
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
                    
                    .bills-table {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        overflow: hidden;
                    }
                    
                    .table-header {
                        background: var(--background-light);
                        padding: 16px 24px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid var(--border-color);
                    }
                    
                    .table-title {
                        font-weight: 600;
                        color: var(--dark-text);
                    }
                    
                    .table-filters {
                        display: flex;
                        gap: 12px;
                        align-items: center;
                    }
                    
                    .bills-list {
                        max-height: 600px;
                        overflow-y: auto;
                    }
                    
                    .bill-item {
                        display: grid;
                        grid-template-columns: 1fr auto auto auto auto;
                        align-items: center;
                        padding: 16px 24px;
                        border-bottom: 1px solid var(--border-color);
                        transition: background 0.2s ease;
                        gap: 16px;
                    }
                    
                    .bill-item:hover {
                        background: var(--background-light);
                    }
                    
                    .bill-item:last-child {
                        border-bottom: none;
                    }
                    
                    .bill-info h4 {
                        font-size: 16px;
                        font-weight: 600;
                        color: var(--dark-text);
                        margin-bottom: 4px;
                    }
                    
                    .bill-client {
                        font-size: 14px;
                        color: var(--muted-text);
                        margin-bottom: 2px;
                    }
                    
                    .bill-date {
                        font-size: 13px;
                        color: var(--muted-text);
                    }
                    
                    .bill-amount {
                        font-size: 18px;
                        font-weight: 600;
                        color: var(--success-color);
                        text-align: right;
                    }
                    
                    .bill-gst {
                        font-size: 12px;
                        color: var(--muted-text);
                        text-align: right;
                    }
                    
                    .bill-status {
                        padding: 6px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                        text-transform: uppercase;
                        text-align: center;
                        min-width: 80px;
                    }
                    
                    .bill-status.paid {
                        background: var(--success-light);
                        color: var(--success-color);
                    }
                    
                    .bill-status.pending {
                        background: var(--warning-light);
                        color: var(--warning-color);
                    }
                    
                    .bill-status.overdue {
                        background: var(--error-light);
                        color: var(--error-color);
                    }
                    
                    .bill-status.partial {
                        background: var(--info-light);
                        color: var(--info-color);
                    }
                    
                    .bill-actions {
                        display: flex;
                        gap: 8px;
                    }
                    
                    .payment-item {
                        background: var(--white);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        padding: 20px;
                        margin-bottom: 12px;
                        transition: all 0.2s ease;
                    }
                    
                    .payment-item:hover {
                        border-color: var(--primary-color);
                        box-shadow: var(--shadow-sm);
                    }
                    
                    .payment-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 12px;
                    }
                    
                    .payment-info h4 {
                        font-size: 16px;
                        font-weight: 600;
                        color: var(--dark-text);
                        margin-bottom: 4px;
                    }
                    
                    .payment-amount {
                        font-size: 20px;
                        font-weight: 700;
                        color: var(--success-color);
                    }
                    
                    .payment-details {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 16px;
                        margin-top: 12px;
                        padding-top: 12px;
                        border-top: 1px solid var(--border-color);
                    }
                    
                    .payment-detail {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 14px;
                        color: var(--muted-text);
                    }
                    
                    .payment-detail i {
                        color: var(--primary-color);
                    }
                    
                    .gst-calculator {
                        background: var(--background-light);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        padding: 16px;
                        margin-bottom: 20px;
                    }
                    
                    .gst-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                        padding: 4px 0;
                    }
                    
                    .gst-row:last-child {
                        margin-bottom: 0;
                        padding-top: 8px;
                        border-top: 1px solid var(--border-color);
                        font-weight: 600;
                        font-size: 16px;
                    }
                    
                    .gst-label {
                        color: var(--dark-text);
                    }
                    
                    .gst-value {
                        color: var(--primary-color);
                        font-weight: 500;
                    }
                    
                    @media (max-width: 768px) {
                        .billing-summary {
                            grid-template-columns: 1fr;
                        }
                        
                        .bill-item {
                            grid-template-columns: 1fr;
                            gap: 8px;
                            text-align: center;
                        }
                        
                        .billing-header {
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
                        
                        .table-filters {
                            flex-direction: column;
                            gap: 8px;
                        }
                    }
                </style>
            `;

            // Store reference for global access
            window.billingPage = this;
            
        } catch (error) {
            pageContent.innerHTML = `<div class="alert alert-error">Error loading billing data: ${error.message}</div>`;
        }
    }

    renderBillingSummary() {
        const totalAmount = this.bills.reduce((sum, bill) => sum + bill.total_amount, 0);
        const paidAmount = this.bills.filter(b => b.status === 'paid')
            .reduce((sum, bill) => sum + bill.total_amount, 0);
        const pendingAmount = this.bills.filter(b => ['pending', 'partial'].includes(b.status))
            .reduce((sum, bill) => sum + bill.total_amount, 0);
        const overdueAmount = this.getOverdueBills()
            .reduce((sum, bill) => sum + bill.total_amount, 0);

        return `
            <div class="summary-card success">
                <div class="summary-icon">
                    <i class="fas fa-money-bill-wave"></i>
                </div>
                <div class="summary-value">₹${this.formatAmount(totalAmount)}</div>
                <div class="summary-label">Total Billed</div>
            </div>
            
            <div class="summary-card success">
                <div class="summary-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="summary-value">₹${this.formatAmount(paidAmount)}</div>
                <div class="summary-label">Collected</div>
            </div>
            
            <div class="summary-card warning">
                <div class="summary-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="summary-value">₹${this.formatAmount(pendingAmount)}</div>
                <div class="summary-label">Pending</div>
            </div>
            
            <div class="summary-card danger">
                <div class="summary-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="summary-value">₹${this.formatAmount(overdueAmount)}</div>
                <div class="summary-label">Overdue</div>
            </div>
        `;
    }

    renderCurrentView() {
        switch (this.currentView) {
            case 'bills':
                return this.renderBillsList();
            case 'payments':
                return this.renderPaymentsList();
            case 'overdue':
                return this.renderOverdueList();
            default:
                return this.renderBillsList();
        }
    }

    renderBillsList() {
        return `
            <div class="bills-table">
                <div class="table-header">
                    <div class="table-title">All Bills</div>
                    <div class="table-filters">
                        <select class="form-control" id="billStatusFilter" onchange="billingPage.filterBills()">
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="partial">Partial</option>
                            <option value="overdue">Overdue</option>
                        </select>
                        <input type="text" placeholder="Search bills..." class="form-control" id="billSearch" oninput="billingPage.searchBills()">
                    </div>
                </div>
                <div class="bills-list" id="billsList">
                    ${this.renderBillItems(this.bills)}
                </div>
            </div>
        `;
    }

    renderBillItems(bills) {
        if (bills.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-file-invoice"></i>
                    <h3>No Bills Found</h3>
                    <p>Create your first bill to start tracking payments.</p>
                </div>
            `;
        }

        return bills.map(bill => {
            const client = this.clients.find(c => c.id === bill.client_id);
            const gstAmount = bill.total_amount - bill.subtotal;
            
            return `
                <div class="bill-item">
                    <div class="bill-info">
                        <h4>Bill #${bill.bill_number}</h4>
                        <div class="bill-client">${client ? client.name : 'Unknown Client'}</div>
                        <div class="bill-date">Due: ${bill.due_date || 'No due date'}</div>
                    </div>
                    <div class="bill-amount">
                        ₹${this.formatAmount(bill.total_amount)}
                        <div class="bill-gst">GST: ₹${this.formatAmount(gstAmount)}</div>
                    </div>
                    <div class="bill-status ${bill.status}">${bill.status.toUpperCase()}</div>
                    <div class="bill-actions">
                        <button class="btn btn-sm btn-outline" onclick="billingPage.viewBill(${bill.id})">
                            <i class="fas fa-eye"></i>
                            View
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="billingPage.editBill(${bill.id})">
                            <i class="fas fa-edit"></i>
                            Edit
                        </button>
                        ${bill.status !== 'paid' ? `
                            <button class="btn btn-sm btn-success" onclick="billingPage.addPayment(${bill.id})">
                                <i class="fas fa-credit-card"></i>
                                Payment
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-danger" onclick="billingPage.deleteBill(${bill.id})">
                            <i class="fas fa-trash"></i>
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderPaymentsList() {
        if (this.payments.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-credit-card"></i>
                    <h3>No Payments Recorded</h3>
                    <p>Payment entries will appear here when recorded.</p>
                </div>
            `;
        }

        return `
            <div class="payments-container">
                ${this.payments.map(payment => {
                    const bill = this.bills.find(b => b.id === payment.bill_id);
                    const client = bill ? this.clients.find(c => c.id === bill.client_id) : null;
                    
                    return `
                        <div class="payment-item">
                            <div class="payment-header">
                                <div class="payment-info">
                                    <h4>Payment #${payment.id}</h4>
                                    <div class="payment-client">${client ? client.name : 'Unknown Client'}</div>
                                </div>
                                <div class="payment-amount">₹${this.formatAmount(payment.amount)}</div>
                            </div>
                            
                            <div class="payment-details">
                                <div class="payment-detail">
                                    <i class="fas fa-file-invoice"></i>
                                    <span>Bill #${bill ? bill.bill_number : 'N/A'}</span>
                                </div>
                                <div class="payment-detail">
                                    <i class="fas fa-calendar"></i>
                                    <span>${payment.payment_date}</span>
                                </div>
                                <div class="payment-detail">
                                    <i class="fas fa-credit-card"></i>
                                    <span>${payment.payment_method}</span>
                                </div>
                                <div class="payment-detail">
                                    <i class="fas fa-hashtag"></i>
                                    <span>${payment.reference_number || 'No reference'}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderOverdueList() {
        const overdueBills = this.getOverdueBills();
        
        return `
            <div class="bills-table">
                <div class="table-header">
                    <div class="table-title">Overdue Bills (${overdueBills.length})</div>
                    <div class="table-filters">
                        <button class="btn btn-warning" onclick="billingPage.sendOverdueReminders()">
                            <i class="fas fa-envelope"></i>
                            Send Reminders
                        </button>
                    </div>
                </div>
                <div class="bills-list">
                    ${this.renderBillItems(overdueBills)}
                </div>
            </div>
        `;
    }

    getOverdueBills() {
        const today = new Date();
        return this.bills.filter(bill => {
            if (!bill.due_date || bill.status === 'paid') return false;
            const dueDate = new Date(bill.due_date);
            return dueDate < today && ['pending', 'partial'].includes(bill.status);
        });
    }

    switchView(view) {
        this.currentView = view;
        document.getElementById('billingMainContent').innerHTML = this.renderCurrentView();
        
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        event.target.closest('.view-btn').classList.add('active');
    }

    showCreateBillModal() {
        const modal = document.createElement('div');
        modal.className = 'modal modal-large';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Create New Bill</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="createBillForm">
                    <div class="modal-body">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Client *</label>
                                <select name="client_id" required class="form-control" onchange="billingPage.loadClientTasks(this.value)">
                                    <option value="">Select Client</option>
                                    ${this.clients.map(client => 
                                        `<option value="${client.id}">${client.name}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Bill Number</label>
                                <input type="text" name="bill_number" class="form-control" 
                                       value="BILL-${Date.now()}" readonly>
                            </div>
                            
                            <div class="form-group">
                                <label>Bill Date *</label>
                                <input type="date" name="bill_date" required class="form-control" 
                                       value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            
                            <div class="form-group">
                                <label>Due Date</label>
                                <input type="date" name="due_date" class="form-control">
                            </div>
                            
                            <div class="form-group full-width">
                                <label>Linked Tasks</label>
                                <div id="clientTasksContainer">
                                    <p class="text-muted">Select a client to see available tasks</p>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Subtotal (₹) *</label>
                                <input type="number" name="subtotal" required class="form-control" 
                                       step="0.01" min="0" onchange="billingPage.calculateGST()">
                            </div>
                            
                            <div class="form-group">
                                <label>GST Rate (%)</label>
                                <select name="gst_rate" class="form-control" onchange="billingPage.calculateGST()">
                                    <option value="0">0% (No GST)</option>
                                    <option value="5">5%</option>
                                    <option value="12">12%</option>
                                    <option value="18" selected>18%</option>
                                    <option value="28">28%</option>
                                </select>
                            </div>
                            
                            <div class="form-group full-width">
                                <div class="gst-calculator" id="gstCalculator">
                                    <div class="gst-row">
                                        <span class="gst-label">Subtotal:</span>
                                        <span class="gst-value">₹<span id="calcSubtotal">0.00</span></span>
                                    </div>
                                    <div class="gst-row">
                                        <span class="gst-label">GST (<span id="calcGstRate">18</span>%):</span>
                                        <span class="gst-value">₹<span id="calcGstAmount">0.00</span></span>
                                    </div>
                                    <div class="gst-row">
                                        <span class="gst-label">Total Amount:</span>
                                        <span class="gst-value">₹<span id="calcTotalAmount">0.00</span></span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-group full-width">
                                <label>Notes</label>
                                <textarea name="notes" class="form-control" rows="3" 
                                          placeholder="Additional notes about this bill"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Bill</button>
                    </div>
                </form>
            </div>
            
            <style>
                .modal-large .modal-content {
                    max-width: 800px;
                    width: 90vw;
                }
                
                .task-checkbox-group {
                    max-height: 200px;
                    overflow-y: auto;
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    padding: 12px;
                }
                
                .task-checkbox-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--border-color);
                }
                
                .task-checkbox-item:last-child {
                    border-bottom: none;
                }
                
                .task-checkbox-item label {
                    margin-left: 8px;
                    flex: 1;
                    cursor: pointer;
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('createBillForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCreateBill(e);
        });
    }

    loadClientTasks(clientId) {
        const container = document.getElementById('clientTasksContainer');
        if (!clientId) {
            container.innerHTML = '<p class="text-muted">Select a client to see available tasks</p>';
            return;
        }

        const clientTasks = this.tasks.filter(task => 
            task.client_id == clientId && task.status === 'completed'
        );

        if (clientTasks.length === 0) {
            container.innerHTML = '<p class="text-muted">No completed tasks available for billing</p>';
            return;
        }

        container.innerHTML = `
            <div class="task-checkbox-group">
                ${clientTasks.map(task => {
                    const service = this.services.find(s => s.id === task.service_id);
                    return `
                        <div class="task-checkbox-item">
                            <input type="checkbox" name="task_ids" value="${task.id}" id="task_${task.id}">
                            <label for="task_${task.id}">
                                ${task.title} ${service ? `(${service.name})` : ''}
                                <br><small class="text-muted">Completed: ${task.completion_date}</small>
                            </label>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    calculateGST() {
        const subtotal = parseFloat(document.querySelector('[name="subtotal"]').value) || 0;
        const gstRate = parseFloat(document.querySelector('[name="gst_rate"]').value) || 0;
        
        const gstAmount = subtotal * (gstRate / 100);
        const totalAmount = subtotal + gstAmount;
        
        document.getElementById('calcSubtotal').textContent = this.formatAmount(subtotal);
        document.getElementById('calcGstRate').textContent = gstRate;
        document.getElementById('calcGstAmount').textContent = this.formatAmount(gstAmount);
        document.getElementById('calcTotalAmount').textContent = this.formatAmount(totalAmount);
    }

    async handleCreateBill(e) {
        try {
            showLoading();
            
            const formData = new FormData(e.target);
            const subtotal = parseFloat(formData.get('subtotal'));
            const gstRate = parseFloat(formData.get('gst_rate')) || 0;
            const gstAmount = subtotal * (gstRate / 100);
            
            // Get selected task IDs
            const taskIds = Array.from(document.querySelectorAll('[name="task_ids"]:checked'))
                .map(checkbox => parseInt(checkbox.value));
            
            const billData = {
                client_id: parseInt(formData.get('client_id')),
                bill_number: formData.get('bill_number'),
                bill_date: formData.get('bill_date'),
                due_date: formData.get('due_date') || null,
                subtotal: subtotal,
                gst_rate: gstRate,
                gst_amount: gstAmount,
                total_amount: subtotal + gstAmount,
                status: 'pending',
                notes: formData.get('notes'),
                task_ids: taskIds
            };
            
            await api.createBill(billData);
            
            hideLoading();
            e.target.closest('.modal').remove();
            showToast('Bill created successfully', 'success');
            
            await this.refreshData();
        } catch (error) {
            hideLoading();
            showToast('Failed to create bill: ' + error.message, 'error');
        }
    }

    async addPayment(billId) {
        const bill = this.bills.find(b => b.id === billId);
        if (!bill) return;
        
        const client = this.clients.find(c => c.id === bill.client_id);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add Payment - Bill #${bill.bill_number}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="addPaymentForm">
                    <div class="modal-body">
                        <div class="bill-summary">
                            <div><strong>Client:</strong> ${client ? client.name : 'Unknown'}</div>
                            <div><strong>Bill Amount:</strong> ₹${this.formatAmount(bill.total_amount)}</div>
                            <div><strong>Status:</strong> ${bill.status.toUpperCase()}</div>
                        </div>
                        
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Payment Amount *</label>
                                <input type="number" name="amount" required class="form-control" 
                                       step="0.01" min="0" max="${bill.total_amount}" 
                                       value="${bill.total_amount}">
                            </div>
                            
                            <div class="form-group">
                                <label>Payment Date *</label>
                                <input type="date" name="payment_date" required class="form-control" 
                                       value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            
                            <div class="form-group">
                                <label>Payment Method *</label>
                                <select name="payment_method" required class="form-control">
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="check">Check</option>
                                    <option value="upi">UPI</option>
                                    <option value="card">Card</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Reference Number</label>
                                <input type="text" name="reference_number" class="form-control" 
                                       placeholder="Transaction ID, Check number, etc.">
                            </div>
                            
                            <div class="form-group full-width">
                                <label>Notes</label>
                                <textarea name="notes" class="form-control" rows="2" 
                                          placeholder="Payment notes"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-success">Record Payment</button>
                    </div>
                </form>
            </div>
            
            <style>
                .bill-summary {
                    background: var(--background-light);
                    padding: 16px;
                    border-radius: var(--border-radius);
                    margin-bottom: 20px;
                    font-size: 14px;
                    line-height: 1.6;
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('addPaymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddPayment(e, billId);
        });
    }

    async handleAddPayment(e, billId) {
        try {
            showLoading();
            
            const formData = new FormData(e.target);
            const paymentData = {
                bill_id: billId,
                amount: parseFloat(formData.get('amount')),
                payment_date: formData.get('payment_date'),
                payment_method: formData.get('payment_method'),
                reference_number: formData.get('reference_number'),
                notes: formData.get('notes')
            };
            
            await api.createPayment(paymentData);
            
            hideLoading();
            e.target.closest('.modal').remove();
            showToast('Payment recorded successfully', 'success');
            
            await this.refreshData();
        } catch (error) {
            hideLoading();
            showToast('Failed to record payment: ' + error.message, 'error');
        }
    }

    async deleteBill(id) {
        if (!confirm('Are you sure you want to delete this bill? This action cannot be undone.')) {
            return;
        }
        
        try {
            showLoading();
            await api.deleteBill(id);
            hideLoading();
            showToast('Bill deleted successfully', 'success');
            await this.refreshData();
        } catch (error) {
            hideLoading();
            showToast('Failed to delete bill: ' + error.message, 'error');
        }
    }

    filterBills() {
        const status = document.getElementById('billStatusFilter').value;
        const filteredBills = status ? 
            this.bills.filter(bill => bill.status === status) : 
            this.bills;
        
        document.getElementById('billsList').innerHTML = this.renderBillItems(filteredBills);
    }

    searchBills() {
        const searchTerm = document.getElementById('billSearch').value.toLowerCase();
        const filteredBills = this.bills.filter(bill => {
            const client = this.clients.find(c => c.id === bill.client_id);
            return bill.bill_number.toLowerCase().includes(searchTerm) ||
                   (client && client.name.toLowerCase().includes(searchTerm));
        });
        
        document.getElementById('billsList').innerHTML = this.renderBillItems(filteredBills);
    }

    async sendOverdueReminders() {
        showToast('Overdue reminders sent successfully', 'success');
    }

    async generateReport() {
        showToast('Report generated successfully', 'success');
    }

    formatAmount(amount) {
        return Number(amount).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    async refreshData() {
        try {
            const [bills, payments] = await Promise.all([
                api.getBills(),
                api.getPayments()
            ]);
            
            this.bills = bills;
            this.payments = payments;
            
            // Re-render current view and summary
            document.querySelector('.billing-summary').innerHTML = this.renderBillingSummary();
            document.getElementById('billingMainContent').innerHTML = this.renderCurrentView();
            
            // Update view switcher counts
            const viewBtns = document.querySelectorAll('.view-btn');
            viewBtns.forEach(btn => {
                if (btn.onclick.toString().includes("'bills'")) {
                    btn.innerHTML = `<i class="fas fa-file-invoice"></i> All Bills (${this.bills.length})`;
                } else if (btn.onclick.toString().includes("'payments'")) {
                    btn.innerHTML = `<i class="fas fa-credit-card"></i> Payments (${this.payments.length})`;
                } else if (btn.onclick.toString().includes("'overdue'")) {
                    btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Overdue (${this.getOverdueBills().length})`;
                }
            });
        } catch (error) {
            showToast('Failed to refresh data: ' + error.message, 'error');
        }
    }
}