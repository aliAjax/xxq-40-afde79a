const STORAGE_KEY = 'document_registry_data';
const TEMPLATE_STORAGE_KEY = 'document_templates';
const DEPARTMENT_LIST = ['办公室', '综合科', '业务一科', '业务二科', '法制科', '财务科', '人事科', '信息科'];
let currentView = 'list';
let currentTab = 'pending';
let searchKeyword = '';
let advancedFilter = {
    department: '',
    urgency: '',
    receiveDateStart: '',
    receiveDateEnd: '',
    deadlineStart: '',
    deadlineEnd: ''
};
let filterCollapsed = false;
let selectedIds = [];
let currentBatchAction = null;

function getDocuments() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const documents = JSON.parse(data);
    return documents.map(function(doc) {
        if (!doc.processingRecords) {
            doc.processingRecords = [];
        }
        return doc;
    });
}

function saveDocuments(documents) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
}

function getTemplates() {
    const data = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveTemplates(templates) {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function renderTemplateSelect() {
    const templates = getTemplates();
    const selectEl = document.getElementById('templateSelect');
    const deleteBtn = document.getElementById('deleteTemplateBtn');
    
    let html = '<option value="">选择模板快速填充...</option>';
    templates.forEach(function(tpl) {
        html += `<option value="${tpl.id}">${escapeHtml(tpl.name)}</option>`;
    });
    selectEl.innerHTML = html;
    
    if (templates.length === 0) {
        deleteBtn.style.display = 'none';
    }
}

function applyTemplate(templateId) {
    const deleteBtn = document.getElementById('deleteTemplateBtn');
    if (!templateId) {
        deleteBtn.style.display = 'none';
        return;
    }
    
    const templates = getTemplates();
    const tpl = templates.find(function(t) { return t.id === templateId; });
    if (!tpl) return;
    
    document.getElementById('fromUnit').value = tpl.fromUnit || '';
    document.getElementById('urgency').value = tpl.urgency || '普通';
    document.getElementById('department').value = tpl.department || '';
    document.getElementById('remark').value = tpl.remark || '';
    
    if (tpl.deadlineDays && tpl.deadlineDays > 0) {
        const receiveDate = document.getElementById('receiveDate').value;
        if (receiveDate) {
            const deadline = new Date(receiveDate);
            deadline.setDate(deadline.getDate() + parseInt(tpl.deadlineDays));
            document.getElementById('deadline').value = formatDateInput(deadline);
        }
    }
    
    deleteBtn.style.display = 'inline-flex';
    showToast('已应用模板：' + tpl.name, 'info');
}

function openSaveTemplateModal() {
    const fromUnit = document.getElementById('fromUnit').value.trim();
    const urgency = document.getElementById('urgency').value;
    const department = document.getElementById('department').value;
    const deadline = document.getElementById('deadline').value;
    const receiveDate = document.getElementById('receiveDate').value;
    const remark = document.getElementById('remark').value.trim();
    
    if (!fromUnit || !department) {
        showToast('请至少填写来文单位和承办科室后再保存模板', 'error');
        return;
    }
    
    document.getElementById('templateName').value = '';
    document.getElementById('previewFromUnit').textContent = fromUnit || '-';
    document.getElementById('previewUrgency').textContent = urgency || '-';
    document.getElementById('previewDepartment').textContent = department || '-';
    
    let deadlineText = '-';
    if (deadline && receiveDate) {
        const days = Math.ceil((new Date(deadline) - new Date(receiveDate)) / (1000 * 60 * 60 * 24));
        if (days >= 0) {
            deadlineText = days + ' 天';
        }
    }
    document.getElementById('previewDeadline').textContent = deadlineText;
    document.getElementById('previewRemark').textContent = remark ? remark.substring(0, 30) + (remark.length > 30 ? '...' : '') : '-';
    
    document.getElementById('saveTemplateModal').classList.add('show');
    setTimeout(function() {
        document.getElementById('templateName').focus();
    }, 100);
}

function closeSaveTemplateModal() {
    document.getElementById('saveTemplateModal').classList.remove('show');
}

function saveTemplate(e) {
    e.preventDefault();
    
    const name = document.getElementById('templateName').value.trim();
    if (!name) {
        showToast('请输入模板名称', 'error');
        return;
    }
    
    const fromUnit = document.getElementById('fromUnit').value.trim();
    const urgency = document.getElementById('urgency').value;
    const department = document.getElementById('department').value;
    const deadline = document.getElementById('deadline').value;
    const receiveDate = document.getElementById('receiveDate').value;
    const remark = document.getElementById('remark').value.trim();
    
    let deadlineDays = 7;
    if (deadline && receiveDate) {
        deadlineDays = Math.ceil((new Date(deadline) - new Date(receiveDate)) / (1000 * 60 * 60 * 24));
        if (deadlineDays < 0) deadlineDays = 7;
    }
    
    const templates = getTemplates();
    const newTemplate = {
        id: generateId(),
        name: name,
        fromUnit: fromUnit,
        urgency: urgency,
        department: department,
        deadlineDays: deadlineDays,
        remark: remark,
        createdAt: new Date().toISOString()
    };
    
    templates.unshift(newTemplate);
    saveTemplates(templates);
    renderTemplateSelect();
    
    closeSaveTemplateModal();
    showToast('模板保存成功', 'success');
}

function deleteCurrentTemplate() {
    const selectEl = document.getElementById('templateSelect');
    const templateId = selectEl.value;
    if (!templateId) {
        showToast('请先选择要删除的模板', 'error');
        return;
    }
    
    const templates = getTemplates();
    const tpl = templates.find(function(t) { return t.id === templateId; });
    if (!tpl) return;
    
    if (!confirm('确定要删除模板「' + tpl.name + '」吗？此操作不可恢复。')) {
        return;
    }
    
    const filtered = templates.filter(function(t) { return t.id !== templateId; });
    saveTemplates(filtered);
    renderTemplateSelect();
    document.getElementById('deleteTemplateBtn').style.display = 'none';
    
    showToast('模板已删除', 'success');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getLatestRecord(doc) {
    if (!doc.processingRecords || doc.processingRecords.length === 0) {
        return null;
    }
    const sorted = doc.processingRecords.slice().sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return sorted[0];
}

function renderLatestRecordSummary(doc) {
    const latest = getLatestRecord(doc);
    if (!latest && !doc.completedRemark) {
        return '';
    }
    let content = '';
    let time = '';
    let handler = '';
    let typeLabel = '';
    if (latest) {
        content = latest.content;
        time = formatDateTime(latest.createdAt);
        handler = latest.handler || '';
        typeLabel = latest.type === 'completion' ? '办结' : '进展';
    } else if (doc.completedRemark) {
        content = doc.completedRemark;
        time = formatDateTime(doc.completedAt);
        typeLabel = '办结';
    }
    const summary = content.length > 40 ? content.substring(0, 40) + '...' : content;
    const handlerText = handler ? ' · ' + escapeHtml(handler) : '';
    return `
        <div class="doc-latest-record">
            <span class="latest-record-icon">📝</span>
            <span class="latest-record-type">${typeLabel}</span>
            <span class="latest-record-content">${escapeHtml(summary)}</span>
            <span class="latest-record-meta">${time}${handlerText}</span>
        </div>
    `;
}

function renderProcessingRecords(doc) {
    const records = doc.processingRecords || [];
    if (records.length === 0 && !doc.completedRemark) {
        return '<div class="records-empty">暂无办理记录</div>';
    }
    const sortedRecords = records.slice().sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    let html = '<div class="processing-records">';
    sortedRecords.forEach(function(record, index) {
        const isLast = index === sortedRecords.length - 1;
        const typeClass = record.type === 'completion' ? 'record-completion' : 'record-progress';
        const typeText = record.type === 'completion' ? '办结' : '进展';
        const typeIcon = record.type === 'completion' ? '✅' : '📋';
        html += `
            <div class="record-item ${typeClass} ${isLast ? 'record-last' : ''}">
                <div class="record-timeline">
                    <div class="record-dot">${typeIcon}</div>
                    <div class="record-line"></div>
                </div>
                <div class="record-content">
                    <div class="record-header">
                        <span class="record-type-tag">${typeText}</span>
                        <span class="record-time">${formatDateTime(record.createdAt)}</span>
                    </div>
                    <div class="record-text">${escapeHtml(record.content)}</div>
                    ${record.handler ? `<div class="record-handler">处理人：${escapeHtml(record.handler)}</div>` : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

function getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function getDaysRemaining(deadline) {
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const today = getToday();
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function getDocumentStatus(doc) {
    if (doc.completed) {
        return 'done';
    }
    const daysRemaining = getDaysRemaining(doc.deadline);
    if (daysRemaining < 0) {
        return 'overdue';
    }
    if (daysRemaining <= 3) {
        return 'urgent';
    }
    return 'pending';
}

function getStatusText(status) {
    const statusMap = {
        'pending': '待办理',
        'urgent': '即将到期',
        'overdue': '已逾期',
        'done': '已办结'
    };
    return statusMap[status] || '待办理';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const iconMap = {
        'success': '✓',
        'error': '✕',
        'info': 'ℹ'
    };
    toast.innerHTML = `<span>${iconMap[type] || 'ℹ'}</span>${message}`;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = `toast ${type}`;
    }, 2500);
}

function updateStats() {
    const documents = getDocuments();
    let pendingCount = 0;
    let urgentCount = 0;
    let doneCount = 0;

    documents.forEach(doc => {
        const status = getDocumentStatus(doc);
        if (status === 'done') {
            doneCount++;
        } else if (status === 'urgent' || status === 'overdue') {
            urgentCount++;
            pendingCount++;
        } else {
            pendingCount++;
        }
    });

    document.getElementById('pendingCount').textContent = pendingCount;
    document.getElementById('urgentCount').textContent = urgentCount;
    document.getElementById('doneCount').textContent = doneCount;
    document.getElementById('totalCount').textContent = documents.length;

    document.getElementById('tabPendingBadge').textContent = pendingCount;
    document.getElementById('tabUrgentBadge').textContent = urgentCount;
    document.getElementById('tabDoneBadge').textContent = doneCount;

    if (currentView === 'board') {
        renderDepartmentBoard();
    }
}

function getDepartmentStats() {
    const documents = getDocuments();
    const stats = {};

    DEPARTMENT_LIST.forEach(dept => {
        stats[dept] = {
            pending: 0,
            urgent: 0,
            overdue: 0,
            done: 0,
            total: 0
        };
    });

    documents.forEach(doc => {
        const dept = doc.department;
        if (!stats[dept]) {
            stats[dept] = {
                pending: 0,
                urgent: 0,
                overdue: 0,
                done: 0,
                total: 0
            };
        }
        const status = getDocumentStatus(doc);
        stats[dept].total++;
        if (status === 'done') {
            stats[dept].done++;
        } else if (status === 'overdue') {
            stats[dept].overdue++;
            stats[dept].pending++;
        } else if (status === 'urgent') {
            stats[dept].urgent++;
            stats[dept].pending++;
        } else {
            stats[dept].pending++;
        }
    });

    return stats;
}

function renderDepartmentBoard() {
    const stats = getDepartmentStats();
    const boardCards = document.getElementById('boardCards');

    const departments = DEPARTMENT_LIST.filter(dept => stats[dept] && stats[dept].total > 0);
    const emptyDepts = DEPARTMENT_LIST.filter(dept => !stats[dept] || stats[dept].total === 0);
    const allDepts = departments.concat(emptyDepts);

    if (allDepts.length === 0) {
        boardCards.innerHTML = `
            <div class="board-empty">
                <div class="board-empty-icon">📊</div>
                <p class="board-empty-text">暂无科室数据</p>
            </div>
        `;
        return;
    }

    boardCards.innerHTML = allDepts.map(dept => {
        const s = stats[dept] || { pending: 0, urgent: 0, overdue: 0, done: 0, total: 0 };
        const hasData = s.total > 0;
        return `
            <div class="board-card ${hasData ? '' : 'board-card-empty'}" onclick="${hasData ? `viewDepartmentDocuments('${dept}')` : ''}">
                <div class="board-card-header">
                    <div class="board-dept-name">${escapeHtml(dept)}</div>
                    <div class="board-dept-total">
                        <span class="board-total-number">${s.total}</span>
                        <span class="board-total-label">件</span>
                    </div>
                </div>
                <div class="board-card-stats">
                    <div class="board-stat-item pending">
                        <div class="board-stat-number">${s.pending}</div>
                        <div class="board-stat-label">待办理</div>
                    </div>
                    <div class="board-stat-item urgent">
                        <div class="board-stat-number">${s.urgent}</div>
                        <div class="board-stat-label">即将到期</div>
                    </div>
                    <div class="board-stat-item overdue">
                        <div class="board-stat-number">${s.overdue}</div>
                        <div class="board-stat-label">已逾期</div>
                    </div>
                    <div class="board-stat-item done">
                        <div class="board-stat-number">${s.done}</div>
                        <div class="board-stat-label">已办结</div>
                    </div>
                </div>
                <div class="board-card-progress">
                    <div class="board-progress-bar">
                        <div class="board-progress-fill done" style="width: ${s.total > 0 ? (s.done / s.total * 100) : 0}%"></div>
                    </div>
                    <div class="board-progress-text">办结率 ${s.total > 0 ? Math.round(s.done / s.total * 100) : 0}%</div>
                </div>
                ${hasData ? '<div class="board-card-action">查看详情 →</div>' : '<div class="board-card-empty-tip">暂无收文</div>'}
            </div>
        `;
    }).join('');
}

function switchView(view) {
    currentView = view;

    document.querySelectorAll('.view-tab').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelector(`.view-tab[data-view="${view}"]`).classList.add('active');

    const listTabs = document.getElementById('listTabs');
    const batchToolbar = document.getElementById('batchToolbar');
    const departmentBoard = document.getElementById('departmentBoard');
    const content = document.querySelector('.content');

    if (view === 'board') {
        listTabs.style.display = 'none';
        batchToolbar.style.display = 'none';
        content.style.display = 'none';
        departmentBoard.style.display = 'block';
        renderDepartmentBoard();
    } else {
        listTabs.style.display = 'flex';
        content.style.display = 'block';
        departmentBoard.style.display = 'none';
        updateBatchToolbar();
        renderDocumentList();
    }
}

function viewDepartmentDocuments(dept) {
    advancedFilter.department = dept;
    document.getElementById('filterDepartment').value = dept;
    updateFilterActiveBadge();
    switchView('list');
    switchTab('all');
    selectedIds = [];
}

function filterDocuments(documents, tab, keyword, filter) {
    let filtered = documents;

    if (tab === 'pending') {
        filtered = filtered.filter(doc => {
            const status = getDocumentStatus(doc);
            return status !== 'done';
        });
    } else if (tab === 'urgent') {
        filtered = filtered.filter(doc => {
            const status = getDocumentStatus(doc);
            return status === 'urgent' || status === 'overdue';
        });
    } else if (tab === 'done') {
        filtered = filtered.filter(doc => doc.completed);
    }

    if (keyword) {
        const kw = keyword.toLowerCase();
        filtered = filtered.filter(doc =>
            doc.title.toLowerCase().includes(kw) ||
            doc.fromUnit.toLowerCase().includes(kw) ||
            doc.department.toLowerCase().includes(kw) ||
            doc.docNumber.toLowerCase().includes(kw)
        );
    }

    if (filter.department) {
        filtered = filtered.filter(doc => doc.department === filter.department);
    }

    if (filter.urgency) {
        filtered = filtered.filter(doc => doc.urgency === filter.urgency);
    }

    if (filter.receiveDateStart) {
        filtered = filtered.filter(doc => doc.receiveDate >= filter.receiveDateStart);
    }

    if (filter.receiveDateEnd) {
        filtered = filtered.filter(doc => doc.receiveDate <= filter.receiveDateEnd);
    }

    if (filter.deadlineStart) {
        filtered = filtered.filter(doc => doc.deadline >= filter.deadlineStart);
    }

    if (filter.deadlineEnd) {
        filtered = filtered.filter(doc => doc.deadline <= filter.deadlineEnd);
    }

    filtered.sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        return new Date(b.receiveDate) - new Date(a.receiveDate);
    });

    return filtered;
}

function hasAdvancedFilter() {
    return advancedFilter.department ||
        advancedFilter.urgency ||
        advancedFilter.receiveDateStart ||
        advancedFilter.receiveDateEnd ||
        advancedFilter.deadlineStart ||
        advancedFilter.deadlineEnd;
}

function renderDocumentList() {
    const documents = getDocuments();
    const filtered = filterDocuments(documents, currentTab, searchKeyword, advancedFilter);
    const listEl = document.getElementById('documentList');

    if (filtered.length === 0) {
        const hasFilter = searchKeyword || hasAdvancedFilter();
        let emptyText = '暂无收文记录';
        let showAddButton = true;

        if (hasFilter) {
            emptyText = '未找到匹配的收文记录，请调整筛选条件';
            showAddButton = false;
        } else if (currentTab === 'pending') {
            emptyText = '暂无待办理的收文';
        } else if (currentTab === 'urgent') {
            emptyText = '暂无即将到期的收文';
        } else if (currentTab === 'done') {
            emptyText = '暂无已办结的收文';
            showAddButton = false;
        }

        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${hasFilter ? '🔍' : '📂'}</div>
                <p class="empty-text">${emptyText}</p>
                ${showAddButton ? '<button class="btn btn-primary" onclick="openAddModal()">新增收文</button>' : ''}
            </div>
        `;
        updateBatchToolbar();
        return;
    }

    listEl.innerHTML = filtered.map(doc => {
        const status = getDocumentStatus(doc);
        const statusText = getStatusText(status);
        const daysRemaining = getDaysRemaining(doc.deadline);
        const isSelected = selectedIds.includes(doc.id);

        let deadlineClass = '';
        let deadlineText = formatDate(doc.deadline);
        if (!doc.completed) {
            if (daysRemaining < 0) {
                deadlineClass = 'deadline-overdue';
                deadlineText = `${formatDate(doc.deadline)}（已逾期${Math.abs(daysRemaining)}天）`;
            } else if (daysRemaining <= 3) {
                deadlineClass = 'deadline-urgent';
                deadlineText = `${formatDate(doc.deadline)}（剩余${daysRemaining}天）`;
            }
        }

        const actions = !doc.completed ? `
            <button class="action-btn view" onclick="viewDocument('${doc.id}')">查看</button>
            <button class="action-btn edit" onclick="editDocument('${doc.id}')">编辑</button>
            <button class="action-btn complete" onclick="completeDocument('${doc.id}')">办结</button>
            <button class="action-btn delete" onclick="deleteDocument('${doc.id}')">删除</button>
        ` : `
            <button class="action-btn view" onclick="viewDocument('${doc.id}')">查看</button>
            <button class="action-btn delete" onclick="deleteDocument('${doc.id}')">删除</button>
        `;

        return `
            <div class="document-card status-${status} ${isSelected ? 'selected' : ''}" onclick="viewDocument('${doc.id}')">
                <div class="doc-card-checkbox" onclick="event.stopPropagation(); toggleSelect('${doc.id}')">
                    <span class="card-checkbox ${isSelected ? 'checked' : ''}">${isSelected ? '✓' : ''}</span>
                </div>
                <div class="doc-header">
                    <div class="doc-title">${escapeHtml(doc.title)}</div>
                    <div class="doc-tags">
                        <span class="doc-tag urgency-${doc.urgency}">${doc.urgency}</span>
                        <span class="doc-tag status-${statusText}">${statusText}</span>
                    </div>
                </div>
                <div class="doc-info">
                    <div class="doc-info-item">
                        <span class="doc-info-label">来文单位</span>
                        <span class="doc-info-value">${escapeHtml(doc.fromUnit)}</span>
                    </div>
                    <div class="doc-info-item">
                        <span class="doc-info-label">文号</span>
                        <span class="doc-info-value">${escapeHtml(doc.docNumber)}</span>
                    </div>
                    <div class="doc-info-item">
                        <span class="doc-info-label">承办科室</span>
                        <span class="doc-info-value">${escapeHtml(doc.department)}</span>
                    </div>
                    <div class="doc-info-item">
                        <span class="doc-info-label">办理期限</span>
                        <span class="doc-info-value ${deadlineClass}">${deadlineText}</span>
                    </div>
                </div>
                ${renderLatestRecordSummary(doc)}
                <div class="doc-actions" onclick="event.stopPropagation()">
                    ${actions}
                </div>
            </div>
        `;
    }).join('');

    updateBatchToolbar();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleSelect(id) {
    const index = selectedIds.indexOf(id);
    if (index > -1) {
        selectedIds.splice(index, 1);
    } else {
        selectedIds.push(id);
    }
    renderDocumentList();
}

function toggleSelectAll() {
    const documents = getDocuments();
    const filtered = filterDocuments(documents, currentTab, searchKeyword, advancedFilter);

    if (selectedIds.length === filtered.length && filtered.length > 0) {
        selectedIds = [];
    } else {
        selectedIds = filtered.map(doc => doc.id);
    }
    renderDocumentList();
}

function clearSelection() {
    selectedIds = [];
    renderDocumentList();
}

function updateBatchToolbar() {
    const documents = getDocuments();
    const validIds = documents.map(d => d.id);
    selectedIds = selectedIds.filter(id => validIds.includes(id));

    const toolbar = document.getElementById('batchToolbar');
    const countEl = document.getElementById('selectedCount');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const batchCompleteBtn = document.getElementById('batchCompleteBtn');

    if (selectedIds.length > 0) {
        toolbar.style.display = 'flex';
        countEl.textContent = selectedIds.length;
    } else {
        toolbar.style.display = 'none';
    }

    const filtered = filterDocuments(documents, currentTab, searchKeyword, advancedFilter);
    selectAllCheckbox.checked = filtered.length > 0 && selectedIds.length === filtered.length;

    const hasUncompleted = selectedIds.some(id => {
        const doc = documents.find(d => d.id === id);
        return doc && !doc.completed;
    });
    batchCompleteBtn.style.display = hasUncompleted ? 'inline-flex' : 'none';
}

function getSelectedDocuments() {
    const documents = getDocuments();
    return documents.filter(doc => selectedIds.includes(doc.id));
}

function buildBatchPreviewList(containerId) {
    const selectedDocs = getSelectedDocuments();
    const container = document.getElementById(containerId);
    container.innerHTML = selectedDocs.map(doc => `
        <div class="batch-preview-item">${escapeHtml(doc.title)}</div>
    `).join('');
}

function openBatchCompleteModal() {
    if (selectedIds.length === 0) return;

    const selectedDocs = getSelectedDocuments();
    const uncompletedDocs = selectedDocs.filter(function(doc) { return !doc.completed; });

    if (uncompletedDocs.length === 0) {
        showToast('所选收文均已办结', 'info');
        return;
    }

    currentBatchAction = 'complete';
    document.getElementById('batchConfirmTitle').textContent = '批量办结确认';
    document.getElementById('batchConfirmMessage').innerHTML =
        '确定要将选中的 <span>' + uncompletedDocs.length + '</span> 条收文标记为已办结吗？';
    document.getElementById('batchConfirmBtn').className = 'btn btn-success';

    document.getElementById('batchCompleteFields').style.display = 'block';
    document.getElementById('batchCompleteRemark').value = '';
    document.getElementById('batchCompleteHandler').value = '';

    buildBatchPreviewList('batchPreviewList');
    document.getElementById('batchConfirmModal').classList.add('show');
}

function openBatchDeleteModal() {
    if (selectedIds.length === 0) return;

    currentBatchAction = 'delete';
    document.getElementById('batchConfirmTitle').textContent = '批量删除确认';
    document.getElementById('batchConfirmMessage').innerHTML =
        '确定要删除选中的 <span>' + selectedIds.length + '</span> 条收文吗？此操作不可恢复。';
    document.getElementById('batchConfirmBtn').className = 'btn btn-danger';

    document.getElementById('batchCompleteFields').style.display = 'none';

    buildBatchPreviewList('batchPreviewList');
    document.getElementById('batchConfirmModal').classList.add('show');
}

function closeBatchConfirmModal() {
    document.getElementById('batchConfirmModal').classList.remove('show');
    currentBatchAction = null;
}

function executeBatchAction(e) {
    if (e) {
        e.preventDefault();
    }
    if (!currentBatchAction) return;

    const documents = getDocuments();

    if (currentBatchAction === 'complete') {
        const batchRemark = document.getElementById('batchCompleteRemark') ?
            document.getElementById('batchCompleteRemark').value.trim() : '';
        const batchHandler = document.getElementById('batchCompleteHandler') ?
            document.getElementById('batchCompleteHandler').value.trim() : '';

        let count = 0;
        const now = new Date().toISOString();
        const updatedDocs = documents.map(function(doc) {
            if (selectedIds.includes(doc.id) && !doc.completed) {
                count++;
                const completionRecord = {
                    id: generateId(),
                    type: 'completion',
                    content: batchRemark || '批量办结',
                    handler: batchHandler || '',
                    createdAt: now
                };
                const records = doc.processingRecords || [];
                records.push(completionRecord);
                return {
                    ...doc,
                    completed: true,
                    completedAt: now,
                    completedRemark: batchRemark || '批量办结',
                    processingRecords: records
                };
            }
            return doc;
        });
        saveDocuments(updatedDocs);
        showToast('成功办结 ' + count + ' 条收文', 'success');
    } else if (currentBatchAction === 'delete') {
        const count = selectedIds.length;
        const filtered = documents.filter(function(doc) { return !selectedIds.includes(doc.id); });
        saveDocuments(filtered);
        showToast('成功删除 ' + count + ' 条收文', 'success');
    }

    selectedIds = [];
    closeBatchConfirmModal();
    updateStats();
    renderDocumentList();
}

function openBatchDepartmentModal() {
    if (selectedIds.length === 0) return;

    document.getElementById('batchDeptCount').textContent = selectedIds.length;
    document.getElementById('batchDepartmentSelect').value = '';
    buildBatchPreviewList('batchDeptPreviewList');
    document.getElementById('batchDepartmentModal').classList.add('show');
}

function closeBatchDepartmentModal() {
    document.getElementById('batchDepartmentModal').classList.remove('show');
}

function executeBatchDepartment(e) {
    e.preventDefault();

    const newDepartment = document.getElementById('batchDepartmentSelect').value;
    if (!newDepartment) {
        showToast('请选择承办科室', 'error');
        return;
    }

    const documents = getDocuments();
    const count = selectedIds.length;
    const updatedDocs = documents.map(doc => {
        if (selectedIds.includes(doc.id)) {
            return { ...doc, department: newDepartment };
        }
        return doc;
    });

    saveDocuments(updatedDocs);
    showToast(`成功修改 ${count} 条收文的承办科室`, 'success');

    selectedIds = [];
    closeBatchDepartmentModal();
    updateStats();
    renderDocumentList();
}

function switchTab(tab) {
    currentTab = tab;
    selectedIds = [];
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    renderDocumentList();
}

function searchDocuments() {
    searchKeyword = document.getElementById('searchInput').value.trim();
    selectedIds = [];
    renderDocumentList();
}

function toggleAdvancedFilter() {
    filterCollapsed = !filterCollapsed;
    const filterSection = document.querySelector('.filter-section');
    if (filterCollapsed) {
        filterSection.classList.add('collapsed');
    } else {
        filterSection.classList.remove('collapsed');
    }
}

function applyAdvancedFilter() {
    advancedFilter.department = document.getElementById('filterDepartment').value;
    advancedFilter.urgency = document.getElementById('filterUrgency').value;
    advancedFilter.receiveDateStart = document.getElementById('filterReceiveDateStart').value;
    advancedFilter.receiveDateEnd = document.getElementById('filterReceiveDateEnd').value;
    advancedFilter.deadlineStart = document.getElementById('filterDeadlineStart').value;
    advancedFilter.deadlineEnd = document.getElementById('filterDeadlineEnd').value;
    selectedIds = [];
    updateFilterActiveBadge();
    renderDocumentList();
}

function clearAdvancedFilter() {
    advancedFilter = {
        department: '',
        urgency: '',
        receiveDateStart: '',
        receiveDateEnd: '',
        deadlineStart: '',
        deadlineEnd: ''
    };
    document.getElementById('filterDepartment').value = '';
    document.getElementById('filterUrgency').value = '';
    document.getElementById('filterReceiveDateStart').value = '';
    document.getElementById('filterReceiveDateEnd').value = '';
    document.getElementById('filterDeadlineStart').value = '';
    document.getElementById('filterDeadlineEnd').value = '';
    selectedIds = [];
    updateFilterActiveBadge();
    renderDocumentList();
}

function updateFilterActiveBadge() {
    const badge = document.getElementById('filterActiveBadge');
    if (hasAdvancedFilter()) {
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function openAddModal() {
    document.getElementById('modalTitle').textContent = '新增收文';
    document.getElementById('documentId').value = '';
    document.getElementById('documentForm').reset();
    document.getElementById('receiveDate').value = formatDateInput(new Date());

    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 7);
    document.getElementById('deadline').value = formatDateInput(defaultDeadline);

    document.getElementById('templateSection').style.display = 'block';
    renderTemplateSelect();
    document.getElementById('deleteTemplateBtn').style.display = 'none';

    document.getElementById('documentModal').classList.add('show');
}

function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function closeModal() {
    document.getElementById('documentModal').classList.remove('show');
}

function editDocument(id) {
    const documents = getDocuments();
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    document.getElementById('modalTitle').textContent = '编辑收文';
    document.getElementById('documentId').value = doc.id;
    document.getElementById('fromUnit').value = doc.fromUnit;
    document.getElementById('docNumber').value = doc.docNumber;
    document.getElementById('title').value = doc.title;
    document.getElementById('receiveDate').value = doc.receiveDate;
    document.getElementById('urgency').value = doc.urgency;
    document.getElementById('department').value = doc.department;
    document.getElementById('deadline').value = doc.deadline;
    document.getElementById('remark').value = doc.remark || '';

    document.getElementById('templateSection').style.display = 'none';

    document.getElementById('documentModal').classList.add('show');
}

function saveDocument(e) {
    e.preventDefault();

    const id = document.getElementById('documentId').value;
    const docData = {
        fromUnit: document.getElementById('fromUnit').value.trim(),
        docNumber: document.getElementById('docNumber').value.trim(),
        title: document.getElementById('title').value.trim(),
        receiveDate: document.getElementById('receiveDate').value,
        urgency: document.getElementById('urgency').value,
        department: document.getElementById('department').value,
        deadline: document.getElementById('deadline').value,
        remark: document.getElementById('remark').value.trim()
    };

    if (!docData.fromUnit || !docData.docNumber || !docData.title ||
        !docData.receiveDate || !docData.urgency || !docData.department || !docData.deadline) {
        showToast('请填写所有必填项', 'error');
        return;
    }

    const documents = getDocuments();

    if (id) {
        const index = documents.findIndex(d => d.id === id);
        if (index !== -1) {
            documents[index] = { ...documents[index], ...docData };
            showToast('收文更新成功', 'success');
        }
    } else {
        const newDoc = {
            id: generateId(),
            ...docData,
            completed: false,
            completedAt: null,
            completedRemark: '',
            processingRecords: [],
            createdAt: new Date().toISOString()
        };
        documents.unshift(newDoc);
        showToast('收文添加成功', 'success');
    }

    saveDocuments(documents);
    closeModal();
    updateStats();
    renderDocumentList();
}

function completeDocument(id) {
    openCompleteModal(id);
}

function openAddRecordModal(docId) {
    document.getElementById('addRecordDocId').value = docId;
    document.getElementById('recordContent').value = '';
    document.getElementById('recordHandler').value = '';
    document.getElementById('addRecordModal').classList.add('show');
}

function closeAddRecordModal() {
    document.getElementById('addRecordModal').classList.remove('show');
}

function saveProcessingRecord(e) {
    e.preventDefault();
    const docId = document.getElementById('addRecordDocId').value;
    const content = document.getElementById('recordContent').value.trim();
    const handler = document.getElementById('recordHandler').value.trim();

    if (!content) {
        showToast('请输入办理内容', 'error');
        return;
    }

    const documents = getDocuments();
    const index = documents.findIndex(function(d) { return d.id === docId; });
    if (index === -1) {
        showToast('收文不存在', 'error');
        return;
    }

    const doc = documents[index];
    if (!doc.processingRecords) {
        doc.processingRecords = [];
    }

    const newRecord = {
        id: generateId(),
        type: 'progress',
        content: content,
        handler: handler,
        createdAt: new Date().toISOString()
    };

    doc.processingRecords.push(newRecord);
    documents[index] = doc;
    saveDocuments(documents);

    closeAddRecordModal();
    showToast('办理记录已保存', 'success');

    const detailModal = document.getElementById('detailModal');
    if (detailModal.classList.contains('show')) {
        viewDocument(docId);
    }
    renderDocumentList();
}

function openCompleteModal(docId) {
    document.getElementById('completeDocId').value = docId;
    document.getElementById('completeRemark').value = '';
    document.getElementById('completeHandler').value = '';
    document.getElementById('completeModal').classList.add('show');
}

function closeCompleteModal() {
    document.getElementById('completeModal').classList.remove('show');
}

function confirmComplete(e) {
    e.preventDefault();
    const docId = document.getElementById('completeDocId').value;
    const remark = document.getElementById('completeRemark').value.trim();
    const handler = document.getElementById('completeHandler').value.trim();

    if (!remark) {
        showToast('请输入办结说明', 'error');
        return;
    }

    const documents = getDocuments();
    const index = documents.findIndex(function(d) { return d.id === docId; });
    if (index === -1) {
        showToast('收文不存在', 'error');
        return;
    }

    const doc = documents[index];
    if (doc.completed) {
        showToast('该收文已办结', 'info');
        closeCompleteModal();
        return;
    }

    if (!doc.processingRecords) {
        doc.processingRecords = [];
    }

    const completionRecord = {
        id: generateId(),
        type: 'completion',
        content: remark,
        handler: handler,
        createdAt: new Date().toISOString()
    };

    doc.processingRecords.push(completionRecord);
    doc.completed = true;
    doc.completedAt = completionRecord.createdAt;
    doc.completedRemark = remark;

    documents[index] = doc;
    saveDocuments(documents);

    const selIndex = selectedIds.indexOf(docId);
    if (selIndex > -1) {
        selectedIds.splice(selIndex, 1);
    }

    closeCompleteModal();
    closeDetailModal();
    showToast('收文已办结', 'success');
    updateStats();
    renderDocumentList();
}

function deleteDocument(id) {
    if (!confirm('确定要删除该收文吗？此操作不可恢复。')) return;

    const documents = getDocuments();
    const filtered = documents.filter(d => d.id !== id);
    saveDocuments(filtered);

    const selIndex = selectedIds.indexOf(id);
    if (selIndex > -1) {
        selectedIds.splice(selIndex, 1);
    }

    updateStats();
    renderDocumentList();
    showToast('收文已删除', 'success');
}

function viewDocument(id) {
    const documents = getDocuments();
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    const status = getDocumentStatus(doc);
    const statusText = getStatusText(status);
    const daysRemaining = getDaysRemaining(doc.deadline);

    let deadlineText = formatDate(doc.deadline);
    if (!doc.completed) {
        if (daysRemaining < 0) {
            deadlineText = `${formatDate(doc.deadline)}（已逾期${Math.abs(daysRemaining)}天）`;
        } else {
            deadlineText = `${formatDate(doc.deadline)}（剩余${daysRemaining}天）`;
        }
    }

    const detailContent = document.getElementById('detailContent');
    detailContent.innerHTML = `
        <div class="detail-item">
            <span class="detail-label">标题</span>
            <span class="detail-value">${escapeHtml(doc.title)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">来文单位</span>
            <span class="detail-value">${escapeHtml(doc.fromUnit)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">文号</span>
            <span class="detail-value">${escapeHtml(doc.docNumber)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">收文日期</span>
            <span class="detail-value">${formatDate(doc.receiveDate)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">紧急程度</span>
            <span class="detail-value">
                <span class="doc-tag urgency-${doc.urgency}">${doc.urgency}</span>
            </span>
        </div>
        <div class="detail-item">
            <span class="detail-label">承办科室</span>
            <span class="detail-value">${escapeHtml(doc.department)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">办理期限</span>
            <span class="detail-value">${deadlineText}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">状态</span>
            <span class="detail-value">
                <span class="doc-tag status-${statusText}">${statusText}</span>
            </span>
        </div>
        ${doc.completed ? `
        <div class="detail-item">
            <span class="detail-label">办结时间</span>
            <span class="detail-value">${formatDateTime(doc.completedAt)}</span>
        </div>
        ` : ''}
        ${doc.remark ? `
        <div class="detail-item">
            <span class="detail-label">备注</span>
            <span class="detail-value">${escapeHtml(doc.remark)}</span>
        </div>
        ` : ''}
        <div class="detail-section">
            <div class="detail-section-header">
                <span class="detail-section-title">📝 办理记录</span>
                <span class="detail-section-count">共 ${(doc.processingRecords || []).length} 条</span>
            </div>
            ${renderProcessingRecords(doc)}
        </div>
    `;

    const detailActions = document.getElementById('detailActions');
    if (!doc.completed) {
        detailActions.innerHTML = `
            <button class="btn btn-default" onclick="closeDetailModal()">关闭</button>
            <button class="btn btn-danger" onclick="deleteDocument('${doc.id}'); closeDetailModal();">删除</button>
            <button class="btn btn-primary" onclick="editDocument('${doc.id}'); closeDetailModal();">编辑</button>
            <button class="btn btn-info" onclick="openAddRecordModal('${doc.id}')">追加进展</button>
            <button class="btn btn-success" onclick="openCompleteModal('${doc.id}')">标记办结</button>
        `;
    } else {
        detailActions.innerHTML = `
            <button class="btn btn-default" onclick="closeDetailModal()">关闭</button>
            <button class="btn btn-danger" onclick="deleteDocument('${doc.id}'); closeDetailModal();">删除</button>
        `;
    }

    document.getElementById('detailModal').classList.add('show');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('show');
}

let importParsedData = [];
let importValidData = [];
let currentImportTab = 'paste';

function openImportModal() {
    importParsedData = [];
    importValidData = [];
    document.getElementById('importCsvText').value = '';
    document.getElementById('importFileInput').value = '';
    document.getElementById('selectedFileName').style.display = 'none';
    document.getElementById('importPreviewSection').style.display = 'none';
    const confirmBtn = document.getElementById('importConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="btn-icon">✓</span> 确认导入';
    switchImportTab('paste');
    document.getElementById('importModal').classList.add('show');
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('show');
    importParsedData = [];
    importValidData = [];
}

function switchImportTab(tab) {
    currentImportTab = tab;
    document.querySelectorAll('.import-tab').forEach(function(t) {
        t.classList.remove('active');
    });
    document.querySelector('.import-tab[data-import-tab="' + tab + '"]').classList.add('active');

    document.getElementById('importTabPaste').style.display = tab === 'paste' ? 'block' : 'none';
    document.getElementById('importTabFile').style.display = tab === 'file' ? 'block' : 'none';

    document.getElementById('importPreviewSection').style.display = 'none';
    document.getElementById('importConfirmBtn').disabled = true;
    importParsedData = [];
    importValidData = [];
}

function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCsvText() {
    const csvText = document.getElementById('importCsvText').value.trim();
    if (!csvText) {
        showToast('请输入CSV内容', 'error');
        return;
    }
    processCsvData(csvText);
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    processFile(file);
}

function processFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('请选择CSV格式文件', 'error');
        return;
    }

    const fileNameEl = document.getElementById('selectedFileName');
    const fileSizeKb = (file.size / 1024).toFixed(2);
    fileNameEl.textContent = '已选择文件：' + file.name + '（' + fileSizeKb + ' KB）';
    fileNameEl.style.display = 'block';

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        processCsvData(content);
    };
    reader.onerror = function() {
        showToast('文件读取失败', 'error');
    };
    reader.readAsText(file, 'UTF-8');
}

function isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
}

function isValidUrgency(urgency) {
    return ['普通', '加急', '特急'].includes(urgency);
}

function isValidDepartment(dept) {
    const validDepts = ['办公室', '综合科', '业务一科', '业务二科', '法制科', '财务科', '人事科', '信息科'];
    return validDepts.includes(dept);
}

function validateImportRow(row, index, allRows, existingDocs) {
    const errors = [];

    if (!row.fromUnit) {
        errors.push('来文单位不能为空');
    }
    if (!row.docNumber) {
        errors.push('文号不能为空');
    }
    if (!row.title) {
        errors.push('标题不能为空');
    }
    if (!row.receiveDate) {
        errors.push('收文日期不能为空');
    } else if (!isValidDate(row.receiveDate)) {
        errors.push('收文日期格式错误');
    }
    if (!row.urgency) {
        errors.push('紧急程度不能为空');
    } else if (!isValidUrgency(row.urgency)) {
        errors.push('紧急程度无效');
    }
    if (!row.department) {
        errors.push('承办科室不能为空');
    } else if (!isValidDepartment(row.department)) {
        errors.push('承办科室无效');
    }
    if (!row.deadline) {
        errors.push('办理期限不能为空');
    } else if (!isValidDate(row.deadline)) {
        errors.push('办理期限格式错误');
    }

    if (row.docNumber) {
        const dupInImport = allRows.filter(function(r, i) {
            return i !== index && r.docNumber && r.docNumber === row.docNumber;
        });
        if (dupInImport.length > 0) {
            errors.push('导入数据内文号重复');
        }

        const dupInExisting = existingDocs.filter(function(d) {
            return d.docNumber === row.docNumber;
        });
        if (dupInExisting.length > 0) {
            errors.push('与现有数据文号重复');
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

function processCsvData(csvText) {
    let text = csvText;
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
    }
    const lines = text.split(/\r?\n/).filter(function(line) {
        return line.trim() !== '';
    });

    if (lines.length < 2) {
        showToast('CSV数据至少需要包含表头和一行数据', 'error');
        return;
    }

    const dataLines = lines.slice(1);
    const parsedRows = [];

    for (let i = 0; i < dataLines.length; i++) {
        const values = parseCsvLine(dataLines[i]);
        const row = {
            fromUnit: values[0] || '',
            docNumber: values[1] || '',
            title: values[2] || '',
            receiveDate: values[3] || '',
            urgency: values[4] || '',
            department: values[5] || '',
            deadline: values[6] || '',
            remark: values[7] || ''
        };
        parsedRows.push(row);
    }

    const existingDocs = getDocuments();
    const validatedRows = parsedRows.map(function(row, index) {
        const validation = validateImportRow(row, index, parsedRows, existingDocs);
        return {
            rowIndex: index + 2,
            data: row,
            valid: validation.valid,
            errors: validation.errors
        };
    });

    importParsedData = validatedRows;
    importValidData = validatedRows.filter(function(r) {
        return r.valid;
    });

    renderImportPreview();
}

function renderImportPreview() {
    const previewSection = document.getElementById('importPreviewSection');
    const tbody = document.getElementById('importPreviewBody');
    const totalCount = importParsedData.length;
    const validCount = importValidData.length;
    const invalidCount = totalCount - validCount;

    document.getElementById('importTotalCount').textContent = totalCount;
    document.getElementById('importValidCount').textContent = validCount;
    document.getElementById('importInvalidCount').textContent = invalidCount;

    const errorSummaryEl = document.getElementById('importErrorSummary');
    if (invalidCount > 0) {
        const errorTypes = {};
        importParsedData.forEach(function(item) {
            item.errors.forEach(function(err) {
                errorTypes[err] = (errorTypes[err] || 0) + 1;
            });
        });
        const errorHtml = Object.keys(errorTypes).map(function(msg) {
            return '<span class="import-error-tag">' + msg + ' (' + errorTypes[msg] + '条)</span>';
        }).join('');
        errorSummaryEl.innerHTML = '<div class="import-error-title">问题汇总：</div>' + errorHtml;
        errorSummaryEl.style.display = 'block';
    } else {
        errorSummaryEl.style.display = 'none';
    }

    tbody.innerHTML = importParsedData.map(function(item) {
        const rowClass = item.valid ? 'row-valid' : 'row-invalid';
        const statusText = item.valid ? '有效' : '无效';
        const statusClass = item.valid ? 'status-valid' : 'status-invalid';
        const errorTooltip = item.errors.join('；');

        return '<tr class="' + rowClass + '" title="' + escapeHtml(errorTooltip) + '">' +
            '<td>' + item.rowIndex + '</td>' +
            '<td class="' + (!item.data.fromUnit ? 'cell-error' : '') + '">' + (escapeHtml(item.data.fromUnit) || '-') + '</td>' +
            '<td class="' + (!item.data.docNumber ? 'cell-error' : '') + '">' + (escapeHtml(item.data.docNumber) || '-') + '</td>' +
            '<td class="' + (!item.data.title ? 'cell-error' : '') + '">' + (escapeHtml(item.data.title) || '-') + '</td>' +
            '<td class="' + (!item.data.receiveDate || !isValidDate(item.data.receiveDate) ? 'cell-error' : '') + '">' + (escapeHtml(item.data.receiveDate) || '-') + '</td>' +
            '<td class="' + (!item.data.urgency || !isValidUrgency(item.data.urgency) ? 'cell-error' : '') + '">' + (escapeHtml(item.data.urgency) || '-') + '</td>' +
            '<td class="' + (!item.data.department || !isValidDepartment(item.data.department) ? 'cell-error' : '') + '">' + (escapeHtml(item.data.department) || '-') + '</td>' +
            '<td class="' + (!item.data.deadline || !isValidDate(item.data.deadline) ? 'cell-error' : '') + '">' + (escapeHtml(item.data.deadline) || '-') + '</td>' +
            '<td>' + (escapeHtml(item.data.remark) || '-') + '</td>' +
            '<td><span class="import-row-status ' + statusClass + '">' + statusText + '</span></td>' +
            '</tr>';
    }).join('');

    previewSection.style.display = 'block';

    const confirmBtn = document.getElementById('importConfirmBtn');
    confirmBtn.disabled = validCount === 0;
    if (validCount > 0) {
        confirmBtn.innerHTML = '<span class="btn-icon">✓</span> 确认导入 (' + validCount + '条)';
    } else {
        confirmBtn.innerHTML = '<span class="btn-icon">✓</span> 确认导入';
    }
}

function confirmImport() {
    if (importValidData.length === 0) {
        showToast('没有可导入的有效数据', 'error');
        return;
    }

    const documents = getDocuments();
    const newDocs = importValidData.map(function(item) {
        return {
            id: generateId(),
            fromUnit: item.data.fromUnit,
            docNumber: item.data.docNumber,
            title: item.data.title,
            receiveDate: item.data.receiveDate,
            urgency: item.data.urgency,
            department: item.data.department,
            deadline: item.data.deadline,
            remark: item.data.remark || '',
            completed: false,
            completedAt: null,
            completedRemark: '',
            processingRecords: [],
            createdAt: new Date().toISOString()
        };
    });

    const updatedDocs = newDocs.concat(documents);
    saveDocuments(updatedDocs);

    const validCount = importValidData.length;
    const totalCount = importParsedData.length;
    const skippedCount = totalCount - validCount;

    let msg = '成功导入 ' + validCount + ' 条收文';
    if (skippedCount > 0) {
        msg += '，跳过 ' + skippedCount + ' 条无效数据';
    }

    showToast(msg, 'success');
    closeImportModal();
    updateStats();
    renderDocumentList();
}

function setupFileDragDrop() {
    const dropArea = document.getElementById('fileUploadArea');
    if (!dropArea) return;

    const preventEvents = ['dragenter', 'dragover', 'dragleave', 'drop'];
    for (let i = 0; i < preventEvents.length; i++) {
        dropArea.addEventListener(preventEvents[i], function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    const addDragEvents = ['dragenter', 'dragover'];
    for (let i = 0; i < addDragEvents.length; i++) {
        dropArea.addEventListener(addDragEvents[i], function() {
            dropArea.classList.add('drag-over');
        });
    }

    const removeDragEvents = ['dragleave', 'drop'];
    for (let i = 0; i < removeDragEvents.length; i++) {
        dropArea.addEventListener(removeDragEvents[i], function() {
            dropArea.classList.remove('drag-over');
        });
    }

    dropArea.addEventListener('drop', function(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    });
}

const FIELD_NAME_MAP = {
    id: 'ID',
    fromUnit: '来文单位',
    docNumber: '文号',
    title: '标题',
    receiveDate: '收文日期',
    urgency: '紧急程度',
    department: '承办科室',
    deadline: '办理期限',
    remark: '备注',
    completed: '是否办结',
    completedAt: '办结时间',
    createdAt: '创建时间'
};

const CSV_EXPORT_FIELDS = [
    'fromUnit', 'docNumber', 'title', 'receiveDate', 'urgency',
    'department', 'deadline', 'remark', 'completed', 'completedAt', 'createdAt'
];

function getExportFileName(prefix, extension) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `收文_${prefix}_${year}${month}${day}_${hours}${minutes}.${extension}`;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob(['\ufeff' + content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function toggleExportMenu() {
    const menu = document.getElementById('exportMenu');
    menu.classList.toggle('show');
}

function closeExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (menu) {
        menu.classList.remove('show');
    }
}

function exportFilteredCsv() {
    closeExportMenu();
    const documents = getDocuments();
    const filtered = filterDocuments(documents, currentTab, searchKeyword, advancedFilter);

    if (filtered.length === 0) {
        showToast('当前筛选结果为空，无法导出', 'error');
        return;
    }

    const headerRow = CSV_EXPORT_FIELDS.map(function(field) {
        return FIELD_NAME_MAP[field] || field;
    }).join(',');

    const dataRows = filtered.map(function(doc) {
        return CSV_EXPORT_FIELDS.map(function(field) {
            let value = doc[field];
            if (field === 'completed') {
                value = value ? '是' : '否';
            }
            if (value === undefined || value === null) {
                value = '';
            }
            value = String(value);
            if (value.indexOf(',') !== -1 || value.indexOf('"') !== -1 || value.indexOf('\n') !== -1) {
                value = '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        }).join(',');
    }).join('\n');

    const csvContent = headerRow + '\n' + dataRows;
    const filename = getExportFileName('筛选导出', 'csv');
    downloadFile(csvContent, filename, 'text/csv');
    showToast('成功导出 ' + filtered.length + ' 条收文数据', 'success');
}

function exportFullJson() {
    closeExportMenu();
    const documents = getDocuments();

    if (documents.length === 0) {
        showToast('当前没有数据可导出', 'error');
        return;
    }

    const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        totalCount: documents.length,
        data: documents
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const filename = getExportFileName('完整备份', 'json');
    downloadFile(jsonContent, filename, 'application/json');
    showToast('成功导出 ' + documents.length + ' 条收文备份', 'success');
}

let restoreData = [];
let restoreAnalysis = null;

function openRestoreModal() {
    restoreData = [];
    restoreAnalysis = null;
    document.getElementById('restoreFileInput').value = '';
    document.getElementById('restoreFileName').style.display = 'none';
    document.getElementById('restorePreviewSection').style.display = 'none';
    document.getElementById('restoreOverwriteCheckbox').checked = false;
    document.getElementById('restoreConfirmBtn').disabled = true;
    document.getElementById('restoreModal').classList.add('show');
}

function closeRestoreModal() {
    document.getElementById('restoreModal').classList.remove('show');
    restoreData = [];
    restoreAnalysis = null;
}

function handleRestoreFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    processRestoreFile(file);
}

function processRestoreFile(file) {
    if (!file.name.toLowerCase().endsWith('.json')) {
        showToast('请选择JSON格式备份文件', 'error');
        return;
    }

    const fileNameEl = document.getElementById('restoreFileName');
    const fileSizeKb = (file.size / 1024).toFixed(2);
    fileNameEl.textContent = '已选择文件：' + file.name + '（' + fileSizeKb + ' KB）';
    fileNameEl.style.display = 'block';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let content = e.target.result;
            if (content.charCodeAt(0) === 0xFEFF) {
                content = content.slice(1);
            }
            const parsed = JSON.parse(content);

            let docs = [];
            if (Array.isArray(parsed)) {
                docs = parsed;
            } else if (parsed.data && Array.isArray(parsed.data)) {
                docs = parsed.data;
            } else {
                throw new Error('无效的备份文件格式');
            }

            if (docs.length === 0) {
                showToast('备份文件中没有数据', 'error');
                return;
            }

            const validDocs = docs.filter(function(doc) {
                return doc.fromUnit && doc.docNumber && doc.title &&
                    doc.receiveDate && doc.urgency && doc.department && doc.deadline;
            });

            if (validDocs.length === 0) {
                showToast('备份文件中没有有效的收文数据', 'error');
                return;
            }

            const normalizedDocs = validDocs.map(function(doc) {
                return {
                    id: doc.id || null,
                    fromUnit: doc.fromUnit,
                    docNumber: doc.docNumber,
                    title: doc.title,
                    receiveDate: doc.receiveDate,
                    urgency: doc.urgency,
                    department: doc.department,
                    deadline: doc.deadline,
                    remark: doc.remark || '',
                    completed: doc.completed || false,
                    completedAt: doc.completedAt || null,
                    completedRemark: doc.completedRemark || '',
                    processingRecords: doc.processingRecords || [],
                    createdAt: doc.createdAt || null
                };
            });

            restoreData = normalizedDocs;
            analyzeRestoreData();
            renderRestorePreview();

        } catch (err) {
            showToast('文件解析失败：' + err.message, 'error');
        }
    };
    reader.onerror = function() {
        showToast('文件读取失败', 'error');
    };
    reader.readAsText(file, 'UTF-8');
}

function analyzeRestoreData() {
    const existingDocs = getDocuments();
    const overwrite = document.getElementById('restoreOverwriteCheckbox').checked;

    const existingById = {};
    const existingByDocNumber = {};
    existingDocs.forEach(function(doc) {
        if (doc.id) {
            existingById[doc.id] = doc;
        }
        if (doc.docNumber) {
            existingByDocNumber[doc.docNumber] = doc;
        }
    });

    const seenIdsInBackup = {};
    const seenDocNumbersInBackup = {};
    const addItems = [];
    const overwriteItems = [];
    const skipItems = [];

    restoreData.forEach(function(item) {
        let matchDoc = null;
        let matchType = null;
        let isInternalDuplicate = false;

        if (item.id && seenIdsInBackup[item.id]) {
            isInternalDuplicate = true;
        }
        if (!isInternalDuplicate && item.docNumber && seenDocNumbersInBackup[item.docNumber]) {
            isInternalDuplicate = true;
        }

        if (item.id) {
            seenIdsInBackup[item.id] = true;
        }
        if (item.docNumber) {
            seenDocNumbersInBackup[item.docNumber] = true;
        }

        if (isInternalDuplicate) {
            skipItems.push({
                data: item,
                action: 'skip',
                matched: null,
                matchType: 'internal-duplicate',
                reason: '备份文件内重复'
            });
            return;
        }

        if (item.id && existingById[item.id]) {
            matchDoc = existingById[item.id];
            matchType = 'id';
        } else if (item.docNumber && existingByDocNumber[item.docNumber]) {
            matchDoc = existingByDocNumber[item.docNumber];
            matchType = 'docNumber';
        }

        if (!matchDoc) {
            addItems.push({ data: item, action: 'add' });
        } else if (overwrite) {
            overwriteItems.push({
                data: item,
                action: 'overwrite',
                matched: matchDoc,
                matchType: matchType
            });
        } else {
            skipItems.push({
                data: item,
                action: 'skip',
                matched: matchDoc,
                matchType: matchType,
                reason: matchType === 'id' ? 'ID重复' : '文号重复'
            });
        }
    });

    restoreAnalysis = {
        total: restoreData.length,
        add: addItems.length,
        overwrite: overwriteItems.length,
        skip: skipItems.length,
        hasDuplicate: overwriteItems.length > 0 || skipItems.length > 0,
        items: addItems.concat(overwriteItems).concat(skipItems)
    };
}

function updateRestorePreview() {
    if (restoreData.length === 0) return;
    analyzeRestoreData();
    renderRestorePreview();
}

function renderRestorePreview() {
    if (!restoreAnalysis) return;

    const previewSection = document.getElementById('restorePreviewSection');
    const tbody = document.getElementById('restorePreviewBody');

    document.getElementById('restoreTotalCount').textContent = restoreAnalysis.total;
    document.getElementById('restoreAddCount').textContent = restoreAnalysis.add;
    document.getElementById('restoreOverwriteCount').textContent = restoreAnalysis.overwrite;
    document.getElementById('restoreSkipCount').textContent = restoreAnalysis.skip;

    const warningEl = document.getElementById('restoreDuplicateWarning');
    if (restoreAnalysis.hasDuplicate) {
        warningEl.style.display = 'flex';
    } else {
        warningEl.style.display = 'none';
    }

    tbody.innerHTML = restoreAnalysis.items.map(function(item, index) {
        const rowClass = 'row-' + item.action;
        const statusMap = {
            'add': { text: '新增', class: 'status-add' },
            'overwrite': { text: '覆盖', class: 'status-overwrite' },
            'skip': { text: '跳过', class: 'status-skip' }
        };
        const status = statusMap[item.action];

        return '<tr class="' + rowClass + '">' +
            '<td>' + (index + 1) + '</td>' +
            '<td>' + escapeHtml(item.data.title || '-') + '</td>' +
            '<td>' + escapeHtml(item.data.docNumber || '-') + '</td>' +
            '<td>' + escapeHtml(item.data.fromUnit || '-') + '</td>' +
            '<td>' + escapeHtml(item.data.department || '-') + '</td>' +
            '<td><span class="restore-row-status ' + status.class + '">' + status.text + '</span></td>' +
            '</tr>';
    }).join('');

    previewSection.style.display = 'block';

    const confirmBtn = document.getElementById('restoreConfirmBtn');
    const canRestore = restoreAnalysis.add > 0 || restoreAnalysis.overwrite > 0;
    confirmBtn.disabled = !canRestore;
    if (canRestore) {
        let btnText = '确认恢复';
        if (restoreAnalysis.add > 0) {
            btnText += ' (新增' + restoreAnalysis.add + '条';
        }
        if (restoreAnalysis.overwrite > 0) {
            btnText += (restoreAnalysis.add > 0 ? '，' : ' (') + '覆盖' + restoreAnalysis.overwrite + '条';
        }
        btnText += ')';
        confirmBtn.innerHTML = '<span class="btn-icon">✓</span> ' + btnText;
    } else {
        confirmBtn.innerHTML = '<span class="btn-icon">✓</span> 确认恢复';
    }
}

function confirmRestore() {
    if (!restoreAnalysis) return;

    const documents = getDocuments();
    const overwrite = document.getElementById('restoreOverwriteCheckbox').checked;

    const existingById = {};
    const existingByDocNumber = {};
    const docIndexById = {};
    documents.forEach(function(doc, index) {
        if (doc.id) {
            existingById[doc.id] = doc;
            docIndexById[doc.id] = index;
        }
        if (doc.docNumber) {
            existingByDocNumber[doc.docNumber] = doc;
        }
    });

    let addCount = 0;
    let overwriteCount = 0;
    let skipCount = 0;

    const finalDocs = documents.slice();

    const seenIdsInBackup = {};
    const seenDocNumbersInBackup = {};

    restoreData.forEach(function(item) {
        let isInternalDuplicate = false;

        if (item.id && seenIdsInBackup[item.id]) {
            isInternalDuplicate = true;
        }
        if (!isInternalDuplicate && item.docNumber && seenDocNumbersInBackup[item.docNumber]) {
            isInternalDuplicate = true;
        }

        if (item.id) {
            seenIdsInBackup[item.id] = true;
        }
        if (item.docNumber) {
            seenDocNumbersInBackup[item.docNumber] = true;
        }

        if (isInternalDuplicate) {
            skipCount++;
            return;
        }

        let matchDoc = null;

        if (item.id && existingById[item.id]) {
            matchDoc = existingById[item.id];
        } else if (item.docNumber && existingByDocNumber[item.docNumber]) {
            matchDoc = existingByDocNumber[item.docNumber];
        }

        if (!matchDoc) {
            const newDoc = {
                id: item.id || generateId(),
                fromUnit: item.fromUnit,
                docNumber: item.docNumber,
                title: item.title,
                receiveDate: item.receiveDate,
                urgency: item.urgency,
                department: item.department,
                deadline: item.deadline,
                remark: item.remark || '',
                completed: item.completed || false,
                completedAt: item.completedAt || null,
                completedRemark: item.completedRemark || '',
                processingRecords: item.processingRecords || [],
                createdAt: item.createdAt || new Date().toISOString()
            };
            finalDocs.push(newDoc);
            addCount++;
        } else if (overwrite) {
            const index = docIndexById[matchDoc.id];
            if (index !== undefined && index !== -1) {
                finalDocs[index] = {
                    ...matchDoc,
                    ...item,
                    id: matchDoc.id,
                    processingRecords: item.processingRecords || matchDoc.processingRecords || [],
                    completedRemark: item.completedRemark || matchDoc.completedRemark || ''
                };
                overwriteCount++;
            }
        } else {
            skipCount++;
        }
    });

    saveDocuments(finalDocs);

    let msg = '';
    if (addCount > 0) {
        msg += '新增 ' + addCount + ' 条';
    }
    if (overwriteCount > 0) {
        msg += (msg ? '，' : '') + '覆盖 ' + overwriteCount + ' 条';
    }
    if (skipCount > 0) {
        msg += (msg ? '，' : '') + '跳过 ' + skipCount + ' 条';
    }
    msg += '收文数据';

    showToast(msg, 'success');
    closeRestoreModal();
    updateStats();
    renderDocumentList();
}

function setupRestoreFileDragDrop() {
    const dropArea = document.getElementById('restoreFileUploadArea');
    if (!dropArea) return;

    const preventEvents = ['dragenter', 'dragover', 'dragleave', 'drop'];
    for (let i = 0; i < preventEvents.length; i++) {
        dropArea.addEventListener(preventEvents[i], function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    const addDragEvents = ['dragenter', 'dragover'];
    for (let i = 0; i < addDragEvents.length; i++) {
        dropArea.addEventListener(addDragEvents[i], function() {
            dropArea.classList.add('drag-over');
        });
    }

    const removeDragEvents = ['dragleave', 'drop'];
    for (let i = 0; i < removeDragEvents.length; i++) {
        dropArea.addEventListener(removeDragEvents[i], function() {
            dropArea.classList.remove('drag-over');
        });
    }

    dropArea.addEventListener('drop', function(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processRestoreFile(files[0]);
        }
    });
}

function init() {
    document.getElementById('documentForm').addEventListener('submit', saveDocument);

    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(window.searchTimer);
        window.searchTimer = setTimeout(searchDocuments, 300);
    });

    document.getElementById('receiveDate').addEventListener('change', function() {
        const templateSelect = document.getElementById('templateSelect');
        if (templateSelect && templateSelect.value) {
            applyTemplate(templateSelect.value);
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeDetailModal();
            closeBatchConfirmModal();
            closeBatchDepartmentModal();
            closeImportModal();
            closeRestoreModal();
            closeExportMenu();
            closeAddRecordModal();
            closeCompleteModal();
            closeSaveTemplateModal();
        }
    });

    document.addEventListener('click', function(e) {
        const exportDropdown = document.querySelector('.export-dropdown');
        if (exportDropdown && !exportDropdown.contains(e.target)) {
            closeExportMenu();
        }
    });

    setupFileDragDrop();
    setupRestoreFileDragDrop();
    updateFilterActiveBadge();
    updateStats();
    renderDocumentList();
}

document.addEventListener('DOMContentLoaded', init);
