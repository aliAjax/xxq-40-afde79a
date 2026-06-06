const STORAGE_KEY = 'document_registry_data';
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
    const uncompletedDocs = selectedDocs.filter(doc => !doc.completed);
    
    if (uncompletedDocs.length === 0) {
        showToast('所选收文均已办结', 'info');
        return;
    }
    
    currentBatchAction = 'complete';
    document.getElementById('batchConfirmTitle').textContent = '批量办结确认';
    document.getElementById('batchConfirmMessage').innerHTML = 
        `确定要将选中的 <span>${uncompletedDocs.length}</span> 条收文标记为已办结吗？`;
    document.getElementById('batchConfirmBtn').className = 'btn btn-success';
    
    buildBatchPreviewList('batchPreviewList');
    document.getElementById('batchConfirmModal').classList.add('show');
}

function openBatchDeleteModal() {
    if (selectedIds.length === 0) return;
    
    currentBatchAction = 'delete';
    document.getElementById('batchConfirmTitle').textContent = '批量删除确认';
    document.getElementById('batchConfirmMessage').innerHTML = 
        `确定要删除选中的 <span>${selectedIds.length}</span> 条收文吗？此操作不可恢复。`;
    document.getElementById('batchConfirmBtn').className = 'btn btn-danger';
    
    buildBatchPreviewList('batchPreviewList');
    document.getElementById('batchConfirmModal').classList.add('show');
}

function closeBatchConfirmModal() {
    document.getElementById('batchConfirmModal').classList.remove('show');
    currentBatchAction = null;
}

function executeBatchAction() {
    if (!currentBatchAction) return;
    
    const documents = getDocuments();
    
    if (currentBatchAction === 'complete') {
        let count = 0;
        const updatedDocs = documents.map(doc => {
            if (selectedIds.includes(doc.id) && !doc.completed) {
                count++;
                return {
                    ...doc,
                    completed: true,
                    completedAt: new Date().toISOString()
                };
            }
            return doc;
        });
        saveDocuments(updatedDocs);
        showToast(`成功办结 ${count} 条收文`, 'success');
    } else if (currentBatchAction === 'delete') {
        const count = selectedIds.length;
        const filtered = documents.filter(doc => !selectedIds.includes(doc.id));
        saveDocuments(filtered);
        showToast(`成功删除 ${count} 条收文`, 'success');
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
        
        const selIndex = selectedIds.indexOf(id);
        if (selIndex > -1) {
            selectedIds.splice(selIndex, 1);
        }
        
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
    document.querySelectorAll('.import-tab').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelector(`.import-tab[data-import-tab="${tab}"]`).classList.add('active');

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
    fileNameEl.textContent = `已选择文件：${file.name}（${(file.size / 1024).toFixed(2)} KB）`;
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
    const warnings = [];

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
        errors.push('紧急程度无效（应为：普通/加急/特急）');
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
        const dupInImport = allRows.filter((r, i) => 
            i !== index && r.docNumber && r.docNumber === row.docNumber
        );
        if (dupInImport.length > 0) {
            warnings.push('导入数据内文号重复');
        }

        const dupInExisting = existingDocs.filter(d => d.docNumber === row.docNumber);
        if (dupInExisting.length > 0) {
            warnings.push('与现有数据文号重复');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

function processCsvData(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
        showToast('CSV数据至少需要包含表头和一行数据', 'error');
        return;
    }

    const headerLine = lines[0];
    const headers = parseCsvLine(headerLine);
    
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
    const validatedRows = parsedRows.map((row, index) => {
        const validation = validateImportRow(row, index, parsedRows, existingDocs);
        return {
            rowIndex: index + 2,
            data: row,
            ...validation
        };
    });

    importParsedData = validatedRows;
    importValidData = validatedRows.filter(r => r.valid);

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
        importParsedData.forEach(item => {
            item.errors.forEach(err => {
                errorTypes[err] = (errorTypes[err] || 0) + 1;
            });
            item.warnings.forEach(warn => {
                errorTypes[warn] = (errorTypes[warn] || 0) + 1;
            });
        });
        const errorHtml = Object.entries(errorTypes).map(([msg, count]) => 
            `<span class="import-error-tag">${msg} (${count}条)</span>`
        ).join('');
        errorSummaryEl.innerHTML = `<div class="import-error-title">问题汇总：</div>${errorHtml}`;
        errorSummaryEl.style.display = 'block';
    } else {
        errorSummaryEl.style.display = 'none';
    }

    tbody.innerHTML = importParsedData.map(item => {
        const rowClass = item.valid ? 'row-valid' : 'row-invalid';
        const statusText = item.valid ? '有效' : '无效';
        const statusClass = item.valid ? 'status-valid' : 'status-invalid';
        
        const hasWarning = item.warnings.length > 0;
        const rowFinalClass = hasWarning ? 'row-warning' : rowClass;
        
        let errorTooltip = '';
        if (item.errors.length > 0 || item.warnings.length > 0) {
            const allIssues = [...item.errors, ...item.warnings];
            errorTooltip = allIssues.join('；');
        }

        return `
            <tr class="${rowFinalClass}" title="${escapeHtml(errorTooltip)}">
                <td>${item.rowIndex}</td>
                <td class="${!item.data.fromUnit ? 'cell-error' : ''}">${escapeHtml(item.data.fromUnit) || '-'}</td>
                <td class="${!item.data.docNumber ? 'cell-error' : ''}">${escapeHtml(item.data.docNumber) || '-'}</td>
                <td class="${!item.data.title ? 'cell-error' : ''}">${escapeHtml(item.data.title) || '-'}</td>
                <td class="${!item.data.receiveDate || !isValidDate(item.data.receiveDate) ? 'cell-error' : ''}">${escapeHtml(item.data.receiveDate) || '-'}</td>
                <td class="${!item.data.urgency || !isValidUrgency(item.data.urgency) ? 'cell-error' : ''}">${escapeHtml(item.data.urgency) || '-'}</td>
                <td class="${!item.data.department || !isValidDepartment(item.data.department) ? 'cell-error' : ''}">${escapeHtml(item.data.department) || '-'}</td>
                <td class="${!item.data.deadline || !isValidDate(item.data.deadline) ? 'cell-error' : ''}">${escapeHtml(item.data.deadline) || '-'}</td>
                <td>${escapeHtml(item.data.remark) || '-'}</td>
                <td><span class="import-row-status ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');

    previewSection.style.display = 'block';
    
    const confirmBtn = document.getElementById('importConfirmBtn');
    confirmBtn.disabled = validCount === 0;
    if (validCount > 0) {
        confirmBtn.innerHTML = `<span class="btn-icon">✓</span> 确认导入 (${validCount}条)`;
    } else {
        confirmBtn.innerHTML = `<span class="btn-icon">✓</span> 确认导入`;
    }
}

function confirmImport() {
    if (importValidData.length === 0) {
        showToast('没有可导入的有效数据', 'error');
        return;
    }

    const documents = getDocuments();
    const newDocs = importValidData.map(item => ({
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
        createdAt: new Date().toISOString()
    }));

    const updatedDocs = [...newDocs, ...documents];
    saveDocuments(updatedDocs);

    const validCount = importValidData.length;
    const totalCount = importParsedData.length;
    const skippedCount = totalCount - validCount;

    let msg = `成功导入 ${validCount} 条收文`;
    if (skippedCount > 0) {
        msg += `，跳过 ${skippedCount} 条无效数据`;
    }

    showToast(msg, 'success');
    closeImportModal();
    updateStats();
    renderDocumentList();
}

function setupFileDragDrop() {
    const dropArea = document.getElementById('fileUploadArea');
    if (!dropArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, function() {
            dropArea.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, function() {
            dropArea.classList.remove('drag-over');
        });
    });

    dropArea.addEventListener('drop', function(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    });
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
            closeBatchConfirmModal();
            closeBatchDepartmentModal();
            closeImportModal();
        }
    });

    setupFileDragDrop();
    updateFilterActiveBadge();
    updateStats();
    renderDocumentList();
}

document.addEventListener('DOMContentLoaded', init);
