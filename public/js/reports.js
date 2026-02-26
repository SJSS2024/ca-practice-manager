// Reports & Analytics Page
let reportsPage;

class ReportsPage {
    constructor() {
        this.currentReport = 'productivity';
        reportsPage = this;
    }

    async render() {
        const pageContent = document.getElementById('pageContent');
        const now = new Date();
        const startOfYear = `${now.getFullYear()}-01-01`;
        const today = now.toISOString().split('T')[0];

        pageContent.innerHTML = `
            <div class="ie-header">
                <h2>Reports & Analytics</h2>
                <div class="header-actions">
                    <label>From: <input type="date" id="reportStart" value="${startOfYear}"></label>
                    <label>To: <input type="date" id="reportEnd" value="${today}"></label>
                    <button class="btn btn-primary" onclick="reportsPage.loadReport()"><i class="fas fa-sync"></i> Refresh</button>
                </div>
            </div>
            <div class="view-switcher" style="margin:20px 0">
                <button class="view-btn active" onclick="reportsPage.switchReport('productivity', this)"><i class="fas fa-user-clock"></i> Staff Productivity</button>
                <button class="view-btn" onclick="reportsPage.switchReport('revenue', this)"><i class="fas fa-rupee-sign"></i> Client Revenue</button>
                <button class="view-btn" onclick="reportsPage.switchReport('profitTrend', this)"><i class="fas fa-chart-line"></i> Profit Trend</button>
            </div>
            <div id="reportContent"><div class="loading">Loading...</div></div>
            <canvas id="reportChart" style="max-height:400px;margin-top:24px;display:none"></canvas>
        `;
        await this.loadReport();
    }

    switchReport(report, btn) {
        this.currentReport = report;
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        this.loadReport();
    }

    async loadReport() {
        const start = document.getElementById('reportStart')?.value || '2024-01-01';
        const end = document.getElementById('reportEnd')?.value || '2026-12-31';
        const container = document.getElementById('reportContent');
        const canvas = document.getElementById('reportChart');

        try {
            if (this.currentReport === 'productivity') {
                const data = await api.getProductivityReport(start, end);
                container.innerHTML = this.renderProductivityTable(data);
                this.renderProductivityChart(data, canvas);
            } else if (this.currentReport === 'revenue') {
                const data = await api.getRevenueReport(start, end);
                container.innerHTML = this.renderRevenueTable(data);
                this.renderRevenueChart(data, canvas);
            } else {
                const [income, expenses] = await Promise.all([api.getIncome(), api.getExpenses()]);
                container.innerHTML = this.renderProfitTrend(income, expenses);
                this.renderProfitChart(income, expenses, canvas);
            }
        } catch (err) {
            container.innerHTML = `<div class="error-message">Error: ${err.message}</div>`;
            canvas.style.display = 'none';
        }
    }

    renderProductivityTable(data) {
        if (!data.length) return '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>No productivity data</p></div>';
        return `<div class="table-container"><table class="data-table"><thead><tr>
            <th>Staff</th><th>Total Tasks</th><th>Completed</th><th>Overdue</th><th>Completion %</th>
        </tr></thead><tbody>${data.map(d => {
            const pct = d.total_tasks ? Math.round(d.completed_tasks / d.total_tasks * 100) : 0;
            return `<tr>
                <td><strong>${d.staff_name || 'Unassigned'}</strong></td>
                <td>${d.total_tasks}</td>
                <td class="text-success">${d.completed_tasks}</td>
                <td class="text-danger">${d.overdue_tasks}</td>
                <td><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div><span>${pct}%</span></div></td>
            </tr>`;
        }).join('')}</tbody></table></div>`;
    }

    renderRevenueTable(data) {
        if (!data.length) return '<div class="empty-state"><i class="fas fa-rupee-sign"></i><p>No revenue data</p></div>';
        return `<div class="table-container"><table class="data-table"><thead><tr>
            <th>Client</th><th>Bills</th><th>Billed</th><th>Paid</th><th>Outstanding</th>
        </tr></thead><tbody>${data.map(d => `<tr>
            <td><strong>${d.client_name || 'Unknown'}</strong></td>
            <td>${d.total_bills}</td>
            <td>${formatCurrency(d.total_billed || 0)}</td>
            <td class="text-success">${formatCurrency(d.total_paid || 0)}</td>
            <td class="text-danger">${formatCurrency(d.outstanding || 0)}</td>
        </tr>`).join('')}</tbody></table></div>`;
    }

    renderProfitTrend(income, expenses) {
        const months = {};
        income.forEach(i => { const m = (i.income_date || '').substring(0, 7); if (m) { months[m] = months[m] || { i: 0, e: 0 }; months[m].i += i.amount || 0; }});
        expenses.forEach(e => { const m = (e.expense_date || '').substring(0, 7); if (m) { months[m] = months[m] || { i: 0, e: 0 }; months[m].e += e.amount || 0; }});
        const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
        if (!sorted.length) return '<div class="empty-state"><i class="fas fa-chart-line"></i><p>No data</p></div>';
        return `<div class="table-container"><table class="data-table"><thead><tr>
            <th>Month</th><th>Income</th><th>Expenses</th><th>Profit</th>
        </tr></thead><tbody>${sorted.map(([m, d]) => `<tr>
            <td><strong>${m}</strong></td>
            <td class="text-success">${formatCurrency(d.i)}</td>
            <td class="text-danger">${formatCurrency(d.e)}</td>
            <td class="${d.i - d.e >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(d.i - d.e)}</td>
        </tr>`).join('')}</tbody></table></div>`;
    }

    renderProductivityChart(data, canvas) {
        if (typeof Chart === 'undefined' || !data.length) { canvas.style.display = 'none'; return; }
        canvas.style.display = 'block';
        if (this.chart) this.chart.destroy();
        this.chart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: data.map(d => d.staff_name || 'Unassigned'),
                datasets: [
                    { label: 'Completed', data: data.map(d => d.completed_tasks), backgroundColor: '#10b981' },
                    { label: 'Overdue', data: data.map(d => d.overdue_tasks), backgroundColor: '#ef4444' }
                ]
            },
            options: { responsive: true, plugins: { title: { display: true, text: 'Staff Productivity' } } }
        });
    }

    renderRevenueChart(data, canvas) {
        if (typeof Chart === 'undefined' || !data.length) { canvas.style.display = 'none'; return; }
        canvas.style.display = 'block';
        if (this.chart) this.chart.destroy();
        this.chart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: data.map(d => d.client_name || 'Unknown'),
                datasets: [
                    { label: 'Billed', data: data.map(d => d.total_billed || 0), backgroundColor: '#3b82f6' },
                    { label: 'Paid', data: data.map(d => d.total_paid || 0), backgroundColor: '#10b981' }
                ]
            },
            options: { responsive: true, plugins: { title: { display: true, text: 'Client Revenue' } } }
        });
    }

    renderProfitChart(income, expenses, canvas) {
        if (typeof Chart === 'undefined') { canvas.style.display = 'none'; return; }
        const months = {};
        income.forEach(i => { const m = (i.income_date || '').substring(0, 7); if (m) { months[m] = months[m] || { i: 0, e: 0 }; months[m].i += i.amount || 0; }});
        expenses.forEach(e => { const m = (e.expense_date || '').substring(0, 7); if (m) { months[m] = months[m] || { i: 0, e: 0 }; months[m].e += e.amount || 0; }});
        const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
        if (!sorted.length) { canvas.style.display = 'none'; return; }
        canvas.style.display = 'block';
        if (this.chart) this.chart.destroy();
        this.chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: sorted.map(([m]) => m),
                datasets: [
                    { label: 'Income', data: sorted.map(([, d]) => d.i), borderColor: '#10b981', fill: false },
                    { label: 'Expenses', data: sorted.map(([, d]) => d.e), borderColor: '#ef4444', fill: false },
                    { label: 'Profit', data: sorted.map(([, d]) => d.i - d.e), borderColor: '#3b82f6', fill: true, backgroundColor: 'rgba(59,130,246,0.1)' }
                ]
            },
            options: { responsive: true, plugins: { title: { display: true, text: 'Profit Trend' } } }
        });
    }
}
