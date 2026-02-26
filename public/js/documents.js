// Document Checklists Page
let documentsPage;

class DocumentsPage {
    constructor() {
        this.templates = [];
        documentsPage = this;
    }

    async render() {
        const pageContent = document.getElementById('pageContent');
        try {
            this.templates = await api.getDocumentTemplates();
            pageContent.innerHTML = `
                <div class="ie-header">
                    <h2>Document Checklists</h2>
                    <div class="header-actions">
                        <button class="btn btn-primary" onclick="documentsPage.showAddTemplate()"><i class="fas fa-plus"></i> Add Template</button>
                    </div>
                </div>
                <div class="templates-grid">${this.templates.length ? this.templates.map(t => this.renderTemplateCard(t)).join('') : '<div class="empty-state"><i class="fas fa-file-alt"></i><p>No document templates yet. Create one to get started.</p></div>'}</div>
            `;
        } catch (error) {
            pageContent.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        }
    }

    renderTemplateCard(t) {
        const docs = (t.required_documents || '').split('\n').filter(d => d.trim());
        return `<div class="template-card">
            <div class="template-header">
                <h3><i class="fas fa-file-alt"></i> ${t.name}</h3>
                <div class="template-actions">
                    <button class="btn-icon" onclick="documentsPage.copyChecklist(${t.id})" title="Copy"><i class="fas fa-copy"></i></button>
                    <button class="btn-icon" onclick="documentsPage.deleteTemplate(${t.id})" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="template-meta">
                ${t.service_type ? `<span class="badge badge-primary">${t.service_type}</span>` : ''}
                ${t.registration_type ? `<span class="badge badge-secondary">${t.registration_type}</span>` : ''}
            </div>
            ${t.description ? `<p class="template-desc">${t.description}</p>` : ''}
            <div class="checklist">
                <h4>Required Documents (${docs.length})</h4>
                <ul>${docs.map(d => `<li><label><input type="checkbox"> ${d.trim()}</label></li>`).join('')}</ul>
            </div>
        </div>`;
    }

    showAddTemplate() {
        showModal('Add Document Template', `
            <form id="addTemplateForm">
                <div class="form-group"><label>Template Name</label><input type="text" name="name" required placeholder="e.g. GST Registration Documents"></div>
                <div class="form-group"><label>Service Type</label><select name="service_type">
                    <option value="">-- Select --</option>
                    <option>GST</option><option>Income Tax</option><option>TDS</option><option>ROC</option><option>Audit</option><option>Company Registration</option><option>Other</option>
                </select></div>
                <div class="form-group"><label>Registration Type</label><input type="text" name="registration_type" placeholder="e.g. New Registration, Amendment"></div>
                <div class="form-group"><label>Description</label><textarea name="description" rows="2"></textarea></div>
                <div class="form-group"><label>Required Documents (one per line)</label><textarea name="required_documents" rows="8" required placeholder="PAN Card\nAadhaar Card\nBank Statement\nAddress Proof"></textarea></div>
                <button type="submit" class="btn btn-primary" style="width:100%;margin-top:12px">Save Template</button>
            </form>
        `);
        document.getElementById('addTemplateForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            try {
                await api.createDocumentTemplate(Object.fromEntries(fd));
                closeModal();
                showToast('Template created', 'success');
                this.render();
            } catch (err) { showToast(err.message, 'error'); }
        });
    }

    copyChecklist(id) {
        const t = this.templates.find(t => t.id === id);
        if (!t) return;
        const text = `${t.name}\n${'='.repeat(t.name.length)}\n${t.required_documents || 'No documents listed'}`;
        navigator.clipboard.writeText(text).then(() => showToast('Checklist copied!', 'success')).catch(() => showToast('Copy failed', 'error'));
    }

    async deleteTemplate(id) {
        if (!confirm('Delete this template?')) return;
        try { await api.deleteDocumentTemplate(id); showToast('Deleted', 'success'); this.render(); }
        catch (err) { showToast(err.message, 'error'); }
    }
}
