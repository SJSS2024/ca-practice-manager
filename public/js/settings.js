// Settings & Customization Page
let settingsPage;

const CATEGORY_LABELS = {
    'business_type': { name: 'Business Types', icon: 'fa-building', desc: 'Client business/entity types' },
    'service_category': { name: 'Service Categories', icon: 'fa-tags', desc: 'Categories for services offered' },
    'expense_category': { name: 'Expense Categories', icon: 'fa-receipt', desc: 'Categories for expense tracking' },
    'income_category': { name: 'Income Categories', icon: 'fa-coins', desc: 'Categories for income tracking' },
    'payment_method': { name: 'Payment Methods', icon: 'fa-credit-card', desc: 'Payment modes accepted' },
    'task_priority': { name: 'Task Priorities', icon: 'fa-flag', desc: 'Priority levels for tasks' },
    'followup_type': { name: 'Follow-up Types', icon: 'fa-phone', desc: 'Types of client follow-ups' },
    'document_service_type': { name: 'Document Service Types', icon: 'fa-file-alt', desc: 'Service types for document checklists' },
    'gst_rate': { name: 'GST Rates', icon: 'fa-percent', desc: 'Available GST tax rates' }
};

class SettingsPage {
    constructor() {
        this.options = {};
        this.activeCategory = null;
        settingsPage = this;
    }

    async render() {
        const pageContent = document.getElementById('pageContent');
        try {
            this.options = await api.getDropdownOptions();
            const categories = Object.keys(CATEGORY_LABELS);
            if (!this.activeCategory) this.activeCategory = categories[0];

            pageContent.innerHTML = `
                <div class="ie-header">
                    <h2><i class="fas fa-cog"></i> Settings & Customization</h2>
                    <p style="color:#64748b;margin-top:4px">Manage dropdown lists used across the application</p>
                </div>
                <div class="settings-layout">
                    <div class="settings-sidebar">
                        ${categories.map(cat => {
                            const info = CATEGORY_LABELS[cat];
                            const count = (this.options[cat] || []).length;
                            return `<div class="settings-cat-item ${this.activeCategory === cat ? 'active' : ''}" onclick="settingsPage.selectCategory('${cat}')">
                                <i class="fas ${info.icon}"></i>
                                <div class="cat-info">
                                    <span class="cat-name">${info.name}</span>
                                    <span class="cat-count">${count} items</span>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="settings-content">
                        <div id="settingsContent">${this.renderCategoryContent()}</div>
                    </div>
                </div>
                <style>
                    .settings-layout { display: flex; gap: 24px; margin-top: 20px; min-height: 500px; }
                    .settings-sidebar { width: 280px; flex-shrink: 0; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
                    .settings-cat-item { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: all 0.2s; }
                    .settings-cat-item:hover { background: #f8fafc; }
                    .settings-cat-item.active { background: #eff6ff; border-left: 3px solid #3b82f6; }
                    .settings-cat-item i { font-size: 16px; color: #64748b; width: 20px; text-align: center; }
                    .settings-cat-item.active i { color: #3b82f6; }
                    .cat-info { display: flex; flex-direction: column; }
                    .cat-name { font-weight: 500; font-size: 14px; color: #1e293b; }
                    .cat-count { font-size: 12px; color: #94a3b8; }
                    .settings-content { flex: 1; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 24px; }
                    .cat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; }
                    .cat-header h3 { font-size: 18px; margin: 0; }
                    .cat-header p { color: #64748b; font-size: 13px; margin: 4px 0 0 0; }
                    .option-list { list-style: none; padding: 0; margin: 0; }
                    .option-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid #f1f5f9; border-radius: 8px; margin-bottom: 8px; transition: all 0.2s; }
                    .option-item:hover { border-color: #e2e8f0; background: #fafbfc; }
                    .option-label { font-weight: 500; font-size: 14px; color: #1e293b; }
                    .option-value { font-size: 12px; color: #94a3b8; margin-left: 8px; }
                    .option-actions { display: flex; gap: 8px; }
                    .option-actions button { background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 6px; font-size: 14px; transition: all 0.2s; }
                    .option-actions .edit-btn { color: #3b82f6; }
                    .option-actions .edit-btn:hover { background: #eff6ff; }
                    .option-actions .delete-btn { color: #ef4444; }
                    .option-actions .delete-btn:hover { background: #fef2f2; }
                    .add-option-form { display: flex; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
                    .add-option-form input { flex: 1; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; }
                    .add-option-form input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
                    .add-option-form button { white-space: nowrap; }
                    .edit-inline { display: flex; gap: 8px; align-items: center; flex: 1; }
                    .edit-inline input { padding: 6px 10px; border: 1px solid #3b82f6; border-radius: 6px; font-size: 14px; flex: 1; }
                    .drag-handle { cursor: grab; color: #cbd5e1; margin-right: 8px; }
                    @media (max-width: 768px) {
                        .settings-layout { flex-direction: column; }
                        .settings-sidebar { width: 100%; display: flex; overflow-x: auto; }
                        .settings-cat-item { flex-shrink: 0; border-bottom: none; border-right: 1px solid #f1f5f9; }
                    }
                </style>
            `;
        } catch (error) {
            pageContent.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        }
    }

    selectCategory(cat) {
        this.activeCategory = cat;
        document.querySelectorAll('.settings-cat-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`.settings-cat-item[onclick*="${cat}"]`)?.classList.add('active');
        document.getElementById('settingsContent').innerHTML = this.renderCategoryContent();
    }

    renderCategoryContent() {
        const cat = this.activeCategory;
        const info = CATEGORY_LABELS[cat] || { name: cat, icon: 'fa-list', desc: '' };
        const items = this.options[cat] || [];

        return `
            <div class="cat-header">
                <div>
                    <h3><i class="fas ${info.icon}" style="margin-right:8px;color:#3b82f6"></i>${info.name}</h3>
                    <p>${info.desc}</p>
                </div>
                <span class="badge badge-primary">${items.length} items</span>
            </div>
            <ul class="option-list">
                ${items.map(item => `
                    <li class="option-item" id="option-${item.id}">
                        <div>
                            <span class="drag-handle"><i class="fas fa-grip-vertical"></i></span>
                            <span class="option-label">${item.label}</span>
                            ${item.value !== item.label ? `<span class="option-value">(${item.value})</span>` : ''}
                        </div>
                        <div class="option-actions">
                            <button class="edit-btn" onclick="settingsPage.editOption(${item.id}, '${item.label.replace(/'/g, "\\'")}', '${(item.value || '').replace(/'/g, "\\'")}')" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                            <button class="delete-btn" onclick="settingsPage.deleteOption(${item.id})" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </li>
                `).join('')}
                ${items.length === 0 ? '<li style="text-align:center;padding:30px;color:#94a3b8"><i class="fas fa-inbox" style="font-size:24px;margin-bottom:8px;display:block"></i>No options yet. Add one below.</li>' : ''}
            </ul>
            <div class="add-option-form">
                <input type="text" id="newOptionLabel" placeholder="Enter new ${info.name.toLowerCase().replace(/s$/, '')} name..." onkeydown="if(event.key==='Enter')settingsPage.addOption()">
                <button class="btn btn-primary" onclick="settingsPage.addOption()"><i class="fas fa-plus"></i> Add</button>
            </div>
        `;
    }

    async addOption() {
        const input = document.getElementById('newOptionLabel');
        const label = input.value.trim();
        if (!label) { showToast('Enter a name', 'error'); return; }
        try {
            await api.createDropdownOption({ category: this.activeCategory, label, value: label });
            showToast('Option added!', 'success');
            this.options = await api.getDropdownOptions();
            document.getElementById('settingsContent').innerHTML = this.renderCategoryContent();
        } catch (err) { showToast(err.message, 'error'); }
    }

    editOption(id, currentLabel, currentValue) {
        const li = document.getElementById(`option-${id}`);
        if (!li) return;
        li.innerHTML = `
            <div class="edit-inline">
                <input type="text" id="editLabel-${id}" value="${currentLabel}" placeholder="Label">
                <input type="text" id="editValue-${id}" value="${currentValue}" placeholder="Value (optional)">
                <button class="btn btn-primary btn-sm" onclick="settingsPage.saveOption(${id})"><i class="fas fa-check"></i></button>
                <button class="btn btn-outline btn-sm" onclick="settingsPage.cancelEdit()"><i class="fas fa-times"></i></button>
            </div>
        `;
        document.getElementById(`editLabel-${id}`).focus();
    }

    async saveOption(id) {
        const label = document.getElementById(`editLabel-${id}`).value.trim();
        const value = document.getElementById(`editValue-${id}`).value.trim() || label;
        if (!label) { showToast('Label cannot be empty', 'error'); return; }
        try {
            await api.updateDropdownOption(id, { label, value });
            showToast('Updated!', 'success');
            this.options = await api.getDropdownOptions();
            document.getElementById('settingsContent').innerHTML = this.renderCategoryContent();
        } catch (err) { showToast(err.message, 'error'); }
    }

    cancelEdit() {
        document.getElementById('settingsContent').innerHTML = this.renderCategoryContent();
    }

    async deleteOption(id) {
        if (!confirm('Delete this option?')) return;
        try {
            await api.deleteDropdownOption(id);
            showToast('Deleted', 'success');
            this.options = await api.getDropdownOptions();
            document.getElementById('settingsContent').innerHTML = this.renderCategoryContent();
        } catch (err) { showToast(err.message, 'error'); }
    }
}
