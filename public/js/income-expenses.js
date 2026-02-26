// Income & Expenses Management Page
let incomeExpensesPage;

class IncomeExpensesPage {
    constructor() {
        this.income = [];
        this.expenses = [];
        this.clients = [];
        this.services = [];
        this.currentView = 'income';
        incomeExpensesPage = this;
    }

    async render() {
        const pageContent = document.getElementById('pageContent');
        try {
            const [income, expenses, clients, services] = await Promise.all([
                api.getIncome(), api.getExpenses(), api.getClients(), api.getServices()
            ]);
            this.income = income;
            this.expenses = expenses;
            this.clients = clients;
            this.services = services;

            const totalIncome = income.reduce((s, i) => s + (i.amount || 0), 0);
            const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
            const netProfit = totalIncome - totalExpenses;

            pageContent.innerHTML = `
                <div class="ie-header">
                    <h2>Income & Expenses</h2>
                    <div class="header-actions">
                        <button class="btn btn-success" onclick="incomeExpensesPage.showAddIncome()"><i class="fas fa-plus"></i> Add Income</button>
                        <button class="btn btn-danger" onclick="incomeExpensesPage.showAddExpense()"><i class="fas fa-minus"></i> Add Expense</button>
                    </div>
                </div>
                <div class="summary-cards">
                    <div class="summary-card card-green"><div class="card-icon"><i class="fas fa-arrow-up"></i></div><div class="card-info"><span class="card-label">Total Income</span><span class="card-value">${formatCurrency(totalIncome)}</span></div></div>
                    <div class="summary-card card-red"><div class="card-icon"><i class="fas fa-arrow-down"></i></div><div class="card-info"><span class="card-label">Total Expenses</span><span class="card-value">${formatCurrency(totalExpenses)}</span></div></div>
                    <div class="summary-card ${netProfit >= 0 ? 'card-blue' : 'card-red'}"><div class="card-icon"><i class="fas fa-wallet"></i></div><div class="card-info"><span class="card-label">Net Profit</span><span class="card-value">${formatCurrency(netProfit)}</span></div></div>
                </div>
                <div class="view-switcher" style="margin:20px 0">
                    <button class="view-btn ${this.currentView === 'income' ? 'active' : ''}" onclick="incomeExpensesPage.switchView('income')"><i class="fas fa-arrow-up"></i> Income (${income.length})</button>
                    <button class="view-btn ${this.currentView === 'expenses' ? 'active' : ''}" onclick="incomeExpensesPage.switchView('expenses')"><i class="fas fa-arrow-down"></i> Expenses (${expenses.length})</button>
                    <button class="view-btn ${this.currentView === 'summary' ? 'active' : ''}" onclick="incomeExpensesPage.switchView('summary')"><i class="fas fa-chart-pie"></i> Summary</button>
                </div>
                <div id="ieContent">${this.renderCurrentView()}</div>
            `;
        } catch (error) {
            pageContent.innerHTML = `<div class="error-message">Error loading data: ${error.message}</div>`;
        }
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        event.target.closest('.view-btn').classList.add('active');
        document.getElementById('ieContent').innerHTML = this.renderCurrentView();
    }

    renderCurrentView() {
        if (this.currentView === 'income') return this.renderIncomeTable();
        if (this.currentView === 'expenses') return this.renderExpensesTable();
        return this.renderSummary();
    }

    renderIncomeTable() {
        if (!this.income.length) return '<div class="empty-state"><i class="fas fa-coins"></i><p>No income records yet</p></div>';
        return `<div class="table-container"><table class="data-table"><thead><tr>
            <th>Date</th><th>Client</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th>
        </tr></thead><tbody>${this.income.map(i => `<tr>
            <td>${formatDate(i.income_date)}</td>
            <td>${i.client_name || '-'}</td>
            <td><span class="badge badge-primary">${i.category || 'General'}</span></td>
            <td>${i.description || '-'}</td>
            <td class="text-success"><strong>${formatCurrency(i.amount)}</strong></td>
            <td><button class="btn-icon" onclick="incomeExpensesPage.deleteIncome(${i.id})" title="Delete"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('')}</tbody></table></div>`;
    }

    renderExpensesTable() {
        if (!this.expenses.length) return '<div class="empty-state"><i class="fas fa-receipt"></i><p>No expense records yet</p></div>';
        return `<div class="table-container"><table class="data-table"><thead><tr>
            <th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th>Amount</th><th>Actions</th>
        </tr></thead><tbody>${this.expenses.map(e => `<tr>
            <td>${formatDate(e.expense_date)}</td>
            <td><span class="badge badge-warning">${e.category || 'General'}</span></td>
            <td>${e.vendor || '-'}</td>
            <td>${e.description || '-'}</td>
            <td class="text-danger"><strong>${formatCurrency(e.amount)}</strong></td>
            <td><button class="btn-icon" onclick="incomeExpensesPage.deleteExpense(${e.id})" title="Delete"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('')}</tbody></table></div>`;
    }

    renderSummary() {
        const months = {};
        this.income.forEach(i => {
            const m = (i.income_date || '').substring(0, 7);
            if (!months[m]) months[m] = { income: 0, expenses: 0 };
            months[m].income += i.amount || 0;
        });
        this.expenses.forEach(e => {
            const m = (e.expense_date || '').substring(0, 7);
            if (!months[m]) months[m] = { income: 0, expenses: 0 };
            months[m].expenses += e.amount || 0;
        });
        const sorted = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
        if (!sorted.length) return '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>No data for summary</p></div>';
        return `<div class="table-container"><table class="data-table"><thead><tr>
            <th>Month</th><th>Income</th><th>Expenses</th><th>Profit</th>
        </tr></thead><tbody>${sorted.map(([m, d]) => `<tr>
            <td><strong>${m}</strong></td>
            <td class="text-success">${formatCurrency(d.income)}</td>
            <td class="text-danger">${formatCurrency(d.expenses)}</td>
            <td class="${d.income - d.expenses >= 0 ? 'text-success' : 'text-danger'}"><strong>${formatCurrency(d.income - d.expenses)}</strong></td>
        </tr>`).join('')}</tbody></table></div>`;
    }

    showAddIncome() {
        const clientOptions = this.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        showModal('Add Income', `
            <form id="addIncomeForm">
                <div class="form-group"><label>Date</label><input type="date" name="income_date" value="${new Date().toISOString().split('T')[0]}" required></div>
                <div class="form-group"><label>Client</label><select name="client_id"><option value="">-- Select --</option>${clientOptions}</select></div>
                <div class="form-group"><label>Category</label><select name="category"><option>Service Fee</option><option>Consultation</option><option>Filing Fee</option><option>Other</option></select></div>
                <div class="form-group"><label>Amount (₹)</label><input type="number" name="amount" step="0.01" required></div>
                <div class="form-group"><label>Description</label><textarea name="description" rows="2"></textarea></div>
                <button type="submit" class="btn btn-primary" style="width:100%;margin-top:12px">Save Income</button>
            </form>
        `);
        document.getElementById('addIncomeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                await api.createIncome(Object.fromEntries(fd));
                closeModal();
                showToast('Income added successfully', 'success');
                this.render();
            } catch (err) { showToast(err.message, 'error'); }
        });
    }

    showAddExpense() {
        showModal('Add Expense', `
            <form id="addExpenseForm">
                <div class="form-group"><label>Date</label><input type="date" name="expense_date" value="${new Date().toISOString().split('T')[0]}" required></div>
                <div class="form-group"><label>Category</label><select name="category"><option>Office Rent</option><option>Salary</option><option>Software</option><option>Travel</option><option>Utilities</option><option>Stationery</option><option>Other</option></select></div>
                <div class="form-group"><label>Vendor</label><input type="text" name="vendor"></div>
                <div class="form-group"><label>Amount (₹)</label><input type="number" name="amount" step="0.01" required></div>
                <div class="form-group"><label>Description</label><textarea name="description" rows="2"></textarea></div>
                <div class="form-group"><label>Receipt No.</label><input type="text" name="receipt_number"></div>
                <button type="submit" class="btn btn-primary" style="width:100%;margin-top:12px">Save Expense</button>
            </form>
        `);
        document.getElementById('addExpenseForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                await api.createExpense(Object.fromEntries(fd));
                closeModal();
                showToast('Expense added successfully', 'success');
                this.render();
            } catch (err) { showToast(err.message, 'error'); }
        });
    }

    async deleteIncome(id) {
        if (!confirm('Delete this income record?')) return;
        try { await api.deleteIncome(id); showToast('Deleted', 'success'); this.render(); }
        catch (err) { showToast(err.message, 'error'); }
    }

    async deleteExpense(id) {
        if (!confirm('Delete this expense record?')) return;
        try { await api.deleteExpense(id); showToast('Deleted', 'success'); this.render(); }
        catch (err) { showToast(err.message, 'error'); }
    }
}
