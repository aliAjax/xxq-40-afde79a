const STORAGE_KEY = 'document_registry_data';
let currentTab = 'pending';
let searchKeyword = '';

function getDocuments() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveDocuments(documents) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
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
}

function filterDocuments(documents, tab, keyword) {
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

    filtered.sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        return new Date(b.receiveDate) - new Date(a.receiveDate);
    });

    return filtered;
}

function renderDocumentList() {
    const documents = getDocuments();
    const filtered = filterDocuments(documents, currentTab, searchKeyword);
    const listEl = document.getElementById('documentList');

    if (filtered.length === 0) {
        let emptyText = '暂无收文记录';
        if (searchKeyword) {
            emptyText = '未找到匹配的收文记录';
        } else if (currentTab === 'pending') {
            emptyText = '暂无待办理的收文';
        } else if (currentTab === 'urgent') {
            emptyText = '暂无即将到期的收文';
        } else if (currentTab === 'done') {
            emptyText = '暂无已办结的收文';
        }

        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <p class="empty-text">${emptyText}</p>
                ${!searchKeyword && currentTab !== 'done' ? '<button class="btn btn-primary" onclick="openAddModal()">新增收文</button>' : ''}
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(doc => {
        const status = getDocumentStatus(doc);
        const statusText = getStatusText(status);
        const daysRemaining = getDaysRemaining(doc.deadline);
        
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
            <div class="document-card status-${status}" onclick="viewDocument('${doc.id}')">
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
                <div class="doc-actions" onclick="event.stopPropagation()">
                    ${actions}
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    renderDocumentList();
}

function searchDocuments() {
    searchKeyword = document.getElementById('searchInput').value.trim();
    renderDocumentList();
}

function openAddModal() {
    document.getElementById('modalTitle').textContent = '新增收文';
    document.getElementById('documentId').value = '';
    document.getElementById('documentForm').reset();
    document.getElementById('receiveDate').value = formatDateInput(new Date());
    
    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 7);
    document.getElementById('deadline').value = formatDateInput(defaultDeadline);
    
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
    if (!confirm('确定要将该收文标记为已办结吗？')) return;

    const documents = getDocuments();
    const index = documents.findIndex(d => d.id === id);
    if (index !== -1) {
        documents[index].completed = true;
        documents[index].completedAt = new Date().toISOString();
        saveDocuments(documents);
        updateStats();
        renderDocumentList();
        showToast('收文已办结', 'success');
    }
}

function deleteDocument(id) {
    if (!confirm('确定要删除该收文吗？此操作不可恢复。')) return;

    const documents = getDocuments();
    const filtered = documents.filter(d => d.id !== id);
    saveDocuments(filtered);
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
            <span class="detail-value">${formatDate(doc.completedAt)}</span>
        </div>
        ` : ''}
        ${doc.remark ? `
        <div class="detail-item">
            <span class="detail-label">备注</span>
            <span class="detail-value">${escapeHtml(doc.remark)}</span>
        </div>
        ` : ''}
    `;

    const detailActions = document.getElementById('detailActions');
    if (!doc.completed) {
        detailActions.innerHTML = `
            <button class="btn btn-default" onclick="closeDetailModal()">关闭</button>
            <button class="btn btn-danger" onclick="deleteDocument('${doc.id}'); closeDetailModal();">删除</button>
            <button class="btn btn-primary" onclick="editDocument('${doc.id}'); closeDetailModal();">编辑</button>
            <button class="btn btn-success" onclick="completeDocument('${doc.id}'); closeDetailModal();">标记办结</button>
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

function init() {
    document.getElementById('documentForm').addEventListener('submit', saveDocument);
    
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(window.searchTimer);
        window.searchTimer = setTimeout(searchDocuments, 300);
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeDetailModal();
        }
    });

    updateStats();
    renderDocumentList();
}

document.addEventListener('DOMContentLoaded', init);