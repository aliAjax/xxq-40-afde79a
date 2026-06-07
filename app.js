const STORAGE_KEY = 'document_registry_data';
const TEMPLATE_STORAGE_KEY = 'document_templates';
const AUDIT_LOG_STORAGE_KEY = 'document_audit_logs';
const FLOW_RULE_STORAGE_KEY = 'document_flow_rules';
const VIEW_PRESETS_STORAGE_KEY = 'document_view_presets';
const ACTIVE_VIEW_STORAGE_KEY = 'document_active_view';
const DEPARTMENT_LIST = ['办公室', '综合科', '业务一科', '业务二科', '法制科', '财务科', '人事科', '信息科'];
const URGENCY_LIST = ['普通', '加急', '特急'];

const AUDIT_ACTION = {
    CREATE: 'create',
    EDIT: 'edit',
    COMPLETE: 'complete',
    EXTEND: 'extend',
    BATCH_COMPLETE: 'batch_complete',
    BATCH_DELETE: 'batch_delete',
    BATCH_DEPARTMENT: 'batch_department',
    IMPORT: 'import',
    RESTORE: 'restore',
    DELETE: 'delete',
    RESTORE_RECYCLE: 'restore_recycle',
    BATCH_RESTORE_RECYCLE: 'batch_restore_recycle',
    PERMANENT_DELETE: 'permanent_delete',
    BATCH_PERMANENT_DELETE: 'batch_permanent_delete',
    EMPTY_RECYCLE_BIN: 'empty_recycle_bin',
    FLOW_PROPOSE: 'flow_propose',
    FLOW_ASSIGN: 'flow_assign',
    FLOW_PROGRESS: 'flow_progress',
    FLOW_FEEDBACK: 'flow_feedback',
    ADD_PROGRESS_RECORD: 'add_progress_record',
    FLOW_RULE_CHANGE: 'flow_rule_change',
    SUPERVISION_CREATE: 'supervision_create',
    SUPERVISION_FEEDBACK: 'supervision_feedback'
};

const AUDIT_ACTION_TEXT = {
    'create': '新增收文',
    'edit': '编辑收文',
    'complete': '办结收文',
    'extend': '延期办理',
    'batch_complete': '批量办结',
    'batch_delete': '批量删除',
    'batch_department': '批量修改科室',
    'import': '导入收文',
    'restore': '恢复备份',
    'delete': '删除收文',
    'restore_recycle': '恢复收文',
    'batch_restore_recycle': '批量恢复',
    'permanent_delete': '彻底删除',
    'batch_permanent_delete': '批量彻底删除',
    'empty_recycle_bin': '清空回收站',
    'flow_propose': '拟办',
    'flow_assign': '交办',
    'flow_progress': '进展更新',
    'flow_feedback': '反馈',
    'add_progress_record': '追加进展',
    'flow_rule_change': '流程规则变更',
    'supervision_create': '发起督办',
    'supervision_feedback': '督办反馈'
};

const FLOW_STATUS = {
    PENDING_REVIEW: 'pending_review',
    PROCESSING: 'processing',
    PENDING_FEEDBACK: 'pending_feedback',
    DONE: 'done'
};

const FLOW_STATUS_TEXT = {
    'pending_review': '待拟办',
    'processing': '办理中',
    'pending_feedback': '待反馈',
    'done': '已办结'
};

const FLOW_ACTION = {
    CREATE: 'create',
    PROPOSE: 'propose',
    ASSIGN: 'assign',
    PROGRESS: 'progress',
    FEEDBACK: 'feedback',
    COMPLETE: 'complete'
};

const FLOW_ACTION_TEXT = {
    'create': '收文登记',
    'propose': '拟办',
    'assign': '交办',
    'progress': '进展更新',
    'feedback': '反馈',
    'complete': '办结'
};

const SUPERVISION_STATUS = {
    PENDING: 'pending',
    FEEDBACK: 'feedback'
};

const SUPERVISION_STATUS_TEXT = {
    'pending': '待反馈',
    'feedback': '已反馈'
};

let currentSupervisionDocId = null;

let currentView = 'list';
let currentTab = 'pending_review';
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
let recycleSelectedIds = [];
let auditLogKeyword = '';
let currentViewPresetId = null;
let viewPresetMenuOpen = false;
let viewPresetManageMode = false;

function migrateDocument(doc) {
    const migrated = { ...doc };

    if (!migrated.flowStatus) {
        if (migrated.completed) {
            migrated.flowStatus = FLOW_STATUS.DONE;
        } else {
            migrated.flowStatus = FLOW_STATUS.PROCESSING;
        }
    }

    if (migrated.flowStatus === FLOW_STATUS.DONE && !migrated.completed) {
        migrated.completed = true;
    }

    if (migrated.completed && migrated.flowStatus !== FLOW_STATUS.DONE) {
        migrated.flowStatus = FLOW_STATUS.DONE;
    }

    if (!migrated.proposedDepartment) {
        migrated.proposedDepartment = '';
    }

    if (!migrated.undertakingDepartment) {
        migrated.undertakingDepartment = migrated.department || '';
    }

    if (!migrated.coDepartments) {
        migrated.coDepartments = [];
    }

    if (!migrated.flowRecords || migrated.flowRecords.length === 0) {
        migrated.flowRecords = [];

        if (migrated.flowStatus === FLOW_STATUS.DONE) {
            migrated.flowRecords.push({
                id: generateId(),
                action: FLOW_ACTION.CREATE,
                fromStatus: null,
                toStatus: FLOW_STATUS.PROCESSING,
                handler: '',
                opinion: '收文登记',
                department: migrated.department || '',
                createdAt: migrated.createdAt || new Date().toISOString()
            });

            migrated.flowRecords.push({
                id: generateId(),
                action: FLOW_ACTION.COMPLETE,
                fromStatus: FLOW_STATUS.PROCESSING,
                toStatus: FLOW_STATUS.DONE,
                handler: migrated.completedRemark ? '' : '',
                opinion: migrated.completedRemark || '已办结',
                department: migrated.department || '',
                createdAt: migrated.completedAt || new Date().toISOString()
            });
        } else {
            migrated.flowRecords.push({
                id: generateId(),
                action: FLOW_ACTION.CREATE,
                fromStatus: null,
                toStatus: FLOW_STATUS.PROCESSING,
                handler: '',
                opinion: '收文登记',
                department: migrated.department || '',
                createdAt: migrated.createdAt || new Date().toISOString()
            });
        }
    }

    if (!migrated.processingRecords) {
        migrated.processingRecords = [];
    }

    if (!migrated.reminderNote) {
        migrated.reminderNote = '';
    }
    if (!migrated.snoozeUntil) {
        migrated.snoozeUntil = '';
    }
    if (!migrated.extendedDeadline) {
        migrated.extendedDeadline = '';
    }
    if (!migrated.reminderHistory) {
        migrated.reminderHistory = [];
    }

    if (migrated.isDeleted === undefined) {
        migrated.isDeleted = false;
    }
    if (!migrated.deletedAt) {
        migrated.deletedAt = null;
    }

    if (!migrated.supervisionRecords) {
        migrated.supervisionRecords = [];
    }

    return migrated;
}

function loadAllDocuments() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const documents = JSON.parse(data);
    const migratedDocs = documents.map(function(doc) {
        return migrateDocument(doc);
    });

    const hasOldFormat = documents.some(function(doc) {
        return !doc.flowStatus || !doc.flowRecords || doc.flowRecords.length === 0 ||
               !doc.undertakingDepartment ||
               (doc.completed && doc.flowStatus !== FLOW_STATUS.DONE) ||
               (doc.flowStatus === FLOW_STATUS.DONE && !doc.completed) ||
               doc.reminderNote === undefined ||
               doc.extendedDeadline === undefined ||
               doc.isDeleted === undefined ||
               doc.supervisionRecords === undefined;
    });
    if (hasOldFormat) {
        saveDocuments(migratedDocs);
    }

    return migratedDocs;
}

function getDocuments() {
    return loadAllDocuments().filter(function(doc) {
        return !doc.isDeleted;
    });
}

function getRecycleBinDocuments() {
    return loadAllDocuments().filter(function(doc) {
        return doc.isDeleted;
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

function getAuditLogs() {
    const data = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveAuditLogs(logs) {
    localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(logs));
}

function getDefaultFlowRules() {
    return {
        version: '1.0',
        urgencyDeadlineDays: {
            '普通': 7,
            '加急': 3,
            '特急': 1
        },
        requireProposeBeforeAssign: false,
        completableStatuses: [FLOW_STATUS.PENDING_FEEDBACK],
        updatedAt: null
    };
}

function getFlowRules() {
    const data = localStorage.getItem(FLOW_RULE_STORAGE_KEY);
    if (!data) {
        return getDefaultFlowRules();
    }
    try {
        const rules = JSON.parse(data);
        const defaults = getDefaultFlowRules();
        const hasCompletableStatuses = rules.completableStatuses !== undefined && rules.completableStatuses !== null;
        return {
            version: rules.version || defaults.version,
            urgencyDeadlineDays: {
                ...defaults.urgencyDeadlineDays,
                ...(rules.urgencyDeadlineDays || {})
            },
            requireProposeBeforeAssign: rules.requireProposeBeforeAssign !== undefined ? rules.requireProposeBeforeAssign : defaults.requireProposeBeforeAssign,
            completableStatuses: hasCompletableStatuses
                ? (Array.isArray(rules.completableStatuses) ? rules.completableStatuses : defaults.completableStatuses)
                : defaults.completableStatuses,
            updatedAt: rules.updatedAt || null
        };
    } catch (e) {
        return getDefaultFlowRules();
    }
}

function saveFlowRules(rules) {
    const now = new Date().toISOString();
    const rulesWithTime = {
        ...rules,
        updatedAt: now
    };
    localStorage.setItem(FLOW_RULE_STORAGE_KEY, JSON.stringify(rulesWithTime));
    return rulesWithTime;
}

function getViewPresets() {
    const data = localStorage.getItem(VIEW_PRESETS_STORAGE_KEY);
    if (!data) return [];
    try {
        const presets = JSON.parse(data);
        if (!Array.isArray(presets)) return [];
        return presets.map(function(p) {
            return {
                id: p.id || '',
                name: p.name || '',
                filter: p.filter || {
                    department: '',
                    urgency: '',
                    receiveDateStart: '',
                    receiveDateEnd: '',
                    deadlineStart: '',
                    deadlineEnd: ''
                },
                keyword: p.keyword || '',
                tab: p.tab || 'all',
                viewType: p.viewType || 'list',
                isDefault: p.isDefault || false,
                createdAt: p.createdAt || new Date().toISOString(),
                updatedAt: p.updatedAt || new Date().toISOString()
            };
        });
    } catch (e) {
        return [];
    }
}

function saveViewPresets(presets) {
    localStorage.setItem(VIEW_PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

function getDefaultViewPreset() {
    const presets = getViewPresets();
    return presets.find(function(p) { return p.isDefault; }) || null;
}

function getActiveViewPresetId() {
    return localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY) || null;
}

function saveActiveViewPresetId(id) {
    if (id) {
        localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, id);
    } else {
        localStorage.removeItem(ACTIVE_VIEW_STORAGE_KEY);
    }
}

function createViewPreset(name, filter, keyword, tab, viewType) {
    const presets = getViewPresets();
    const newPreset = {
        id: generateId(),
        name: name,
        filter: { ...filter },
        keyword: keyword || '',
        tab: tab || 'all',
        viewType: viewType || 'list',
        isDefault: presets.length === 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    presets.push(newPreset);
    saveViewPresets(presets);
    return newPreset;
}

function updateViewPreset(id, updates) {
    const presets = getViewPresets();
    const index = presets.findIndex(function(p) { return p.id === id; });
    if (index === -1) return null;
    presets[index] = {
        ...presets[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };
    saveViewPresets(presets);
    return presets[index];
}

function deleteViewPreset(id) {
    const presets = getViewPresets();
    const filtered = presets.filter(function(p) { return p.id !== id; });
    const deleted = presets.find(function(p) { return p.id === id; });
    if (deleted && deleted.isDefault && filtered.length > 0) {
        filtered[0].isDefault = true;
    }
    saveViewPresets(filtered);
    if (currentViewPresetId === id) {
        currentViewPresetId = null;
        saveActiveViewPresetId(null);
    }
    return true;
}

function setDefaultViewPreset(id) {
    const presets = getViewPresets();
    presets.forEach(function(p) {
        p.isDefault = p.id === id;
    });
    saveViewPresets(presets);
}

function renameViewPreset(id, newName) {
    return updateViewPreset(id, { name: newName });
}

function applyViewPreset(id) {
    const presets = getViewPresets();
    const preset = presets.find(function(p) { return p.id === id; });
    if (!preset) return false;

    advancedFilter = { ...preset.filter };
    searchKeyword = preset.keyword || '';
    currentTab = preset.tab || 'all';
    currentView = preset.viewType || 'list';

    const filterDeptEl = document.getElementById('filterDepartment');
    if (filterDeptEl) filterDeptEl.value = advancedFilter.department || '';
    const filterUrgencyEl = document.getElementById('filterUrgency');
    if (filterUrgencyEl) filterUrgencyEl.value = advancedFilter.urgency || '';
    const filterReceiveStartEl = document.getElementById('filterReceiveDateStart');
    if (filterReceiveStartEl) filterReceiveStartEl.value = advancedFilter.receiveDateStart || '';
    const filterReceiveEndEl = document.getElementById('filterReceiveDateEnd');
    if (filterReceiveEndEl) filterReceiveEndEl.value = advancedFilter.receiveDateEnd || '';
    const filterDeadlineStartEl = document.getElementById('filterDeadlineStart');
    if (filterDeadlineStartEl) filterDeadlineStartEl.value = advancedFilter.deadlineStart || '';
    const filterDeadlineEndEl = document.getElementById('filterDeadlineEnd');
    if (filterDeadlineEndEl) filterDeadlineEndEl.value = advancedFilter.deadlineEnd || '';

    const searchInputEl = document.getElementById('searchInput');
    if (searchInputEl) searchInputEl.value = searchKeyword;

    currentViewPresetId = id;
    saveActiveViewPresetId(id);

    selectedIds = [];
    updateFilterActiveBadge();

    switchingFromPreset = true;
    switchView(currentView);

    const tabEls = document.querySelectorAll('.tab');
    tabEls.forEach(function(t) { t.classList.remove('active'); });
    const activeTab = document.querySelector(`.tab[data-tab="${currentTab}"]`);
    if (activeTab) activeTab.classList.add('active');

    if (currentView === 'list') {
        renderDocumentList();
    } else if (currentView === 'board') {
        renderDepartmentBoard();
    }
    switchingFromPreset = false;

    renderViewPresetSelector();

    return true;
}

function isCurrentViewMatchingPreset(preset) {
    if (!preset) return false;
    if (preset.viewType !== currentView) return false;
    if (preset.tab !== currentTab) return false;
    if ((preset.keyword || '') !== searchKeyword) return false;
    const f = preset.filter || {};
    return f.department === advancedFilter.department &&
        f.urgency === advancedFilter.urgency &&
        f.receiveDateStart === advancedFilter.receiveDateStart &&
        f.receiveDateEnd === advancedFilter.receiveDateEnd &&
        f.deadlineStart === advancedFilter.deadlineStart &&
        f.deadlineEnd === advancedFilter.deadlineEnd;
}

function getViewPresetSummary(preset) {
    if (!preset) return '';
    const parts = [];
    const f = preset.filter || {};
    if (f.department) parts.push('科室：' + f.department);
    if (f.urgency) parts.push('紧急：' + f.urgency);
    if (f.receiveDateStart || f.receiveDateEnd) {
        parts.push('收文：' + (f.receiveDateStart || '不限') + ' ~ ' + (f.receiveDateEnd || '不限'));
    }
    if (f.deadlineStart || f.deadlineEnd) {
        parts.push('期限：' + (f.deadlineStart || '不限') + ' ~ ' + (f.deadlineEnd || '不限'));
    }
    if (preset.keyword) parts.push('关键词：' + preset.keyword);
    if (preset.viewType === 'list') {
        const tabNames = {
            'pending_review': '待拟办',
            'processing': '办理中',
            'pending_feedback': '待反馈',
            'urgent': '即将到期',
            'done': '已办结',
            'all': '全部'
        };
        parts.push('标签：' + (tabNames[preset.tab] || preset.tab));
    }
    parts.push(preset.viewType === 'board' ? '科室看板' : '列表视图');
    return parts.join(' | ');
}

function getDeadlineDaysByUrgency(urgency) {
    const rules = getFlowRules();
    const days = rules.urgencyDeadlineDays[urgency];
    return days !== undefined ? days : 7;
}

function canCompleteFromStatus(status) {
    const rules = getFlowRules();
    return rules.completableStatuses.includes(status);
}

function isProposeRequiredBeforeAssign() {
    const rules = getFlowRules();
    return rules.requireProposeBeforeAssign;
}

function getFlowRulesChangesSummary(oldRules, newRules) {
    const changes = [];

    URGENCY_LIST.forEach(function(urgency) {
        const oldDays = oldRules.urgencyDeadlineDays[urgency];
        const newDays = newRules.urgencyDeadlineDays[urgency];
        if (oldDays !== newDays) {
            changes.push(urgency + '办理天数：' + oldDays + '天 → ' + newDays + '天');
        }
    });

    const oldRequire = oldRules.requireProposeBeforeAssign ? '是' : '否';
    const newRequire = newRules.requireProposeBeforeAssign ? '是' : '否';
    if (oldRequire !== newRequire) {
        changes.push('必须先拟办再交办：' + oldRequire + ' → ' + newRequire);
    }

    const oldCompletable = (oldRules.completableStatuses || []).map(function(s) { return FLOW_STATUS_TEXT[s] || s; }).join('、');
    const newCompletable = (newRules.completableStatuses || []).map(function(s) { return FLOW_STATUS_TEXT[s] || s; }).join('、');
    if (oldCompletable !== newCompletable) {
        changes.push('允许办结状态：' + oldCompletable + ' → ' + newCompletable);
    }

    if (changes.length === 0) return '无变更';
    return changes.join('；');
}

function addFlowRuleChangeAuditLog(oldRules, newRules) {
    const logs = getAuditLogs();
    const now = new Date().toISOString();

    const oldSummary = '紧急程度天数：普通' + oldRules.urgencyDeadlineDays['普通'] + '天、加急' + oldRules.urgencyDeadlineDays['加急'] + '天、特急' + oldRules.urgencyDeadlineDays['特急'] + '天；先拟办再交办：' + (oldRules.requireProposeBeforeAssign ? '是' : '否') + '；允许办结：' + (oldRules.completableStatuses || []).map(function(s) { return FLOW_STATUS_TEXT[s] || s; }).join('、');

    const newSummary = '紧急程度天数：普通' + newRules.urgencyDeadlineDays['普通'] + '天、加急' + newRules.urgencyDeadlineDays['加急'] + '天、特急' + newRules.urgencyDeadlineDays['特急'] + '天；先拟办再交办：' + (newRules.requireProposeBeforeAssign ? '是' : '否') + '；允许办结：' + (newRules.completableStatuses || []).map(function(s) { return FLOW_STATUS_TEXT[s] || s; }).join('、');

    const log = {
        id: generateId(),
        action: AUDIT_ACTION.FLOW_RULE_CHANGE,
        actionText: AUDIT_ACTION_TEXT[AUDIT_ACTION.FLOW_RULE_CHANGE],
        docId: null,
        docTitle: '',
        docNumber: '',
        beforeSummary: oldSummary,
        afterSummary: newSummary,
        changes: getFlowRulesChangesSummary(oldRules, newRules),
        timestamp: now,
        extra: null
    };

    logs.unshift(log);

    if (logs.length > 1000) {
        logs.length = 1000;
    }

    saveAuditLogs(logs);
}

function openFlowRuleModal() {
    loadFlowRuleSettings();
    document.getElementById('flowRuleModal').classList.add('show');
}

function closeFlowRuleModal() {
    document.getElementById('flowRuleModal').classList.remove('show');
}

function loadFlowRuleSettings() {
    const rules = getFlowRules();

    document.getElementById('urgencyDaysNormal').value = rules.urgencyDeadlineDays['普通'];
    document.getElementById('urgencyDaysUrgent').value = rules.urgencyDeadlineDays['加急'];
    document.getElementById('urgencyDaysExtraUrgent').value = rules.urgencyDeadlineDays['特急'];

    document.getElementById('requireProposeBeforeAssign').checked = rules.requireProposeBeforeAssign;

    const checkboxes = document.querySelectorAll('.completable-status-checkbox');
    checkboxes.forEach(function(cb) {
        cb.checked = rules.completableStatuses.includes(cb.value);
    });

    updateCompletableStatusHint();
}

function updateCompletableStatusHint() {
    const checkboxes = document.querySelectorAll('.completable-status-checkbox:checked');
    const hint = document.getElementById('completableStatusHint');
    if (checkboxes.length === 0) {
        hint.textContent = '警告：未选择任何可办结状态，将无法对任何收文进行办结操作';
        hint.style.color = '#cf1322';
    } else {
        hint.textContent = '';
    }
}

function saveFlowRuleSettings() {
    const oldRules = getFlowRules();

    const normalDays = parseInt(document.getElementById('urgencyDaysNormal').value, 10);
    const urgentDays = parseInt(document.getElementById('urgencyDaysUrgent').value, 10);
    const extraUrgentDays = parseInt(document.getElementById('urgencyDaysExtraUrgent').value, 10);

    if (!normalDays || normalDays < 1 || normalDays > 365) {
        showToast('普通紧急程度的办理天数必须在1-365之间', 'error');
        return;
    }
    if (!urgentDays || urgentDays < 1 || urgentDays > 365) {
        showToast('加急紧急程度的办理天数必须在1-365之间', 'error');
        return;
    }
    if (!extraUrgentDays || extraUrgentDays < 1 || extraUrgentDays > 365) {
        showToast('特急紧急程度的办理天数必须在1-365之间', 'error');
        return;
    }

    const requirePropose = document.getElementById('requireProposeBeforeAssign').checked;

    const completableStatuses = [];
    const checkboxes = document.querySelectorAll('.completable-status-checkbox:checked');
    checkboxes.forEach(function(cb) {
        completableStatuses.push(cb.value);
    });

    if (completableStatuses.length === 0) {
        if (!confirm('未选择任何可办结状态，将无法对任何收文进行办结操作。确定要保存吗？')) {
            return;
        }
    }

    const newRules = {
        version: '1.0',
        urgencyDeadlineDays: {
            '普通': normalDays,
            '加急': urgentDays,
            '特急': extraUrgentDays
        },
        requireProposeBeforeAssign: requirePropose,
        completableStatuses: completableStatuses
    };

    const changes = getFlowRulesChangesSummary(oldRules, newRules);
    if (changes === '无变更') {
        showToast('规则未发生变化', 'info');
        closeFlowRuleModal();
        return;
    }

    const savedRules = saveFlowRules(newRules);
    addFlowRuleChangeAuditLog(oldRules, savedRules);
    showToast('流程规则已保存', 'success');
    closeFlowRuleModal();

    renderDocumentList();
    updateStats();
}

function resetFlowRules() {
    if (!confirm('确定要恢复为默认规则吗？')) {
        return;
    }

    const oldRules = getFlowRules();
    const defaultRules = getDefaultFlowRules();
    const savedRules = saveFlowRules(defaultRules);
    addFlowRuleChangeAuditLog(oldRules, savedRules);
    loadFlowRuleSettings();
    showToast('已恢复为默认规则', 'success');

    renderDocumentList();
    updateStats();
}

function getDocSummary(doc) {
    if (!doc) return '-';
    const parts = [];
    if (doc.title) parts.push('标题：' + doc.title);
    if (doc.docNumber) parts.push('文号：' + doc.docNumber);
    if (doc.fromUnit) parts.push('来文单位：' + doc.fromUnit);
    const dept = doc.undertakingDepartment || doc.department;
    if (dept) parts.push('承办科室：' + dept);
    if (doc.urgency) parts.push('紧急程度：' + doc.urgency);
    if (doc.deadline) parts.push('办理期限：' + doc.deadline);
    if (doc.flowStatus) parts.push('状态：' + (FLOW_ACTION_TEXT[doc.flowStatus] || doc.flowStatus));
    return parts.join('；');
}

function getChangesSummary(oldDoc, newDoc) {
    if (!oldDoc) return '新增收文';
    if (!newDoc) return '删除收文';
    const changes = [];
    const fields = [
        { key: 'title', label: '标题' },
        { key: 'docNumber', label: '文号' },
        { key: 'fromUnit', label: '来文单位' },
        { key: 'urgency', label: '紧急程度' },
        { key: 'deadline', label: '办理期限' },
        { key: 'undertakingDepartment', label: '承办科室' },
        { key: 'proposedDepartment', label: '拟办科室' },
        { key: 'remark', label: '备注' },
        { key: 'flowStatus', label: '流转状态' }
    ];
    fields.forEach(function(f) {
        const oldVal = oldDoc[f.key] || '';
        const newVal = newDoc[f.key] || '';
        if (oldVal !== newVal) {
            changes.push(f.label + '：' + (oldVal || '空') + ' → ' + (newVal || '空'));
        }
    });
    if (changes.length === 0) return '无变更';
    return changes.join('；');
}

function addAuditLog(action, doc, oldDoc, extra) {
    const logs = getAuditLogs();
    const now = new Date().toISOString();

    let beforeSummary = '';
    let afterSummary = '';

    if (action === AUDIT_ACTION.CREATE || action === AUDIT_ACTION.IMPORT || action === AUDIT_ACTION.RESTORE) {
        afterSummary = getDocSummary(doc);
        beforeSummary = '-';
    } else if (action === AUDIT_ACTION.DELETE || action === AUDIT_ACTION.PERMANENT_DELETE) {
        beforeSummary = getDocSummary(doc);
        afterSummary = '-';
    } else if (action === AUDIT_ACTION.RESTORE_RECYCLE) {
        beforeSummary = getDocSummary(doc) + '（已删除）';
        afterSummary = getDocSummary(doc) + '（已恢复）';
    } else {
        beforeSummary = getDocSummary(oldDoc);
        afterSummary = getDocSummary(doc);
    }

    const log = {
        id: generateId(),
        action: action,
        actionText: AUDIT_ACTION_TEXT[action] || action,
        docId: doc ? doc.id : null,
        docTitle: doc ? (doc.title || '') : '',
        docNumber: doc ? (doc.docNumber || '') : '',
        beforeSummary: beforeSummary,
        afterSummary: afterSummary,
        changes: oldDoc ? getChangesSummary(oldDoc, doc) : '',
        timestamp: now,
        extra: extra || null
    };

    logs.unshift(log);

    if (logs.length > 1000) {
        logs.length = 1000;
    }

    saveAuditLogs(logs);
}

function getCurrentFormTemplateData() {
    const fromUnit = document.getElementById('fromUnit').value.trim();
    const urgency = document.getElementById('urgency').value;
    const department = document.getElementById('department') ? document.getElementById('department').value : '';
    const proposedDepartment = document.getElementById('proposedDepartment') ? document.getElementById('proposedDepartment').value : '';
    const undertakingDepartment = document.getElementById('undertakingDepartment') ? document.getElementById('undertakingDepartment').value : department;
    const coDepartments = getAddCoDepartments();
    const deadline = document.getElementById('deadline').value;
    const receiveDate = document.getElementById('receiveDate').value;
    const remark = document.getElementById('remark').value.trim();

    let deadlineDays = 7;
    if (deadline && receiveDate) {
        deadlineDays = Math.ceil((new Date(deadline) - new Date(receiveDate)) / (1000 * 60 * 60 * 24));
        if (deadlineDays < 0) deadlineDays = 7;
    }

    return {
        fromUnit: fromUnit,
        urgency: urgency,
        department: undertakingDepartment || department,
        proposedDepartment: proposedDepartment,
        undertakingDepartment: undertakingDepartment || department,
        coDepartments: coDepartments,
        deadlineDays: deadlineDays,
        remark: remark
    };
}

function isTemplateContentEqual(a, b) {
    const coDepEqual = JSON.stringify(a.coDepartments || []) === JSON.stringify(b.coDepartments || []);
    return a.fromUnit === b.fromUnit &&
        a.urgency === b.urgency &&
        a.undertakingDepartment === b.undertakingDepartment &&
        a.proposedDepartment === b.proposedDepartment &&
        coDepEqual &&
        a.deadlineDays === b.deadlineDays &&
        a.remark === b.remark;
}

function findDuplicateTemplate(name, content) {
    const templates = getTemplates();
    const nameDup = templates.find(function(t) { return t.name === name; });
    const contentDup = templates.find(function(t) { return isTemplateContentEqual(t, content); });
    return { nameDup: nameDup, contentDup: contentDup };
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
        if (deleteBtn) deleteBtn.style.display = 'none';
        return;
    }

    const templates = getTemplates();
    const tpl = templates.find(function(t) { return t.id === templateId; });
    if (!tpl) return;

    document.getElementById('fromUnit').value = tpl.fromUnit || '';
    document.getElementById('urgency').value = tpl.urgency || '普通';
    document.getElementById('remark').value = tpl.remark || '';

    const deptEl = document.getElementById('department');
    if (deptEl) deptEl.value = tpl.department || tpl.undertakingDepartment || '';

    const proposedDeptEl = document.getElementById('proposedDepartment');
    if (proposedDeptEl) proposedDeptEl.value = tpl.proposedDepartment || '';

    const undertakingDeptEl = document.getElementById('undertakingDepartment');
    if (undertakingDeptEl) undertakingDeptEl.value = tpl.undertakingDepartment || tpl.department || '';

    renderCoDeptCheckboxesAdd(tpl.coDepartments || []);

    if (tpl.deadlineDays && tpl.deadlineDays > 0) {
        const receiveDate = document.getElementById('receiveDate').value;
        if (receiveDate) {
            const deadline = new Date(receiveDate);
            deadline.setDate(deadline.getDate() + parseInt(tpl.deadlineDays));
            document.getElementById('deadline').value = formatDateInput(deadline);
        }
    }

    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
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

    updateTemplateDupTip();

    document.getElementById('saveTemplateModal').classList.add('show');
    setTimeout(function() {
        document.getElementById('templateName').focus();
    }, 100);
}

function updateTemplateDupTip() {
    const name = document.getElementById('templateName').value.trim();
    const dupTip = document.getElementById('templateDupTip');
    const dupText = document.getElementById('templateDupText');

    if (!name) {
        dupTip.style.display = 'none';
        return;
    }

    const formData = getCurrentFormTemplateData();
    const { nameDup, contentDup } = findDuplicateTemplate(name, formData);

    if (nameDup && contentDup && nameDup.id === contentDup.id) {
        dupTip.className = 'template-duplicate-tip dup-warn';
        dupText.textContent = '已存在同名且内容完全相同的模板';
        dupTip.style.display = 'flex';
    } else if (nameDup) {
        dupTip.className = 'template-duplicate-tip dup-warn';
        dupText.textContent = '已存在同名模板，保存将覆盖原有内容';
        dupTip.style.display = 'flex';
    } else if (contentDup) {
        dupTip.className = 'template-duplicate-tip dup-info';
        dupText.textContent = '与模板「' + contentDup.name + '」内容相同，考虑直接使用？';
        dupTip.style.display = 'flex';
    } else {
        dupTip.style.display = 'none';
    }
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

    const formData = getCurrentFormTemplateData();
    const { nameDup, contentDup } = findDuplicateTemplate(name, formData);

    if (contentDup && contentDup.name === name) {
        showToast('已存在完全相同的模板：' + name, 'info');
        return;
    }

    if (contentDup && contentDup.name !== name) {
        if (!confirm('检测到与模板「' + contentDup.name + '」内容完全相同，仍要保存为新模板吗？')) {
            return;
        }
    }

    if (nameDup) {
        if (!confirm('已存在名为「' + name + '」的模板，是否覆盖？\n\n覆盖后原模板内容将被替换，此操作不可恢复。')) {
            return;
        }
        const templates = getTemplates();
        const index = templates.findIndex(function(t) { return t.id === nameDup.id; });
        if (index !== -1) {
            templates[index] = {
                ...templates[index],
                ...formData,
                updatedAt: new Date().toISOString()
            };
            saveTemplates(templates);
            renderTemplateSelect();
            document.getElementById('templateSelect').value = nameDup.id;
            document.getElementById('deleteTemplateBtn').style.display = 'inline-flex';
            closeSaveTemplateModal();
            showToast('模板已更新', 'success');
            return;
        }
    }

    const templates = getTemplates();
    const newTemplate = {
        id: generateId(),
        name: name,
        ...formData,
        createdAt: new Date().toISOString()
    };

    templates.unshift(newTemplate);
    saveTemplates(templates);
    renderTemplateSelect();
    document.getElementById('templateSelect').value = newTemplate.id;
    document.getElementById('deleteTemplateBtn').style.display = 'inline-flex';

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

function getLatestFlowRecord(doc) {
    if (!doc.flowRecords || doc.flowRecords.length === 0) {
        return null;
    }
    const sorted = doc.flowRecords.slice().sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return sorted[0];
}

function renderLatestFlowRecordSummary(doc) {
    const latest = getLatestFlowRecord(doc);
    if (!latest) {
        return '';
    }
    const actionText = FLOW_ACTION_TEXT[latest.action] || latest.action;
    const content = latest.opinion || '';
    const summary = content.length > 40 ? content.substring(0, 40) + '...' : content;
    const handlerText = latest.handler ? ' · ' + escapeHtml(latest.handler) : '';
    const time = formatDateTime(latest.createdAt);
    return `
        <div class="doc-latest-record">
            <span class="latest-record-icon">🔄</span>
            <span class="latest-record-type">${actionText}</span>
            <span class="latest-record-content">${escapeHtml(summary) || '—'}</span>
            <span class="latest-record-meta">${time}${handlerText}</span>
        </div>
    `;
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

function renderFlowTimeline(doc) {
    const flowRecords = (doc.flowRecords || []).map(function(record) {
        return {
            type: 'flow',
            createdAt: record.createdAt,
            record: record
        };
    });
    const supervisionRecords = (doc.supervisionRecords || []).map(function(record) {
        return {
            type: 'supervision',
            createdAt: record.createdAt,
            record: record
        };
    });
    const records = flowRecords.concat(supervisionRecords);
    if (records.length === 0) {
        return '<div class="records-empty">暂无流转记录</div>';
    }
    const sortedRecords = records.slice().sort(function(a, b) {
        return new Date(a.createdAt) - new Date(b.createdAt);
    });
    let html = '<div class="flow-timeline">';
    sortedRecords.forEach(function(item, index) {
        const isLast = index === sortedRecords.length - 1;
        const record = item.record;

        if (item.type === 'supervision') {
            const isPending = record.status === SUPERVISION_STATUS.PENDING;
            const statusText = isPending ? '待反馈' : '已反馈';
            const statusClass = isPending ? 'supervision-pending' : 'supervision-feedback';

            html += `
                <div class="flow-timeline-item supervision-timeline-item ${statusClass} ${isLast ? 'flow-last' : ''}">
                    <div class="flow-timeline-dot">
                        <span class="flow-dot-icon">📢</span>
                    </div>
                    <div class="flow-timeline-line"></div>
                    <div class="flow-timeline-content">
                        <div class="flow-timeline-header">
                            <span class="flow-action-tag">${isPending ? '发起督办' : '督办反馈'}</span>
                            <span class="supervision-status-tag">${statusText}</span>
                            <span class="flow-time">${formatDateTime(record.createdAt)}</span>
                        </div>
                        <div class="supervision-detail">
                            <div class="supervision-detail-row">
                                <span class="supervision-detail-label">督办原因：</span>
                                <span class="supervision-detail-value">${escapeHtml(record.reason)}</span>
                            </div>
                            ${record.supervisor ? `
                            <div class="supervision-detail-row">
                                <span class="supervision-detail-label">督办人：</span>
                                <span class="supervision-detail-value">${escapeHtml(record.supervisor)}</span>
                            </div>
                            ` : ''}
                            <div class="supervision-detail-row">
                                <span class="supervision-detail-label">要求反馈：</span>
                                <span class="supervision-detail-value">${formatDate(record.feedbackDeadline)}</span>
                            </div>
                        </div>
                        ${!isPending ? `
                            <div class="supervision-result">
                                <div class="supervision-result-label">处理结果：</div>
                                <div class="supervision-result-content">${escapeHtml(record.result)}</div>
                                ${record.feedbackAt ? `<div class="supervision-feedback-time">反馈时间：${formatDateTime(record.feedbackAt)}</div>` : ''}
                            </div>
                        ` : ''}
                        ${isPending && !doc.isDeleted ? `
                            <div class="supervision-actions">
                                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); openSupervisionFeedbackModal('${doc.id}')">反馈</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            return;
        }

        const actionText = FLOW_ACTION_TEXT[record.action] || record.action;
        const fromStatusText = record.fromStatus ? FLOW_STATUS_TEXT[record.fromStatus] : '-';
        const toStatusText = record.toStatus ? FLOW_STATUS_TEXT[record.toStatus] : '-';
        const statusChange = record.fromStatus && record.toStatus ?
            `<span class="flow-status-change">${fromStatusText} → ${toStatusText}</span>` : '';

        let icon = '📄';
        if (record.action === FLOW_ACTION.CREATE) icon = '📝';
        else if (record.action === FLOW_ACTION.PROPOSE) icon = '💡';
        else if (record.action === FLOW_ACTION.ASSIGN) icon = '📤';
        else if (record.action === FLOW_ACTION.PROGRESS) icon = '🔄';
        else if (record.action === FLOW_ACTION.FEEDBACK) icon = '📥';
        else if (record.action === FLOW_ACTION.COMPLETE) icon = '✅';

        const isComplete = record.action === FLOW_ACTION.COMPLETE;

        html += `
            <div class="flow-timeline-item ${isComplete ? 'flow-complete' : ''} ${isLast ? 'flow-last' : ''}">
                <div class="flow-timeline-dot">
                    <span class="flow-dot-icon">${icon}</span>
                </div>
                <div class="flow-timeline-line"></div>
                <div class="flow-timeline-content">
                    <div class="flow-timeline-header">
                        <span class="flow-action-tag">${actionText}</span>
                        ${statusChange}
                        <span class="flow-time">${formatDateTime(record.createdAt)}</span>
                    </div>
                    ${record.opinion ? `<div class="flow-opinion">${escapeHtml(record.opinion)}</div>` : ''}
                    <div class="flow-meta">
                        ${record.handler ? `<span class="flow-meta-item">👤 ${escapeHtml(record.handler)}</span>` : ''}
                        ${record.department ? `<span class="flow-meta-item">🏢 ${escapeHtml(record.department)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
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

function getEffectiveDeadline(doc) {
    if (doc.extendedDeadline) {
        return doc.extendedDeadline;
    }
    return doc.deadline;
}

function getDaysRemaining(deadline) {
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const today = getToday();
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function isReminderSnoozed(doc) {
    if (!doc.snoozeUntil) return false;
    const snoozeDate = new Date(doc.snoozeUntil);
    snoozeDate.setHours(0, 0, 0, 0);
    const today = getToday();
    return today <= snoozeDate;
}

function shouldShowInReminderCenter(doc) {
    if (doc.flowStatus === FLOW_STATUS.DONE) {
        return false;
    }
    if (isReminderSnoozed(doc)) {
        return false;
    }
    const effectiveDeadline = getEffectiveDeadline(doc);
    const daysRemaining = getDaysRemaining(effectiveDeadline);
    return daysRemaining <= 3;
}

function getReminderGroup(doc) {
    const effectiveDeadline = getEffectiveDeadline(doc);
    const daysRemaining = getDaysRemaining(effectiveDeadline);
    if (daysRemaining < 0) {
        return 'overdue';
    }
    if (daysRemaining === 0) {
        return 'today';
    }
    if (daysRemaining <= 3) {
        return 'soon';
    }
    return 'normal';
}

function getDeadlineStatus(doc) {
    if (doc.flowStatus === FLOW_STATUS.DONE) {
        return 'normal';
    }
    const effectiveDeadline = getEffectiveDeadline(doc);
    const daysRemaining = getDaysRemaining(effectiveDeadline);
    if (daysRemaining < 0) {
        return 'overdue';
    }
    if (daysRemaining <= 3) {
        return 'urgent';
    }
    return 'normal';
}

function getDocumentStatus(doc) {
    return doc.flowStatus || FLOW_STATUS.PENDING_REVIEW;
}

function getFlowStatusText(status) {
    return FLOW_STATUS_TEXT[status] || '待拟办';
}

function getDeadlineStatusText(status) {
    const statusMap = {
        'normal': '正常',
        'urgent': '即将到期',
        'overdue': '已逾期'
    };
    return statusMap[status] || '正常';
}

function getStatusText(status) {
    return getFlowStatusText(status);
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
    let pendingReviewCount = 0;
    let processingCount = 0;
    let pendingFeedbackCount = 0;
    let doneCount = 0;
    let urgentCount = 0;
    let overdueCount = 0;

    documents.forEach(doc => {
        const flowStatus = getDocumentStatus(doc);
        const deadlineStatus = getDeadlineStatus(doc);

        if (flowStatus === FLOW_STATUS.PENDING_REVIEW) {
            pendingReviewCount++;
        } else if (flowStatus === FLOW_STATUS.PROCESSING) {
            processingCount++;
        } else if (flowStatus === FLOW_STATUS.PENDING_FEEDBACK) {
            pendingFeedbackCount++;
        } else if (flowStatus === FLOW_STATUS.DONE) {
            doneCount++;
        }

        if (deadlineStatus === 'urgent') {
            urgentCount++;
        } else if (deadlineStatus === 'overdue') {
            overdueCount++;
        }
    });

    const pendingCountEl = document.getElementById('pendingCount');
    if (pendingCountEl) pendingCountEl.textContent = pendingReviewCount;
    const processingCountEl = document.getElementById('processingCount');
    if (processingCountEl) processingCountEl.textContent = processingCount;
    const feedbackCountEl = document.getElementById('feedbackCount');
    if (feedbackCountEl) feedbackCountEl.textContent = pendingFeedbackCount;
    const doneCountEl = document.getElementById('doneCount');
    if (doneCountEl) doneCountEl.textContent = doneCount;
    const totalCountEl = document.getElementById('totalCount');
    if (totalCountEl) totalCountEl.textContent = documents.length;
    const urgentCountEl = document.getElementById('urgentCount');
    if (urgentCountEl) urgentCountEl.textContent = urgentCount + overdueCount;

    const tabPendingReviewBadge = document.getElementById('tabPendingReviewBadge');
    if (tabPendingReviewBadge) tabPendingReviewBadge.textContent = pendingReviewCount;
    const tabProcessingBadge = document.getElementById('tabProcessingBadge');
    if (tabProcessingBadge) tabProcessingBadge.textContent = processingCount;
    const tabFeedbackBadge = document.getElementById('tabFeedbackBadge');
    if (tabFeedbackBadge) tabFeedbackBadge.textContent = pendingFeedbackCount;
    const tabDoneBadge = document.getElementById('tabDoneBadge');
    if (tabDoneBadge) tabDoneBadge.textContent = doneCount;
    const tabUrgentBadge = document.getElementById('tabUrgentBadge');
    if (tabUrgentBadge) tabUrgentBadge.textContent = urgentCount + overdueCount;

    if (currentView === 'board') {
        renderDepartmentBoard();
    }
}

function isHighRiskDoc(doc) {
    const deadlineStatus = getDeadlineStatus(doc);
    const hasPendingSup = hasPendingSupervision(doc);
    if (hasPendingSup) return true;
    if (deadlineStatus === 'overdue' && doc.urgency === '特急') return true;
    return false;
}

function getDocProcessingDays(doc) {
    const receiveDate = new Date(doc.receiveDate);
    receiveDate.setHours(0, 0, 0, 0);
    let endDate;
    if (doc.flowStatus === FLOW_STATUS.DONE && doc.completedAt) {
        endDate = new Date(doc.completedAt);
    } else {
        endDate = new Date();
    }
    endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate - receiveDate;
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    return diffDays;
}

function get7DaysAgo() {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getDepartmentStats() {
    const documents = getDocuments();
    const filteredDocs = filterDocuments(documents, currentTab, searchKeyword, advancedFilter);
    const stats = {};
    const sevenDaysAgo = get7DaysAgo();

    DEPARTMENT_LIST.forEach(dept => {
        stats[dept] = {
            pending_review: 0,
            processing: 0,
            pending_feedback: 0,
            urgent: 0,
            overdue: 0,
            done: 0,
            total: 0,
            recent7DaysNew: 0,
            overdueRate: 0,
            avgProcessingDays: 0,
            highRiskCount: 0,
            _processingDaysTotal: 0,
            _processingDaysCount: 0
        };
    });

    filteredDocs.forEach(doc => {
        const dept = doc.undertakingDepartment || doc.department || '';
        if (!dept) return;

        if (!stats[dept]) {
            stats[dept] = {
                pending_review: 0,
                processing: 0,
                pending_feedback: 0,
                urgent: 0,
                overdue: 0,
                done: 0,
                total: 0,
                recent7DaysNew: 0,
                overdueRate: 0,
                avgProcessingDays: 0,
                highRiskCount: 0,
                _processingDaysTotal: 0,
                _processingDaysCount: 0
            };
        }

        const flowStatus = getDocumentStatus(doc);
        const deadlineStatus = getDeadlineStatus(doc);

        stats[dept].total++;

        if (flowStatus === FLOW_STATUS.PENDING_REVIEW) {
            stats[dept].pending_review++;
        } else if (flowStatus === FLOW_STATUS.PROCESSING) {
            stats[dept].processing++;
        } else if (flowStatus === FLOW_STATUS.PENDING_FEEDBACK) {
            stats[dept].pending_feedback++;
        } else if (flowStatus === FLOW_STATUS.DONE) {
            stats[dept].done++;
        }

        if (deadlineStatus === 'urgent') {
            stats[dept].urgent++;
        } else if (deadlineStatus === 'overdue') {
            stats[dept].overdue++;
        }

        const createdAt = new Date(doc.createdAt || doc.receiveDate);
        if (createdAt >= sevenDaysAgo) {
            stats[dept].recent7DaysNew++;
        }

        if (isHighRiskDoc(doc)) {
            stats[dept].highRiskCount++;
        }

        if (doc.receiveDate) {
            const days = getDocProcessingDays(doc);
            stats[dept]._processingDaysTotal += days;
            stats[dept]._processingDaysCount++;
        }
    });

    DEPARTMENT_LIST.forEach(dept => {
        if (stats[dept]) {
            const s = stats[dept];
            s.overdueRate = s.total > 0 ? Math.round(s.overdue / s.total * 100) : 0;
            s.avgProcessingDays = s._processingDaysCount > 0 ? Math.round(s._processingDaysTotal / s._processingDaysCount * 10) / 10 : 0;
            delete s._processingDaysTotal;
            delete s._processingDaysCount;
        }
    });

    return stats;
}

let boardDrillContext = null;

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
        const s = stats[dept] || {
            pending_review: 0, processing: 0, pending_feedback: 0,
            urgent: 0, overdue: 0, done: 0, total: 0,
            recent7DaysNew: 0, overdueRate: 0, avgProcessingDays: 0, highRiskCount: 0
        };
        const hasData = s.total > 0;
        const doneRate = s.total > 0 ? Math.round(s.done / s.total * 100) : 0;

        const loadLevel = s.overdueRate >= 30 || s.highRiskCount >= 3 ? 'high' :
                         (s.overdueRate >= 15 || s.highRiskCount >= 1 ? 'medium' : 'normal');

        return `
            <div class="board-card board-card-load-${loadLevel} ${hasData ? '' : 'board-card-empty'}" data-dept="${escapeHtml(dept)}">
                <div class="board-card-header">
                    <div class="board-dept-name">
                        ${escapeHtml(dept)}
                        ${hasData && s.highRiskCount > 0 ? '<span class="board-high-risk-badge">⚠ 高风险</span>' : ''}
                    </div>
                    <div class="board-dept-total">
                        <span class="board-total-number">${s.total}</span>
                        <span class="board-total-label">件</span>
                    </div>
                </div>

                <div class="board-card-section-title">
                    <span class="section-title-icon">📈</span> 负荷预警
                </div>
                <div class="board-card-load-stats">
                    <div class="board-load-item clickable" onclick="event.stopPropagation(); drillDepartmentMetric('${dept}', 'recent7Days')" title="点击查看近7天新增收文">
                        <div class="board-load-number recent">${s.recent7DaysNew}</div>
                        <div class="board-load-label">近7天新增</div>
                    </div>
                    <div class="board-load-item clickable" onclick="event.stopPropagation(); drillDepartmentMetric('${dept}', 'overdueRate')" title="点击查看逾期收文">
                        <div class="board-load-number ${s.overdueRate >= 30 ? 'high-risk' : s.overdueRate >= 15 ? 'warn' : ''}">${s.overdueRate}%</div>
                        <div class="board-load-label">逾期率</div>
                    </div>
                    <div class="board-load-item clickable" onclick="event.stopPropagation(); drillDepartmentMetric('${dept}', 'avgDays')" title="点击查看按办理天数排序">
                        <div class="board-load-number avg-days">${s.avgProcessingDays}</div>
                        <div class="board-load-label">平均办理天数</div>
                    </div>
                    <div class="board-load-item clickable" onclick="event.stopPropagation(); drillDepartmentMetric('${dept}', 'highRisk')" title="点击查看高风险收文">
                        <div class="board-load-number ${s.highRiskCount > 0 ? 'high-risk' : ''}">${s.highRiskCount}</div>
                        <div class="board-load-label">高风险收文</div>
                    </div>
                </div>

                <div class="board-card-section-title">
                    <span class="section-title-icon">📋</span> 状态分布
                </div>
                <div class="board-card-stats">
                    <div class="board-stat-item pending_review clickable" onclick="event.stopPropagation(); drillDepartmentMetric('${dept}', 'pending_review')" title="点击查看待拟办">
                        <div class="board-stat-number">${s.pending_review}</div>
                        <div class="board-stat-label">待拟办</div>
                    </div>
                    <div class="board-stat-item processing clickable" onclick="event.stopPropagation(); drillDepartmentMetric('${dept}', 'processing')" title="点击查看办理中">
                        <div class="board-stat-number">${s.processing}</div>
                        <div class="board-stat-label">办理中</div>
                    </div>
                    <div class="board-stat-item pending_feedback clickable" onclick="event.stopPropagation(); drillDepartmentMetric('${dept}', 'pending_feedback')" title="点击查看待反馈">
                        <div class="board-stat-number">${s.pending_feedback}</div>
                        <div class="board-stat-label">待反馈</div>
                    </div>
                    <div class="board-stat-item done clickable" onclick="event.stopPropagation(); drillDepartmentMetric('${dept}', 'done')" title="点击查看已办结">
                        <div class="board-stat-number">${s.done}</div>
                        <div class="board-stat-label">已办结</div>
                    </div>
                </div>

                <div class="board-card-urgent">
                    ${s.urgent > 0 ? `<span class="board-urgent-tag urgent clickable" onclick="event.stopPropagation(); drillDepartmentMetric('${dept}', 'urgent')" title="点击查看即将到期">即将到期 ${s.urgent}</span>` : ''}
                    ${s.overdue > 0 ? `<span class="board-urgent-tag overdue clickable" onclick="event.stopPropagation(); drillDepartmentMetric('${dept}', 'overdue')" title="点击查看已逾期">已逾期 ${s.overdue}</span>` : ''}
                    ${s.urgent === 0 && s.overdue === 0 ? '<span class="board-urgent-tag normal">暂无超期</span>' : ''}
                </div>

                <div class="board-card-progress">
                    <div class="board-progress-bar">
                        <div class="board-progress-fill done" style="width: ${doneRate}%"></div>
                    </div>
                    <div class="board-progress-text">办结率 ${doneRate}%</div>
                </div>

                ${hasData ? `
                    <div class="board-card-actions">
                        <div class="board-card-action" onclick="event.stopPropagation(); viewDepartmentDocuments('${dept}')">
                            查看全部 →
                        </div>
                    </div>
                ` : '<div class="board-card-empty-tip">暂无收文</div>'}
            </div>
        `;
    }).join('');
}

function drillDepartmentMetric(dept, metric) {
    boardDrillContext = {
        dept: dept,
        metric: metric,
        fromBoard: true,
        previousTab: currentTab,
        previousFilter: { ...advancedFilter },
        previousKeyword: searchKeyword
    };

    advancedFilter.department = dept;
    document.getElementById('filterDepartment').value = dept;

    let tab = 'all';
    let extraFilterInfo = '';

    switch (metric) {
        case 'pending_review':
            tab = 'pending_review';
            extraFilterInfo = '待拟办';
            break;
        case 'processing':
            tab = 'processing';
            extraFilterInfo = '办理中';
            break;
        case 'pending_feedback':
            tab = 'pending_feedback';
            extraFilterInfo = '待反馈';
            break;
        case 'done':
            tab = 'done';
            extraFilterInfo = '已办结';
            break;
        case 'urgent':
            tab = 'urgent';
            extraFilterInfo = '即将到期';
            break;
        case 'overdue':
        case 'overdueRate':
            tab = 'urgent';
            extraFilterInfo = '已逾期/即将到期';
            boardDrillContext.overdueOnly = true;
            break;
        case 'recent7Days':
            tab = 'all';
            extraFilterInfo = '近7天新增';
            boardDrillContext.recent7DaysOnly = true;
            break;
        case 'highRisk':
            tab = 'all';
            extraFilterInfo = '高风险';
            boardDrillContext.highRiskOnly = true;
            break;
        case 'avgDays':
            tab = 'all';
            extraFilterInfo = '按办理天数排序';
            boardDrillContext.sortByProcessingDays = true;
            break;
    }

    detachFromViewPreset();
    updateFilterActiveBadge();
    switchView('list');
    switchTab(tab);
    selectedIds = [];

    updateDrillIndicator(dept, extraFilterInfo);
}

function updateDrillIndicator(dept, filterInfo) {
    let indicator = document.getElementById('drillIndicator');
    if (!indicator) {
        const listTabs = document.getElementById('listTabs');
        if (!listTabs) return;
        indicator = document.createElement('div');
        indicator.id = 'drillIndicator';
        indicator.className = 'drill-indicator';
        listTabs.parentNode.insertBefore(indicator, listTabs.nextSibling);
    }

    indicator.innerHTML = `
        <span class="drill-crumb" onclick="returnToBoard()">
            ← 返回科室看板
        </span>
        <span class="drill-separator">/</span>
        <span class="drill-dept">${escapeHtml(dept)}</span>
        <span class="drill-separator">/</span>
        <span class="drill-filter">${escapeHtml(filterInfo)}</span>
    `;
    indicator.style.display = 'flex';
}

function hideDrillIndicator() {
    const indicator = document.getElementById('drillIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

function returnToBoard() {
    if (boardDrillContext) {
        currentTab = boardDrillContext.previousTab || 'all';
        searchKeyword = boardDrillContext.previousKeyword || '';
        if (boardDrillContext.previousFilter) {
            advancedFilter = { ...boardDrillContext.previousFilter };
        }
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = searchKeyword;
        const filterDeptEl = document.getElementById('filterDepartment');
        if (filterDeptEl) filterDeptEl.value = advancedFilter.department || '';
        const filterUrgencyEl = document.getElementById('filterUrgency');
        if (filterUrgencyEl) filterUrgencyEl.value = advancedFilter.urgency || '';
        const filterReceiveStartEl = document.getElementById('filterReceiveDateStart');
        if (filterReceiveStartEl) filterReceiveStartEl.value = advancedFilter.receiveDateStart || '';
        const filterReceiveEndEl = document.getElementById('filterReceiveDateEnd');
        if (filterReceiveEndEl) filterReceiveEndEl.value = advancedFilter.receiveDateEnd || '';
        const filterDeadlineStartEl = document.getElementById('filterDeadlineStart');
        if (filterDeadlineStartEl) filterDeadlineStartEl.value = advancedFilter.deadlineStart || '';
        const filterDeadlineEndEl = document.getElementById('filterDeadlineEnd');
        if (filterDeadlineEndEl) filterDeadlineEndEl.value = advancedFilter.deadlineEnd || '';

        document.querySelectorAll('.tab').forEach(t => {
            t.classList.remove('active');
        });
        const activeTab = document.querySelector(`.tab[data-tab="${currentTab}"]`);
        if (activeTab) activeTab.classList.add('active');

        updateFilterActiveBadge();
    }
    boardDrillContext = null;
    hideDrillIndicator();
    switchView('board');
}

function isDrillFilterActive() {
    return boardDrillContext && (
        boardDrillContext.overdueOnly ||
        boardDrillContext.recent7DaysOnly ||
        boardDrillContext.highRiskOnly ||
        boardDrillContext.sortByProcessingDays
    );
}

function applyDrillFilters(docs) {
    if (!boardDrillContext) return docs;

    let filtered = docs;

    if (boardDrillContext.overdueOnly) {
        filtered = filtered.filter(doc => {
            const deadlineStatus = getDeadlineStatus(doc);
            return deadlineStatus === 'overdue';
        });
    }

    if (boardDrillContext.recent7DaysOnly) {
        const sevenDaysAgo = get7DaysAgo();
        filtered = filtered.filter(doc => {
            const createdAt = new Date(doc.createdAt || doc.receiveDate);
            return createdAt >= sevenDaysAgo;
        });
    }

    if (boardDrillContext.highRiskOnly) {
        filtered = filtered.filter(doc => isHighRiskDoc(doc));
    }

    return filtered;
}

function applyDrillSorting(docs) {
    if (!boardDrillContext || !boardDrillContext.sortByProcessingDays) return docs;

    const sorted = docs.slice().sort(function(a, b) {
        const daysA = getDocProcessingDays(a);
        const daysB = getDocProcessingDays(b);
        return daysB - daysA;
    });

    return sorted;
}

function clearDrillSpecialFilters() {
    if (!boardDrillContext) return;
    boardDrillContext.overdueOnly = false;
    boardDrillContext.recent7DaysOnly = false;
    boardDrillContext.highRiskOnly = false;
    boardDrillContext.sortByProcessingDays = false;
    boardDrillContext.metric = 'all';
    if (boardDrillContext.dept) {
        updateDrillIndicator(boardDrillContext.dept, '全部');
    }
}

let switchingFromPreset = false;

function switchView(view) {
    currentView = view;

    document.querySelectorAll('.view-tab').forEach(t => {
        t.classList.remove('active');
    });
    const viewTab = document.querySelector(`.view-tab[data-view="${view}"]`);
    if (viewTab) viewTab.classList.add('active');

    if (!switchingFromPreset && (view === 'list' || view === 'board') && currentViewPresetId) {
        detachFromViewPreset();
    }

    const listTabs = document.getElementById('listTabs');
    const batchToolbar = document.getElementById('batchToolbar');
    const departmentBoard = document.getElementById('departmentBoard');
    const documentList = document.getElementById('documentList');
    const auditLogSection = document.getElementById('auditLogSection');
    const recycleBinSection = document.getElementById('recycleBinSection');
    const filterSection = document.querySelector('.filter-section');
    const viewSwitcher = document.querySelector('.view-switcher');
    const statsSection = document.querySelector('.stats-section');
    const reminderCenter = document.querySelector('.reminder-center');

    if (view === 'audit_log') {
        if (viewSwitcher) viewSwitcher.style.display = 'none';
        if (listTabs) listTabs.style.display = 'none';
        if (batchToolbar) batchToolbar.style.display = 'none';
        if (departmentBoard) departmentBoard.style.display = 'none';
        if (filterSection) filterSection.style.display = 'none';
        if (statsSection) statsSection.style.display = 'none';
        if (reminderCenter) reminderCenter.style.display = 'none';
        documentList.style.display = 'none';
        auditLogSection.style.display = 'block';
        recycleBinSection.style.display = 'none';
        renderAuditLogList();
    } else if (view === 'recycle_bin') {
        if (viewSwitcher) viewSwitcher.style.display = 'none';
        if (listTabs) listTabs.style.display = 'none';
        if (batchToolbar) batchToolbar.style.display = 'none';
        if (departmentBoard) departmentBoard.style.display = 'none';
        if (filterSection) filterSection.style.display = 'none';
        if (statsSection) statsSection.style.display = 'none';
        if (reminderCenter) reminderCenter.style.display = 'none';
        documentList.style.display = 'none';
        auditLogSection.style.display = 'none';
        recycleBinSection.style.display = 'block';
        renderRecycleBinList();
    } else if (view === 'board') {
        if (viewSwitcher) viewSwitcher.style.display = 'flex';
        if (listTabs) listTabs.style.display = 'flex';
        if (batchToolbar) batchToolbar.style.display = 'none';
        if (departmentBoard) departmentBoard.style.display = 'block';
        if (filterSection) filterSection.style.display = 'block';
        if (statsSection) statsSection.style.display = 'grid';
        if (reminderCenter) reminderCenter.style.display = 'block';
        documentList.style.display = 'block';
        auditLogSection.style.display = 'none';
        recycleBinSection.style.display = 'none';
        boardDrillContext = null;
        hideDrillIndicator();
        renderDepartmentBoard();
    } else {
        if (viewSwitcher) viewSwitcher.style.display = 'flex';
        if (listTabs) listTabs.style.display = 'flex';
        if (departmentBoard) departmentBoard.style.display = 'none';
        if (filterSection) filterSection.style.display = 'block';
        if (statsSection) statsSection.style.display = 'grid';
        if (reminderCenter) reminderCenter.style.display = 'block';
        documentList.style.display = 'block';
        auditLogSection.style.display = 'none';
        recycleBinSection.style.display = 'none';
        updateBatchToolbar();
        renderDocumentList();
    }
}

function viewDepartmentDocuments(dept) {
    boardDrillContext = {
        dept: dept,
        metric: 'all',
        fromBoard: true,
        previousTab: currentTab,
        previousFilter: { ...advancedFilter },
        previousKeyword: searchKeyword,
        overdueOnly: false,
        recent7DaysOnly: false,
        highRiskOnly: false,
        sortByProcessingDays: false
    };

    advancedFilter.department = dept;
    document.getElementById('filterDepartment').value = dept;
    detachFromViewPreset();
    updateFilterActiveBadge();
    switchView('list');
    switchTab('all');
    selectedIds = [];

    updateDrillIndicator(dept, '全部');
}

function filterDocuments(documents, tab, keyword, filter) {
    let filtered = documents;

    if (tab === 'pending_review') {
        filtered = filtered.filter(doc => doc.flowStatus === FLOW_STATUS.PENDING_REVIEW);
    } else if (tab === 'processing') {
        filtered = filtered.filter(doc => doc.flowStatus === FLOW_STATUS.PROCESSING);
    } else if (tab === 'pending_feedback') {
        filtered = filtered.filter(doc => doc.flowStatus === FLOW_STATUS.PENDING_FEEDBACK);
    } else if (tab === 'done') {
        filtered = filtered.filter(doc => doc.flowStatus === FLOW_STATUS.DONE);
    } else if (tab === 'urgent') {
        filtered = filtered.filter(doc => {
            const deadlineStatus = getDeadlineStatus(doc);
            return deadlineStatus === 'urgent' || deadlineStatus === 'overdue';
        });
    }

    if (keyword) {
        const kw = keyword.toLowerCase();
        filtered = filtered.filter(doc =>
            doc.title.toLowerCase().includes(kw) ||
            doc.fromUnit.toLowerCase().includes(kw) ||
            (doc.undertakingDepartment || doc.department || '').toLowerCase().includes(kw) ||
            doc.docNumber.toLowerCase().includes(kw)
        );
    }

    if (filter.department) {
        filtered = filtered.filter(doc => {
            const dept = doc.undertakingDepartment || doc.department || '';
            return dept === filter.department;
        });
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
        filtered = filtered.filter(doc => getEffectiveDeadline(doc) >= filter.deadlineStart);
    }

    if (filter.deadlineEnd) {
        filtered = filtered.filter(doc => getEffectiveDeadline(doc) <= filter.deadlineEnd);
    }

    const statusOrder = {};
    statusOrder[FLOW_STATUS.PENDING_REVIEW] = 0;
    statusOrder[FLOW_STATUS.PROCESSING] = 1;
    statusOrder[FLOW_STATUS.PENDING_FEEDBACK] = 2;
    statusOrder[FLOW_STATUS.DONE] = 3;

    filtered.sort((a, b) => {
        const statusA = statusOrder[a.flowStatus] !== undefined ? statusOrder[a.flowStatus] : 0;
        const statusB = statusOrder[b.flowStatus] !== undefined ? statusOrder[b.flowStatus] : 0;
        if (statusA !== statusB) {
            return statusA - statusB;
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
    let filtered = filterDocuments(documents, currentTab, searchKeyword, advancedFilter);
    filtered = applyDrillFilters(filtered);
    filtered = applyDrillSorting(filtered);
    const listEl = document.getElementById('documentList');

    if (filtered.length === 0) {
        const hasFilter = searchKeyword || hasAdvancedFilter();
        let emptyText = '暂无收文记录';
        let showAddButton = true;

        if (hasFilter) {
            emptyText = '未找到匹配的收文记录，请调整筛选条件';
            showAddButton = false;
        } else if (currentTab === 'pending_review') {
            emptyText = '暂无待拟办的收文';
        } else if (currentTab === 'processing') {
            emptyText = '暂无办理中的收文';
        } else if (currentTab === 'pending_feedback') {
            emptyText = '暂无待反馈的收文';
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
        const flowStatus = getDocumentStatus(doc);
        const flowStatusText = getFlowStatusText(flowStatus);
        const deadlineStatus = getDeadlineStatus(doc);
        const effectiveDeadline = getEffectiveDeadline(doc);
        const daysRemaining = getDaysRemaining(effectiveDeadline);
        const isSelected = selectedIds.includes(doc.id);
        const isDone = flowStatus === FLOW_STATUS.DONE;
        const isExtended = !!doc.extendedDeadline;

        let deadlineClass = '';
        let deadlineText = formatDate(effectiveDeadline);
        if (!isDone) {
            if (deadlineStatus === 'overdue') {
                deadlineClass = 'deadline-overdue';
                deadlineText = `${formatDate(effectiveDeadline)}（已逾期${Math.abs(daysRemaining)}天）`;
            } else if (deadlineStatus === 'urgent') {
                deadlineClass = 'deadline-urgent';
                deadlineText = `${formatDate(effectiveDeadline)}（剩余${daysRemaining}天）`;
            }
            if (isExtended) {
                deadlineText += ' <span class="list-extended-badge">已延期</span>';
            }
        }

        const undertakingDept = doc.undertakingDepartment || doc.department || '';

        const actions = !isDone ? `
            <button class="action-btn view" onclick="viewDocument('${doc.id}')">查看</button>
            <button class="action-btn edit" onclick="editDocument('${doc.id}')">编辑</button>
            <button class="action-btn flow" onclick="openFlowModal('${doc.id}')">流转办理</button>
            <button class="action-btn delete" onclick="deleteDocument('${doc.id}')">删除</button>
        ` : `
            <button class="action-btn view" onclick="viewDocument('${doc.id}')">查看</button>
            <button class="action-btn delete" onclick="deleteDocument('${doc.id}')">删除</button>
        `;

        const deadlineTag = !isDone && deadlineStatus !== 'normal' ? `
            <span class="doc-tag deadline-${deadlineStatus}">${getDeadlineStatusText(deadlineStatus)}</span>
        ` : '';

        const hasPendingSup = hasPendingSupervision(doc);
        const supervisionTag = hasPendingSup ? `
            <span class="doc-tag supervision-pending">督办中</span>
        ` : '';

        const isHighRisk = isHighRiskDoc(doc);
        const highRiskTag = isHighRisk ? `
            <span class="doc-tag high-risk-tag">⚠ 高风险</span>
        ` : '';

        const cardClass = isHighRisk ? 'high-risk-card' :
                          deadlineStatus === 'overdue' ? 'deadline-overdue-card' :
                          deadlineStatus === 'urgent' ? 'deadline-urgent-card' : '';

        return `
            <div class="document-card flow-status-${flowStatus} ${cardClass} ${isSelected ? 'selected' : ''}" onclick="viewDocument('${doc.id}')">
                <div class="doc-card-checkbox" onclick="event.stopPropagation(); toggleSelect('${doc.id}')">
                    <span class="card-checkbox ${isSelected ? 'checked' : ''}">${isSelected ? '✓' : ''}</span>
                </div>
                <div class="doc-header">
                    <div class="doc-title">${escapeHtml(doc.title)}</div>
                    <div class="doc-tags">
                        <span class="doc-tag urgency-${doc.urgency}">${doc.urgency}</span>
                        <span class="doc-tag flow-status-tag-${flowStatus}">${flowStatusText}</span>
                        ${deadlineTag}
                        ${supervisionTag}
                        ${highRiskTag}
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
                        <span class="doc-info-value">${escapeHtml(undertakingDept)}</span>
                    </div>
                    <div class="doc-info-item">
                        <span class="doc-info-label">办理期限</span>
                        <span class="doc-info-value ${deadlineClass}">${deadlineText}</span>
                    </div>
                </div>
                ${renderLatestFlowRecordSummary(doc)}
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
        if (toolbar) toolbar.style.display = 'flex';
        if (countEl) countEl.textContent = selectedIds.length;
    } else {
        if (toolbar) toolbar.style.display = 'none';
    }

    const filtered = filterDocuments(documents, currentTab, searchKeyword, advancedFilter);
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = filtered.length > 0 && selectedIds.length === filtered.length;
    }

    const hasCompletableDocs = selectedIds.some(id => {
        const doc = documents.find(d => d.id === id);
        return doc && canCompleteFromStatus(doc.flowStatus);
    });
    if (batchCompleteBtn) {
        batchCompleteBtn.style.display = hasCompletableDocs ? 'inline-flex' : 'none';
    }
}

function getSelectedDocuments() {
    const documents = getDocuments();
    return documents.filter(doc => selectedIds.includes(doc.id));
}

function buildBatchPreviewList(containerId) {
    const selectedDocs = getSelectedDocuments();
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = selectedDocs.map(doc => `
            <div class="batch-preview-item">${escapeHtml(doc.title)}</div>
        `).join('');
    }
}

function openBatchCompleteModal() {
    if (selectedIds.length === 0) return;

    const selectedDocs = getSelectedDocuments();
    const completableDocs = selectedDocs.filter(function(doc) {
        return canCompleteFromStatus(doc.flowStatus);
    });

    if (completableDocs.length === 0) {
        const rules = getFlowRules();
        const statusNames = rules.completableStatuses.map(function(s) { return FLOW_STATUS_TEXT[s] || s; }).join('、');
        showToast('只有' + statusNames + '状态的收文才能办结', 'info');
        return;
    }

    currentBatchAction = 'complete';
    const batchConfirmTitle = document.getElementById('batchConfirmTitle');
    if (batchConfirmTitle) batchConfirmTitle.textContent = '批量办结确认';
    const batchConfirmMessage = document.getElementById('batchConfirmMessage');
    if (batchConfirmMessage) {
        batchConfirmMessage.innerHTML =
            '确定要将选中的 <span>' + completableDocs.length + '</span> 条收文标记为已办结吗？';
    }
    const batchConfirmBtn = document.getElementById('batchConfirmBtn');
    if (batchConfirmBtn) batchConfirmBtn.className = 'btn btn-success';

    const completeFields = document.getElementById('batchCompleteFields');
    if (completeFields) completeFields.style.display = 'block';
    const remarkEl = document.getElementById('batchCompleteRemark');
    if (remarkEl) remarkEl.value = '';
    const handlerEl = document.getElementById('batchCompleteHandler');
    if (handlerEl) handlerEl.value = '';

    buildBatchPreviewList('batchPreviewList');
    const confirmModal = document.getElementById('batchConfirmModal');
    if (confirmModal) confirmModal.classList.add('show');
}

function openBatchDeleteModal() {
    if (selectedIds.length === 0) return;

    currentBatchAction = 'delete';
    const batchConfirmTitle = document.getElementById('batchConfirmTitle');
    if (batchConfirmTitle) batchConfirmTitle.textContent = '批量删除确认';
    const batchConfirmMessage = document.getElementById('batchConfirmMessage');
    if (batchConfirmMessage) {
        batchConfirmMessage.innerHTML =
            '确定要删除选中的 <span>' + selectedIds.length + '</span> 条收文吗？删除后将移至回收站，可从回收站恢复。';
    }
    const batchConfirmBtn = document.getElementById('batchConfirmBtn');
    if (batchConfirmBtn) batchConfirmBtn.className = 'btn btn-danger';

    const completeFields = document.getElementById('batchCompleteFields');
    if (completeFields) completeFields.style.display = 'none';

    buildBatchPreviewList('batchPreviewList');
    const confirmModal = document.getElementById('batchConfirmModal');
    if (confirmModal) confirmModal.classList.add('show');
}

function closeBatchConfirmModal() {
    const confirmModal = document.getElementById('batchConfirmModal');
    if (confirmModal) confirmModal.classList.remove('show');
    currentBatchAction = null;
}

function executeBatchAction(e) {
    if (e) {
        e.preventDefault();
    }
    if (!currentBatchAction) return;

    const allDocs = loadAllDocuments();

    if (currentBatchAction === 'complete') {
        const remarkEl = document.getElementById('batchCompleteRemark');
        const batchRemark = remarkEl ? remarkEl.value.trim() : '';
        const handlerEl = document.getElementById('batchCompleteHandler');
        const batchHandler = handlerEl ? handlerEl.value.trim() : '';

        let count = 0;
        const now = new Date().toISOString();
        const completedDocs = [];
        const updatedDocs = allDocs.map(function(doc) {
            if (selectedIds.includes(doc.id) && !doc.isDeleted && canCompleteFromStatus(doc.flowStatus)) {
                count++;
                const flowRecord = {
                    id: generateId(),
                    action: FLOW_ACTION.COMPLETE,
                    actionText: FLOW_ACTION_TEXT[FLOW_ACTION.COMPLETE] || '办结',
                    fromStatus: doc.flowStatus,
                    toStatus: FLOW_STATUS.DONE,
                    opinion: batchRemark || '批量办结',
                    handler: batchHandler || '',
                    department: doc.undertakingDepartment || doc.department || '',
                    createdAt: now
                };
                const flowRecords = doc.flowRecords || [];
                flowRecords.push(flowRecord);
                const newDoc = {
                    ...doc,
                    flowStatus: FLOW_STATUS.DONE,
                    completed: true,
                    completedAt: now,
                    completedRemark: batchRemark || '批量办结',
                    flowRecords: flowRecords
                };
                completedDocs.push({ oldDoc: doc, newDoc: newDoc });
                return newDoc;
            }
            return doc;
        });
        saveDocuments(updatedDocs);
        completedDocs.forEach(function(item) {
            addAuditLog(AUDIT_ACTION.COMPLETE, item.newDoc, item.oldDoc, {
                handler: batchHandler,
                remark: batchRemark,
                fromBatch: true
            });
        });
        showToast('成功办结 ' + count + ' 条收文', 'success');
    } else if (currentBatchAction === 'delete') {
        const count = selectedIds.length;
        const allDocs = loadAllDocuments();
        const now = new Date().toISOString();
        const deletedDocs = [];
        const updatedDocs = allDocs.map(function(doc) {
            if (selectedIds.includes(doc.id) && !doc.isDeleted) {
                const oldDoc = { ...doc };
                const newDoc = {
                    ...doc,
                    isDeleted: true,
                    deletedAt: now
                };
                deletedDocs.push({ oldDoc: oldDoc, newDoc: newDoc });
                return newDoc;
            }
            return doc;
        });
        saveDocuments(updatedDocs);
        deletedDocs.forEach(function(item) {
            addAuditLog(AUDIT_ACTION.DELETE, item.newDoc, item.oldDoc, {
                fromBatch: true
            });
        });
        showToast('成功删除 ' + count + ' 条收文，已移至回收站', 'success');
    } else if (currentBatchAction === 'department') {
        const deptSelectEl = document.getElementById('batchDepartmentSelect');
        const newDept = deptSelectEl ? deptSelectEl.value : '';
        if (!newDept) {
            showToast('请选择科室', 'error');
            return;
        }
        let count = 0;
        const changedDocs = [];
        const updatedDocs = allDocs.map(function(doc) {
            if (selectedIds.includes(doc.id) && !doc.isDeleted) {
                count++;
                const oldDoc = { ...doc };
                const newDoc = {
                    ...doc,
                    undertakingDepartment: newDept,
                    department: newDept
                };
                changedDocs.push({ oldDoc: oldDoc, newDoc: newDoc });
                return newDoc;
            }
            return doc;
        });
        saveDocuments(updatedDocs);
        changedDocs.forEach(function(item) {
            addAuditLog(AUDIT_ACTION.EDIT, item.newDoc, item.oldDoc, {
                fromBatch: true,
                newDepartment: newDept
            });
        });
        showToast('成功修改 ' + count + ' 条收文的科室', 'success');
    }

    selectedIds = [];
    closeBatchConfirmModal();
    updateStats();
    renderReminderCenter();
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

    const allDocs = loadAllDocuments();
    const count = selectedIds.length;
    const changedDocs = [];
    const updatedDocs = allDocs.map(doc => {
        if (selectedIds.includes(doc.id) && !doc.isDeleted) {
            const oldDoc = { ...doc };
            const newDoc = {
                ...doc,
                undertakingDepartment: newDepartment,
                department: newDepartment
            };
            changedDocs.push({ oldDoc: oldDoc, newDoc: newDoc });
            return newDoc;
        }
        return doc;
    });

    saveDocuments(updatedDocs);
    changedDocs.forEach(function(item) {
        addAuditLog(AUDIT_ACTION.EDIT, item.newDoc, item.oldDoc, {
            fromBatch: true,
            newDepartment: newDepartment
        });
    });
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
    if (currentViewPresetId) {
        detachFromViewPreset();
    }
    if (boardDrillContext && currentView === 'list') {
        clearDrillSpecialFilters();
    }
    if (currentView === 'board') {
        renderDepartmentBoard();
    } else {
        renderDocumentList();
    }
}

function searchDocuments() {
    searchKeyword = document.getElementById('searchInput').value.trim();
    selectedIds = [];
    detachFromViewPreset();
    if (boardDrillContext && currentView === 'list') {
        clearDrillSpecialFilters();
    }
    if (currentView === 'list') {
        renderDocumentList();
    } else if (currentView === 'board') {
        renderDepartmentBoard();
    }
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
    const newDepartment = document.getElementById('filterDepartment').value;
    const deptChanged = boardDrillContext && boardDrillContext.dept !== newDepartment;

    advancedFilter.department = newDepartment;
    advancedFilter.urgency = document.getElementById('filterUrgency').value;
    advancedFilter.receiveDateStart = document.getElementById('filterReceiveDateStart').value;
    advancedFilter.receiveDateEnd = document.getElementById('filterReceiveDateEnd').value;
    advancedFilter.deadlineStart = document.getElementById('filterDeadlineStart').value;
    advancedFilter.deadlineEnd = document.getElementById('filterDeadlineEnd').value;
    selectedIds = [];
    detachFromViewPreset();
    updateFilterActiveBadge();

    if (boardDrillContext && currentView === 'list') {
        if (deptChanged || !newDepartment) {
            boardDrillContext = null;
            hideDrillIndicator();
        } else {
            clearDrillSpecialFilters();
        }
    }

    if (currentView === 'list') {
        renderDocumentList();
    } else if (currentView === 'board') {
        renderDepartmentBoard();
    }
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
    detachFromViewPreset();
    updateFilterActiveBadge();
    if (boardDrillContext && currentView === 'list') {
        boardDrillContext = null;
        hideDrillIndicator();
    }
    if (currentView === 'list') {
        renderDocumentList();
    } else if (currentView === 'board') {
        renderDepartmentBoard();
    }
}

function updateFilterActiveBadge() {
    const badge = document.getElementById('filterActiveBadge');
    if (hasAdvancedFilter()) {
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function detachFromViewPreset() {
    currentViewPresetId = null;
    saveActiveViewPresetId(null);
    renderViewPresetSelector();
}

function renderViewPresetSelector() {
    const presets = getViewPresets();
    const selectorEl = document.getElementById('viewPresetSelector');
    const menuEl = document.getElementById('viewPresetMenu');
    if (!selectorEl || !menuEl) return;

    const currentLabelEl = document.getElementById('currentViewPresetName');
    if (currentLabelEl) {
        if (currentViewPresetId) {
            const current = presets.find(function(p) { return p.id === currentViewPresetId; });
            currentLabelEl.textContent = current ? current.name : '选择视图';
        } else {
            currentLabelEl.textContent = '常用视图';
        }
    }

    let menuHtml = '';

    menuHtml += '<div class="view-preset-menu-header">';
    menuHtml += '<div class="view-preset-menu-title">常用视图</div>';
    menuHtml += '<button class="view-preset-manage-btn" onclick="toggleViewPresetManageMode()" title="管理视图">⚙️</button>';
    menuHtml += '</div>';

    if (presets.length === 0) {
        menuHtml += '<div class="view-preset-empty">';
        menuHtml += '<div class="view-preset-empty-icon">💾</div>';
        menuHtml += '<div class="view-preset-empty-text">暂无保存的视图</div>';
        menuHtml += '<div class="view-preset-empty-hint">调整筛选条件后保存为常用视图</div>';
        menuHtml += '</div>';
    } else {
        menuHtml += '<div class="view-preset-list">';
        presets.forEach(function(preset) {
            const isActive = preset.id === currentViewPresetId;
            const isMatching = !currentViewPresetId && isCurrentViewMatchingPreset(preset);
            menuHtml += `
                <div class="view-preset-item ${isActive ? 'active' : ''} ${isMatching ? 'matching' : ''}"
                     onclick="${viewPresetManageMode ? '' : `selectViewPreset('${preset.id}')`}">
                    <div class="view-preset-item-main">
                        <div class="view-preset-item-icon">${preset.viewType === 'board' ? '📊' : '📋'}</div>
                        <div class="view-preset-item-info">
                            <div class="view-preset-item-name">
                                ${escapeHtml(preset.name)}
                                ${preset.isDefault ? '<span class="view-preset-default-badge">默认</span>' : ''}
                            </div>
                            <div class="view-preset-item-summary">${escapeHtml(getViewPresetSummary(preset))}</div>
                        </div>
                    </div>
                    ${viewPresetManageMode ? `
                        <div class="view-preset-item-actions">
                            <button class="view-preset-action-btn" onclick="event.stopPropagation(); renameViewPresetPrompt('${preset.id}')" title="重命名">✏️</button>
                            <button class="view-preset-action-btn ${preset.isDefault ? 'disabled' : ''}"
                                    onclick="event.stopPropagation(); ${preset.isDefault ? '' : `setDefaultViewPresetHandler('${preset.id}')`}"
                                    title="${preset.isDefault ? '已是默认' : '设为默认'}">${preset.isDefault ? '⭐' : '☆'}</button>
                            <button class="view-preset-action-btn delete" onclick="event.stopPropagation(); deleteViewPresetHandler('${preset.id}')" title="删除">🗑</button>
                        </div>
                    ` : `
                        <div class="view-preset-item-arrow">${isActive ? '✓' : '›'}</div>
                    `}
                </div>
            `;
        });
        menuHtml += '</div>';
    }

    menuHtml += '<div class="view-preset-menu-footer">';
    menuHtml += '<button class="btn btn-primary btn-sm view-preset-save-btn" onclick="openSaveViewPresetModal()">';
    menuHtml += '<span class="btn-icon">💾</span> 保存当前为视图';
    menuHtml += '</button>';
    menuHtml += '</div>';

    menuEl.innerHTML = menuHtml;
}

function toggleViewPresetMenu() {
    viewPresetMenuOpen = !viewPresetMenuOpen;
    viewPresetManageMode = false;
    const menuEl = document.getElementById('viewPresetMenu');
    if (menuEl) {
        if (viewPresetMenuOpen) {
            menuEl.classList.add('show');
            renderViewPresetSelector();
        } else {
            menuEl.classList.remove('show');
        }
    }
}

function closeViewPresetMenu() {
    viewPresetMenuOpen = false;
    viewPresetManageMode = false;
    const menuEl = document.getElementById('viewPresetMenu');
    if (menuEl) {
        menuEl.classList.remove('show');
    }
}

function toggleViewPresetManageMode() {
    viewPresetManageMode = !viewPresetManageMode;
    renderViewPresetSelector();
}

function selectViewPreset(id) {
    const success = applyViewPreset(id);
    if (success) {
        closeViewPresetMenu();
        showToast('已切换视图', 'success');
    }
    renderViewPresetSelector();
}

function setDefaultViewPresetHandler(id) {
    setDefaultViewPreset(id);
    renderViewPresetSelector();
    showToast('已设为默认视图', 'success');
}

function deleteViewPresetHandler(id) {
    const presets = getViewPresets();
    const preset = presets.find(function(p) { return p.id === id; });
    if (!preset) return;

    if (!confirm('确定要删除视图「' + preset.name + '」吗？此操作不可恢复。')) {
        return;
    }

    deleteViewPreset(id);
    renderViewPresetSelector();
    showToast('视图已删除', 'success');
}

function renameViewPresetPrompt(id) {
    const presets = getViewPresets();
    const preset = presets.find(function(p) { return p.id === id; });
    if (!preset) return;

    const newName = prompt('请输入新的视图名称：', preset.name);
    if (newName === null) return;

    const trimmedName = newName.trim();
    if (!trimmedName) {
        showToast('视图名称不能为空', 'error');
        return;
    }

    const nameDup = presets.find(function(p) { return p.name === trimmedName && p.id !== id; });
    if (nameDup) {
        showToast('已存在同名视图', 'error');
        return;
    }

    renameViewPreset(id, trimmedName);
    renderViewPresetSelector();
    showToast('视图已重命名', 'success');
}

let saveViewPresetMode = 'create';
let editingViewPresetId = null;

function openSaveViewPresetModal() {
    closeViewPresetMenu();
    saveViewPresetMode = 'create';
    editingViewPresetId = null;

    document.getElementById('saveViewPresetName').value = '';
    document.getElementById('saveViewPresetTitle').textContent = '保存为常用视图';
    document.getElementById('saveViewPresetSummary').textContent = getViewPresetSummary({
        filter: advancedFilter,
        keyword: searchKeyword,
        tab: currentTab,
        viewType: currentView
    });

    const saveAsDefaultEl = document.getElementById('saveViewPresetAsDefault');
    if (saveAsDefaultEl) {
        const presets = getViewPresets();
        saveAsDefaultEl.checked = presets.length === 0;
    }

    document.getElementById('saveViewPresetModal').classList.add('show');
    setTimeout(function() {
        document.getElementById('saveViewPresetName').focus();
    }, 100);
}

function closeSaveViewPresetModal() {
    document.getElementById('saveViewPresetModal').classList.remove('show');
    saveViewPresetMode = 'create';
    editingViewPresetId = null;
}

function saveViewPresetHandler(e) {
    if (e) e.preventDefault();

    const name = document.getElementById('saveViewPresetName').value.trim();
    if (!name) {
        showToast('请输入视图名称', 'error');
        return;
    }

    const presets = getViewPresets();
    const nameDup = presets.find(function(p) {
        return p.name === name && p.id !== editingViewPresetId;
    });
    if (nameDup) {
        showToast('已存在同名视图', 'error');
        return;
    }

    const setAsDefault = document.getElementById('saveViewPresetAsDefault').checked;

    if (saveViewPresetMode === 'create') {
        const newPreset = createViewPreset(name, advancedFilter, searchKeyword, currentTab, currentView);
        if (setAsDefault) {
            setDefaultViewPreset(newPreset.id);
        }
        currentViewPresetId = newPreset.id;
        saveActiveViewPresetId(newPreset.id);
        showToast('视图保存成功', 'success');
    } else {
        updateViewPreset(editingViewPresetId, {
            name: name,
            filter: { ...advancedFilter },
            keyword: searchKeyword,
            tab: currentTab,
            viewType: currentView
        });
        if (setAsDefault) {
            setDefaultViewPreset(editingViewPresetId);
        }
        currentViewPresetId = editingViewPresetId;
        saveActiveViewPresetId(editingViewPresetId);
        showToast('视图已更新', 'success');
    }

    closeSaveViewPresetModal();
    renderViewPresetSelector();
}

function addFlowRecord(docId, action, opinion, handler, department, toStatus, coDepartments) {
    const documents = loadAllDocuments();
    const index = documents.findIndex(function(d) { return d.id === docId && !d.isDeleted; });
    if (index === -1) {
        return { success: false, message: '收文不存在' };
    }

    const doc = documents[index];
    const oldDoc = { ...doc };
    const fromStatus = doc.flowStatus;
    const now = new Date().toISOString();
    const actionText = FLOW_ACTION_TEXT[action] || action;

    const newRecord = {
        id: generateId(),
        action: action,
        actionText: actionText,
        fromStatus: fromStatus,
        toStatus: toStatus || fromStatus,
        handler: handler || '',
        opinion: opinion || '',
        department: department || '',
        createdAt: now
    };

    if (!doc.flowRecords) {
        doc.flowRecords = [];
    }
    doc.flowRecords.push(newRecord);

    if (toStatus) {
        doc.flowStatus = toStatus;
    }

    if (toStatus === FLOW_STATUS.DONE) {
        doc.completed = true;
        doc.completedAt = now;
        doc.completedRemark = opinion || '';
    }

    if (action === FLOW_ACTION.PROPOSE && department) {
        doc.proposedDepartment = department;
    }

    if (action === FLOW_ACTION.ASSIGN && department) {
        doc.undertakingDepartment = department;
        doc.department = department;
    }

    if ((action === FLOW_ACTION.PROPOSE || action === FLOW_ACTION.ASSIGN) && Array.isArray(coDepartments)) {
        doc.coDepartments = coDepartments;
    }

    documents[index] = doc;
    saveDocuments(documents);

    const flowAuditActionMap = {
        [FLOW_ACTION.PROPOSE]: AUDIT_ACTION.FLOW_PROPOSE,
        [FLOW_ACTION.ASSIGN]: AUDIT_ACTION.FLOW_ASSIGN,
        [FLOW_ACTION.PROGRESS]: AUDIT_ACTION.FLOW_PROGRESS,
        [FLOW_ACTION.FEEDBACK]: AUDIT_ACTION.FLOW_FEEDBACK,
        [FLOW_ACTION.COMPLETE]: AUDIT_ACTION.COMPLETE
    };
    const auditAction = flowAuditActionMap[action];
    if (auditAction) {
        addAuditLog(auditAction, doc, oldDoc, {
            handler: handler || '',
            opinion: opinion || '',
            department: department || ''
        });
    }

    return { success: true, doc: doc };
}

function hasProposeFlowRecord(doc) {
    return Array.isArray(doc.flowRecords) && doc.flowRecords.some(function(record) {
        return record.action === FLOW_ACTION.PROPOSE;
    });
}

function getAvailableFlowActions(doc) {
    const status = doc.flowStatus;
    const actions = [];
    const requirePropose = isProposeRequiredBeforeAssign();
    const hasProposeRecord = hasProposeFlowRecord(doc);

    if (status === FLOW_STATUS.PENDING_REVIEW || status === FLOW_STATUS.PROCESSING) {
        if (!hasProposeRecord || status === FLOW_STATUS.PENDING_REVIEW) {
            actions.push({
                key: 'propose',
                label: hasProposeRecord ? '重新拟办' : '拟办',
                icon: '💡',
                description: hasProposeRecord ? '修改拟办科室和处理意见' : '指定拟办科室和处理意见',
                toStatus: status === FLOW_STATUS.PENDING_REVIEW ? FLOW_STATUS.PROCESSING : null,
                needsDepartment: true,
                departmentLabel: '拟办科室'
            });
        }
    }

    const canAssign = !requirePropose || hasProposeRecord;
    if (canAssign && (status === FLOW_STATUS.PENDING_REVIEW || status === FLOW_STATUS.PROCESSING)) {
        actions.push({
            key: 'assign',
            label: '交办',
            icon: '📤',
            description: '交办给承办科室办理',
            toStatus: FLOW_STATUS.PROCESSING,
            needsDepartment: true,
            departmentLabel: '承办科室'
        });
    }

    if (status === FLOW_STATUS.PROCESSING || status === FLOW_STATUS.PENDING_FEEDBACK) {
        actions.push({
            key: 'progress',
            label: '进展更新',
            icon: '🔄',
            description: '记录办理进展，状态不变',
            toStatus: null,
            needsDepartment: false
        });
    }

    if (status === FLOW_STATUS.PROCESSING) {
        actions.push({
            key: 'feedback',
            label: '申请反馈',
            icon: '📥',
            description: '提交反馈，等待审核',
            toStatus: FLOW_STATUS.PENDING_FEEDBACK,
            needsDepartment: false
        });
    }

    if (canCompleteFromStatus(status)) {
        actions.push({
            key: 'complete',
            label: '办结',
            icon: '✅',
            description: '审核通过，办结收文',
            toStatus: FLOW_STATUS.DONE,
            needsDepartment: false
        });
    }

    return actions;
}

let currentFlowDocId = null;
let currentFlowAction = null;

function openFlowModal(docId) {
    const documents = getDocuments();
    const doc = documents.find(function(d) { return d.id === docId; });
    if (!doc) return;

    currentFlowDocId = docId;
    currentFlowAction = null;

    const actions = getAvailableFlowActions(doc);
    const actionsHtml = actions.map(function(action) {
        return `
            <div class="flow-action-card" onclick="selectFlowAction('${action.key}')">
                <div class="flow-action-icon">${action.icon}</div>
                <div class="flow-action-info">
                    <div class="flow-action-title">${action.label}</div>
                    <div class="flow-action-desc">${action.description}</div>
                </div>
                <div class="flow-action-arrow">→</div>
            </div>
        `;
    }).join('');

    const actionListEl = document.getElementById('flowActionList');
    const actionFormEl = document.getElementById('flowActionFormEl');
    if (actionListEl) actionListEl.innerHTML = actionsHtml;
    if (actionFormEl) actionFormEl.style.display = 'none';
    if (actionListEl) actionListEl.style.display = 'block';

    const flowModalTitle = document.getElementById('flowModalTitle');
    if (flowModalTitle) {
        flowModalTitle.textContent = '流转办理';
    }

    const flowModal = document.getElementById('flowModal');
    if (flowModal) flowModal.classList.add('show');
}

function selectFlowAction(actionKey) {
    const documents = getDocuments();
    const doc = documents.find(function(d) { return d.id === currentFlowDocId; });
    if (!doc) return;

    const actions = getAvailableFlowActions(doc);
    const action = actions.find(function(a) { return a.key === actionKey; });
    if (!action) return;

    currentFlowAction = action;

    const listEl = document.getElementById('flowActionList');
    const formEl = document.getElementById('flowActionFormEl');
    if (listEl) listEl.style.display = 'none';
    if (formEl) formEl.style.display = 'block';

    const flowModalTitle = document.getElementById('flowModalTitle');
    if (flowModalTitle) {
        flowModalTitle.textContent = action.label;
    }

    const actionLabelEl = document.getElementById('flowActionLabel');
    if (actionLabelEl) actionLabelEl.textContent = action.label;
    const actionIconEl = document.getElementById('flowActionIcon');
    if (actionIconEl) actionIconEl.textContent = action.icon;

    const deptSection = document.getElementById('flowDepartmentSection');
    if (deptSection) {
        if (action.needsDepartment) {
            deptSection.style.display = 'block';
            const deptLabel = document.getElementById('flowDepartmentLabel');
            if (deptLabel) {
                deptLabel.textContent = action.departmentLabel || '科室';
            }
            const deptSelect = document.getElementById('flowDepartmentSelect');
            if (deptSelect) {
                deptSelect.value = doc.undertakingDepartment || doc.department || '';
            }
        } else {
            deptSection.style.display = 'none';
        }
    }

    const opinionEl = document.getElementById('flowOpinion');
    if (opinionEl) opinionEl.value = '';
    const handlerEl = document.getElementById('flowHandler');
    if (handlerEl) handlerEl.value = '';

    const coDeptSection = document.getElementById('flowCoDeptSection');
    if (coDeptSection) {
        if (action.needsDepartment) {
            coDeptSection.style.display = 'block';
            renderCoDepartmentCheckboxes(doc.coDepartments || []);
        } else {
            coDeptSection.style.display = 'none';
        }
    }
}

function renderCoDepartmentCheckboxes(selected) {
    const container = document.getElementById('coDeptCheckboxes');
    if (!container) return;

    const html = DEPARTMENT_LIST.map(function(dept) {
        const isChecked = selected.includes(dept) ? 'checked' : '';
        return `
            <label class="co-dept-checkbox-label">
                <input type="checkbox" class="co-dept-checkbox" value="${dept}" ${isChecked}>
                <span class="co-dept-text">${dept}</span>
            </label>
        `;
    }).join('');

    container.innerHTML = html;
}

function getSelectedCoDepartments() {
    const checkboxes = document.querySelectorAll('#coDeptCheckboxes .co-dept-checkbox:checked');
    const selected = [];
    checkboxes.forEach(function(cb) {
        selected.push(cb.value);
    });
    return selected;
}

function backToFlowActionList() {
    const actionList = document.getElementById('flowActionList');
    const actionForm = document.getElementById('flowActionFormEl');
    if (actionList) actionList.style.display = 'block';
    if (actionForm) actionForm.style.display = 'none';
    currentFlowAction = null;
}

function closeFlowModal() {
    const flowModal = document.getElementById('flowModal');
    if (flowModal) flowModal.classList.remove('show');
    currentFlowDocId = null;
    currentFlowAction = null;
    backToFlowActionList();
}

function executeFlowAction(e) {
    if (e) {
        e.preventDefault();
    }

    if (!currentFlowDocId || !currentFlowAction) {
        showToast('请选择流转操作', 'error');
        return;
    }

    const opinionEl = document.getElementById('flowOpinion');
    const opinion = opinionEl ? opinionEl.value.trim() : '';
    const handlerEl = document.getElementById('flowHandler');
    const handler = handlerEl ? handlerEl.value.trim() : '';
    let department = '';

    if (currentFlowAction.needsDepartment) {
        const deptSelectEl = document.getElementById('flowDepartmentSelect');
        department = deptSelectEl ? deptSelectEl.value : '';
        if (!department) {
            showToast('请选择科室', 'error');
            return;
        }
    }

    if (currentFlowAction.toStatus === FLOW_STATUS.DONE && !opinion) {
        showToast('请输入办结说明', 'error');
        return;
    }

    const actionMap = {
        'propose': FLOW_ACTION.PROPOSE,
        'assign': FLOW_ACTION.ASSIGN,
        'progress': FLOW_ACTION.PROGRESS,
        'feedback': FLOW_ACTION.FEEDBACK,
        'complete': FLOW_ACTION.COMPLETE
    };

    const flowActionType = actionMap[currentFlowAction.key] || currentFlowAction.key;

    const selectedCoDepartments = currentFlowAction.needsDepartment ? getSelectedCoDepartments() : null;

    const result = addFlowRecord(
        currentFlowDocId,
        flowActionType,
        opinion,
        handler,
        department,
        currentFlowAction.toStatus,
        selectedCoDepartments
    );

    if (result.success) {
        showToast('操作成功', 'success');
        closeFlowModal();
        updateStats();
        renderReminderCenter();
        renderDocumentList();

        const detailModal = document.getElementById('detailModal');
        if (detailModal && detailModal.classList.contains('show')) {
            viewDocument(currentFlowDocId);
        }
    } else {
        showToast(result.message || '操作失败', 'error');
    }
}

function openAddModal() {
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = '新增收文';
    const documentId = document.getElementById('documentId');
    if (documentId) documentId.value = '';
    const documentForm = document.getElementById('documentForm');
    if (documentForm) documentForm.reset();
    const receiveDateEl = document.getElementById('receiveDate');
    if (receiveDateEl) receiveDateEl.value = formatDateInput(new Date());

    const urgencyEl = document.getElementById('urgency');
    const defaultUrgency = urgencyEl ? urgencyEl.value : '普通';
    updateAddModalDeadlineByUrgency(defaultUrgency);

    const templateSection = document.getElementById('templateSection');
    if (templateSection) templateSection.style.display = 'block';
    renderTemplateSelect();
    const deleteTemplateBtn = document.getElementById('deleteTemplateBtn');
    if (deleteTemplateBtn) deleteTemplateBtn.style.display = 'none';

    const proposedDeptEl = document.getElementById('proposedDepartment');
    if (proposedDeptEl) proposedDeptEl.value = '';
    const undertakingDeptEl = document.getElementById('undertakingDepartment');
    if (undertakingDeptEl) undertakingDeptEl.value = '';
    renderCoDeptCheckboxesAdd([]);

    const documentModal = document.getElementById('documentModal');
    if (documentModal) documentModal.classList.add('show');
}

function updateAddModalDeadlineByUrgency(urgency) {
    const receiveDateEl = document.getElementById('receiveDate');
    const deadlineEl = document.getElementById('deadline');
    if (!receiveDateEl || !deadlineEl) return;

    const receiveDate = receiveDateEl.value;
    if (!receiveDate) return;

    const days = getDeadlineDaysByUrgency(urgency);
    const deadlineDate = new Date(receiveDate);
    deadlineDate.setDate(deadlineDate.getDate() + days);
    deadlineEl.value = formatDateInput(deadlineDate);
}

function renderCoDeptCheckboxesAdd(selected) {
    const container = document.getElementById('addCoDeptCheckboxes');
    if (!container) return;

    const html = DEPARTMENT_LIST.map(function(dept) {
        const isChecked = selected.includes(dept) ? 'checked' : '';
        return `
            <label class="co-dept-checkbox-label">
                <input type="checkbox" class="add-co-dept-checkbox" value="${dept}" ${isChecked}>
                <span class="co-dept-text">${dept}</span>
            </label>
        `;
    }).join('');

    container.innerHTML = html;
}

function getAddCoDepartments() {
    const checkboxes = document.querySelectorAll('.add-co-dept-checkbox:checked');
    const selected = [];
    checkboxes.forEach(function(cb) {
        selected.push(cb.value);
    });
    return selected;
}

function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function closeModal() {
    const documentModal = document.getElementById('documentModal');
    if (documentModal) documentModal.classList.remove('show');
}

function editDocument(id) {
    const documents = getDocuments();
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = '编辑收文';
    const documentIdEl = document.getElementById('documentId');
    if (documentIdEl) documentIdEl.value = doc.id;
    const fromUnitEl = document.getElementById('fromUnit');
    if (fromUnitEl) fromUnitEl.value = doc.fromUnit;
    const docNumberEl = document.getElementById('docNumber');
    if (docNumberEl) docNumberEl.value = doc.docNumber;
    const titleEl = document.getElementById('title');
    if (titleEl) titleEl.value = doc.title;
    const receiveDateEl = document.getElementById('receiveDate');
    if (receiveDateEl) receiveDateEl.value = doc.receiveDate;
    const urgencyEl = document.getElementById('urgency');
    if (urgencyEl) urgencyEl.value = doc.urgency;

    const deptEl = document.getElementById('department');
    if (deptEl) deptEl.value = doc.department || '';

    const proposedDeptEl = document.getElementById('proposedDepartment');
    if (proposedDeptEl) proposedDeptEl.value = doc.proposedDepartment || '';

    const undertakingDeptEl = document.getElementById('undertakingDepartment');
    if (undertakingDeptEl) undertakingDeptEl.value = doc.undertakingDepartment || doc.department || '';

    renderCoDeptCheckboxesAdd(doc.coDepartments || []);

    const deadlineEl = document.getElementById('deadline');
    if (deadlineEl) deadlineEl.value = doc.deadline;
    const remarkEl = document.getElementById('remark');
    if (remarkEl) remarkEl.value = doc.remark || '';

    const templateSection = document.getElementById('templateSection');
    if (templateSection) templateSection.style.display = 'none';

    const documentModal = document.getElementById('documentModal');
    if (documentModal) documentModal.classList.add('show');
}

function saveDocument(e) {
    e.preventDefault();

    const idEl = document.getElementById('documentId');
    const id = idEl ? idEl.value : '';
    const deptEl = document.getElementById('department');
    const department = deptEl ? deptEl.value : '';

    const proposedDeptEl = document.getElementById('proposedDepartment');
    const proposedDepartment = proposedDeptEl ? proposedDeptEl.value : '';

    const undertakingDeptEl = document.getElementById('undertakingDepartment');
    const undertakingDepartment = undertakingDeptEl ? undertakingDeptEl.value : department;

    const coDepartments = getAddCoDepartments();

    const fromUnitEl = document.getElementById('fromUnit');
    const docNumberEl = document.getElementById('docNumber');
    const titleEl = document.getElementById('title');
    const receiveDateEl = document.getElementById('receiveDate');
    const urgencyEl = document.getElementById('urgency');
    const deadlineEl = document.getElementById('deadline');
    const remarkEl = document.getElementById('remark');

    const docData = {
        fromUnit: fromUnitEl ? fromUnitEl.value.trim() : '',
        docNumber: docNumberEl ? docNumberEl.value.trim() : '',
        title: titleEl ? titleEl.value.trim() : '',
        receiveDate: receiveDateEl ? receiveDateEl.value : '',
        urgency: urgencyEl ? urgencyEl.value : '',
        department: undertakingDepartment || department,
        proposedDepartment: proposedDepartment,
        undertakingDepartment: undertakingDepartment || department,
        coDepartments: coDepartments,
        deadline: deadlineEl ? deadlineEl.value : '',
        remark: remarkEl ? remarkEl.value.trim() : ''
    };

    const mainDept = undertakingDepartment || department;

    if (!docData.fromUnit || !docData.docNumber || !docData.title ||
        !docData.receiveDate || !docData.urgency || !mainDept || !docData.deadline) {
        showToast('请填写所有必填项', 'error');
        return;
    }

    const documents = loadAllDocuments();

    if (id) {
        const index = documents.findIndex(d => d.id === id && !d.isDeleted);
        if (index !== -1) {
            const oldDoc = documents[index];
            const updatedDoc = { ...oldDoc, ...docData };
            if (oldDoc.deadline !== docData.deadline && oldDoc.extendedDeadline) {
                updatedDoc.extendedDeadline = '';
                if (!updatedDoc.reminderHistory) {
                    updatedDoc.reminderHistory = [];
                }
                updatedDoc.reminderHistory.push({
                    id: generateId(),
                    type: 'reset_extend',
                    oldDeadline: oldDoc.deadline,
                    newDeadline: docData.deadline,
                    createdAt: new Date().toISOString()
                });
            }
            documents[index] = updatedDoc;
            addAuditLog(AUDIT_ACTION.EDIT, updatedDoc, oldDoc);
            showToast('收文更新成功', 'success');
        }
    } else {
        const now = new Date().toISOString();
        const newDoc = {
            id: generateId(),
            ...docData,
            flowStatus: FLOW_STATUS.PENDING_REVIEW,
            completed: false,
            completedAt: null,
            completedRemark: '',
            processingRecords: [],
            supervisionRecords: [],
            flowRecords: [
                {
                    id: generateId(),
                    action: FLOW_ACTION.CREATE,
                    actionText: FLOW_ACTION_TEXT[FLOW_ACTION.CREATE] || '收文登记',
                    fromStatus: null,
                    toStatus: FLOW_STATUS.PENDING_REVIEW,
                    handler: '',
                    opinion: '收文登记',
                    department: mainDept,
                    createdAt: now
                }
            ],
            isDeleted: false,
            deletedAt: null,
            createdAt: now
        };
        documents.unshift(newDoc);
        addAuditLog(AUDIT_ACTION.CREATE, newDoc, null);
        showToast('收文添加成功', 'success');
    }

    saveDocuments(documents);
    closeModal();
    updateStats();
    renderReminderCenter();
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

    const documents = loadAllDocuments();
    const index = documents.findIndex(function(d) { return d.id === docId && !d.isDeleted; });
    if (index === -1) {
        showToast('收文不存在', 'error');
        return;
    }

    const doc = documents[index];
    const oldDoc = { ...doc };
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

    addAuditLog(AUDIT_ACTION.ADD_PROGRESS_RECORD, doc, oldDoc, {
        handler: handler,
        content: content
    });

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

    const documents = loadAllDocuments();
    const index = documents.findIndex(function(d) { return d.id === docId && !d.isDeleted; });
    if (index === -1) {
        showToast('收文不存在', 'error');
        return;
    }

    const doc = documents[index];
    const oldDoc = { ...doc };
    const flowStatus = getDocumentStatus(doc);
    if (flowStatus === FLOW_STATUS.DONE) {
        showToast('该收文已办结', 'info');
        closeCompleteModal();
        return;
    }

    if (!doc.processingRecords) {
        doc.processingRecords = [];
    }
    if (!doc.flowRecords) {
        doc.flowRecords = [];
    }

    const now = new Date().toISOString();

    const completionRecord = {
        id: generateId(),
        type: 'completion',
        content: remark,
        handler: handler,
        createdAt: now
    };

    const flowRecord = {
        id: generateId(),
        action: FLOW_ACTION.COMPLETE,
        actionText: FLOW_ACTION_TEXT[FLOW_ACTION.COMPLETE] || '办结',
        fromStatus: doc.flowStatus,
        toStatus: FLOW_STATUS.DONE,
        opinion: remark,
        handler: handler,
        department: doc.undertakingDepartment || doc.department || '',
        createdAt: now
    };

    doc.processingRecords.push(completionRecord);
    doc.flowRecords.push(flowRecord);
    doc.flowStatus = FLOW_STATUS.DONE;
    doc.completed = true;
    doc.completedAt = now;
    doc.completedRemark = remark;

    documents[index] = doc;
    saveDocuments(documents);
    addAuditLog(AUDIT_ACTION.COMPLETE, doc, oldDoc, { handler: handler, remark: remark });

    const selIndex = selectedIds.indexOf(docId);
    if (selIndex > -1) {
        selectedIds.splice(selIndex, 1);
    }

    closeCompleteModal();
    closeDetailModal();
    showToast('收文已办结', 'success');
    updateStats();
    renderReminderCenter();
    renderDocumentList();
}

function deleteDocument(id) {
    if (!confirm('确定要删除该收文吗？删除后将移至回收站，可从回收站恢复。')) return;

    const allDocs = loadAllDocuments();
    const index = allDocs.findIndex(d => d.id === id);
    if (index === -1) return;

    const doc = allDocs[index];
    const oldDoc = { ...doc };
    doc.isDeleted = true;
    doc.deletedAt = new Date().toISOString();
    allDocs[index] = doc;

    saveDocuments(allDocs);
    addAuditLog(AUDIT_ACTION.DELETE, doc, oldDoc);

    const selIndex = selectedIds.indexOf(id);
    if (selIndex > -1) {
        selectedIds.splice(selIndex, 1);
    }

    updateStats();
    renderReminderCenter();
    renderDocumentList();
    showToast('收文已移至回收站', 'success');
}

function restoreDocument(id) {
    const allDocs = loadAllDocuments();
    const index = allDocs.findIndex(d => d.id === id);
    if (index === -1) return false;

    const doc = allDocs[index];
    if (!doc.isDeleted) return false;

    const oldDoc = { ...doc };
    doc.isDeleted = false;
    doc.deletedAt = null;
    allDocs[index] = doc;

    saveDocuments(allDocs);
    addAuditLog(AUDIT_ACTION.RESTORE_RECYCLE, doc, oldDoc);
    return true;
}

function permanentDeleteDocument(id) {
    if (!confirm('确定要彻底删除该收文吗？此操作不可恢复！')) return false;

    const allDocs = loadAllDocuments();
    const doc = allDocs.find(d => d.id === id);
    if (!doc) return false;

    const filtered = allDocs.filter(d => d.id !== id);
    saveDocuments(filtered);
    addAuditLog(AUDIT_ACTION.PERMANENT_DELETE, doc, null);
    return true;
}

function batchRestoreDocuments(ids) {
    if (!ids || ids.length === 0) return 0;

    const allDocs = loadAllDocuments();
    let count = 0;
    const restoredDocs = [];

    const updatedDocs = allDocs.map(function(doc) {
        if (ids.includes(doc.id) && doc.isDeleted) {
            count++;
            const oldDoc = { ...doc };
            const newDoc = {
                ...doc,
                isDeleted: false,
                deletedAt: null
            };
            restoredDocs.push({ oldDoc: oldDoc, newDoc: newDoc });
            return newDoc;
        }
        return doc;
    });

    saveDocuments(updatedDocs);
    restoredDocs.forEach(function(item) {
        addAuditLog(AUDIT_ACTION.RESTORE_RECYCLE, item.newDoc, item.oldDoc, {
            fromBatch: true
        });
    });
    return count;
}

function batchPermanentDelete(ids) {
    if (!ids || ids.length === 0) return 0;
    if (!confirm('确定要彻底删除选中的 ' + ids.length + ' 条收文吗？此操作不可恢复！')) return 0;

    const allDocs = loadAllDocuments();
    const toDelete = allDocs.filter(d => ids.includes(d.id));

    toDelete.forEach(function(doc) {
        addAuditLog(AUDIT_ACTION.PERMANENT_DELETE, doc, null, {
            fromBatch: true
        });
    });

    const filtered = allDocs.filter(d => !ids.includes(d.id));
    saveDocuments(filtered);

    return toDelete.length;
}

function emptyRecycleBin() {
    const recycleDocs = getRecycleBinDocuments();
    if (recycleDocs.length === 0) {
        showToast('回收站为空', 'info');
        return;
    }

    if (!confirm('确定要清空回收站吗？所有 ' + recycleDocs.length + ' 条收文将被彻底删除，此操作不可恢复！')) return;

    recycleDocs.forEach(function(doc) {
        addAuditLog(AUDIT_ACTION.PERMANENT_DELETE, doc, null, {
            fromEmptyRecycle: true
        });
    });

    const remaining = loadAllDocuments().filter(d => !d.isDeleted);
    saveDocuments(remaining);

    recycleSelectedIds = [];
    showToast('回收站已清空', 'success');
    if (currentView === 'recycle_bin') {
        renderRecycleBinList();
    }
}

function viewDocument(id) {
    const documents = loadAllDocuments();
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    const flowStatus = getDocumentStatus(doc);
    const flowStatusText = getFlowStatusText(flowStatus);
    const deadlineStatus = getDeadlineStatus(doc);
    const effectiveDeadline = getEffectiveDeadline(doc);
    const daysRemaining = getDaysRemaining(effectiveDeadline);
    const isDone = flowStatus === FLOW_STATUS.DONE;
    const undertakingDept = doc.undertakingDepartment || doc.department || '';
    const isSnoozed = isReminderSnoozed(doc);
    const isExtended = !!doc.extendedDeadline;

    let deadlineText = formatDate(effectiveDeadline);
    if (!isDone) {
        if (deadlineStatus === 'overdue') {
            deadlineText = `${formatDate(effectiveDeadline)}（已逾期${Math.abs(daysRemaining)}天）`;
        } else {
            deadlineText = `${formatDate(effectiveDeadline)}（剩余${daysRemaining}天）`;
        }
        if (isExtended) {
            deadlineText += ' <span class="detail-extended-badge">已延期</span>';
        }
    }

    const coDeptsText = (doc.coDepartments && doc.coDepartments.length > 0) ?
        doc.coDepartments.join('、') : '无';

    const hasPendingSup = hasPendingSupervision(doc);
    const flowTimelineCount = (doc.flowRecords || []).length + (doc.supervisionRecords || []).length;
    const isHighRisk = isHighRiskDoc(doc);
    const processingDays = getDocProcessingDays(doc);

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
                ${isHighRisk ? '<span class="doc-tag high-risk-tag">⚠ 高风险</span>' : ''}
            </span>
        </div>
        <div class="detail-item">
            <span class="detail-label">流转状态</span>
            <span class="detail-value">
                <span class="doc-tag flow-status-tag-${flowStatus}">${flowStatusText}</span>
                ${!isDone && deadlineStatus !== 'normal' ?
                    `<span class="doc-tag deadline-${deadlineStatus}">${getDeadlineStatusText(deadlineStatus)}</span>` : ''}
                ${hasPendingSup ? '<span class="doc-tag supervision-pending">督办中</span>' : ''}
            </span>
        </div>
        <div class="detail-item">
            <span class="detail-label">办理时长</span>
            <span class="detail-value">${processingDays} 天${isDone ? '（已办结）' : '（进行中）'}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">拟办科室</span>
            <span class="detail-value">${escapeHtml(doc.proposedDepartment) || '—'}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">承办科室</span>
            <span class="detail-value">${escapeHtml(undertakingDept) || '—'}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">协办科室</span>
            <span class="detail-value">${escapeHtml(coDeptsText)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">办理期限</span>
            <span class="detail-value">${deadlineText}</span>
        </div>
        ${isExtended ? `
        <div class="detail-item">
            <span class="detail-label">原办理期限</span>
            <span class="detail-value">${formatDate(doc.deadline)}</span>
        </div>
        ` : ''}
        ${doc.reminderNote ? `
        <div class="detail-item">
            <span class="detail-label">提醒备注</span>
            <span class="detail-value reminder-note-value">
                <span class="reminder-note-icon-inline">📝</span>
                ${escapeHtml(doc.reminderNote)}
            </span>
        </div>
        ` : ''}
        ${isSnoozed ? `
        <div class="detail-item">
            <span class="detail-label">暂不提醒</span>
            <span class="detail-value">
                <span class="doc-tag snoozed">暂不提醒至 ${formatDate(doc.snoozeUntil)}</span>
            </span>
        </div>
        ` : ''}
        ${isDone ? `
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
                <span class="detail-section-title">🔄 流转时间线</span>
                <span class="detail-section-count">共 ${flowTimelineCount} 条</span>
            </div>
            ${renderFlowTimeline(doc)}
        </div>
    `;

    const detailActions = document.getElementById('detailActions');
    if (doc.isDeleted) {
        detailActions.innerHTML = `
            <button class="btn btn-default" onclick="closeDetailModal()">关闭</button>
            <button class="btn btn-danger" onclick="permanentDeleteFromRecycleBin('${doc.id}'); closeDetailModal();">彻底删除</button>
            <button class="btn btn-success" onclick="restoreFromRecycleBin('${doc.id}'); closeDetailModal();">恢复</button>
        `;
    } else if (!isDone) {
        detailActions.innerHTML = `
            <button class="btn btn-default" onclick="closeDetailModal()">关闭</button>
            <button class="btn btn-danger" onclick="deleteDocument('${doc.id}'); closeDetailModal();">删除</button>
            <button class="btn btn-primary" onclick="editDocument('${doc.id}'); closeDetailModal();">编辑</button>
            <button class="btn btn-info" onclick="openAddRecordModal('${doc.id}')">追加进展</button>
            <button class="btn btn-success" onclick="openFlowModal('${doc.id}')">流转办理</button>
            <div class="detail-actions-divider"></div>
            <button class="btn btn-default" onclick="openReminderNoteModal('${doc.id}')">📝 提醒备注</button>
            <button class="btn btn-warning" onclick="openExtendDeadlineModal('${doc.id}')">⏰ 延长期限</button>
            ${hasPendingSup ?
                `<button class="btn btn-warning" onclick="openSupervisionFeedbackModal('${doc.id}')">📢 督办反馈</button>` :
                (deadlineStatus === 'overdue' || deadlineStatus === 'urgent' ?
                    `<button class="btn btn-warning" onclick="openSupervisionModal('${doc.id}')">📢 发起督办</button>` :
                    ''
                )
            }
            ${isSnoozed ?
                `<button class="btn btn-default" onclick="cancelSnooze('${doc.id}'); viewDocument('${doc.id}');">🔔 取消暂不提醒</button>` :
                `<button class="btn btn-default" onclick="openSnoozeModal('${doc.id}')">🙈 暂不提醒</button>`
            }
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
    if (row.deadline && !isValidDate(row.deadline)) {
        errors.push('办理期限格式错误');
    }

    if (!row.deadline && row.receiveDate && isValidDate(row.receiveDate) && row.urgency && isValidUrgency(row.urgency)) {
        // 将自动根据紧急程度计算办理期限
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

        const deadlineHasError = item.data.deadline && !isValidDate(item.data.deadline);
        let deadlineDisplay = escapeHtml(item.data.deadline) || '-';
        if (!item.data.deadline && item.data.receiveDate && isValidDate(item.data.receiveDate) && item.data.urgency && isValidUrgency(item.data.urgency)) {
            const days = getDeadlineDaysByUrgency(item.data.urgency);
            const deadlineDate = new Date(item.data.receiveDate);
            deadlineDate.setDate(deadlineDate.getDate() + days);
            deadlineDisplay = '<span class="auto-calc-hint">' + formatDate(formatDateInput(deadlineDate)) + ' (自动计算)</span>';
        }

        return '<tr class="' + rowClass + '" title="' + escapeHtml(errorTooltip) + '">' +
            '<td>' + item.rowIndex + '</td>' +
            '<td class="' + (!item.data.fromUnit ? 'cell-error' : '') + '">' + (escapeHtml(item.data.fromUnit) || '-') + '</td>' +
            '<td class="' + (!item.data.docNumber ? 'cell-error' : '') + '">' + (escapeHtml(item.data.docNumber) || '-') + '</td>' +
            '<td class="' + (!item.data.title ? 'cell-error' : '') + '">' + (escapeHtml(item.data.title) || '-') + '</td>' +
            '<td class="' + (!item.data.receiveDate || !isValidDate(item.data.receiveDate) ? 'cell-error' : '') + '">' + (escapeHtml(item.data.receiveDate) || '-') + '</td>' +
            '<td class="' + (!item.data.urgency || !isValidUrgency(item.data.urgency) ? 'cell-error' : '') + '">' + (escapeHtml(item.data.urgency) || '-') + '</td>' +
            '<td class="' + (!item.data.department || !isValidDepartment(item.data.department) ? 'cell-error' : '') + '">' + (escapeHtml(item.data.department) || '-') + '</td>' +
            '<td class="' + (deadlineHasError ? 'cell-error' : '') + '">' + deadlineDisplay + '</td>' +
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

    const allDocs = loadAllDocuments();
    const now = new Date().toISOString();
    const newDocs = importValidData.map(function(item) {
        const dept = item.data.undertakingDepartment || item.data.department || '';
        let deadline = item.data.deadline;
        if (!deadline && item.data.receiveDate && item.data.urgency) {
            const days = getDeadlineDaysByUrgency(item.data.urgency);
            const deadlineDate = new Date(item.data.receiveDate);
            deadlineDate.setDate(deadlineDate.getDate() + days);
            deadline = formatDateInput(deadlineDate);
        }
        return {
            id: generateId(),
            fromUnit: item.data.fromUnit,
            docNumber: item.data.docNumber,
            title: item.data.title,
            receiveDate: item.data.receiveDate,
            urgency: item.data.urgency,
            department: dept,
            proposedDepartment: item.data.proposedDepartment || '',
            undertakingDepartment: dept,
            coDepartments: item.data.coDepartments || [],
            deadline: deadline,
            remark: item.data.remark || '',
            flowStatus: FLOW_STATUS.PENDING_REVIEW,
            completed: false,
            completedAt: null,
            completedRemark: '',
            processingRecords: [],
            flowRecords: [
                {
                    id: generateId(),
                    action: FLOW_ACTION.CREATE,
                    actionText: '收文登记',
                    fromStatus: null,
                    toStatus: FLOW_STATUS.PENDING_REVIEW,
                    handler: '',
                    opinion: '收文登记',
                    department: dept,
                    createdAt: now
                }
            ],
            isDeleted: false,
            deletedAt: null,
            createdAt: now
        };
    });

    const updatedDocs = newDocs.concat(allDocs);
    saveDocuments(updatedDocs);

    const validCount = importValidData.length;
    const totalCount = importParsedData.length;
    const skippedCount = totalCount - validCount;

    if (validCount > 0 && newDocs.length > 0) {
        newDocs.forEach(function(doc) {
            addAuditLog(AUDIT_ACTION.CREATE, doc, null, {
                fromImport: true
            });
        });
    }

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
    proposedDepartment: '拟办科室',
    undertakingDepartment: '承办科室',
    coDepartments: '协办科室',
    flowStatus: '流转状态',
    deadline: '办理期限',
    remark: '备注',
    completed: '是否办结',
    completedAt: '办结时间',
    createdAt: '创建时间'
};

const CSV_EXPORT_FIELDS = [
    'fromUnit', 'docNumber', 'title', 'receiveDate', 'urgency',
    'proposedDepartment', 'undertakingDepartment', 'coDepartments',
    'flowStatus', 'deadline', 'remark', 'completed', 'completedAt', 'createdAt'
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
            } else if (field === 'flowStatus') {
                value = getFlowStatusText(value);
            } else if (field === 'coDepartments') {
                value = (value || []).join('、');
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
                    doc.receiveDate && doc.urgency && doc.department;
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
                    deadline: doc.deadline || '',
                    remark: doc.remark || '',
                    completed: doc.completed === true,
                    completedAt: doc.completedAt || null,
                    completedRemark: doc.completedRemark || '',
                    processingRecords: doc.processingRecords || [],
                    flowStatus: doc.flowStatus || null,
                    flowRecords: Array.isArray(doc.flowRecords) ? doc.flowRecords : [],
                    proposedDepartment: doc.proposedDepartment || '',
                    undertakingDepartment: doc.undertakingDepartment || doc.department || '',
                    coDepartments: Array.isArray(doc.coDepartments) ? doc.coDepartments : [],
                    reminderNote: doc.reminderNote || '',
                    snoozeUntil: doc.snoozeUntil || '',
                    extendedDeadline: doc.extendedDeadline || '',
                    reminderHistory: Array.isArray(doc.reminderHistory) ? doc.reminderHistory : [],
                    supervisionRecords: doc.supervisionRecords === undefined ? null :
                        (Array.isArray(doc.supervisionRecords) ? doc.supervisionRecords : []),
                    isDeleted: doc.isDeleted === true,
                    deletedAt: doc.deletedAt || null,
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
    const existingDocs = loadAllDocuments();
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

    const allDocs = loadAllDocuments();
    const overwrite = document.getElementById('restoreOverwriteCheckbox').checked;

    const existingById = {};
    const existingByDocNumber = {};
    const docIndexById = {};
    allDocs.forEach(function(doc, index) {
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
    let restoredFromTrash = 0;

    const finalDocs = allDocs.slice();

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
            let deadline = item.deadline;
            if (!deadline && item.receiveDate && item.urgency) {
                const days = getDeadlineDaysByUrgency(item.urgency);
                const deadlineDate = new Date(item.receiveDate);
                deadlineDate.setDate(deadlineDate.getDate() + days);
                deadline = formatDateInput(deadlineDate);
            }
            let flowStatus = item.flowStatus;
            if (!flowStatus) {
                flowStatus = item.completed ? FLOW_STATUS.DONE : FLOW_STATUS.PENDING_REVIEW;
            }
            const newDoc = {
                id: item.id || generateId(),
                fromUnit: item.fromUnit,
                docNumber: item.docNumber,
                title: item.title,
                receiveDate: item.receiveDate,
                urgency: item.urgency,
                department: item.department,
                deadline: deadline,
                remark: item.remark || '',
                completed: item.completed || false,
                completedAt: item.completedAt || null,
                completedRemark: item.completedRemark || '',
                processingRecords: item.processingRecords || [],
                flowStatus: flowStatus,
                flowRecords: item.flowRecords || [],
                proposedDepartment: item.proposedDepartment || '',
                undertakingDepartment: item.undertakingDepartment || item.department || '',
                coDepartments: item.coDepartments || [],
                reminderNote: item.reminderNote || '',
                snoozeUntil: item.snoozeUntil || '',
                extendedDeadline: item.extendedDeadline || '',
                reminderHistory: item.reminderHistory || [],
                supervisionRecords: Array.isArray(item.supervisionRecords) ? item.supervisionRecords : [],
                isDeleted: false,
                deletedAt: null,
                createdAt: item.createdAt || new Date().toISOString()
            };
            finalDocs.push(newDoc);
            addCount++;
        } else if (overwrite) {
            const index = docIndexById[matchDoc.id];
            if (index !== undefined && index !== -1) {
                const wasDeleted = matchDoc.isDeleted;
                let deadline = item.deadline;
                if (!deadline && item.receiveDate && item.urgency) {
                    const days = getDeadlineDaysByUrgency(item.urgency);
                    const deadlineDate = new Date(item.receiveDate);
                    deadlineDate.setDate(deadlineDate.getDate() + days);
                    deadline = formatDateInput(deadlineDate);
                }
                let flowStatus = item.flowStatus;
                if (!flowStatus) {
                    flowStatus = item.completed ? FLOW_STATUS.DONE : FLOW_STATUS.PENDING_REVIEW;
                }
                finalDocs[index] = {
                    ...matchDoc,
                    ...item,
                    id: matchDoc.id,
                    deadline: deadline,
                    flowStatus: flowStatus,
                    processingRecords: item.processingRecords || matchDoc.processingRecords || [],
                    flowRecords: item.flowRecords || matchDoc.flowRecords || [],
                    supervisionRecords: Array.isArray(item.supervisionRecords) ? item.supervisionRecords : (matchDoc.supervisionRecords || []),
                    proposedDepartment: item.proposedDepartment !== undefined ? item.proposedDepartment : (matchDoc.proposedDepartment || ''),
                    undertakingDepartment: item.undertakingDepartment || item.department || matchDoc.undertakingDepartment || matchDoc.department || '',
                    coDepartments: item.coDepartments || matchDoc.coDepartments || [],
                    completedRemark: item.completedRemark || matchDoc.completedRemark || '',
                    isDeleted: false,
                    deletedAt: null
                };
                overwriteCount++;
                if (wasDeleted) {
                    restoredFromTrash++;
                }
            }
        } else {
            skipCount++;
        }
    });

    saveDocuments(finalDocs);

    const totalAffected = addCount + overwriteCount;
    if (totalAffected > 0) {
        const sampleDoc = finalDocs.find(function(d) {
            return restoreData.some(function(r) { return r.docNumber === d.docNumber; });
        }) || finalDocs[0];
        addAuditLog(AUDIT_ACTION.RESTORE, sampleDoc, null, {
            addCount: addCount,
            overwriteCount: overwriteCount,
            skipCount: skipCount,
            restoredFromTrash: restoredFromTrash
        });
    }

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

function setReminderNote(docId, note) {
    const documents = loadAllDocuments();
    const docIndex = documents.findIndex(d => d.id === docId && !d.isDeleted);
    if (docIndex === -1) return false;

    documents[docIndex].reminderNote = note;
    documents[docIndex].reminderHistory.push({
        id: generateId(),
        type: 'note',
        note: note,
        createdAt: new Date().toISOString()
    });

    saveDocuments(documents);
    updateStats();
    renderDocumentList();
    renderReminderCenter();
    return true;
}

function extendDeadline(docId, days) {
    const documents = loadAllDocuments();
    const docIndex = documents.findIndex(d => d.id === docId && !d.isDeleted);
    if (docIndex === -1) return false;

    const doc = documents[docIndex];
    const oldDoc = { ...doc };
    const currentDeadline = new Date(getEffectiveDeadline(doc));
    currentDeadline.setDate(currentDeadline.getDate() + parseInt(days));
    const newDeadline = formatDateInput(currentDeadline);

    const oldDeadline = getEffectiveDeadline(doc);
    doc.extendedDeadline = newDeadline;

    doc.reminderHistory.push({
        id: generateId(),
        type: 'extend',
        oldDeadline: oldDeadline,
        newDeadline: newDeadline,
        extendDays: parseInt(days),
        createdAt: new Date().toISOString()
    });

    saveDocuments(documents);
    addAuditLog(AUDIT_ACTION.EXTEND, doc, oldDoc, { extendDays: parseInt(days) });
    updateStats();
    renderDocumentList();
    renderReminderCenter();
    return true;
}

function snoozeReminder(docId, snoozeDate) {
    const documents = loadAllDocuments();
    const docIndex = documents.findIndex(d => d.id === docId && !d.isDeleted);
    if (docIndex === -1) return false;

    documents[docIndex].snoozeUntil = snoozeDate;
    documents[docIndex].reminderHistory.push({
        id: generateId(),
        type: 'snooze',
        snoozeUntil: snoozeDate,
        createdAt: new Date().toISOString()
    });

    saveDocuments(documents);
    updateStats();
    renderDocumentList();
    renderReminderCenter();
    return true;
}

function cancelSnooze(docId) {
    const documents = loadAllDocuments();
    const docIndex = documents.findIndex(d => d.id === docId && !d.isDeleted);
    if (docIndex === -1) return false;

    documents[docIndex].snoozeUntil = '';
    documents[docIndex].reminderHistory.push({
        id: generateId(),
        type: 'cancel_snooze',
        createdAt: new Date().toISOString()
    });

    saveDocuments(documents);
    updateStats();
    renderDocumentList();
    renderReminderCenter();
    return true;
}

function hasPendingSupervision(doc) {
    if (!doc.supervisionRecords || doc.supervisionRecords.length === 0) {
        return false;
    }
    return doc.supervisionRecords.some(function(record) {
        return record.status === SUPERVISION_STATUS.PENDING;
    });
}

function getLatestSupervision(doc) {
    if (!doc.supervisionRecords || doc.supervisionRecords.length === 0) {
        return null;
    }
    const sorted = doc.supervisionRecords.slice().sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return sorted[0];
}

function createSupervision(docId, reason, supervisor, feedbackDeadline) {
    const documents = loadAllDocuments();
    const docIndex = documents.findIndex(d => d.id === docId && !d.isDeleted);
    if (docIndex === -1) return { success: false, message: '收文不存在' };

    const doc = documents[docIndex];
    const oldDoc = { ...doc };

    if (doc.flowStatus === FLOW_STATUS.DONE) {
        return { success: false, message: '已办结的收文不能发起督办' };
    }

    const deadlineStatus = getDeadlineStatus(doc);
    if (deadlineStatus !== 'overdue' && deadlineStatus !== 'urgent') {
        return { success: false, message: '仅逾期或即将到期的收文可发起督办' };
    }

    const now = new Date().toISOString();
    const supervisionRecord = {
        id: generateId(),
        reason: reason,
        supervisor: supervisor,
        feedbackDeadline: feedbackDeadline,
        result: '',
        status: SUPERVISION_STATUS.PENDING,
        createdAt: now,
        feedbackAt: null
    };

    if (!doc.supervisionRecords) {
        doc.supervisionRecords = [];
    }
    doc.supervisionRecords.push(supervisionRecord);

    saveDocuments(documents);
    addAuditLog(AUDIT_ACTION.SUPERVISION_CREATE, doc, oldDoc, {
        supervisionId: supervisionRecord.id,
        reason: reason,
        supervisor: supervisor,
        feedbackDeadline: feedbackDeadline
    });

    updateStats();
    renderDocumentList();
    renderReminderCenter();

    return { success: true, record: supervisionRecord };
}

function feedbackSupervision(docId, supervisionId, result) {
    const documents = loadAllDocuments();
    const docIndex = documents.findIndex(d => d.id === docId && !d.isDeleted);
    if (docIndex === -1) return { success: false, message: '收文不存在' };

    const doc = documents[docIndex];
    const oldDoc = { ...doc };

    if (!doc.supervisionRecords) {
        return { success: false, message: '没有督办记录' };
    }

    const recordIndex = doc.supervisionRecords.findIndex(function(r) {
        return r.id === supervisionId;
    });
    if (recordIndex === -1) {
        return { success: false, message: '督办记录不存在' };
    }

    const record = doc.supervisionRecords[recordIndex];
    if (record.status === SUPERVISION_STATUS.FEEDBACK) {
        return { success: false, message: '该督办已反馈' };
    }

    const now = new Date().toISOString();
    record.result = result;
    record.status = SUPERVISION_STATUS.FEEDBACK;
    record.feedbackAt = now;

    saveDocuments(documents);
    addAuditLog(AUDIT_ACTION.SUPERVISION_FEEDBACK, doc, oldDoc, {
        supervisionId: supervisionId,
        reason: record.reason,
        supervisor: record.supervisor,
        feedbackDeadline: record.feedbackDeadline,
        result: result,
        feedbackAt: now
    });

    updateStats();
    renderDocumentList();
    renderReminderCenter();

    return { success: true, record: record };
}

function getReminderCenterData() {
    const documents = getDocuments();
    const reminderDocs = documents.filter(doc => shouldShowInReminderCenter(doc));

    const groups = {
        overdue: [],
        today: [],
        soon: []
    };

    reminderDocs.forEach(doc => {
        const group = getReminderGroup(doc);
        if (groups[group]) {
            groups[group].push(doc);
        }
    });

    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => {
            const daysA = getDaysRemaining(getEffectiveDeadline(a));
            const daysB = getDaysRemaining(getEffectiveDeadline(b));
            return daysA - daysB;
        });
    });

    return groups;
}

function renderReminderCenter() {
    const reminderCenterEl = document.getElementById('reminderCenter');
    if (!reminderCenterEl) return;

    const groups = getReminderCenterData();
    const totalCount = groups.overdue.length + groups.today.length + groups.soon.length;

    if (totalCount === 0) {
        reminderCenterEl.innerHTML = `
            <div class="reminder-center-empty">
                <div class="reminder-empty-icon">🎉</div>
                <div class="reminder-empty-text">暂无到期提醒，继续保持！</div>
            </div>
        `;
        return;
    }

    let html = '';

    if (groups.overdue.length > 0) {
        html += `
            <div class="reminder-group overdue">
                <div class="reminder-group-header">
                    <span class="reminder-group-title">
                        <span class="reminder-group-icon">🔴</span>
                        已逾期
                    </span>
                    <span class="reminder-group-count">${groups.overdue.length} 件</span>
                </div>
                <div class="reminder-list">
                    ${groups.overdue.map(doc => renderReminderItem(doc)).join('')}
                </div>
            </div>
        `;
    }

    if (groups.today.length > 0) {
        html += `
            <div class="reminder-group today">
                <div class="reminder-group-header">
                    <span class="reminder-group-title">
                        <span class="reminder-group-icon">🟠</span>
                        今天到期
                    </span>
                    <span class="reminder-group-count">${groups.today.length} 件</span>
                </div>
                <div class="reminder-list">
                    ${groups.today.map(doc => renderReminderItem(doc)).join('')}
                </div>
            </div>
        `;
    }

    if (groups.soon.length > 0) {
        html += `
            <div class="reminder-group soon">
                <div class="reminder-group-header">
                    <span class="reminder-group-title">
                        <span class="reminder-group-icon">🟡</span>
                        3天内到期
                    </span>
                    <span class="reminder-group-count">${groups.soon.length} 件</span>
                </div>
                <div class="reminder-list">
                    ${groups.soon.map(doc => renderReminderItem(doc)).join('')}
                </div>
            </div>
        `;
    }

    reminderCenterEl.innerHTML = html;
}

function renderReminderItem(doc) {
    const effectiveDeadline = getEffectiveDeadline(doc);
    const daysRemaining = getDaysRemaining(effectiveDeadline);
    const undertakingDept = doc.undertakingDepartment || doc.department || '';
    const flowStatus = getDocumentStatus(doc);
    const flowStatusText = getFlowStatusText(flowStatus);
    const isExtended = !!doc.extendedDeadline;
    const hasPending = hasPendingSupervision(doc);
    const latestSupervision = getLatestSupervision(doc);

    let deadlineText = '';
    if (daysRemaining < 0) {
        deadlineText = `已逾期 ${Math.abs(daysRemaining)} 天`;
    } else if (daysRemaining === 0) {
        deadlineText = '今天到期';
    } else {
        deadlineText = `剩余 ${daysRemaining} 天`;
    }

    return `
        <div class="reminder-item ${hasPending ? 'has-supervision' : ''}" onclick="viewDocument('${doc.id}')">
            <div class="reminder-item-main">
                <div class="reminder-item-title">
                    ${escapeHtml(doc.title)}
                    ${hasPending ? '<span class="doc-tag supervision-pending">督办中</span>' : ''}
                </div>
                <div class="reminder-item-meta">
                    <span class="reminder-meta-item">
                        <span class="reminder-meta-label">来文单位:</span>
                        <span class="reminder-meta-value">${escapeHtml(doc.fromUnit)}</span>
                    </span>
                    <span class="reminder-meta-item">
                        <span class="reminder-meta-label">承办科室:</span>
                        <span class="reminder-meta-value">${escapeHtml(undertakingDept)}</span>
                    </span>
                    <span class="reminder-meta-item">
                        <span class="reminder-meta-label">状态:</span>
                        <span class="doc-tag flow-status-tag-${flowStatus}">${flowStatusText}</span>
                    </span>
                    ${isExtended ? '<span class="doc-tag reminder-extended">已延期</span>' : ''}
                </div>
                ${doc.reminderNote ? `
                <div class="reminder-item-note">
                    <span class="reminder-note-icon">📝</span>
                    <span class="reminder-note-text">${escapeHtml(doc.reminderNote)}</span>
                </div>
                ` : ''}
                ${hasPending && latestSupervision ? `
                <div class="reminder-item-supervision">
                    <span class="reminder-supervision-icon">📢</span>
                    <span class="reminder-supervision-text">
                        督办原因：${escapeHtml(latestSupervision.reason.substring(0, 30))}${latestSupervision.reason.length > 30 ? '...' : ''}
                        ｜ 要求反馈：${formatDate(latestSupervision.feedbackDeadline)}
                    </span>
                </div>
                ` : ''}
            </div>
            <div class="reminder-item-right">
                <div class="reminder-deadline ${daysRemaining < 0 ? 'overdue' : daysRemaining === 0 ? 'today' : 'soon'}">
                    ${deadlineText}
                </div>
                <div class="reminder-deadline-date">${formatDate(effectiveDeadline)}</div>
                <div class="reminder-actions" onclick="event.stopPropagation();">
                    <button class="reminder-action-btn" onclick="openReminderNoteModal('${doc.id}')" title="设置备注">
                        📝 备注
                    </button>
                    <button class="reminder-action-btn" onclick="openExtendDeadlineModal('${doc.id}')" title="延长期限">
                        ⏰ 延期
                    </button>
                    ${hasPending ?
                        `<button class="reminder-action-btn supervision-btn" onclick="openSupervisionFeedbackModal('${doc.id}')" title="督办反馈">
                            📢 反馈
                        </button>` :
                        `<button class="reminder-action-btn" onclick="openSupervisionModal('${doc.id}')" title="发起督办">
                            📢 督办
                        </button>`
                    }
                    <button class="reminder-action-btn" onclick="openSnoozeModal('${doc.id}')" title="暂不提醒">
                        🙈 暂不提醒
                    </button>
                </div>
            </div>
        </div>
    `;
}

let currentReminderDocId = null;

function openReminderNoteModal(docId) {
    currentReminderDocId = docId;
    const documents = getDocuments();
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    document.getElementById('reminderNoteInput').value = doc.reminderNote || '';
    document.getElementById('reminderNoteModal').classList.add('show');
    setTimeout(() => {
        document.getElementById('reminderNoteInput').focus();
    }, 100);
}

function closeReminderNoteModal() {
    document.getElementById('reminderNoteModal').classList.remove('show');
    currentReminderDocId = null;
}

function saveReminderNote() {
    if (!currentReminderDocId) return;
    const note = document.getElementById('reminderNoteInput').value.trim();
    if (setReminderNote(currentReminderDocId, note)) {
        showToast('提醒备注已保存', 'success');
        closeReminderNoteModal();
    }
}

function openExtendDeadlineModal(docId) {
    currentReminderDocId = docId;
    const documents = getDocuments();
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    const currentDeadline = getEffectiveDeadline(doc);
    document.getElementById('extendCurrentDeadline').textContent = formatDate(currentDeadline);
    document.getElementById('extendDays').value = '3';
    updateExtendPreview();

    document.getElementById('extendDeadlineModal').classList.add('show');
}

function closeExtendDeadlineModal() {
    document.getElementById('extendDeadlineModal').classList.remove('show');
    currentReminderDocId = null;
}

function updateExtendPreview() {
    const documents = getDocuments();
    const doc = documents.find(d => d.id === currentReminderDocId);
    if (!doc) return;

    const days = parseInt(document.getElementById('extendDays').value) || 0;
    const currentDeadline = new Date(getEffectiveDeadline(doc));
    currentDeadline.setDate(currentDeadline.getDate() + days);
    document.getElementById('extendNewDeadline').textContent = formatDate(formatDateInput(currentDeadline));
}

function confirmExtendDeadline() {
    if (!currentReminderDocId) return;
    const days = parseInt(document.getElementById('extendDays').value) || 0;
    if (days <= 0) {
        showToast('请输入有效的延期天数', 'error');
        return;
    }
    if (extendDeadline(currentReminderDocId, days)) {
        showToast(`已延期 ${days} 天`, 'success');
        closeExtendDeadlineModal();
    }
}

function openSnoozeModal(docId) {
    currentReminderDocId = docId;
    const documents = getDocuments();
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    const today = getToday();
    const defaultSnooze = new Date(today);
    defaultSnooze.setDate(defaultSnooze.getDate() + 3);
    document.getElementById('snoozeDate').value = formatDateInput(defaultSnooze);

    document.getElementById('snoozeModal').classList.add('show');
}

function closeSnoozeModal() {
    document.getElementById('snoozeModal').classList.remove('show');
    currentReminderDocId = null;
}

function confirmSnooze() {
    if (!currentReminderDocId) return;
    const snoozeDate = document.getElementById('snoozeDate').value;
    if (!snoozeDate) {
        showToast('请选择暂不提醒的日期', 'error');
        return;
    }
    const today = formatDateInput(getToday());
    if (snoozeDate < today) {
        showToast('暂不提醒日期不能早于今天', 'error');
        return;
    }
    if (snoozeReminder(currentReminderDocId, snoozeDate)) {
        showToast('已设置暂不提醒', 'success');
        closeSnoozeModal();
    }
}

function openSupervisionModal(docId) {
    currentSupervisionDocId = docId;
    const documents = getDocuments();
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    if (doc.flowStatus === FLOW_STATUS.DONE) {
        showToast('已办结的收文不能发起督办', 'error');
        return;
    }

    const deadlineStatus = getDeadlineStatus(doc);
    if (deadlineStatus !== 'overdue' && deadlineStatus !== 'urgent') {
        showToast('仅逾期或即将到期的收文可发起督办', 'error');
        return;
    }

    document.getElementById('supervisionDocId').value = docId;
    document.getElementById('supervisionReason').value = '';
    document.getElementById('supervisionSupervisor').value = '';

    const today = getToday();
    const defaultDeadline = new Date(today);
    defaultDeadline.setDate(defaultDeadline.getDate() + 3);
    document.getElementById('supervisionFeedbackDeadline').value = formatDateInput(defaultDeadline);

    document.getElementById('supervisionModal').classList.add('show');
    setTimeout(function() {
        document.getElementById('supervisionReason').focus();
    }, 100);
}

function closeSupervisionModal() {
    document.getElementById('supervisionModal').classList.remove('show');
    currentSupervisionDocId = null;
}

function saveSupervision(e) {
    if (e) e.preventDefault();
    if (!currentSupervisionDocId) return;

    const reason = document.getElementById('supervisionReason').value.trim();
    const supervisor = document.getElementById('supervisionSupervisor').value.trim();
    const feedbackDeadline = document.getElementById('supervisionFeedbackDeadline').value;

    if (!reason) {
        showToast('请输入督办原因', 'error');
        return;
    }
    if (!feedbackDeadline) {
        showToast('请选择要求反馈时间', 'error');
        return;
    }

    const result = createSupervision(currentSupervisionDocId, reason, supervisor, feedbackDeadline);
    if (result.success) {
        showToast('督办已发起', 'success');
        closeSupervisionModal();

        const detailModal = document.getElementById('detailModal');
        if (detailModal && detailModal.classList.contains('show')) {
            viewDocument(currentSupervisionDocId);
        }
    } else {
        showToast(result.message || '发起督办失败', 'error');
    }
}

function openSupervisionFeedbackModal(docId) {
    currentSupervisionDocId = docId;
    const documents = getDocuments();
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    const pendingRecord = (doc.supervisionRecords || []).find(function(r) {
        return r.status === SUPERVISION_STATUS.PENDING;
    });
    if (!pendingRecord) {
        showToast('没有待反馈的督办记录', 'error');
        return;
    }

    document.getElementById('supervisionFeedbackDocId').value = docId;
    document.getElementById('supervisionFeedbackRecordId').value = pendingRecord.id;
    document.getElementById('supervisionFeedbackReason').textContent = pendingRecord.reason || '-';
    document.getElementById('supervisionFeedbackSupervisor').textContent = pendingRecord.supervisor || '-';
    document.getElementById('supervisionFeedbackDeadlineText').textContent = formatDate(pendingRecord.feedbackDeadline) || '-';
    document.getElementById('supervisionFeedbackResult').value = '';

    document.getElementById('supervisionFeedbackModal').classList.add('show');
    setTimeout(function() {
        document.getElementById('supervisionFeedbackResult').focus();
    }, 100);
}

function closeSupervisionFeedbackModal() {
    document.getElementById('supervisionFeedbackModal').classList.remove('show');
    currentSupervisionDocId = null;
}

function saveSupervisionFeedback(e) {
    if (e) e.preventDefault();
    if (!currentSupervisionDocId) return;

    const recordId = document.getElementById('supervisionFeedbackRecordId').value;
    const result = document.getElementById('supervisionFeedbackResult').value.trim();

    if (!result) {
        showToast('请输入处理结果', 'error');
        return;
    }

    const feedbackResult = feedbackSupervision(currentSupervisionDocId, recordId, result);
    if (feedbackResult.success) {
        showToast('督办反馈已提交', 'success');
        closeSupervisionFeedbackModal();

        const detailModal = document.getElementById('detailModal');
        if (detailModal && detailModal.classList.contains('show')) {
            viewDocument(currentSupervisionDocId);
        }
    } else {
        showToast(feedbackResult.message || '提交反馈失败', 'error');
    }
}

function getAuditLogExtraSearchText(log) {
    if (!log.extra) return '';
    const extra = log.extra;
    const values = [];
    if (extra.reason) values.push(extra.reason);
    if (extra.supervisor) values.push(extra.supervisor);
    if (extra.feedbackDeadline) values.push(formatDate(extra.feedbackDeadline));
    if (extra.result) values.push(extra.result);
    if (extra.feedbackAt) values.push(formatDateTime(extra.feedbackAt));
    return values.join(' ');
}

function renderAuditLogExtra(log) {
    if (!log.extra ||
        (log.action !== AUDIT_ACTION.SUPERVISION_CREATE && log.action !== AUDIT_ACTION.SUPERVISION_FEEDBACK)) {
        return '';
    }
    const extra = log.extra;
    const rows = [];

    if (extra.reason) {
        rows.push(`
            <div class="audit-extra-row">
                <span class="audit-extra-label">督办原因：</span>
                <span class="audit-extra-value">${escapeHtml(extra.reason)}</span>
            </div>
        `);
    }
    if (extra.supervisor) {
        rows.push(`
            <div class="audit-extra-row">
                <span class="audit-extra-label">督办人：</span>
                <span class="audit-extra-value">${escapeHtml(extra.supervisor)}</span>
            </div>
        `);
    }
    if (extra.feedbackDeadline) {
        rows.push(`
            <div class="audit-extra-row">
                <span class="audit-extra-label">要求反馈：</span>
                <span class="audit-extra-value">${formatDate(extra.feedbackDeadline)}</span>
            </div>
        `);
    }
    if (extra.result) {
        rows.push(`
            <div class="audit-extra-row">
                <span class="audit-extra-label">处理结果：</span>
                <span class="audit-extra-value">${escapeHtml(extra.result)}</span>
            </div>
        `);
    }
    if (extra.feedbackAt) {
        rows.push(`
            <div class="audit-extra-row">
                <span class="audit-extra-label">反馈时间：</span>
                <span class="audit-extra-value">${formatDateTime(extra.feedbackAt)}</span>
            </div>
        `);
    }

    if (rows.length === 0) return '';
    return `<div class="audit-log-extra">${rows.join('')}</div>`;
}

function renderAuditLogList() {
    const logs = getAuditLogs();
    const listEl = document.getElementById('auditLogList');
    const countEl = document.getElementById('auditLogTotalCount');

    let filteredLogs = logs;
    if (auditLogKeyword) {
        const kw = auditLogKeyword.toLowerCase();
        filteredLogs = logs.filter(function(log) {
            return log.docTitle.toLowerCase().includes(kw) ||
                   log.docNumber.toLowerCase().includes(kw) ||
                   log.actionText.toLowerCase().includes(kw) ||
                   log.beforeSummary.toLowerCase().includes(kw) ||
                   log.afterSummary.toLowerCase().includes(kw) ||
                   getAuditLogExtraSearchText(log).toLowerCase().includes(kw);
        });
    }

    if (countEl) countEl.textContent = filteredLogs.length;

    if (filteredLogs.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <p class="empty-text">暂无审计日志记录</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filteredLogs.map(function(log) {
        const actionIconMap = {
            'create': '➕',
            'edit': '✏️',
            'complete': '✅',
            'extend': '⏰',
            'batch_complete': '✅',
            'batch_delete': '🗑',
            'batch_department': '🏢',
            'import': '📋',
            'restore': '♻️',
            'delete': '🗑',
            'restore_recycle': '↩',
            'batch_restore_recycle': '↩',
            'permanent_delete': '✕',
            'batch_permanent_delete': '✕',
            'empty_recycle_bin': '🗑',
            'flow_rule_change': '⚙️',
            'supervision_create': '📢',
            'supervision_feedback': '📨'
        };
        const icon = actionIconMap[log.action] || '📝';
        const timeStr = formatDateTime(log.timestamp);
        const extraText = log.extra && log.extra.count ? '（共 ' + log.extra.count + ' 条）' : '';

        return `
            <div class="audit-log-item">
                <div class="audit-log-icon">${icon}</div>
                <div class="audit-log-content">
                    <div class="audit-log-header">
                        <span class="audit-log-action">${escapeHtml(log.actionText)}${extraText}</span>
                        <span class="audit-log-time">${escapeHtml(timeStr)}</span>
                    </div>
                    <div class="audit-log-title">
                        ${log.docTitle ? escapeHtml(log.docTitle) : '-'}
                        ${log.docNumber ? '<span class="audit-log-doc-number">[' + escapeHtml(log.docNumber) + ']</span>' : ''}
                    </div>
                    ${renderAuditLogExtra(log)}
                    ${log.changes ? '<div class="audit-log-changes">变更：' + escapeHtml(log.changes) + '</div>' : ''}
                    <div class="audit-log-summary">
                        <div class="audit-log-before">
                            <span class="audit-summary-label">变更前：</span>
                            <span class="audit-summary-value">${escapeHtml(log.beforeSummary)}</span>
                        </div>
                        <div class="audit-log-after">
                            <span class="audit-summary-label">变更后：</span>
                            <span class="audit-summary-value">${escapeHtml(log.afterSummary)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function searchAuditLogs() {
    const input = document.getElementById('auditLogSearchInput');
    if (input) {
        auditLogKeyword = input.value.trim();
    }
    renderAuditLogList();
}

function renderRecycleBinList() {
    const docs = getRecycleBinDocuments();
    const listEl = document.getElementById('recycleBinList');
    const countEl = document.getElementById('recycleBinCount');

    if (countEl) countEl.textContent = docs.length;

    if (docs.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🗑</div>
                <p class="empty-text">回收站为空</p>
                <button class="btn btn-primary" onclick="switchView('list')">返回列表</button>
            </div>
        `;
        updateRecycleBatchToolbar();
        return;
    }

    const validIds = docs.map(d => d.id);
    recycleSelectedIds = recycleSelectedIds.filter(id => validIds.includes(id));

    listEl.innerHTML = docs.map(function(doc) {
        const isSelected = recycleSelectedIds.includes(doc.id);
        const flowStatus = getDocumentStatus(doc);
        const flowStatusText = getFlowStatusText(flowStatus);
        const undertakingDept = doc.undertakingDepartment || doc.department || '';
        const deletedTime = formatDateTime(doc.deletedAt);
        const hasPendingSup = hasPendingSupervision(doc);

        return `
            <div class="recycle-bin-item ${isSelected ? 'selected' : ''}">
                <div class="recycle-checkbox" onclick="event.stopPropagation(); toggleRecycleSelect('${doc.id}')">
                    <span class="card-checkbox ${isSelected ? 'checked' : ''}">${isSelected ? '✓' : ''}</span>
                </div>
                <div class="recycle-content" onclick="viewRecycleDocument('${doc.id}')">
                    <div class="recycle-header">
                        <div class="recycle-title">${escapeHtml(doc.title)}</div>
                        <div class="recycle-tags">
                            <span class="doc-tag urgency-${doc.urgency}">${doc.urgency}</span>
                            <span class="doc-tag flow-status-tag-${flowStatus}">${flowStatusText}</span>
                            ${hasPendingSup ? '<span class="doc-tag supervision-pending">督办中</span>' : ''}
                        </div>
                    </div>
                    <div class="recycle-info">
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
                            <span class="doc-info-value">${escapeHtml(undertakingDept)}</span>
                        </div>
                        <div class="doc-info-item">
                            <span class="doc-info-label">删除时间</span>
                            <span class="doc-info-value recycle-deleted-time">${escapeHtml(deletedTime)}</span>
                        </div>
                    </div>
                </div>
                <div class="recycle-actions">
                    <button class="action-btn restore" onclick="event.stopPropagation(); restoreFromRecycleBin('${doc.id}')">恢复</button>
                    <button class="action-btn delete" onclick="event.stopPropagation(); permanentDeleteFromRecycleBin('${doc.id}')">彻底删除</button>
                </div>
            </div>
        `;
    }).join('');

    updateRecycleBatchToolbar();
}

function toggleRecycleSelect(id) {
    const index = recycleSelectedIds.indexOf(id);
    if (index > -1) {
        recycleSelectedIds.splice(index, 1);
    } else {
        recycleSelectedIds.push(id);
    }
    renderRecycleBinList();
}

function toggleRecycleSelectAll() {
    const docs = getRecycleBinDocuments();
    if (recycleSelectedIds.length === docs.length && docs.length > 0) {
        recycleSelectedIds = [];
    } else {
        recycleSelectedIds = docs.map(doc => doc.id);
    }
    renderRecycleBinList();
}

function updateRecycleBatchToolbar() {
    const toolbar = document.getElementById('recycleBatchToolbar');
    if (!toolbar) return;

    const docs = getRecycleBinDocuments();
    const countEl = document.getElementById('recycleSelectedCount');
    const selectAllCheckbox = document.getElementById('recycleSelectAllCheckbox');

    if (recycleSelectedIds.length > 0) {
        toolbar.style.display = 'flex';
        if (countEl) countEl.textContent = recycleSelectedIds.length;
        if (selectAllCheckbox) selectAllCheckbox.checked = docs.length > 0 && recycleSelectedIds.length === docs.length;
    } else {
        toolbar.style.display = 'none';
    }
}

function restoreFromRecycleBin(id) {
    if (restoreDocument(id)) {
        const idx = recycleSelectedIds.indexOf(id);
        if (idx > -1) recycleSelectedIds.splice(idx, 1);
        showToast('收文已恢复', 'success');
        renderRecycleBinList();
        updateStats();
    }
}

function permanentDeleteFromRecycleBin(id) {
    if (permanentDeleteDocument(id)) {
        const idx = recycleSelectedIds.indexOf(id);
        if (idx > -1) recycleSelectedIds.splice(idx, 1);
        showToast('收文已彻底删除', 'success');
        renderRecycleBinList();
    }
}

function batchRestoreFromRecycle() {
    if (recycleSelectedIds.length === 0) {
        showToast('请先选择要恢复的收文', 'warning');
        return;
    }
    const count = batchRestoreDocuments(recycleSelectedIds);
    if (count > 0) {
        recycleSelectedIds = [];
        showToast('成功恢复 ' + count + ' 条收文', 'success');
        renderRecycleBinList();
        updateStats();
    }
}

function batchPermanentDeleteFromRecycle() {
    if (recycleSelectedIds.length === 0) {
        showToast('请先选择要彻底删除的收文', 'warning');
        return;
    }
    const count = batchPermanentDelete(recycleSelectedIds);
    if (count > 0) {
        recycleSelectedIds = [];
        showToast('成功彻底删除 ' + count + ' 条收文', 'success');
        renderRecycleBinList();
    }
}

function viewRecycleDocument(id) {
    const allDocs = loadAllDocuments();
    const doc = allDocs.find(d => d.id === id);
    if (!doc) return;
    viewDocument(id);
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
        } else {
            const urgencyEl = document.getElementById('urgency');
            if (urgencyEl) {
                updateAddModalDeadlineByUrgency(urgencyEl.value);
            }
        }
    });

    const urgencySelect = document.getElementById('urgency');
    if (urgencySelect) {
        urgencySelect.addEventListener('change', function() {
            updateAddModalDeadlineByUrgency(this.value);
        });
    }

    document.getElementById('templateName').addEventListener('input', function() {
        clearTimeout(window.templateDupTimer);
        window.templateDupTimer = setTimeout(updateTemplateDupTip, 200);
    });

    const auditSearchInput = document.getElementById('auditLogSearchInput');
    if (auditSearchInput) {
        auditSearchInput.addEventListener('input', function() {
            clearTimeout(window.auditSearchTimer);
            window.auditSearchTimer = setTimeout(searchAuditLogs, 300);
        });
    }

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
            if (typeof closeCompleteModal === 'function') closeCompleteModal();
            closeSaveTemplateModal();
            closeSaveViewPresetModal();
            closeViewPresetMenu();
            closeFlowModal();
            closeReminderNoteModal();
            closeExtendDeadlineModal();
            closeSnoozeModal();
        }
    });

    document.addEventListener('click', function(e) {
        const exportDropdown = document.querySelector('.export-dropdown');
        if (exportDropdown && !exportDropdown.contains(e.target)) {
            closeExportMenu();
        }

        const viewPresetSelector = document.getElementById('viewPresetSelector');
        if (viewPresetSelector && !viewPresetSelector.contains(e.target)) {
            closeViewPresetMenu();
        }
    });

    setupFileDragDrop();
    setupRestoreFileDragDrop();

    const activePresetId = getActiveViewPresetId();
    if (activePresetId) {
        const presets = getViewPresets();
        const preset = presets.find(function(p) { return p.id === activePresetId; });
        if (preset) {
            switchingFromPreset = true;
            applyViewPreset(activePresetId);
            switchingFromPreset = false;
        } else {
            saveActiveViewPresetId(null);
            const defaultPreset = getDefaultViewPreset();
            if (defaultPreset) {
                switchingFromPreset = true;
                applyViewPreset(defaultPreset.id);
                switchingFromPreset = false;
            }
        }
    } else {
        const defaultPreset = getDefaultViewPreset();
        if (defaultPreset) {
            switchingFromPreset = true;
            applyViewPreset(defaultPreset.id);
            switchingFromPreset = false;
        }
    }

    updateFilterActiveBadge();
    renderViewPresetSelector();
    updateStats();
    renderReminderCenter();
    renderDocumentList();
}

document.addEventListener('DOMContentLoaded', init);
