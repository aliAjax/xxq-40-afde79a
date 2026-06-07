const STORAGE_KEY = 'document_registry_data';
const TEMPLATE_STORAGE_KEY = 'document_templates';
const AUDIT_LOG_STORAGE_KEY = 'document_audit_logs';
const FLOW_RULE_STORAGE_KEY = 'document_flow_rules';
const VIEW_PRESETS_STORAGE_KEY = 'document_view_presets';
const ACTIVE_VIEW_STORAGE_KEY = 'document_active_view';
const CHANGE_HISTORY_STORAGE_KEY = 'document_change_history';
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

const BATCH_FLOW_ACTION = {
    PROPOSE: 'propose',
    TRANSFER: 'transfer',
    ASSIGN_CO: 'assign_co',
    FEEDBACK: 'feedback',
    SUPERVISION: 'supervision'
};

const BATCH_FLOW_ACTION_TEXT = {
    'propose': '批量拟办',
    'transfer': '批量转办',
    'assign_co': '批量指定协办',
    'feedback': '批量反馈',
    'supervision': '批量督办'
};

const BATCH_FLOW_ACTION_ICON = {
    'propose': '💡',
    'transfer': '📤',
    'assign_co': '🤝',
    'feedback': '📥',
    'supervision': '📢'
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
let currentBatchFlowAction = null;
let batchFlowValidDocs = [];
let batchFlowSkippedDocs = [];

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
        const templates = JSON.parse(data);
        return templates.map(function(tpl) {
            return {
                useCount: 0,
                lastUsedAt: null,
                ...tpl
            };
        });
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

const CHANGE_HISTORY_FIELDS = [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'docNumber', label: '文号', type: 'text' },
    { key: 'fromUnit', label: '来文单位', type: 'text' },
    { key: 'receiveDate', label: '收文日期', type: 'date' },
    { key: 'urgency', label: '紧急程度', type: 'text' },
    { key: 'proposedDepartment', label: '拟办科室', type: 'text' },
    { key: 'undertakingDepartment', label: '承办科室', type: 'text' },
    { key: 'coDepartments', label: '协办科室', type: 'array' },
    { key: 'deadline', label: '办理期限', type: 'date' },
    { key: 'extendedDeadline', label: '延期后期限', type: 'date' },
    { key: 'flowStatus', label: '流转状态', type: 'status' },
    { key: 'remark', label: '备注', type: 'text' },
    { key: 'reminderNote', label: '提醒备注', type: 'text' },
    { key: 'snoozeUntil', label: '暂不提醒至', type: 'date' },
    { key: 'completed', label: '是否办结', type: 'boolean' },
    { key: 'completedRemark', label: '办结说明', type: 'text' }
];

function getChangeHistory() {
    const data = localStorage.getItem(CHANGE_HISTORY_STORAGE_KEY);
    if (!data) return {};
    try {
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

function saveChangeHistory(history) {
    localStorage.setItem(CHANGE_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function getChangeHistoryByDocId(docId) {
    const allHistory = getChangeHistory();
    return allHistory[docId] || [];
}

function formatFieldValue(key, value) {
    const field = CHANGE_HISTORY_FIELDS.find(f => f.key === key);
    if (!field) return value;

    if (value === undefined || value === null || value === '') {
        return '（空）';
    }

    switch (field.type) {
        case 'date':
            return formatDate(value);
        case 'array':
            if (Array.isArray(value) && value.length > 0) {
                return value.join('、');
            }
            return '无';
        case 'status':
            return FLOW_STATUS_TEXT[value] || value;
        case 'boolean':
            return value ? '是' : '否';
        default:
            return String(value);
    }
}

function getFieldChanges(oldDoc, newDoc) {
    const changes = [];
    CHANGE_HISTORY_FIELDS.forEach(function(field) {
        const oldVal = oldDoc ? oldDoc[field.key] : undefined;
        const newVal = newDoc ? newDoc[field.key] : undefined;

        let isChanged = false;
        if (field.type === 'array') {
            const oldArr = oldVal || [];
            const newArr = newVal || [];
            isChanged = JSON.stringify(oldArr.sort()) !== JSON.stringify(newArr.sort());
        } else {
            isChanged = (oldVal || '') !== (newVal || '');
        }

        if (isChanged) {
            changes.push({
                key: field.key,
                label: field.label,
                type: field.type,
                oldValue: oldVal,
                newValue: newVal,
                oldDisplay: formatFieldValue(field.key, oldVal),
                newDisplay: formatFieldValue(field.key, newVal)
            });
        }
    });
    return changes;
}

function addChangeHistoryRecord(docId, action, actionText, oldDoc, newDoc, extra) {
    const allHistory = getChangeHistory();
    if (!allHistory[docId]) {
        allHistory[docId] = [];
    }

    const changes = getFieldChanges(oldDoc, newDoc);

    const record = {
        id: generateId(),
        action: action,
        actionText: actionText || AUDIT_ACTION_TEXT[action] || action,
        timestamp: new Date().toISOString(),
        oldSnapshot: oldDoc ? extractComparableSnapshot(oldDoc) : null,
        newSnapshot: newDoc ? extractComparableSnapshot(newDoc) : null,
        changes: changes,
        extra: extra || null
    };

    allHistory[docId].unshift(record);
    saveChangeHistory(allHistory);
    return record;
}

function extractComparableSnapshot(doc) {
    if (!doc) return null;
    const snapshot = {};
    CHANGE_HISTORY_FIELDS.forEach(function(field) {
        if (doc[field.key] !== undefined) {
            snapshot[field.key] = doc[field.key];
        }
    });
    return snapshot;
}

const CHANGE_HISTORY_MIGRATION_KEY = 'document_change_history_migrated_v1';

function migrateChangeHistory() {
    const migrationDone = localStorage.getItem(CHANGE_HISTORY_MIGRATION_KEY);
    if (migrationDone === 'true') {
        return;
    }

    const allDocs = loadAllDocuments();
    const allHistory = getChangeHistory();
    let migratedCount = 0;

    allDocs.forEach(function(doc) {
        if (allHistory[doc.id] && allHistory[doc.id].length > 0) {
            return;
        }

        const docHistory = [];

        docHistory.push({
            id: generateId(),
            action: AUDIT_ACTION.CREATE,
            actionText: AUDIT_ACTION_TEXT[AUDIT_ACTION.CREATE] || '新增收文',
            timestamp: doc.createdAt || new Date().toISOString(),
            oldSnapshot: null,
            newSnapshot: extractComparableSnapshot(doc),
            changes: [],
            extra: { migrated: true }
        });

        if (doc.flowRecords && doc.flowRecords.length > 0) {
            const sortedFlowRecords = [...doc.flowRecords].sort(function(a, b) {
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

            let prevDoc = { ...doc };
            for (let i = sortedFlowRecords.length - 1; i >= 0; i--) {
                const record = sortedFlowRecords[i];
                let tempDoc = { ...prevDoc };
                
                if (record.action === FLOW_ACTION.COMPLETE) {
                    tempDoc.completed = false;
                    tempDoc.completedAt = null;
                    tempDoc.completedRemark = '';
                    tempDoc.flowStatus = record.fromStatus || FLOW_STATUS.PROCESSING;
                } else if (record.fromStatus) {
                    tempDoc.flowStatus = record.fromStatus;
                }
                
                if (record.action === FLOW_ACTION.ASSIGN && record.department) {
                    tempDoc.undertakingDepartment = record.department;
                    tempDoc.department = record.department;
                }
                
                if (record.action === FLOW_ACTION.PROPOSE && record.department) {
                    tempDoc.proposedDepartment = record.department;
                }

                const auditActionMap = {
                    [FLOW_ACTION.PROPOSE]: AUDIT_ACTION.FLOW_PROPOSE,
                    [FLOW_ACTION.ASSIGN]: AUDIT_ACTION.FLOW_ASSIGN,
                    [FLOW_ACTION.PROGRESS]: AUDIT_ACTION.FLOW_PROGRESS,
                    [FLOW_ACTION.FEEDBACK]: AUDIT_ACTION.FLOW_FEEDBACK,
                    [FLOW_ACTION.COMPLETE]: AUDIT_ACTION.COMPLETE
                };

                const actionType = auditActionMap[record.action] || record.action;
                const actionText = record.actionText || FLOW_ACTION_TEXT[record.action] || record.action;

                const changes = getFieldChanges(tempDoc, prevDoc);
                
                const historyRecord = {
                    id: generateId(),
                    action: actionType,
                    actionText: actionText,
                    timestamp: record.createdAt || new Date().toISOString(),
                    oldSnapshot: extractComparableSnapshot(tempDoc),
                    newSnapshot: extractComparableSnapshot(prevDoc),
                    changes: changes,
                    extra: {
                        migrated: true,
                        handler: record.handler || '',
                        opinion: record.opinion || '',
                        department: record.department || ''
                    }
                };

                docHistory.unshift(historyRecord);
                prevDoc = tempDoc;
            }
        }

        if (doc.reminderHistory && doc.reminderHistory.length > 0) {
            const sortedReminders = [...doc.reminderHistory].sort(function(a, b) {
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

            sortedReminders.forEach(function(item) {
                let action = AUDIT_ACTION.EDIT;
                let actionText = '提醒变更';
                
                if (item.type === 'extend') {
                    action = AUDIT_ACTION.EXTEND;
                    actionText = AUDIT_ACTION_TEXT[action] || '延期办理';
                } else if (item.type === 'snooze') {
                    actionText = '设置暂不提醒';
                } else if (item.type === 'cancel_snooze') {
                    actionText = '取消暂不提醒';
                } else if (item.type === 'note') {
                    actionText = '提醒备注变更';
                }

                let oldDoc = { ...doc };
                let newDoc = { ...doc };

                if (item.type === 'extend' && item.oldDeadline && item.newDeadline) {
                    oldDoc.extendedDeadline = item.oldDeadline;
                    newDoc.extendedDeadline = item.newDeadline;
                } else if (item.type === 'snooze') {
                    oldDoc.snoozeUntil = '';
                    newDoc.snoozeUntil = item.snoozeUntil;
                } else if (item.type === 'cancel_snooze') {
                    oldDoc.snoozeUntil = item.snoozeUntil || '';
                    newDoc.snoozeUntil = '';
                } else if (item.type === 'note') {
                    oldDoc.reminderNote = '';
                    newDoc.reminderNote = item.note || '';
                }

                const changes = getFieldChanges(oldDoc, newDoc);

                const historyRecord = {
                    id: generateId(),
                    action: action,
                    actionText: actionText,
                    timestamp: item.createdAt || new Date().toISOString(),
                    oldSnapshot: extractComparableSnapshot(oldDoc),
                    newSnapshot: extractComparableSnapshot(newDoc),
                    changes: changes,
                    extra: {
                        migrated: true,
                        type: item.type
                    }
                };

                const insertIndex = docHistory.findIndex(function(h) {
                    return new Date(h.timestamp) > new Date(item.createdAt);
                });

                if (insertIndex === -1) {
                    docHistory.push(historyRecord);
                } else {
                    docHistory.splice(insertIndex, 0, historyRecord);
                }
            });
        }

        if (doc.isDeleted && doc.deletedAt) {
            const deletedOldDoc = { ...doc };
            deletedOldDoc.isDeleted = false;
            deletedOldDoc.deletedAt = null;
            
            const changes = getFieldChanges(deletedOldDoc, doc);
            
            const deleteRecord = {
                id: generateId(),
                action: AUDIT_ACTION.DELETE,
                actionText: AUDIT_ACTION_TEXT[AUDIT_ACTION.DELETE] || '删除收文',
                timestamp: doc.deletedAt,
                oldSnapshot: extractComparableSnapshot(deletedOldDoc),
                newSnapshot: extractComparableSnapshot(doc),
                changes: changes,
                extra: { migrated: true }
            };
            
            docHistory.unshift(deleteRecord);
        }

        docHistory.sort(function(a, b) {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        allHistory[doc.id] = docHistory;
        migratedCount++;
    });

    saveChangeHistory(allHistory);
    localStorage.setItem(CHANGE_HISTORY_MIGRATION_KEY, 'true');

    if (migratedCount > 0) {
        console.log(`变更历史迁移完成，共迁移 ${migratedCount} 条收文的历史记录`);
    }
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

    const tplIndex = templates.findIndex(function(t) { return t.id === templateId; });
    if (tplIndex !== -1) {
        templates[tplIndex].useCount = (templates[tplIndex].useCount || 0) + 1;
        templates[tplIndex].lastUsedAt = new Date().toISOString();
        saveTemplates(templates);
    }

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
    const undertakingDepartment = document.getElementById('undertakingDepartment')
        ? document.getElementById('undertakingDepartment').value
        : (document.getElementById('department') ? document.getElementById('department').value : '');
    const deadline = document.getElementById('deadline').value;
    const receiveDate = document.getElementById('receiveDate').value;
    const remark = document.getElementById('remark').value.trim();

    if (!fromUnit || !undertakingDepartment) {
        showToast('请至少填写来文单位和承办科室后再保存模板', 'error');
        return;
    }

    document.getElementById('templateName').value = '';
    document.getElementById('previewFromUnit').textContent = fromUnit || '-';
    document.getElementById('previewUrgency').textContent = urgency || '-';
    document.getElementById('previewDepartment').textContent = undertakingDepartment || '-';

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
            if (typeof renderTemplateManagementList === 'function') renderTemplateManagementList();
            return;
        }
    }

    const templates = getTemplates();
    const newTemplate = {
        id: generateId(),
        name: name,
        ...formData,
        useCount: 0,
        lastUsedAt: null,
        createdAt: new Date().toISOString()
    };

    templates.unshift(newTemplate);
    saveTemplates(templates);
    renderTemplateSelect();
    document.getElementById('templateSelect').value = newTemplate.id;
    document.getElementById('deleteTemplateBtn').style.display = 'inline-flex';

    closeSaveTemplateModal();
    showToast('模板保存成功', 'success');
    if (typeof renderTemplateManagementList === 'function') renderTemplateManagementList();
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
    if (typeof renderTemplateManagementList === 'function') renderTemplateManagementList();
}

let templateMgmtSearchKeyword = '';

function renderTemplateManagementList() {
    const listEl = document.getElementById('templateMgmtList');
    if (!listEl) return;

    let templates = getTemplates();

    if (templateMgmtSearchKeyword) {
        const keyword = templateMgmtSearchKeyword.toLowerCase();
        templates = templates.filter(function(tpl) {
            return (tpl.name && tpl.name.toLowerCase().includes(keyword)) ||
                (tpl.fromUnit && tpl.fromUnit.toLowerCase().includes(keyword)) ||
                (tpl.proposedDepartment && tpl.proposedDepartment.toLowerCase().includes(keyword)) ||
                (tpl.undertakingDepartment && tpl.undertakingDepartment.toLowerCase().includes(keyword)) ||
                (tpl.department && tpl.department.toLowerCase().includes(keyword)) ||
                (tpl.remark && tpl.remark.toLowerCase().includes(keyword)) ||
                (tpl.coDepartments && tpl.coDepartments.some(function(d) { return d.toLowerCase().includes(keyword); }));
        });
    }

    const totalCountEl = document.getElementById('templateMgmtTotalCount');
    if (totalCountEl) totalCountEl.textContent = templates.length;

    const totalUseCountEl = document.getElementById('templateMgmtTotalUseCount');
    if (totalUseCountEl) {
        const total = templates.reduce(function(sum, tpl) { return sum + (tpl.useCount || 0); }, 0);
        totalUseCountEl.textContent = total;
    }

    if (templates.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📑</div>
                <p class="empty-text">${templateMgmtSearchKeyword ? '没有找到匹配的模板' : '暂无模板，快去新增收文时保存模板吧'}</p>
            </div>
        `;
        return;
    }

    const html = templates.map(function(tpl) {
        const coDeptText = (tpl.coDepartments && tpl.coDepartments.length > 0)
            ? tpl.coDepartments.join('、')
            : '-';
        const useCount = tpl.useCount || 0;
        const lastUsedText = tpl.lastUsedAt ? formatDateTime(tpl.lastUsedAt) : '从未使用';
        const createdAtText = tpl.createdAt ? formatDateTime(tpl.createdAt) : '-';

        let urgencyClass = 'urgency-normal';
        if (tpl.urgency === '加急') urgencyClass = 'urgency-urgent';
        if (tpl.urgency === '特急') urgencyClass = 'urgency-special';

        return `
            <div class="template-mgmt-card" data-id="${tpl.id}">
                <div class="template-mgmt-card-header">
                    <div class="template-mgmt-card-title">
                        <span class="template-mgmt-card-icon">📋</span>
                        <span class="template-mgmt-card-name">${escapeHtml(tpl.name)}</span>
                        <span class="template-mgmt-urgency ${urgencyClass}">${tpl.urgency || '普通'}</span>
                    </div>
                    <div class="template-mgmt-card-actions">
                        <button class="btn btn-default btn-sm" onclick="copyTemplate('${tpl.id}')" title="复制模板">
                            <span class="btn-icon">📄</span> 复制
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="openEditTemplateModal('${tpl.id}')" title="编辑模板">
                            <span class="btn-icon">✏️</span> 编辑
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteTemplateMgmt('${tpl.id}')" title="删除模板">
                            <span class="btn-icon">🗑</span> 删除
                        </button>
                    </div>
                </div>
                <div class="template-mgmt-card-body">
                    <div class="template-mgmt-field">
                        <span class="template-mgmt-field-label">来文单位：</span>
                        <span class="template-mgmt-field-value">${escapeHtml(tpl.fromUnit || '-')}</span>
                    </div>
                    <div class="template-mgmt-field-row">
                        <div class="template-mgmt-field">
                            <span class="template-mgmt-field-label">拟办科室：</span>
                            <span class="template-mgmt-field-value">${escapeHtml(tpl.proposedDepartment || '-')}</span>
                        </div>
                        <div class="template-mgmt-field">
                            <span class="template-mgmt-field-label">承办科室：</span>
                            <span class="template-mgmt-field-value">${escapeHtml(tpl.undertakingDepartment || tpl.department || '-')}</span>
                        </div>
                    </div>
                    <div class="template-mgmt-field">
                        <span class="template-mgmt-field-label">协办科室：</span>
                        <span class="template-mgmt-field-value">${escapeHtml(coDeptText)}</span>
                    </div>
                    <div class="template-mgmt-field-row">
                        <div class="template-mgmt-field">
                            <span class="template-mgmt-field-label">默认期限：</span>
                            <span class="template-mgmt-field-value">${tpl.deadlineDays ? tpl.deadlineDays + ' 天' : '-'}</span>
                        </div>
                        <div class="template-mgmt-field">
                            <span class="template-mgmt-field-label">备注：</span>
                            <span class="template-mgmt-field-value">${escapeHtml(tpl.remark ? (tpl.remark.substring(0, 30) + (tpl.remark.length > 30 ? '...' : '')) : '-')}</span>
                        </div>
                    </div>
                </div>
                <div class="template-mgmt-card-footer">
                    <div class="template-mgmt-stat">
                        <span class="template-mgmt-stat-icon">📊</span>
                        <span class="template-mgmt-stat-label">使用次数：</span>
                        <span class="template-mgmt-stat-value">${useCount}</span>
                    </div>
                    <div class="template-mgmt-stat">
                        <span class="template-mgmt-stat-icon">🕐</span>
                        <span class="template-mgmt-stat-label">最近使用：</span>
                        <span class="template-mgmt-stat-value">${lastUsedText}</span>
                    </div>
                    <div class="template-mgmt-stat">
                        <span class="template-mgmt-stat-icon">📅</span>
                        <span class="template-mgmt-stat-label">创建时间：</span>
                        <span class="template-mgmt-stat-value">${createdAtText}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    listEl.innerHTML = html;
}

function searchTemplateManagement() {
    const inputEl = document.getElementById('templateMgmtSearchInput');
    if (inputEl) {
        templateMgmtSearchKeyword = inputEl.value.trim();
    }
    renderTemplateManagementList();
}

function openEditTemplateModal(templateId) {
    const templates = getTemplates();
    const tpl = templates.find(function(t) { return t.id === templateId; });
    if (!tpl) return;

    document.getElementById('editTemplateId').value = tpl.id;
    document.getElementById('editTemplateName').value = tpl.name || '';
    document.getElementById('editTemplateFromUnit').value = tpl.fromUnit || '';
    document.getElementById('editTemplateUrgency').value = tpl.urgency || '普通';
    document.getElementById('editTemplateProposedDept').value = tpl.proposedDepartment || '';
    document.getElementById('editTemplateUndertakingDept').value = tpl.undertakingDepartment || tpl.department || '';
    document.getElementById('editTemplateDeadlineDays').value = tpl.deadlineDays || '';
    document.getElementById('editTemplateRemark').value = tpl.remark || '';

    document.getElementById('editTemplateUseCount').textContent = tpl.useCount || 0;
    document.getElementById('editTemplateLastUsed').textContent = tpl.lastUsedAt ? formatDateTime(tpl.lastUsedAt) : '-';
    document.getElementById('editTemplateCreatedAt').textContent = tpl.createdAt ? formatDateTime(tpl.createdAt) : '-';

    renderEditTemplateCoDeptCheckboxes(tpl.coDepartments || []);

    document.getElementById('editTemplateModal').classList.add('show');
}

function closeEditTemplateModal() {
    document.getElementById('editTemplateModal').classList.remove('show');
}

function renderEditTemplateCoDeptCheckboxes(selected) {
    const container = document.getElementById('editTemplateCoDeptCheckboxes');
    if (!container) return;

    const html = DEPARTMENT_LIST.map(function(dept) {
        const isChecked = selected.includes(dept) ? 'checked' : '';
        return `
            <label class="co-dept-checkbox-label">
                <input type="checkbox" class="edit-template-co-dept-checkbox" value="${dept}" ${isChecked}>
                <span class="co-dept-text">${dept}</span>
            </label>
        `;
    }).join('');

    container.innerHTML = html;
}

function getEditTemplateCoDepartments() {
    const checkboxes = document.querySelectorAll('.edit-template-co-dept-checkbox:checked');
    const selected = [];
    checkboxes.forEach(function(cb) {
        selected.push(cb.value);
    });
    return selected;
}

function saveEditTemplate(e) {
    e.preventDefault();

    const id = document.getElementById('editTemplateId').value;
    const name = document.getElementById('editTemplateName').value.trim();
    const fromUnit = document.getElementById('editTemplateFromUnit').value.trim();
    const urgency = document.getElementById('editTemplateUrgency').value;
    const proposedDepartment = document.getElementById('editTemplateProposedDept').value;
    const undertakingDepartment = document.getElementById('editTemplateUndertakingDept').value;
    const coDepartments = getEditTemplateCoDepartments();
    const deadlineDays = document.getElementById('editTemplateDeadlineDays').value;
    const remark = document.getElementById('editTemplateRemark').value.trim();

    if (!name) {
        showToast('请输入模板名称', 'error');
        return;
    }
    if (!fromUnit) {
        showToast('请输入来文单位', 'error');
        return;
    }
    if (!undertakingDepartment) {
        showToast('请选择承办科室', 'error');
        return;
    }

    const templates = getTemplates();
    const index = templates.findIndex(function(t) { return t.id === id; });
    if (index === -1) {
        showToast('模板不存在', 'error');
        return;
    }

    const nameDup = templates.find(function(t) { return t.name === name && t.id !== id; });
    if (nameDup) {
        if (!confirm('已存在名为「' + name + '」的模板，是否仍要修改？')) {
            return;
        }
    }

    const oldTpl = templates[index];
    templates[index] = {
        ...oldTpl,
        name: name,
        fromUnit: fromUnit,
        urgency: urgency,
        proposedDepartment: proposedDepartment,
        undertakingDepartment: undertakingDepartment,
        department: undertakingDepartment,
        coDepartments: coDepartments,
        deadlineDays: deadlineDays ? parseInt(deadlineDays) : null,
        remark: remark,
        updatedAt: new Date().toISOString()
    };

    saveTemplates(templates);
    renderTemplateSelect();
    renderTemplateManagementList();
    closeEditTemplateModal();
    showToast('模板已更新', 'success');
}

function copyTemplate(templateId) {
    const templates = getTemplates();
    const tpl = templates.find(function(t) { return t.id === templateId; });
    if (!tpl) return;

    const newName = tpl.name + ' - 副本';
    let finalName = newName;
    let counter = 1;
    while (templates.some(function(t) { return t.name === finalName; })) {
        counter++;
        finalName = tpl.name + ' - 副本 ' + counter;
    }

    const newTemplate = {
        id: generateId(),
        name: finalName,
        fromUnit: tpl.fromUnit,
        urgency: tpl.urgency,
        proposedDepartment: tpl.proposedDepartment,
        undertakingDepartment: tpl.undertakingDepartment,
        department: tpl.department,
        coDepartments: (tpl.coDepartments || []).slice(),
        deadlineDays: tpl.deadlineDays,
        remark: tpl.remark,
        useCount: 0,
        lastUsedAt: null,
        createdAt: new Date().toISOString()
    };

    templates.unshift(newTemplate);
    saveTemplates(templates);
    renderTemplateSelect();
    renderTemplateManagementList();
    showToast('模板已复制：' + finalName, 'success');
}

function deleteTemplateMgmt(templateId) {
    const templates = getTemplates();
    const tpl = templates.find(function(t) { return t.id === templateId; });
    if (!tpl) return;

    if (!confirm('确定要删除模板「' + tpl.name + '」吗？此操作不可恢复。')) {
        return;
    }

    const filtered = templates.filter(function(t) { return t.id !== templateId; });
    saveTemplates(filtered);
    renderTemplateSelect();
    renderTemplateManagementList();

    const selectEl = document.getElementById('templateSelect');
    if (selectEl && selectEl.value === templateId) {
        selectEl.value = '';
        const deleteBtn = document.getElementById('deleteTemplateBtn');
        if (deleteBtn) deleteBtn.style.display = 'none';
    }

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
            extraFilterInfo = '已逾期';
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
    switchTab(tab, { preserveDrill: true });
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
    const templateManagementSection = document.getElementById('templateManagementSection');
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
        if (templateManagementSection) templateManagementSection.style.display = 'none';
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
        if (templateManagementSection) templateManagementSection.style.display = 'none';
        renderRecycleBinList();
    } else if (view === 'template_management') {
        if (viewSwitcher) viewSwitcher.style.display = 'none';
        if (listTabs) listTabs.style.display = 'none';
        if (batchToolbar) batchToolbar.style.display = 'none';
        if (departmentBoard) departmentBoard.style.display = 'none';
        if (filterSection) filterSection.style.display = 'none';
        if (statsSection) statsSection.style.display = 'none';
        if (reminderCenter) reminderCenter.style.display = 'none';
        documentList.style.display = 'none';
        auditLogSection.style.display = 'none';
        recycleBinSection.style.display = 'none';
        if (templateManagementSection) templateManagementSection.style.display = 'block';
        renderTemplateManagementList();
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
        if (templateManagementSection) templateManagementSection.style.display = 'none';
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
        if (templateManagementSection) templateManagementSection.style.display = 'none';
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
    switchTab('all', { preserveDrill: true });
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
            const batchCompleteHistoryRecord = addChangeHistoryRecord(item.newDoc.id, AUDIT_ACTION.COMPLETE, null, item.oldDoc, item.newDoc, {
                handler: batchHandler,
                remark: batchRemark,
                fromBatch: true
            });
            addAuditLog(AUDIT_ACTION.COMPLETE, item.newDoc, item.oldDoc, {
                handler: batchHandler,
                remark: batchRemark,
                fromBatch: true,
                changeHistoryRecordId: batchCompleteHistoryRecord.id
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
            const batchDeleteHistoryRecord = addChangeHistoryRecord(item.newDoc.id, AUDIT_ACTION.DELETE, null, item.oldDoc, item.newDoc, {
                fromBatch: true
            });
            addAuditLog(AUDIT_ACTION.DELETE, item.newDoc, item.oldDoc, {
                fromBatch: true,
                changeHistoryRecordId: batchDeleteHistoryRecord.id
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
            const batchDeptHistoryRecord = addChangeHistoryRecord(item.newDoc.id, AUDIT_ACTION.BATCH_DEPARTMENT, null, item.oldDoc, item.newDoc, {
                fromBatch: true,
                newDepartment: newDept
            });
            addAuditLog(AUDIT_ACTION.BATCH_DEPARTMENT, item.newDoc, item.oldDoc, {
                fromBatch: true,
                newDepartment: newDept,
                changeHistoryRecordId: batchDeptHistoryRecord.id
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
        const batchDeptHistoryRecord = addChangeHistoryRecord(item.newDoc.id, AUDIT_ACTION.BATCH_DEPARTMENT, null, item.oldDoc, item.newDoc, {
            fromBatch: true,
            newDepartment: newDepartment
        });
        addAuditLog(AUDIT_ACTION.BATCH_DEPARTMENT, item.newDoc, item.oldDoc, {
            fromBatch: true,
            newDepartment: newDepartment,
            changeHistoryRecordId: batchDeptHistoryRecord.id
        });
    });
    showToast(`成功修改 ${count} 条收文的承办科室`, 'success');

    selectedIds = [];
    closeBatchDepartmentModal();
    updateStats();
    renderReminderCenter();
    renderDocumentList();
    if (currentView === 'board') {
        renderDepartmentBoard();
    }
}

function toggleBatchFlowMenu() {
    const menu = document.getElementById('batchFlowMenu');
    if (menu) {
        menu.classList.toggle('show');
    }
}

function closeBatchFlowMenu() {
    const menu = document.getElementById('batchFlowMenu');
    if (menu) {
        menu.classList.remove('show');
    }
}

function getBatchFlowSelectedCoDepartments() {
    const checkboxes = document.querySelectorAll('#batchFlowCoDeptCheckboxes input[type="checkbox"]:checked');
    const selected = [];
    checkboxes.forEach(function(cb) {
        selected.push(cb.value);
    });
    return selected;
}

function renderBatchFlowPreviewLists() {
    const validListEl = document.getElementById('batchFlowValidList');
    const skippedListEl = document.getElementById('batchFlowSkippedList');
    const skippedSection = document.getElementById('batchFlowSkippedSection');

    if (validListEl) {
        validListEl.innerHTML = batchFlowValidDocs.map(function(doc) {
            return `
                <div class="batch-flow-preview-item">
                    <div class="batch-flow-preview-title">${escapeHtml(doc.title)}</div>
                    <div class="batch-flow-preview-meta">
                        <span class="batch-flow-preview-dept">${escapeHtml(doc.undertakingDepartment || doc.department || '')}</span>
                        <span class="batch-flow-preview-status">${escapeHtml(FLOW_STATUS_TEXT[doc.flowStatus] || doc.flowStatus)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (skippedListEl) {
        skippedListEl.innerHTML = batchFlowSkippedDocs.map(function(item) {
            return `
                <div class="batch-flow-preview-item skipped">
                    <div class="batch-flow-preview-title">${escapeHtml(item.doc.title)}</div>
                    <div class="batch-flow-preview-meta">
                        <span class="batch-flow-preview-dept">${escapeHtml(item.doc.undertakingDepartment || item.doc.department || '')}</span>
                        <span class="batch-flow-preview-status">${escapeHtml(FLOW_STATUS_TEXT[item.doc.flowStatus] || item.doc.flowStatus)}</span>
                    </div>
                    <div class="batch-flow-skip-reason">${escapeHtml(item.reason)}</div>
                </div>
            `;
        }).join('');
    }

    const validCountEl = document.getElementById('batchFlowValidCount');
    const skippedCountEl = document.getElementById('batchFlowSkippedCount');
    const validPreviewCountEl = document.getElementById('batchFlowValidPreviewCount');
    const skippedPreviewCountEl = document.getElementById('batchFlowSkippedPreviewCount');

    if (validCountEl) validCountEl.textContent = batchFlowValidDocs.length;
    if (skippedCountEl) skippedCountEl.textContent = batchFlowSkippedDocs.length;
    if (validPreviewCountEl) validPreviewCountEl.textContent = batchFlowValidDocs.length;
    if (skippedPreviewCountEl) skippedPreviewCountEl.textContent = batchFlowSkippedDocs.length;

    if (skippedSection) {
        skippedSection.style.display = batchFlowSkippedDocs.length > 0 ? 'block' : 'none';
    }
}

function openBatchFlowModal(action) {
    if (selectedIds.length === 0) {
        showToast('请先选择收文', 'info');
        return;
    }

    closeBatchFlowMenu();
    currentBatchFlowAction = action;

    const selectedDocs = getSelectedDocuments();
    const result = validateBatchFlowDocuments(selectedDocs, action);
    batchFlowValidDocs = result.valid;
    batchFlowSkippedDocs = result.skipped;

    if (batchFlowValidDocs.length === 0) {
        let reason = '所选收文均不符合操作条件';
        if (batchFlowSkippedDocs.length > 0) {
            reason = batchFlowSkippedDocs[0].reason;
        }
        showToast(reason, 'info');
        return;
    }

    const titleEl = document.getElementById('batchFlowTitle');
    if (titleEl) {
        titleEl.textContent = BATCH_FLOW_ACTION_TEXT[action] || '批量流转办理';
    }

    const actionTypeEl = document.getElementById('batchFlowActionType');
    if (actionTypeEl) {
        actionTypeEl.value = action;
    }

    const deptRow = document.getElementById('batchFlowDeptRow');
    const deptLabel = document.getElementById('batchFlowDeptLabel');
    const coDeptGroup = document.getElementById('batchFlowCoDeptGroup');
    const opinionGroup = document.getElementById('batchFlowOpinionGroup');
    const opinionLabel = document.getElementById('batchFlowOpinionLabel');
    const handlerGroup = document.getElementById('batchFlowHandlerGroup');
    const supervisionReasonGroup = document.getElementById('batchFlowSupervisionReasonGroup');
    const supervisionSupervisorGroup = document.getElementById('batchFlowSupervisionSupervisorGroup');
    const supervisionDeadlineGroup = document.getElementById('batchFlowSupervisionDeadlineGroup');
    const submitBtn = document.getElementById('batchFlowSubmitBtn');

    if (deptRow) deptRow.style.display = 'none';
    if (coDeptGroup) coDeptGroup.style.display = 'none';
    if (opinionGroup) opinionGroup.style.display = 'block';
    if (handlerGroup) handlerGroup.style.display = 'block';
    if (supervisionReasonGroup) supervisionReasonGroup.style.display = 'none';
    if (supervisionSupervisorGroup) supervisionSupervisorGroup.style.display = 'none';
    if (supervisionDeadlineGroup) supervisionDeadlineGroup.style.display = 'none';

    const opinionEl = document.getElementById('batchFlowOpinion');
    const handlerEl = document.getElementById('batchFlowHandler');
    const deptSelectEl = document.getElementById('batchFlowDepartment');

    if (opinionEl) opinionEl.value = '';
    if (handlerEl) handlerEl.value = '';
    if (deptSelectEl) deptSelectEl.value = '';

    const coDeptCheckboxes = document.querySelectorAll('#batchFlowCoDeptCheckboxes input[type="checkbox"]');
    coDeptCheckboxes.forEach(function(cb) {
        cb.checked = false;
    });

    switch (action) {
        case BATCH_FLOW_ACTION.PROPOSE:
            if (deptRow) deptRow.style.display = 'flex';
            if (deptLabel) deptLabel.innerHTML = '拟办科室 <span class="required">*</span>';
            if (coDeptGroup) coDeptGroup.style.display = 'block';
            if (opinionLabel) opinionLabel.textContent = '拟办意见';
            if (submitBtn) submitBtn.className = 'btn btn-primary';
            break;

        case BATCH_FLOW_ACTION.TRANSFER:
            if (deptRow) deptRow.style.display = 'flex';
            if (deptLabel) deptLabel.innerHTML = '承办科室 <span class="required">*</span>';
            if (coDeptGroup) coDeptGroup.style.display = 'block';
            if (opinionLabel) opinionLabel.textContent = '转办意见';
            if (submitBtn) submitBtn.className = 'btn btn-primary';
            break;

        case BATCH_FLOW_ACTION.ASSIGN_CO:
            if (coDeptGroup) coDeptGroup.style.display = 'block';
            if (opinionLabel) opinionLabel.textContent = '协办意见';
            if (submitBtn) submitBtn.className = 'btn btn-primary';
            break;

        case BATCH_FLOW_ACTION.FEEDBACK:
            if (opinionLabel) opinionLabel.innerHTML = '反馈内容 <span class="required">*</span>';
            if (submitBtn) submitBtn.className = 'btn btn-info';
            break;

        case BATCH_FLOW_ACTION.SUPERVISION:
            if (opinionGroup) opinionGroup.style.display = 'none';
            if (handlerGroup) handlerGroup.style.display = 'none';
            if (supervisionReasonGroup) supervisionReasonGroup.style.display = 'block';
            if (supervisionSupervisorGroup) supervisionSupervisorGroup.style.display = 'block';
            if (supervisionDeadlineGroup) supervisionDeadlineGroup.style.display = 'block';
            if (submitBtn) submitBtn.className = 'btn btn-warning';

            const today = getToday();
            const defaultDeadline = new Date(today);
            defaultDeadline.setDate(defaultDeadline.getDate() + 3);
            const deadlineEl = document.getElementById('batchFlowSupervisionDeadline');
            if (deadlineEl) {
                deadlineEl.value = formatDateInput(defaultDeadline);
            }
            const reasonEl = document.getElementById('batchFlowSupervisionReason');
            if (reasonEl) reasonEl.value = '';
            const supervisorEl = document.getElementById('batchFlowSupervisionSupervisor');
            if (supervisorEl) supervisorEl.value = '';
            break;
    }

    renderBatchFlowPreviewLists();

    const modal = document.getElementById('batchFlowModal');
    if (modal) {
        modal.classList.add('show');
    }
}

function closeBatchFlowModal() {
    const modal = document.getElementById('batchFlowModal');
    if (modal) {
        modal.classList.remove('show');
    }
    currentBatchFlowAction = null;
    batchFlowValidDocs = [];
    batchFlowSkippedDocs = [];
}

function executeBatchFlowAction(e) {
    if (e) {
        e.preventDefault();
    }

    if (!currentBatchFlowAction || batchFlowValidDocs.length === 0) {
        showToast('没有可操作的收文', 'error');
        return;
    }

    const opinion = document.getElementById('batchFlowOpinion')?.value.trim() || '';
    const handler = document.getElementById('batchFlowHandler')?.value.trim() || '';
    const department = document.getElementById('batchFlowDepartment')?.value || '';
    const coDepartments = getBatchFlowSelectedCoDepartments();

    const allDocs = loadAllDocuments();
    const now = new Date().toISOString();
    let count = 0;
    const changedDocs = [];

    switch (currentBatchFlowAction) {
        case BATCH_FLOW_ACTION.PROPOSE:
            if (!department) {
                showToast('请选择拟办科室', 'error');
                return;
            }

            allDocs.forEach(function(doc) {
                if (batchFlowValidDocs.some(function(d) { return d.id === doc.id; })) {
                    const oldDoc = { ...doc };

                    const flowRecord = {
                        id: generateId(),
                        action: FLOW_ACTION.PROPOSE,
                        actionText: FLOW_ACTION_TEXT[FLOW_ACTION.PROPOSE] || '拟办',
                        fromStatus: doc.flowStatus,
                        toStatus: doc.flowStatus === FLOW_STATUS.PENDING_REVIEW ? FLOW_STATUS.PROCESSING : doc.flowStatus,
                        opinion: opinion || '批量拟办',
                        handler: handler || '',
                        department: department,
                        createdAt: now
                    };

                    const flowRecords = doc.flowRecords || [];
                    flowRecords.push(flowRecord);

                    const processingRecord = {
                        id: generateId(),
                        type: 'propose',
                        content: opinion || '批量拟办',
                        handler: handler || '',
                        department: department,
                        coDepartments: coDepartments,
                        createdAt: now
                    };

                    const processingRecords = doc.processingRecords || [];
                    processingRecords.push(processingRecord);

                    const newDoc = {
                        ...doc,
                        flowStatus: doc.flowStatus === FLOW_STATUS.PENDING_REVIEW ? FLOW_STATUS.PROCESSING : doc.flowStatus,
                        proposedDepartment: department,
                        coDepartments: coDepartments.length > 0 ? coDepartments : doc.coDepartments || [],
                        flowRecords: flowRecords,
                        processingRecords: processingRecords
                    };

                    const index = allDocs.findIndex(function(d) { return d.id === doc.id; });
                    if (index > -1) {
                        allDocs[index] = newDoc;
                    }

                    changedDocs.push({ oldDoc: oldDoc, newDoc: newDoc });
                    count++;
                }
            });
            break;

        case BATCH_FLOW_ACTION.TRANSFER:
            if (!department) {
                showToast('请选择承办科室', 'error');
                return;
            }

            allDocs.forEach(function(doc) {
                if (batchFlowValidDocs.some(function(d) { return d.id === doc.id; })) {
                    const oldDoc = { ...doc };

                    const flowRecord = {
                        id: generateId(),
                        action: FLOW_ACTION.ASSIGN,
                        actionText: FLOW_ACTION_TEXT[FLOW_ACTION.ASSIGN] || '交办',
                        fromStatus: doc.flowStatus,
                        toStatus: FLOW_STATUS.PROCESSING,
                        opinion: opinion || '批量转办',
                        handler: handler || '',
                        department: department,
                        createdAt: now
                    };

                    const flowRecords = doc.flowRecords || [];
                    flowRecords.push(flowRecord);

                    const processingRecord = {
                        id: generateId(),
                        type: 'assign',
                        content: opinion || '批量转办',
                        handler: handler || '',
                        department: department,
                        coDepartments: coDepartments,
                        createdAt: now
                    };

                    const processingRecords = doc.processingRecords || [];
                    processingRecords.push(processingRecord);

                    const newDoc = {
                        ...doc,
                        flowStatus: FLOW_STATUS.PROCESSING,
                        undertakingDepartment: department,
                        department: department,
                        coDepartments: coDepartments.length > 0 ? coDepartments : doc.coDepartments || [],
                        flowRecords: flowRecords,
                        processingRecords: processingRecords
                    };

                    const index = allDocs.findIndex(function(d) { return d.id === doc.id; });
                    if (index > -1) {
                        allDocs[index] = newDoc;
                    }

                    changedDocs.push({ oldDoc: oldDoc, newDoc: newDoc });
                    count++;
                }
            });
            break;

        case BATCH_FLOW_ACTION.ASSIGN_CO:
            allDocs.forEach(function(doc) {
                if (batchFlowValidDocs.some(function(d) { return d.id === doc.id; })) {
                    const oldDoc = { ...doc };

                    const flowRecord = {
                        id: generateId(),
                        action: FLOW_ACTION.PROGRESS,
                        actionText: FLOW_ACTION_TEXT[FLOW_ACTION.PROGRESS] || '进展更新',
                        fromStatus: doc.flowStatus,
                        toStatus: doc.flowStatus,
                        opinion: opinion || '批量指定协办科室',
                        handler: handler || '',
                        department: doc.undertakingDepartment || doc.department || '',
                        createdAt: now
                    };

                    const flowRecords = doc.flowRecords || [];
                    flowRecords.push(flowRecord);

                    const processingRecord = {
                        id: generateId(),
                        type: 'assign_co',
                        content: opinion || '指定协办科室',
                        handler: handler || '',
                        coDepartments: coDepartments,
                        createdAt: now
                    };

                    const processingRecords = doc.processingRecords || [];
                    processingRecords.push(processingRecord);

                    const newDoc = {
                        ...doc,
                        coDepartments: coDepartments,
                        flowRecords: flowRecords,
                        processingRecords: processingRecords
                    };

                    const index = allDocs.findIndex(function(d) { return d.id === doc.id; });
                    if (index > -1) {
                        allDocs[index] = newDoc;
                    }

                    changedDocs.push({ oldDoc: oldDoc, newDoc: newDoc });
                    count++;
                }
            });
            break;

        case BATCH_FLOW_ACTION.FEEDBACK:
            if (!opinion) {
                showToast('请输入反馈内容', 'error');
                return;
            }

            allDocs.forEach(function(doc) {
                if (batchFlowValidDocs.some(function(d) { return d.id === doc.id; })) {
                    const oldDoc = { ...doc };

                    const flowRecord = {
                        id: generateId(),
                        action: FLOW_ACTION.FEEDBACK,
                        actionText: FLOW_ACTION_TEXT[FLOW_ACTION.FEEDBACK] || '反馈',
                        fromStatus: doc.flowStatus,
                        toStatus: FLOW_STATUS.PENDING_FEEDBACK,
                        opinion: opinion,
                        handler: handler || '',
                        department: doc.undertakingDepartment || doc.department || '',
                        createdAt: now
                    };

                    const flowRecords = doc.flowRecords || [];
                    flowRecords.push(flowRecord);

                    const processingRecord = {
                        id: generateId(),
                        type: 'feedback',
                        content: opinion,
                        handler: handler || '',
                        department: doc.undertakingDepartment || doc.department || '',
                        createdAt: now
                    };

                    const processingRecords = doc.processingRecords || [];
                    processingRecords.push(processingRecord);

                    const newDoc = {
                        ...doc,
                        flowStatus: FLOW_STATUS.PENDING_FEEDBACK,
                        flowRecords: flowRecords,
                        processingRecords: processingRecords
                    };

                    const index = allDocs.findIndex(function(d) { return d.id === doc.id; });
                    if (index > -1) {
                        allDocs[index] = newDoc;
                    }

                    changedDocs.push({ oldDoc: oldDoc, newDoc: newDoc });
                    count++;
                }
            });
            break;

        case BATCH_FLOW_ACTION.SUPERVISION:
            const supervisionReason = document.getElementById('batchFlowSupervisionReason')?.value.trim() || '';
            const supervisionSupervisor = document.getElementById('batchFlowSupervisionSupervisor')?.value.trim() || '';
            const supervisionDeadline = document.getElementById('batchFlowSupervisionDeadline')?.value || '';

            if (!supervisionReason) {
                showToast('请输入督办原因', 'error');
                return;
            }
            if (!supervisionDeadline) {
                showToast('请选择要求反馈时间', 'error');
                return;
            }

            allDocs.forEach(function(doc) {
                if (batchFlowValidDocs.some(function(d) { return d.id === doc.id; })) {
                    const oldDoc = { ...doc };

                    const supervisionRecord = {
                        id: generateId(),
                        reason: supervisionReason,
                        supervisor: supervisionSupervisor,
                        feedbackDeadline: supervisionDeadline,
                        result: '',
                        status: SUPERVISION_STATUS.PENDING,
                        createdAt: now,
                        feedbackAt: null
                    };

                    const supervisionRecords = doc.supervisionRecords || [];
                    supervisionRecords.push(supervisionRecord);

                    const processingRecord = {
                        id: generateId(),
                        type: 'supervision',
                        content: supervisionReason,
                        handler: supervisionSupervisor || '',
                        department: doc.undertakingDepartment || doc.department || '',
                        supervisionId: supervisionRecord.id,
                        feedbackDeadline: supervisionDeadline,
                        createdAt: now
                    };

                    const processingRecords = doc.processingRecords || [];
                    processingRecords.push(processingRecord);

                    const newDoc = {
                        ...doc,
                        supervisionRecords: supervisionRecords,
                        processingRecords: processingRecords
                    };

                    const index = allDocs.findIndex(function(d) { return d.id === doc.id; });
                    if (index > -1) {
                        allDocs[index] = newDoc;
                    }

                    changedDocs.push({ oldDoc: oldDoc, newDoc: newDoc, supervisionRecord: supervisionRecord });
                    count++;
                }
            });
            break;
    }

    saveDocuments(allDocs);

    changedDocs.forEach(function(item) {
        const extra = {
            fromBatch: true,
            handler: handler || '',
            opinion: opinion || ''
        };

        let auditAction = null;
        let historyRecord = null;

        switch (currentBatchFlowAction) {
            case BATCH_FLOW_ACTION.PROPOSE:
                auditAction = AUDIT_ACTION.FLOW_PROPOSE;
                extra.department = department || '';
                extra.coDepartments = coDepartments;
                break;
            case BATCH_FLOW_ACTION.TRANSFER:
                auditAction = AUDIT_ACTION.FLOW_ASSIGN;
                extra.department = department || '';
                extra.coDepartments = coDepartments;
                break;
            case BATCH_FLOW_ACTION.ASSIGN_CO:
                auditAction = AUDIT_ACTION.FLOW_PROGRESS;
                extra.coDepartments = coDepartments;
                break;
            case BATCH_FLOW_ACTION.FEEDBACK:
                auditAction = AUDIT_ACTION.FLOW_FEEDBACK;
                break;
            case BATCH_FLOW_ACTION.SUPERVISION:
                auditAction = AUDIT_ACTION.SUPERVISION_CREATE;
                extra.supervisionId = item.supervisionRecord?.id || '';
                extra.reason = document.getElementById('batchFlowSupervisionReason')?.value.trim() || '';
                extra.supervisor = document.getElementById('batchFlowSupervisionSupervisor')?.value.trim() || '';
                extra.feedbackDeadline = document.getElementById('batchFlowSupervisionDeadline')?.value || '';
                break;
        }

        if (auditAction) {
            historyRecord = addChangeHistoryRecord(item.newDoc.id, auditAction, null, item.oldDoc, item.newDoc, extra);
            extra.changeHistoryRecordId = historyRecord.id;
            addAuditLog(auditAction, item.newDoc, item.oldDoc, extra);
        }
    });

    const actionText = BATCH_FLOW_ACTION_TEXT[currentBatchFlowAction] || '批量操作';
    showToast(`${actionText}成功，共处理 ${count} 条收文`, 'success');

    selectedIds = [];
    closeBatchFlowModal();
    updateStats();
    renderReminderCenter();
    renderDocumentList();
    if (currentView === 'board') {
        renderDepartmentBoard();
    }
}

function switchTab(tab, options = {}) {
    currentTab = tab;
    selectedIds = [];
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
    });
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    if (currentViewPresetId) {
        detachFromViewPreset();
    }
    if (boardDrillContext && currentView === 'list' && !options.preserveDrill) {
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
        const historyRecord = addChangeHistoryRecord(doc.id, auditAction, null, oldDoc, doc, {
            handler: handler || '',
            opinion: opinion || '',
            department: department || ''
        });
        addAuditLog(auditAction, doc, oldDoc, {
            handler: handler || '',
            opinion: opinion || '',
            department: department || '',
            changeHistoryRecordId: historyRecord.id
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

function canPerformBatchFlowAction(doc, action) {
    if (!doc || doc.isDeleted) return { valid: false, reason: '收文不存在或已删除' };

    const status = doc.flowStatus;
    const requirePropose = isProposeRequiredBeforeAssign();
    const hasProposeRecord = hasProposeFlowRecord(doc);

    switch (action) {
        case BATCH_FLOW_ACTION.PROPOSE:
            if (status === FLOW_STATUS.DONE) {
                return { valid: false, reason: '已办结的收文不能拟办' };
            }
            return { valid: true };

        case BATCH_FLOW_ACTION.TRANSFER:
            if (status === FLOW_STATUS.DONE) {
                return { valid: false, reason: '已办结的收文不能转办' };
            }
            if (requirePropose && !hasProposeRecord) {
                return { valid: false, reason: '需先拟办才能转办' };
            }
            return { valid: true };

        case BATCH_FLOW_ACTION.ASSIGN_CO:
            if (status === FLOW_STATUS.DONE) {
                return { valid: false, reason: '已办结的收文不能指定协办' };
            }
            return { valid: true };

        case BATCH_FLOW_ACTION.FEEDBACK:
            if (status !== FLOW_STATUS.PROCESSING) {
                return { valid: false, reason: '仅办理中的收文可以申请反馈' };
            }
            return { valid: true };

        case BATCH_FLOW_ACTION.SUPERVISION:
            if (status === FLOW_STATUS.DONE) {
                return { valid: false, reason: '已办结的收文不能发起督办' };
            }
            const deadlineStatus = getDeadlineStatus(doc);
            if (deadlineStatus !== 'overdue' && deadlineStatus !== 'urgent') {
                return { valid: false, reason: '仅逾期或即将到期的收文可发起督办' };
            }
            return { valid: true };

        default:
            return { valid: false, reason: '未知操作类型' };
    }
}

function validateBatchFlowDocuments(docs, action) {
    const valid = [];
    const skipped = [];

    docs.forEach(function(doc) {
        const result = canPerformBatchFlowAction(doc, action);
        if (result.valid) {
            valid.push(doc);
        } else {
            skipped.push({ doc: doc, reason: result.reason });
        }
    });

    return { valid: valid, skipped: skipped };
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
            const editHistoryRecord = addChangeHistoryRecord(updatedDoc.id, AUDIT_ACTION.EDIT, null, oldDoc, updatedDoc);
            addAuditLog(AUDIT_ACTION.EDIT, updatedDoc, oldDoc, { changeHistoryRecordId: editHistoryRecord.id });
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
        const createHistoryRecord = addChangeHistoryRecord(newDoc.id, AUDIT_ACTION.CREATE, null, null, newDoc);
        addAuditLog(AUDIT_ACTION.CREATE, newDoc, null, { changeHistoryRecordId: createHistoryRecord.id });
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

    const progressHistoryRecord = addChangeHistoryRecord(doc.id, AUDIT_ACTION.ADD_PROGRESS_RECORD, null, oldDoc, doc, {
        handler: handler,
        content: content
    });
    addAuditLog(AUDIT_ACTION.ADD_PROGRESS_RECORD, doc, oldDoc, {
        handler: handler,
        content: content,
        changeHistoryRecordId: progressHistoryRecord.id
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
    const completeHistoryRecord = addChangeHistoryRecord(doc.id, AUDIT_ACTION.COMPLETE, null, oldDoc, doc, {
        handler: handler,
        remark: remark
    });
    addAuditLog(AUDIT_ACTION.COMPLETE, doc, oldDoc, {
        handler: handler,
        remark: remark,
        changeHistoryRecordId: completeHistoryRecord.id
    });

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
    const deleteHistoryRecord = addChangeHistoryRecord(doc.id, AUDIT_ACTION.DELETE, null, oldDoc, doc);
    addAuditLog(AUDIT_ACTION.DELETE, doc, oldDoc, { changeHistoryRecordId: deleteHistoryRecord.id });

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
    const restoreHistoryRecord = addChangeHistoryRecord(doc.id, AUDIT_ACTION.RESTORE_RECYCLE, null, oldDoc, doc);
    addAuditLog(AUDIT_ACTION.RESTORE_RECYCLE, doc, oldDoc, { changeHistoryRecordId: restoreHistoryRecord.id });
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
    
    const allHistory = getChangeHistory();
    delete allHistory[id];
    saveChangeHistory(allHistory);
    
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
        const batchRestoreHistoryRecord = addChangeHistoryRecord(item.newDoc.id, AUDIT_ACTION.RESTORE_RECYCLE, null, item.oldDoc, item.newDoc, {
            fromBatch: true
        });
        addAuditLog(AUDIT_ACTION.RESTORE_RECYCLE, item.newDoc, item.oldDoc, {
            fromBatch: true,
            changeHistoryRecordId: batchRestoreHistoryRecord.id
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
    
    const allHistory = getChangeHistory();
    ids.forEach(function(id) {
        delete allHistory[id];
    });
    saveChangeHistory(allHistory);

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
    
    const allHistory = getChangeHistory();
    recycleDocs.forEach(function(doc) {
        delete allHistory[doc.id];
    });
    saveChangeHistory(allHistory);

    recycleSelectedIds = [];
    showToast('回收站已清空', 'success');
    if (currentView === 'recycle_bin') {
        renderRecycleBinList();
    }
}

function renderChangeHistory(docId) {
    const history = getChangeHistoryByDocId(docId);
    if (history.length === 0) {
        return `
            <div class="change-history-empty">
                <div class="change-history-empty-icon">📋</div>
                <div class="change-history-empty-text">暂无变更历史记录</div>
            </div>
        `;
    }

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
        'flow_propose': '💡',
        'flow_assign': '📤',
        'flow_progress': '🔄',
        'flow_feedback': '📨',
        'add_progress_record': '📝',
        'supervision_create': '📢',
        'supervision_feedback': '📨',
        'flow_rule_change': '⚙️'
    };

    return `
        <div class="change-history-list">
            ${history.map(function(record, index) {
                const icon = actionIconMap[record.action] || '📝';
                const timeStr = formatDateTime(record.timestamp);
                const changeCount = record.changes ? record.changes.length : 0;
                const isExpanded = index === 0;
                
                return `
                    <div class="change-history-item ${isExpanded ? 'expanded' : ''}" data-record-id="${record.id}">
                        <div class="change-history-header" onclick="toggleChangeHistoryItem('${record.id}')">
                            <div class="change-history-icon">${icon}</div>
                            <div class="change-history-info">
                                <div class="change-history-action">
                                    ${escapeHtml(record.actionText)}
                                    ${changeCount > 0 ? `<span class="change-count-badge">${changeCount} 处变更</span>` : ''}
                                </div>
                                <div class="change-history-time">${escapeHtml(timeStr)}</div>
                            </div>
                            <div class="change-history-toggle">
                                <span class="toggle-arrow">▼</span>
                            </div>
                        </div>
                        <div class="change-history-content">
                            ${record.extra && record.extra.handler ? `
                                <div class="change-history-extra">
                                    <span class="change-extra-label">处理人：</span>
                                    <span class="change-extra-value">${escapeHtml(record.extra.handler)}</span>
                                </div>
                            ` : ''}
                            ${record.extra && record.extra.opinion ? `
                                <div class="change-history-extra">
                                    <span class="change-extra-label">意见：</span>
                                    <span class="change-extra-value">${escapeHtml(record.extra.opinion)}</span>
                                </div>
                            ` : ''}
                            ${record.changes && record.changes.length > 0 ? `
                                <div class="change-field-list">
                                    <div class="change-field-header">
                                        <span class="change-field-label">字段</span>
                                        <span class="change-field-before">变更前</span>
                                        <span class="change-field-arrow">→</span>
                                        <span class="change-field-after">变更后</span>
                                    </div>
                                    ${record.changes.map(function(change) {
                                        return `
                                            <div class="change-field-row">
                                                <span class="change-field-label">${escapeHtml(change.label)}</span>
                                                <span class="change-field-before">${escapeHtml(change.oldDisplay)}</span>
                                                <span class="change-field-arrow">→</span>
                                                <span class="change-field-after">${escapeHtml(change.newDisplay)}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            ` : `
                                <div class="change-no-fields">无字段变更</div>
                            `}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function toggleChangeHistoryItem(recordId) {
    const item = document.querySelector(`.change-history-item[data-record-id="${recordId}"]`);
    if (item) {
        item.classList.toggle('expanded');
    }
}

let changeHistoryScrollTargetId = null;
let shouldScrollToChangeHistorySection = false;

function scrollToChangeHistory(recordId) {
    changeHistoryScrollTargetId = recordId;
    setTimeout(function() {
        const item = document.querySelector(`.change-history-item[data-record-id="${recordId}"]`);
        if (item) {
            item.classList.add('expanded');
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            item.style.animation = 'change-history-highlight 2s ease';
            setTimeout(function() {
                item.style.animation = '';
            }, 2000);
        }
        changeHistoryScrollTargetId = null;
    }, 100);
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
    const changeHistoryList = getChangeHistoryByDocId(doc.id);
    const changeHistoryCount = changeHistoryList.length;

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
        <div class="detail-section" id="changeHistorySection">
            <div class="detail-section-header">
                <span class="detail-section-title">📋 变更历史对比</span>
                <span class="detail-section-count">共 ${changeHistoryCount} 条</span>
            </div>
            ${renderChangeHistory(doc.id)}
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

    if (changeHistoryScrollTargetId) {
        const targetId = changeHistoryScrollTargetId;
        changeHistoryScrollTargetId = null;
        setTimeout(function() {
            const item = document.querySelector(`.change-history-item[data-record-id="${targetId}"]`);
            if (item) {
                item.classList.add('expanded');
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                item.style.animation = 'change-history-highlight 2s ease';
                setTimeout(function() {
                    item.style.animation = '';
                }, 2000);
            } else {
                const section = document.getElementById('changeHistorySection');
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }, 150);
    } else if (shouldScrollToChangeHistorySection) {
        shouldScrollToChangeHistorySection = false;
        setTimeout(function() {
            const section = document.getElementById('changeHistorySection');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 150);
    }
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('show');
}

let currentWizardStep = 1;
let wizardCsvHeaders = [];
let wizardCsvRawData = [];
let wizardFieldMapping = {};
let wizardMappedData = [];
let wizardValidatedData = [];
let currentImportTab = 'paste';
let currentPreviewFilter = 'all';

const WIZARD_SYSTEM_FIELDS = [
    { key: 'fromUnit', label: '来文单位', required: true, type: 'text' },
    { key: 'docNumber', label: '文号', required: true, type: 'text' },
    { key: 'title', label: '标题', required: true, type: 'text' },
    { key: 'receiveDate', label: '收文日期', required: true, type: 'date' },
    { key: 'urgency', label: '紧急程度', required: true, type: 'select', options: URGENCY_LIST },
    { key: 'proposedDepartment', label: '拟办科室', required: false, type: 'select', options: DEPARTMENT_LIST },
    { key: 'undertakingDepartment', label: '承办科室', required: true, type: 'select', options: DEPARTMENT_LIST },
    { key: 'coDepartments', label: '协办科室', required: false, type: 'multi', options: DEPARTMENT_LIST },
    { key: 'deadline', label: '办理期限', required: true, type: 'date' },
    { key: 'remark', label: '备注', required: false, type: 'text' }
];

const HEADER_ALIAS_MAP = {
    'fromUnit': ['来文单位', '发文单位', '来文机关', '发文机关', '单位', 'fromUnit', 'from_unit'],
    'docNumber': ['文号', '文件号', '发文字号', '文號', 'docNumber', 'doc_number', 'document_number'],
    'title': ['标题', '文件标题', '题目', 'title', 'subject'],
    'receiveDate': ['收文日期', '收文时间', '接收日期', '收到日期', 'receiveDate', 'receive_date', 'received_date'],
    'urgency': ['紧急程度', '紧急', '急缓', 'priority', 'urgency', 'urgent_level'],
    'proposedDepartment': ['拟办科室', '拟办部门', '拟办', 'proposedDepartment', 'proposed_department'],
    'undertakingDepartment': ['承办科室', '承办部门', '主办科室', '主办部门', '承办', 'department', 'undertaking_department'],
    'coDepartments': ['协办科室', '协办部门', '会办科室', '会办部门', '协办', 'coDepartments', 'co_departments', 'assist_departments'],
    'deadline': ['办理期限', '期限', '截止日期', '到期日期', '办结期限', 'deadline', 'due_date'],
    'remark': ['备注', '说明', '附注', 'remark', 'note', 'comments']
};

function openImportModal() {
    currentWizardStep = 1;
    wizardCsvHeaders = [];
    wizardCsvRawData = [];
    wizardFieldMapping = {};
    wizardMappedData = [];
    wizardValidatedData = [];
    currentPreviewFilter = 'all';

    document.getElementById('importCsvText').value = '';
    document.getElementById('importFileInput').value = '';
    document.getElementById('selectedFileName').style.display = 'none';

    const skipDupRadio = document.querySelector('input[name="importMode"][value="skip_duplicate"]');
    if (skipDupRadio) skipDupRadio.checked = true;

    switchImportTab('paste');
    updateWizardSteps();
    renderWizardStepContent();
    updateWizardNavButtons();
    document.getElementById('importModal').classList.add('show');
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('show');
    wizardCsvHeaders = [];
    wizardCsvRawData = [];
    wizardFieldMapping = {};
    wizardMappedData = [];
    wizardValidatedData = [];
}

function switchImportTab(tab) {
    currentImportTab = tab;
    document.querySelectorAll('.import-tab').forEach(function(t) {
        t.classList.remove('active');
    });
    document.querySelector('.import-tab[data-import-tab="' + tab + '"]').classList.add('active');

    document.getElementById('importTabPaste').style.display = tab === 'paste' ? 'block' : 'none';
    document.getElementById('importTabFile').style.display = tab === 'file' ? 'block' : 'none';

    wizardCsvHeaders = [];
    wizardCsvRawData = [];
}

function goToWizardStep(step) {
    if (step === 1) {
        currentWizardStep = 1;
    } else if (step === 2 && wizardCsvHeaders.length > 0) {
        currentWizardStep = 2;
    } else if (step === 3 && Object.keys(wizardFieldMapping).length > 0) {
        applyFieldMapping();
        currentWizardStep = 3;
    } else if (step === 4 && wizardValidatedData.length > 0) {
        currentWizardStep = 4;
        updateImportConfirmSummary();
    } else {
        showToast('请先完成上一步', 'warning');
        return;
    }

    updateWizardSteps();
    renderWizardStepContent();
    updateWizardNavButtons();
}

function nextWizardStep() {
    if (currentWizardStep === 1) {
        parseWizardCsvData();
    } else if (currentWizardStep === 2) {
        if (!validateFieldMapping()) {
            return;
        }
        applyFieldMapping();
        validateWizardData();
        currentWizardStep = 3;
        updateWizardSteps();
        renderWizardStepContent();
        updateWizardNavButtons();
    } else if (currentWizardStep === 3) {
        currentWizardStep = 4;
        updateImportConfirmSummary();
        updateWizardSteps();
        renderWizardStepContent();
        updateWizardNavButtons();
    }
}

function prevWizardStep() {
    if (currentWizardStep > 1) {
        currentWizardStep--;
        updateWizardSteps();
        renderWizardStepContent();
        updateWizardNavButtons();
    }
}

function updateWizardSteps() {
    const steps = document.querySelectorAll('.wizard-step');
    steps.forEach(function(step) {
        const stepNum = parseInt(step.getAttribute('data-step'));
        step.classList.remove('active', 'completed');
        if (stepNum < currentWizardStep) {
            step.classList.add('completed');
        } else if (stepNum === currentWizardStep) {
            step.classList.add('active');
        }
    });

    const lines = document.querySelectorAll('.wizard-step-line');
    lines.forEach(function(line, index) {
        line.classList.remove('completed');
        if (index + 1 < currentWizardStep) {
            line.classList.add('completed');
        }
    });
}

function renderWizardStepContent() {
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById('wizardStep' + i);
        if (stepEl) {
            stepEl.style.display = i === currentWizardStep ? 'block' : 'none';
        }
    }
}

function updateWizardNavButtons() {
    const prevBtn = document.getElementById('wizardPrevBtn');
    const nextBtn = document.getElementById('wizardNextBtn');
    const importBtn = document.getElementById('wizardImportBtn');

    prevBtn.style.display = currentWizardStep > 1 ? 'inline-flex' : 'none';
    nextBtn.style.display = currentWizardStep < 4 ? 'inline-flex' : 'none';
    importBtn.style.display = currentWizardStep === 4 ? 'inline-flex' : 'none';

    if (currentWizardStep === 1) {
        const hasData = currentImportTab === 'paste'
            ? document.getElementById('importCsvText').value.trim() !== ''
            : (document.getElementById('selectedFileName').style.display !== 'none');
        nextBtn.disabled = !hasData;
    } else if (currentWizardStep === 2) {
        const hasRequiredMappings = WIZARD_SYSTEM_FIELDS.filter(function(f) {
            return f.required && wizardFieldMapping[f.key];
        }).length > 0;
        nextBtn.disabled = !hasRequiredMappings;
    } else {
        nextBtn.disabled = false;
    }
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

function parseWizardCsvData() {
    let csvText = '';
    if (currentImportTab === 'paste') {
        csvText = document.getElementById('importCsvText').value.trim();
        if (!csvText) {
            showToast('请输入CSV内容', 'error');
            return;
        }
    } else if (currentImportTab === 'file') {
        showToast('请先选择CSV文件', 'error');
        return;
    }

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

    wizardCsvHeaders = parseCsvLine(lines[0]);
    wizardCsvRawData = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row = {};
        wizardCsvHeaders.forEach(function(header, idx) {
            row[header] = values[idx] || '';
        });
        row._rowIndex = i + 1;
        wizardCsvRawData.push(row);
    }

    autoMapFields();
    renderFieldMapping();
    updateMappingPreview();

    currentWizardStep = 2;
    updateWizardSteps();
    renderWizardStepContent();
    updateWizardNavButtons();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    processWizardFile(file);
}

function processWizardFile(file) {
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
        let text = content;
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1);
        }
        const lines = text.split(/\r?\n/).filter(function(line) {
            return line.trim() !== '';
        });

        if (lines.length < 2) {
            showToast('CSV文件至少需要包含表头和一行数据', 'error');
            return;
        }

        wizardCsvHeaders = parseCsvLine(lines[0]);
        wizardCsvRawData = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i]);
            const row = {};
            wizardCsvHeaders.forEach(function(header, idx) {
                row[header] = values[idx] || '';
            });
            row._rowIndex = i + 1;
            wizardCsvRawData.push(row);
        }

        autoMapFields();
        renderFieldMapping();
        updateMappingPreview();

        currentWizardStep = 2;
        updateWizardSteps();
        renderWizardStepContent();
        updateWizardNavButtons();
    };
    reader.onerror = function() {
        showToast('文件读取失败', 'error');
    };
    reader.readAsText(file, 'UTF-8');
}

function autoMapFields() {
    wizardFieldMapping = {};

    WIZARD_SYSTEM_FIELDS.forEach(function(field) {
        const aliases = HEADER_ALIAS_MAP[field.key] || [];
        for (let i = 0; i < aliases.length; i++) {
            const alias = aliases[i];
            const matchedHeader = wizardCsvHeaders.find(function(h) {
                return h.toLowerCase() === alias.toLowerCase() ||
                       h.replace(/\s/g, '') === alias.replace(/\s/g, '');
            });
            if (matchedHeader) {
                wizardFieldMapping[field.key] = matchedHeader;
                break;
            }
        }
    });
}

function renderFieldMapping() {
    const listEl = document.getElementById('fieldMappingList');

    const html = WIZARD_SYSTEM_FIELDS.map(function(field) {
        const currentMapping = wizardFieldMapping[field.key] || '';
        const requiredMark = field.required ? '<span class="required">*</span>' : '';

        const options = ['<option value="">不导入</option>']
            .concat(wizardCsvHeaders.map(function(h) {
                return '<option value="' + escapeHtml(h) + '"' + (currentMapping === h ? ' selected' : '') + '>' + escapeHtml(h) + '</option>';
            })).join('');

        return '<div class="field-mapping-item" data-field="' + field.key + '">' +
            '<div class="mapping-col mapping-col-csv">' +
                '<select class="form-input mapping-select" onchange="setFieldMapping(\'' + field.key + '\', this.value)">' +
                    options +
                '</select>' +
            '</div>' +
            '<div class="mapping-col-arrow">→</div>' +
            '<div class="mapping-col mapping-col-system">' +
                '<span class="system-field-label">' + field.label + '</span>' +
                requiredMark +
                (field.required ? '<span class="field-badge required-badge">必填</span>' : '<span class="field-badge optional-badge">选填</span>') +
            '</div>' +
        '</div>';
    }).join('');

    listEl.innerHTML = html;
}

function setFieldMapping(fieldKey, header) {
    if (header) {
        const otherKeys = Object.keys(wizardFieldMapping).filter(function(k) {
            return k !== fieldKey && wizardFieldMapping[k] === header;
        });
        otherKeys.forEach(function(k) {
            delete wizardFieldMapping[k];
        });
        wizardFieldMapping[fieldKey] = header;
    } else {
        delete wizardFieldMapping[fieldKey];
    }
    renderFieldMapping();
    updateMappingPreview();
    updateWizardNavButtons();
}

function validateFieldMapping() {
    const requiredFields = WIZARD_SYSTEM_FIELDS.filter(function(f) { return f.required; });
    const missingRequired = requiredFields.filter(function(f) {
        return !wizardFieldMapping[f.key];
    });

    if (missingRequired.length > 0) {
        const names = missingRequired.map(function(f) { return f.label; }).join('、');
        showToast('请为必填字段设置映射：' + names, 'error');
        return false;
    }
    return true;
}

function updateMappingPreview() {
    const previewData = wizardCsvRawData.slice(0, 3);
    const tableEl = document.getElementById('mappingPreviewTable');

    let theadHtml = '<tr><th style="width: 50px;">行号</th>';
    WIZARD_SYSTEM_FIELDS.forEach(function(field) {
        if (wizardFieldMapping[field.key]) {
            theadHtml += '<th>' + field.label + '</th>';
        }
    });
    theadHtml += '</tr>';

    let tbodyHtml = '';
    previewData.forEach(function(row) {
        tbodyHtml += '<tr><td>' + row._rowIndex + '</td>';
        WIZARD_SYSTEM_FIELDS.forEach(function(field) {
            if (wizardFieldMapping[field.key]) {
                let value = row[wizardFieldMapping[field.key]] || '';
                if (field.key === 'coDepartments' && value) {
                    const separator = document.getElementById('coDeptSeparator').value || ';';
                    value = value.split(separator).map(function(s) { return s.trim(); }).filter(Boolean).join('、');
                }
                tbodyHtml += '<td>' + escapeHtml(value || '-') + '</td>';
            }
        });
        tbodyHtml += '</tr>';
    });

    tableEl.innerHTML = '<thead>' + theadHtml + '</thead><tbody>' + tbodyHtml + '</tbody>';
}

function applyFieldMapping() {
    wizardMappedData = wizardCsvRawData.map(function(row) {
        const mapped = { _rowIndex: row._rowIndex };
        WIZARD_SYSTEM_FIELDS.forEach(function(field) {
            const header = wizardFieldMapping[field.key];
            if (header) {
                let value = row[header] || '';
                if (field.key === 'coDepartments' && value) {
                    const separator = document.getElementById('coDeptSeparator').value || ';';
                    value = value.split(separator).map(function(s) { return s.trim(); }).filter(Boolean);
                }
                mapped[field.key] = value;
            } else {
                mapped[field.key] = field.key === 'coDepartments' ? [] : '';
            }
        });
        return mapped;
    });
}

function isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return true;
    if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) return true;
    if (dateStr.match(/^\d{4}年\d{1,2}月\d{1,2}日$/)) return true;
    return false;
}

function normalizeDate(dateStr) {
    if (!dateStr) return '';
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
        return dateStr.replace(/\//g, '-');
    }
    const match = dateStr.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if (match) {
        return match[1] + '-' + String(match[2]).padStart(2, '0') + '-' + String(match[3]).padStart(2, '0');
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        return formatDateInput(date);
    }
    return '';
}

function isValidUrgency(urgency) {
    return URGENCY_LIST.includes(urgency);
}

function isValidDepartment(dept) {
    return DEPARTMENT_LIST.includes(dept);
}

function validateWizardData() {
    const existingDocs = getDocuments();
    const docNumbers = wizardMappedData.map(function(r) { return r.docNumber; });

    wizardValidatedData = wizardMappedData.map(function(row, index) {
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
            errors.push('紧急程度无效（仅支持：普通、加急、特急）');
        }

        if (row.proposedDepartment && !isValidDepartment(row.proposedDepartment)) {
            warnings.push('拟办科室"' + row.proposedDepartment + '"未知');
        }

        if (!row.undertakingDepartment) {
            errors.push('承办科室不能为空');
        } else if (!isValidDepartment(row.undertakingDepartment)) {
            errors.push('承办科室无效');
        }

        if (row.coDepartments && row.coDepartments.length > 0) {
            const invalidCoDepts = row.coDepartments.filter(function(d) {
                return !isValidDepartment(d);
            });
            if (invalidCoDepts.length > 0) {
                warnings.push('协办科室存在未知科室：' + invalidCoDepts.join('、'));
            }
        }

        if (!row.deadline) {
            if (row.receiveDate && isValidDate(row.receiveDate) && row.urgency && isValidUrgency(row.urgency)) {
                warnings.push('办理期限将根据紧急程度自动计算');
            } else {
                errors.push('办理期限不能为空');
            }
        } else if (!isValidDate(row.deadline)) {
            errors.push('办理期限格式错误');
        }

        if (row.docNumber) {
            const dupInImport = docNumbers.filter(function(dn, i) {
                return i !== index && dn && dn === row.docNumber;
            });
            if (dupInImport.length > 0) {
                errors.push('导入数据内文号重复');
            }

            const dupInExisting = existingDocs.filter(function(d) {
                return d.docNumber === row.docNumber;
            });
            if (dupInExisting.length > 0) {
                warnings.push('与现有数据文号重复');
            }
        }

        let normalizedRow = { ...row };
        if (row.receiveDate && isValidDate(row.receiveDate)) {
            normalizedRow.receiveDate = normalizeDate(row.receiveDate);
        }
        if (row.deadline && isValidDate(row.deadline)) {
            normalizedRow.deadline = normalizeDate(row.deadline);
        }

        const valid = errors.length === 0;
        const hasWarning = warnings.length > 0;

        return {
            rowIndex: row._rowIndex,
            data: normalizedRow,
            valid: valid,
            hasWarning: hasWarning,
            errors: errors,
            warnings: warnings
        };
    });

    renderWizardPreview();
}

function filterPreviewRows(filter) {
    currentPreviewFilter = filter;
    document.querySelectorAll('.preview-filter-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    const btns = document.querySelectorAll('.preview-filter-btn');
    const filterMap = { 'all': 0, 'valid': 1, 'warning': 2, 'invalid': 3 };
    if (btns[filterMap[filter]]) {
        btns[filterMap[filter]].classList.add('active');
    }
    renderWizardPreview();
}

function renderWizardPreview() {
    const tbody = document.getElementById('wizardPreviewBody');
    const totalCount = wizardValidatedData.length;
    const validCount = wizardValidatedData.filter(function(r) { return r.valid && !r.hasWarning; }).length;
    const warningCount = wizardValidatedData.filter(function(r) { return r.valid && r.hasWarning; }).length;
    const invalidCount = wizardValidatedData.filter(function(r) { return !r.valid; }).length;

    document.getElementById('wizardTotalCount').textContent = totalCount;
    document.getElementById('wizardValidCount').textContent = validCount;
    document.getElementById('wizardWarningCount').textContent = warningCount;
    document.getElementById('wizardInvalidCount').textContent = invalidCount;

    renderIssueSummary();

    let displayData = wizardValidatedData;
    if (currentPreviewFilter === 'valid') {
        displayData = wizardValidatedData.filter(function(r) { return r.valid && !r.hasWarning; });
    } else if (currentPreviewFilter === 'warning') {
        displayData = wizardValidatedData.filter(function(r) { return r.valid && r.hasWarning; });
    } else if (currentPreviewFilter === 'invalid') {
        displayData = wizardValidatedData.filter(function(r) { return !r.valid; });
    }

    tbody.innerHTML = displayData.map(function(item) {
        let rowClass = 'row-valid';
        let statusText = '有效';
        let statusClass = 'status-valid';
        const allIssues = item.errors.concat(item.warnings).join('；');

        if (!item.valid) {
            rowClass = 'row-invalid';
            statusText = '无效';
            statusClass = 'status-invalid';
        } else if (item.hasWarning) {
            rowClass = 'row-warning';
            statusText = '有警告';
            statusClass = 'status-warning';
        }

        const coDeptDisplay = Array.isArray(item.data.coDepartments)
            ? item.data.coDepartments.join('、') || '-'
            : '-';

        let deadlineDisplay = escapeHtml(item.data.deadline) || '-';
        if (!item.data.deadline && item.data.receiveDate && item.data.urgency && isValidUrgency(item.data.urgency)) {
            const days = getDeadlineDaysByUrgency(item.data.urgency);
            const deadlineDate = new Date(item.data.receiveDate);
            deadlineDate.setDate(deadlineDate.getDate() + days);
            deadlineDisplay = '<span class="auto-calc-hint">' + formatDate(formatDateInput(deadlineDate)) + ' (自动计算)</span>';
        }

        return '<tr class="' + rowClass + '" title="' + escapeHtml(allIssues) + '">' +
            '<td>' + item.rowIndex + '</td>' +
            '<td class="' + (!item.data.fromUnit ? 'cell-error' : '') + '">' + (escapeHtml(item.data.fromUnit) || '-') + '</td>' +
            '<td class="' + (!item.data.docNumber ? 'cell-error' : (item.warnings.some(function(w) { return w.indexOf('文号重复') >= 0; }) ? 'cell-warning' : '')) + '">' + (escapeHtml(item.data.docNumber) || '-') + '</td>' +
            '<td class="' + (!item.data.title ? 'cell-error' : '') + '">' + (escapeHtml(item.data.title) || '-') + '</td>' +
            '<td class="' + (!item.data.receiveDate || !isValidDate(item.data.receiveDate) ? 'cell-error' : '') + '">' + (escapeHtml(item.data.receiveDate) || '-') + '</td>' +
            '<td class="' + (!item.data.urgency || !isValidUrgency(item.data.urgency) ? 'cell-error' : '') + '">' + (escapeHtml(item.data.urgency) || '-') + '</td>' +
            '<td class="' + (item.warnings.some(function(w) { return w.indexOf('拟办科室') >= 0 && w.indexOf('未知') >= 0; }) ? 'cell-warning' : '') + '">' + (escapeHtml(item.data.proposedDepartment) || '-') + '</td>' +
            '<td class="' + (!item.data.undertakingDepartment || !isValidDepartment(item.data.undertakingDepartment) ? 'cell-error' : '') + '">' + (escapeHtml(item.data.undertakingDepartment) || '-') + '</td>' +
            '<td class="' + (item.warnings.some(function(w) { return w.indexOf('协办科室') >= 0 && w.indexOf('未知') >= 0; }) ? 'cell-warning' : '') + '">' + escapeHtml(coDeptDisplay) + '</td>' +
            '<td class="' + (item.data.deadline && !isValidDate(item.data.deadline) ? 'cell-error' : '') + '">' + deadlineDisplay + '</td>' +
            '<td>' + (escapeHtml(item.data.remark) || '-') + '</td>' +
            '<td><span class="import-row-status ' + statusClass + '">' + statusText + '</span></td>' +
            '</tr>';
    }).join('');
}

function renderIssueSummary() {
    const sectionEl = document.getElementById('importIssueSection');
    const issueTypes = {};

    wizardValidatedData.forEach(function(item) {
        item.errors.forEach(function(err) {
            if (!issueTypes[err]) {
                issueTypes[err] = { count: 0, type: 'error' };
            }
            issueTypes[err].count++;
        });
        item.warnings.forEach(function(warn) {
            if (!issueTypes[warn]) {
                issueTypes[warn] = { count: 0, type: 'warning' };
            }
            issueTypes[warn].count++;
        });
    });

    const hasIssues = Object.keys(issueTypes).length > 0;
    sectionEl.style.display = hasIssues ? 'block' : 'none';

    if (hasIssues) {
        const html = '<div class="import-issue-title">问题汇总</div>' +
            '<div class="import-issue-list">' +
            Object.keys(issueTypes).map(function(msg) {
                const issue = issueTypes[msg];
                const cls = issue.type === 'error' ? 'issue-error' : 'issue-warning';
                const icon = issue.type === 'error' ? '❌' : '⚠️';
                return '<div class="import-issue-item ' + cls + '">' +
                    '<span class="issue-icon">' + icon + '</span>' +
                    '<span class="issue-text">' + msg + '</span>' +
                    '<span class="issue-count">' + issue.count + ' 条</span>' +
                '</div>';
            }).join('') +
            '</div>';
        sectionEl.innerHTML = html;
    }
}

function updateImportConfirmSummary() {
    const totalCount = wizardValidatedData.length;
    const validCount = wizardValidatedData.filter(function(r) { return r.valid && !r.hasWarning; }).length;
    const warningCount = wizardValidatedData.filter(function(r) { return r.valid && r.hasWarning; }).length;
    const invalidCount = wizardValidatedData.filter(function(r) { return !r.valid; }).length;

    document.getElementById('confirmTotalCount').textContent = totalCount;
    document.getElementById('confirmValidCount').textContent = validCount;
    document.getElementById('confirmWarningCount').textContent = warningCount;
    document.getElementById('confirmInvalidCount').textContent = invalidCount;

    const importMode = document.querySelector('input[name="importMode"]:checked').value;
    const resultPreviewEl = document.getElementById('importResultPreview');

    let importableCount = 0;
    let overwriteCount = 0;
    let skipCount = 0;

    const allValidCount = validCount + warningCount;
    const duplicateCount = wizardValidatedData.filter(function(r) {
        return r.valid && r.warnings.some(function(w) { return w.indexOf('与现有数据文号重复') >= 0; });
    }).length;

    if (importMode === 'skip_duplicate') {
        importableCount = allValidCount - duplicateCount;
        skipCount = invalidCount + duplicateCount;
    } else if (importMode === 'overwrite') {
        importableCount = allValidCount;
        overwriteCount = duplicateCount;
        skipCount = invalidCount;
    }

    const html = '<div class="import-result-card">' +
        '<div class="result-item result-add">' +
            '<span class="result-icon">➕</span>' +
            '<span class="result-label">将新增</span>' +
            '<span class="result-value">' + (importableCount - overwriteCount) + ' 条</span>' +
        '</div>' +
        '<div class="result-item result-overwrite">' +
            '<span class="result-icon">🔄</span>' +
            '<span class="result-label">将覆盖</span>' +
            '<span class="result-value">' + overwriteCount + ' 条</span>' +
        '</div>' +
        '<div class="result-item result-skip">' +
            '<span class="result-icon">⏭</span>' +
            '<span class="result-label">将跳过</span>' +
            '<span class="result-value">' + skipCount + ' 条</span>' +
        '</div>' +
    '</div>';

    resultPreviewEl.innerHTML = html;

    const importBtn = document.getElementById('wizardImportBtn');
    importBtn.disabled = importableCount === 0;
    if (importableCount > 0) {
        importBtn.innerHTML = '<span class="btn-icon">✓</span> 开始导入 (' + importableCount + '条)';
    } else {
        importBtn.innerHTML = '<span class="btn-icon">✓</span> 开始导入';
    }
}

function confirmWizardImport() {
    const importMode = document.querySelector('input[name="importMode"]:checked').value;
    const allDocs = loadAllDocuments();
    const existingDocs = getDocuments();
    const now = new Date().toISOString();

    const docsToImport = wizardValidatedData.filter(function(r) { return r.valid; });

    let addedCount = 0;
    let updatedCount = 0;
    const importedDocs = [];

    docsToImport.forEach(function(item) {
        const dept = item.data.undertakingDepartment || '';
        let deadline = item.data.deadline;
        if (!deadline && item.data.receiveDate && item.data.urgency) {
            const days = getDeadlineDaysByUrgency(item.data.urgency);
            const deadlineDate = new Date(item.data.receiveDate);
            deadlineDate.setDate(deadlineDate.getDate() + days);
            deadline = formatDateInput(deadlineDate);
        }

        const existingIdx = allDocs.findIndex(function(d) {
            return !d.isDeleted && d.docNumber === item.data.docNumber;
        });

        const flowRecords = [
            {
                id: generateId(),
                action: FLOW_ACTION.CREATE,
                actionText: '收文登记',
                fromStatus: null,
                toStatus: FLOW_STATUS.PENDING_REVIEW,
                handler: '',
                opinion: '收文登记（导入）',
                department: dept,
                createdAt: now
            }
        ];

        if (existingIdx >= 0 && importMode === 'overwrite') {
            const oldDoc = { ...allDocs[existingIdx] };
            allDocs[existingIdx] = {
                ...allDocs[existingIdx],
                fromUnit: item.data.fromUnit,
                title: item.data.title,
                receiveDate: item.data.receiveDate,
                urgency: item.data.urgency,
                proposedDepartment: item.data.proposedDepartment || '',
                undertakingDepartment: dept,
                department: dept,
                coDepartments: item.data.coDepartments || [],
                deadline: deadline,
                remark: item.data.remark || '',
                updatedAt: now
            };

            const importOverwriteHistoryRecord = addChangeHistoryRecord(allDocs[existingIdx].id, AUDIT_ACTION.IMPORT, '导入覆盖', oldDoc, allDocs[existingIdx], {
                fromImport: true,
                overwrite: true
            });
            addAuditLog(AUDIT_ACTION.EDIT, allDocs[existingIdx], oldDoc, {
                fromImport: true,
                overwrite: true,
                changeHistoryRecordId: importOverwriteHistoryRecord.id
            });
            updatedCount++;
            importedDocs.push(allDocs[existingIdx]);
        } else if (existingIdx < 0) {
            const newDoc = {
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
                flowRecords: flowRecords,
                supervisionRecords: [],
                reminderNote: '',
                extendedDeadline: null,
                isDeleted: false,
                deletedAt: null,
                createdAt: now
            };
            allDocs.unshift(newDoc);
            const importCreateHistoryRecord = addChangeHistoryRecord(newDoc.id, AUDIT_ACTION.IMPORT, '导入新增', null, newDoc, {
                fromImport: true
            });
            addAuditLog(AUDIT_ACTION.CREATE, newDoc, null, {
                fromImport: true,
                changeHistoryRecordId: importCreateHistoryRecord.id
            });
            addedCount++;
            importedDocs.push(newDoc);
        }
    });

    saveDocuments(allDocs);

    let msg = '导入完成：新增 ' + addedCount + ' 条';
    if (updatedCount > 0) {
        msg += '，覆盖 ' + updatedCount + ' 条';
    }
    const skipped = wizardValidatedData.length - addedCount - updatedCount;
    if (skipped > 0) {
        msg += '，跳过 ' + skipped + ' 条';
    }

    showToast(msg, 'success');
    closeImportModal();
    updateStats();
    renderDocumentList();
    renderReminderCenter();
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
            processWizardFile(files[0]);
        }
    });
}

function setupImportWizardEvents() {
    const csvText = document.getElementById('importCsvText');
    if (csvText) {
        csvText.addEventListener('input', function() {
            if (currentWizardStep === 1) {
                updateWizardNavButtons();
            }
        });
    }
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

function generateChecksum(data) {
    const jsonStr = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

function exportFullJson() {
    closeExportMenu();
    const documents = loadAllDocuments();
    const templates = getTemplates();
    const auditLogs = getAuditLogs();
    const flowRules = getFlowRules();
    const viewPresets = getViewPresets();

    const hasData = documents.length > 0 || templates.length > 0 || auditLogs.length > 0 ||
        viewPresets.length > 0 || flowRules.updatedAt !== null;

    if (!hasData) {
        showToast('当前没有数据可导出', 'error');
        return;
    }

    const payload = {
        documents: documents,
        templates: templates,
        auditLogs: auditLogs,
        flowRules: flowRules,
        viewPresets: viewPresets
    };

    const checksum = generateChecksum(payload);

    const exportData = {
        packageType: 'full_backup',
        version: '2.0',
        backupTime: new Date().toISOString(),
        summary: {
            documents: documents.length,
            templates: templates.length,
            auditLogs: auditLogs.length,
            flowRules: flowRules.updatedAt ? 1 : 0,
            viewPresets: viewPresets.length
        },
        data: payload,
        checksum: checksum
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const filename = getExportFileName('完整备份', 'json');
    downloadFile(jsonContent, filename, 'application/json');
    const totalItems = documents.length + templates.length + auditLogs.length + viewPresets.length;
    showToast('成功导出完整备份（' + totalItems + ' 条数据）', 'success');
}

let restorePackage = null;
let restoreAnalysis = null;
let currentRestoreTab = 'documents';

const RESTORE_TYPES = {
    DOCUMENTS: 'documents',
    TEMPLATES: 'templates',
    AUDIT_LOGS: 'auditLogs',
    FLOW_RULES: 'flowRules',
    VIEW_PRESETS: 'viewPresets'
};

function openRestoreModal() {
    restorePackage = null;
    restoreAnalysis = null;
    currentRestoreTab = 'documents';
    document.getElementById('restoreFileInput').value = '';
    document.getElementById('restoreFileName').style.display = 'none';
    document.getElementById('restorePreviewSection').style.display = 'none';
    document.getElementById('restoreOverwriteCheckbox').checked = false;
    document.getElementById('restoreConfirmBtn').disabled = true;

    const typeCheckboxes = ['restoreTypeDocuments', 'restoreTypeTemplates', 'restoreTypeAuditLogs', 'restoreTypeFlowRules', 'restoreTypeViewPresets'];
    typeCheckboxes.forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.checked = true;
    });

    document.querySelectorAll('.preview-tab').forEach(function(tab) {
        tab.classList.remove('active');
    });
    const docTab = document.querySelector('.preview-tab[data-tab="documents"]');
    if (docTab) docTab.classList.add('active');

    document.getElementById('restoreModal').classList.add('show');
}

function closeRestoreModal() {
    document.getElementById('restoreModal').classList.remove('show');
    restorePackage = null;
    restoreAnalysis = null;
    currentRestoreTab = 'documents';
}

function handleRestoreFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    processRestoreFile(file);
}

function parseBackupFile(parsed) {
    const result = {
        version: '1.0',
        backupTime: null,
        isLegacy: false,
        checksumValid: null,
        data: {
            documents: [],
            templates: [],
            auditLogs: [],
            flowRules: null,
            viewPresets: []
        }
    };

    if (Array.isArray(parsed)) {
        result.isLegacy = true;
        result.data.documents = parsed;
        return result;
    }

    if (parsed.packageType === 'full_backup' && parsed.data && typeof parsed.data === 'object') {
        result.version = parsed.version || '2.0';
        result.backupTime = parsed.backupTime || null;

        const payload = parsed.data;
        result.data.documents = Array.isArray(payload.documents) ? payload.documents : [];
        result.data.templates = Array.isArray(payload.templates) ? payload.templates : [];
        result.data.auditLogs = Array.isArray(payload.auditLogs) ? payload.auditLogs : [];
        result.data.flowRules = payload.flowRules || null;
        result.data.viewPresets = Array.isArray(payload.viewPresets) ? payload.viewPresets : [];

        if (parsed.checksum) {
            const verifyChecksum = generateChecksum(payload);
            result.checksumValid = verifyChecksum === parsed.checksum;
        }

        return result;
    }

    if (parsed.data && Array.isArray(parsed.data)) {
        result.isLegacy = true;
        result.version = parsed.version || '1.0';
        result.backupTime = parsed.exportTime || null;
        result.data.documents = parsed.data;
        return result;
    }

    result.isLegacy = true;
    result.data.documents = parsed.documents || [];
    return result;
}

function normalizeDocument(doc) {
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
}

function isValidDocument(doc) {
    return doc.fromUnit && doc.docNumber && doc.title &&
        doc.receiveDate && doc.urgency && doc.department;
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

            restorePackage = parseBackupFile(parsed);

            const validDocs = restorePackage.data.documents.filter(isValidDocument);
            restorePackage.data.documents = validDocs.map(normalizeDocument);

            const hasAnyData = restorePackage.data.documents.length > 0 ||
                restorePackage.data.templates.length > 0 ||
                restorePackage.data.auditLogs.length > 0 ||
                restorePackage.data.flowRules !== null ||
                restorePackage.data.viewPresets.length > 0;

            if (!hasAnyData) {
                showToast('备份文件中没有有效数据', 'error');
                return;
            }

            updateDataTypeCounts();
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

function updateDataTypeCounts() {
    if (!restorePackage) return;

    document.getElementById('restoreTypeDocCount').textContent = restorePackage.data.documents.length + ' 条';
    document.getElementById('restoreTypeTplCount').textContent = restorePackage.data.templates.length + ' 条';
    document.getElementById('restoreTypeAuditCount').textContent = restorePackage.data.auditLogs.length + ' 条';
    document.getElementById('restoreTypeFlowCount').textContent = (restorePackage.data.flowRules ? 1 : 0) + ' 项';
    document.getElementById('restoreTypeViewCount').textContent = restorePackage.data.viewPresets.length + ' 个';

    const hasFlowRules = restorePackage.data.flowRules !== null;
    const flowTypeCheckbox = document.getElementById('restoreTypeFlowRules');
    if (flowTypeCheckbox && !hasFlowRules) {
        flowTypeCheckbox.checked = false;
        flowTypeCheckbox.disabled = true;
    } else if (flowTypeCheckbox) {
        flowTypeCheckbox.disabled = false;
    }

    const typeNames = ['Documents', 'Templates', 'AuditLogs', 'FlowRules', 'ViewPresets'];
    const dataKeys = ['documents', 'templates', 'auditLogs', 'flowRules', 'viewPresets'];
    typeNames.forEach(function(name, i) {
        const checkbox = document.getElementById('restoreType' + name);
        if (checkbox) {
            const hasData = dataKeys[i] === 'flowRules'
                ? restorePackage.data.flowRules !== null
                : restorePackage.data[dataKeys[i]].length > 0;
            if (!hasData) {
                checkbox.checked = false;
                checkbox.disabled = true;
                checkbox.closest('.data-type-item').style.opacity = '0.5';
            } else {
                checkbox.disabled = false;
                checkbox.closest('.data-type-item').style.opacity = '1';
            }
        }
    });
}

function analyzeArrayItems(items, existingItems, matchFields, overwrite) {
    const existingMap = {};
    const existingIndexMap = {};
    existingItems.forEach(function(item, index) {
        matchFields.forEach(function(field) {
            if (item[field]) {
                existingMap[field + ':' + item[field]] = item;
                existingIndexMap[field + ':' + item[field]] = index;
            }
        });
    });

    const seenInBackup = {};
    const addItems = [];
    const overwriteItems = [];
    const skipItems = [];

    items.forEach(function(item) {
        let matchItem = null;
        let matchType = null;
        let isInternalDuplicate = false;

        for (let i = 0; i < matchFields.length; i++) {
            const field = matchFields[i];
            if (item[field] && seenInBackup[field + ':' + item[field]]) {
                isInternalDuplicate = true;
                break;
            }
        }

        matchFields.forEach(function(field) {
            if (item[field]) {
                seenInBackup[field + ':' + item[field]] = true;
            }
        });

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

        for (let i = 0; i < matchFields.length; i++) {
            const field = matchFields[i];
            const key = field + ':' + item[field];
            if (item[field] && existingMap[key]) {
                matchItem = existingMap[key];
                matchType = field;
                break;
            }
        }

        if (!matchItem) {
            addItems.push({ data: item, action: 'add' });
        } else if (overwrite) {
            overwriteItems.push({
                data: item,
                action: 'overwrite',
                matched: matchItem,
                matchType: matchType,
                existingIndex: existingIndexMap[matchType + ':' + matchItem[matchType]]
            });
        } else {
            skipItems.push({
                data: item,
                action: 'skip',
                matched: matchItem,
                matchType: matchType,
                reason: matchFields[0] === 'id' ? 'ID重复' : '名称重复'
            });
        }
    });

    return {
        add: addItems,
        overwrite: overwriteItems,
        skip: skipItems,
        all: addItems.concat(overwriteItems).concat(skipItems)
    };
}

function analyzeRestoreData() {
    if (!restorePackage) return;

    const overwrite = document.getElementById('restoreOverwriteCheckbox').checked;
    const typeDocs = document.getElementById('restoreTypeDocuments').checked;
    const typeTpls = document.getElementById('restoreTypeTemplates').checked;
    const typeAudit = document.getElementById('restoreTypeAuditLogs').checked;
    const typeFlow = document.getElementById('restoreTypeFlowRules').checked;
    const typeView = document.getElementById('restoreTypeViewPresets').checked;

    const docAnalysis = typeDocs
        ? analyzeArrayItems(restorePackage.data.documents, loadAllDocuments(), ['id', 'docNumber'], overwrite)
        : { add: [], overwrite: [], skip: [], all: [] };

    const tplAnalysis = typeTpls
        ? analyzeArrayItems(restorePackage.data.templates, getTemplates(), ['id', 'name'], overwrite)
        : { add: [], overwrite: [], skip: [], all: [] };

    const auditAnalysis = typeAudit
        ? analyzeArrayItems(restorePackage.data.auditLogs, getAuditLogs(), ['id'], overwrite)
        : { add: [], overwrite: [], skip: [], all: [] };

    const existingFlow = getFlowRules();
    let flowAdd = 0, flowOver = 0, flowSkip = 0;
    if (typeFlow && restorePackage.data.flowRules) {
        if (!existingFlow.updatedAt) {
            flowAdd = 1;
        } else if (overwrite) {
            flowOver = 1;
        } else {
            flowSkip = 1;
        }
    }

    const viewAnalysis = typeView
        ? analyzeArrayItems(restorePackage.data.viewPresets, getViewPresets(), ['id', 'name'], overwrite)
        : { add: [], overwrite: [], skip: [], all: [] };

    const totalAdd = docAnalysis.add.length + tplAnalysis.add.length + auditAnalysis.add.length + flowAdd + viewAnalysis.add.length;
    const totalOver = docAnalysis.overwrite.length + tplAnalysis.overwrite.length + auditAnalysis.overwrite.length + flowOver + viewAnalysis.overwrite.length;
    const totalSkip = docAnalysis.skip.length + tplAnalysis.skip.length + auditAnalysis.skip.length + flowSkip + viewAnalysis.skip.length;
    const total = totalAdd + totalOver + totalSkip;

    restoreAnalysis = {
        total: total,
        add: totalAdd,
        overwrite: totalOver,
        skip: totalSkip,
        hasDuplicate: totalOver > 0 || totalSkip > 0,
        categories: {
            documents: {
                total: restorePackage.data.documents.length,
                add: docAnalysis.add.length,
                overwrite: docAnalysis.overwrite.length,
                skip: docAnalysis.skip.length,
                items: docAnalysis.all
            },
            templates: {
                total: restorePackage.data.templates.length,
                add: tplAnalysis.add.length,
                overwrite: tplAnalysis.overwrite.length,
                skip: tplAnalysis.skip.length,
                items: tplAnalysis.all
            },
            auditLogs: {
                total: restorePackage.data.auditLogs.length,
                add: auditAnalysis.add.length,
                overwrite: auditAnalysis.overwrite.length,
                skip: auditAnalysis.skip.length,
                items: auditAnalysis.all
            },
            flowRules: {
                total: restorePackage.data.flowRules ? 1 : 0,
                add: flowAdd,
                overwrite: flowOver,
                skip: flowSkip,
                data: restorePackage.data.flowRules
            },
            viewPresets: {
                total: restorePackage.data.viewPresets.length,
                add: viewAnalysis.add.length,
                overwrite: viewAnalysis.overwrite.length,
                skip: viewAnalysis.skip.length,
                items: viewAnalysis.all
            }
        }
    };
}

function updateRestorePreview() {
    if (!restorePackage) return;
    analyzeRestoreData();
    renderRestorePreview();
}

function switchRestorePreviewTab(tab) {
    currentRestoreTab = tab;
    document.querySelectorAll('.preview-tab').forEach(function(t) {
        t.classList.remove('active');
    });
    const activeTab = document.querySelector('.preview-tab[data-tab="' + tab + '"]');
    if (activeTab) activeTab.classList.add('active');
    renderRestorePreviewTable();
}

function getTableHeaders(tab) {
    const headers = {
        documents: ['序号', '标题', '文号', '来文单位', '承办科室', '处理方式'],
        templates: ['序号', '模板名称', '来文单位', '紧急程度', '使用次数', '最近使用', '处理方式'],
        auditLogs: ['序号', '操作类型', '收文标题', '文号', '操作时间', '处理方式'],
        viewPresets: ['序号', '视图名称', '筛选科室', '视图类型', '创建时间', '处理方式']
    };
    return headers[tab] || headers.documents;
}

function getTableRow(item, index, tab) {
    const statusMap = {
        'add': { text: '新增', class: 'status-add' },
        'overwrite': { text: '覆盖', class: 'status-overwrite' },
        'skip': { text: '跳过', class: 'status-skip' }
    };
    const status = statusMap[item.action];
    const rowClass = 'row-' + item.action;
    const data = item.data;

    let cells = '';
    switch (tab) {
        case 'documents':
            cells =
                '<td>' + escapeHtml(data.title || '-') + '</td>' +
                '<td>' + escapeHtml(data.docNumber || '-') + '</td>' +
                '<td>' + escapeHtml(data.fromUnit || '-') + '</td>' +
                '<td>' + escapeHtml(data.department || '-') + '</td>';
            break;
        case 'templates':
            cells =
                '<td>' + escapeHtml(data.name || '-') + '</td>' +
                '<td>' + escapeHtml(data.fromUnit || '-') + '</td>' +
                '<td>' + escapeHtml(data.urgency || '-') + '</td>' +
                '<td>' + (data.useCount || 0) + '</td>' +
                '<td>' + escapeHtml(data.lastUsedAt ? data.lastUsedAt.substring(0, 10) : '从未使用') + '</td>';
            break;
        case 'auditLogs':
            cells =
                '<td>' + escapeHtml(data.actionText || data.action || '-') + '</td>' +
                '<td>' + escapeHtml(data.docTitle || '-') + '</td>' +
                '<td>' + escapeHtml(data.docNumber || '-') + '</td>' +
                '<td>' + escapeHtml(data.timestamp ? data.timestamp.substring(0, 10) : '-') + '</td>';
            break;
        case 'viewPresets':
            cells =
                '<td>' + escapeHtml(data.name || '-') + '</td>' +
                '<td>' + escapeHtml((data.filter && data.filter.department) || '-') + '</td>' +
                '<td>' + escapeHtml(data.viewType === 'board' ? '科室看板' : '列表视图') + '</td>' +
                '<td>' + escapeHtml(data.createdAt ? data.createdAt.substring(0, 10) : '-') + '</td>';
            break;
        default:
            cells = '<td>-</td><td>-</td><td>-</td><td>-</td>';
    }

    return '<tr class="' + rowClass + '">' +
        '<td>' + (index + 1) + '</td>' +
        cells +
        '<td><span class="restore-row-status ' + status.class + '">' + status.text + '</span></td>' +
        '</tr>';
}

function renderRestorePreviewTable() {
    if (!restoreAnalysis) return;

    const thead = document.getElementById('restorePreviewTableHead');
    const tbody = document.getElementById('restorePreviewBody');
    const headers = getTableHeaders(currentRestoreTab);

    thead.innerHTML = '<tr>' + headers.map(function(h, i) {
        let style = '';
        if (i === 0) style = 'style="width: 50px;"';
        if (i === headers.length - 1) style = 'style="width: 80px;"';
        return '<th ' + style + '>' + h + '</th>';
    }).join('') + '</tr>';

    const category = restoreAnalysis.categories[currentRestoreTab];
    if (!category || !category.items) {
        tbody.innerHTML = '<tr><td colspan="' + headers.length + '" style="text-align:center;color:#999;padding:20px;">暂无数据</td></tr>';
        return;
    }

    tbody.innerHTML = category.items.map(function(item, index) {
        return getTableRow(item, index, currentRestoreTab);
    }).join('');
}

function renderRestorePreview() {
    if (!restoreAnalysis || !restorePackage) return;

    const previewSection = document.getElementById('restorePreviewSection');

    document.getElementById('restorePackageVersion').textContent =
        (restorePackage.isLegacy ? '旧版格式 v' : 'v') + restorePackage.version +
        (restorePackage.isLegacy ? '（仅收文）' : '');

    if (restorePackage.backupTime) {
        const bt = new Date(restorePackage.backupTime);
        document.getElementById('restoreBackupTime').textContent =
            bt.getFullYear() + '-' + String(bt.getMonth() + 1).padStart(2, '0') + '-' +
            String(bt.getDate()).padStart(2, '0') + ' ' + String(bt.getHours()).padStart(2, '0') + ':' +
            String(bt.getMinutes()).padStart(2, '0');
    } else {
        document.getElementById('restoreBackupTime').textContent = '未知';
    }

    const checksumEl = document.getElementById('restoreChecksumStatus');
    if (restorePackage.checksumValid === null) {
        checksumEl.textContent = '无校验信息';
        checksumEl.className = 'package-info-value';
    } else if (restorePackage.checksumValid) {
        checksumEl.textContent = '✓ 校验通过';
        checksumEl.className = 'package-info-value checksum-valid';
    } else {
        checksumEl.textContent = '✗ 校验失败（文件可能已损坏）';
        checksumEl.className = 'package-info-value checksum-invalid';
    }

    document.getElementById('restoreTotalCount').textContent = restoreAnalysis.total;
    document.getElementById('restoreAddCount').textContent = restoreAnalysis.add;
    document.getElementById('restoreOverwriteCount').textContent = restoreAnalysis.overwrite;
    document.getElementById('restoreSkipCount').textContent = restoreAnalysis.skip;

    document.getElementById('catDocAdd').textContent = restoreAnalysis.categories.documents.add;
    document.getElementById('catDocOver').textContent = restoreAnalysis.categories.documents.overwrite;
    document.getElementById('catDocSkip').textContent = restoreAnalysis.categories.documents.skip;

    document.getElementById('catTplAdd').textContent = restoreAnalysis.categories.templates.add;
    document.getElementById('catTplOver').textContent = restoreAnalysis.categories.templates.overwrite;
    document.getElementById('catTplSkip').textContent = restoreAnalysis.categories.templates.skip;

    document.getElementById('catAuditAdd').textContent = restoreAnalysis.categories.auditLogs.add;
    document.getElementById('catAuditOver').textContent = restoreAnalysis.categories.auditLogs.overwrite;
    document.getElementById('catAuditSkip').textContent = restoreAnalysis.categories.auditLogs.skip;

    document.getElementById('catFlowAdd').textContent = restoreAnalysis.categories.flowRules.add;
    document.getElementById('catFlowOver').textContent = restoreAnalysis.categories.flowRules.overwrite;
    document.getElementById('catFlowSkip').textContent = restoreAnalysis.categories.flowRules.skip;

    document.getElementById('catViewAdd').textContent = restoreAnalysis.categories.viewPresets.add;
    document.getElementById('catViewOver').textContent = restoreAnalysis.categories.viewPresets.overwrite;
    document.getElementById('catViewSkip').textContent = restoreAnalysis.categories.viewPresets.skip;

    const warningEl = document.getElementById('restoreDuplicateWarning');
    if (restoreAnalysis.hasDuplicate) {
        warningEl.style.display = 'flex';
    } else {
        warningEl.style.display = 'none';
    }

    renderRestorePreviewTable();

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
    if (!restoreAnalysis || !restorePackage) return;

    const overwrite = document.getElementById('restoreOverwriteCheckbox').checked;
    const typeDocs = document.getElementById('restoreTypeDocuments').checked;
    const typeTpls = document.getElementById('restoreTypeTemplates').checked;
    const typeAudit = document.getElementById('restoreTypeAuditLogs').checked;
    const typeFlow = document.getElementById('restoreTypeFlowRules').checked;
    const typeView = document.getElementById('restoreTypeViewPresets').checked;

    let docAdded = 0, docOverwritten = 0, docSkipped = 0;
    let tplAdded = 0, tplOverwritten = 0, tplSkipped = 0;
    let auditAdded = 0, auditOverwritten = 0, auditSkipped = 0;
    let flowAdded = 0, flowOverwritten = 0, flowSkipped = 0;
    let viewAdded = 0, viewOverwritten = 0, viewSkipped = 0;
    let restoredFromTrash = 0;
    let restoreHistoryLinks = [];

    if (typeDocs) {
        const result = restoreDocuments(overwrite);
        docAdded = result.added;
        docOverwritten = result.overwritten;
        docSkipped = result.skipped;
        restoredFromTrash = result.restoredFromTrash;
        restoreHistoryLinks = result.historyLinks || [];
    }

    if (typeTpls) {
        const result = restoreTemplates(overwrite);
        tplAdded = result.added;
        tplOverwritten = result.overwritten;
        tplSkipped = result.skipped;
    }

    if (typeAudit) {
        const result = restoreAuditLogs(overwrite);
        auditAdded = result.added;
        auditOverwritten = result.overwritten;
        auditSkipped = result.skipped;
    }

    if (typeFlow && restorePackage.data.flowRules) {
        const result = restoreFlowRules(overwrite);
        flowAdded = result.added;
        flowOverwritten = result.overwritten;
        flowSkipped = result.skipped;
    }

    if (typeView) {
        const result = restoreViewPresets(overwrite);
        viewAdded = result.added;
        viewOverwritten = result.overwritten;
        viewSkipped = result.skipped;
    }

    const totalAdded = docAdded + tplAdded + auditAdded + flowAdded + viewAdded;
    const totalOver = docOverwritten + tplOverwritten + auditOverwritten + flowOverwritten + viewOverwritten;
    const totalSkip = docSkipped + tplSkipped + auditSkipped + flowSkipped + viewSkipped;

    if (docAdded + docOverwritten > 0) {
        const docs = loadAllDocuments();
        const firstHistoryLink = restoreHistoryLinks[0] || null;
        const sampleDoc = firstHistoryLink
            ? docs.find(function(doc) { return doc.id === firstHistoryLink.docId; }) || docs[0]
            : docs[0];
        addAuditLog(AUDIT_ACTION.RESTORE, sampleDoc, null, {
            documents: { add: docAdded, overwrite: docOverwritten, skip: docSkipped, restoredFromTrash: restoredFromTrash },
            templates: { add: tplAdded, overwrite: tplOverwritten, skip: tplSkipped },
            auditLogs: { add: auditAdded, overwrite: auditOverwritten, skip: auditSkipped },
            flowRules: { add: flowAdded, overwrite: flowOverwritten, skip: flowSkipped },
            viewPresets: { add: viewAdded, overwrite: viewOverwritten, skip: viewSkipped },
            changeHistoryRecordId: firstHistoryLink ? firstHistoryLink.recordId : ''
        });
    }

    let msg = '';
    const parts = [];
    if (docAdded + docOverwritten > 0) parts.push('收文 ' + docAdded + '新增/' + docOverwritten + '覆盖');
    if (tplAdded + tplOverwritten > 0) parts.push('模板 ' + tplAdded + '新增/' + tplOverwritten + '覆盖');
    if (auditAdded + auditOverwritten > 0) parts.push('审计日志 ' + auditAdded + '新增/' + auditOverwritten + '覆盖');
    if (flowAdded + flowOverwritten > 0) parts.push('流程规则 ' + (flowAdded + flowOverwritten) + '项');
    if (viewAdded + viewOverwritten > 0) parts.push('保存视图 ' + viewAdded + '新增/' + viewOverwritten + '覆盖');
    msg = '恢复完成：' + parts.join('，');
    if (totalSkip > 0) msg += '，跳过 ' + totalSkip + ' 条';

    showToast(msg, 'success');
    closeRestoreModal();

    refreshAllViews();
}

function restoreDocuments(overwrite) {
    const allDocs = loadAllDocuments();
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
    const seenIds = {};
    const seenDocNumbers = {};
    const addedDocIds = [];
    const overwrittenDocs = [];
    const historyLinks = [];

    restorePackage.data.documents.forEach(function(item) {
        let isInternalDup = false;
        if (item.id && seenIds[item.id]) isInternalDup = true;
        if (!isInternalDup && item.docNumber && seenDocNumbers[item.docNumber]) isInternalDup = true;
        if (item.id) seenIds[item.id] = true;
        if (item.docNumber) seenDocNumbers[item.docNumber] = true;

        if (isInternalDup) {
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
                const d = new Date(item.receiveDate);
                d.setDate(d.getDate() + days);
                deadline = formatDateInput(d);
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
            addedDocIds.push(newDoc.id);
            addCount++;
        } else if (overwrite) {
            const idx = docIndexById[matchDoc.id];
            if (idx !== undefined && idx !== -1) {
                const wasDeleted = matchDoc.isDeleted;
                const oldDoc = { ...matchDoc };
                let deadline = item.deadline;
                if (!deadline && item.receiveDate && item.urgency) {
                    const days = getDeadlineDaysByUrgency(item.urgency);
                    const d = new Date(item.receiveDate);
                    d.setDate(d.getDate() + days);
                    deadline = formatDateInput(d);
                }
                let flowStatus = item.flowStatus;
                if (!flowStatus) {
                    flowStatus = item.completed ? FLOW_STATUS.DONE : FLOW_STATUS.PENDING_REVIEW;
                }
                finalDocs[idx] = {
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
                overwrittenDocs.push({ oldDoc: oldDoc, newDoc: finalDocs[idx] });
                overwriteCount++;
                if (wasDeleted) restoredFromTrash++;
            }
        } else {
            skipCount++;
        }
    });

    saveDocuments(finalDocs);
    
    addedDocIds.forEach(function(docId) {
        const doc = finalDocs.find(d => d.id === docId);
        if (doc) {
            const historyRecord = addChangeHistoryRecord(docId, AUDIT_ACTION.RESTORE, '恢复备份-新增', null, doc);
            historyLinks.push({ docId: docId, recordId: historyRecord.id });
        }
    });

    overwrittenDocs.forEach(function(item) {
        const historyRecord = addChangeHistoryRecord(item.newDoc.id, AUDIT_ACTION.RESTORE, '恢复备份-覆盖', item.oldDoc, item.newDoc);
        historyLinks.push({ docId: item.newDoc.id, recordId: historyRecord.id });
    });

    return {
        added: addCount,
        overwritten: overwriteCount,
        skipped: skipCount,
        restoredFromTrash: restoredFromTrash,
        historyLinks: historyLinks
    };
}

function restoreTemplates(overwrite) {
    const existing = getTemplates();
    const existingById = {};
    const existingByName = {};
    const indexById = {};
    existing.forEach(function(t, i) {
        if (t.id) { existingById[t.id] = t; indexById[t.id] = i; }
        if (t.name) existingByName[t.name] = t;
    });

    let addCount = 0, overwriteCount = 0, skipCount = 0;
    const finalTpls = existing.slice();
    const seenIds = {}, seenNames = {};

    restorePackage.data.templates.forEach(function(item) {
        let isDup = false;
        if (item.id && seenIds[item.id]) isDup = true;
        if (!isDup && item.name && seenNames[item.name]) isDup = true;
        if (item.id) seenIds[item.id] = true;
        if (item.name) seenNames[item.name] = true;
        if (isDup) { skipCount++; return; }

        let match = null;
        if (item.id && existingById[item.id]) match = existingById[item.id];
        else if (item.name && existingByName[item.name]) match = existingByName[item.name];

        if (!match) {
            finalTpls.unshift({ ...item, id: item.id || generateId() });
            addCount++;
        } else if (overwrite) {
            const idx = indexById[match.id];
            if (idx !== undefined) {
                finalTpls[idx] = { ...match, ...item, id: match.id };
                overwriteCount++;
            }
        } else {
            skipCount++;
        }
    });

    saveTemplates(finalTpls);
    return { added: addCount, overwritten: overwriteCount, skipped: skipCount };
}

function restoreAuditLogs(overwrite) {
    const existing = getAuditLogs();
    const existingById = {};
    const indexById = {};
    existing.forEach(function(log, i) {
        if (log.id) {
            existingById[log.id] = log;
            indexById[log.id] = i;
        }
    });

    let addCount = 0, overwriteCount = 0, skipCount = 0;
    const finalLogs = existing.slice();
    const seenIds = {};

    restorePackage.data.auditLogs.forEach(function(item) {
        if (item.id && seenIds[item.id]) { skipCount++; return; }
        if (item.id) seenIds[item.id] = true;

        if (!item.id || !existingById[item.id]) {
            finalLogs.push({ ...item, id: item.id || generateId() });
            addCount++;
        } else if (overwrite) {
            const idx = indexById[item.id];
            if (idx !== undefined) {
                finalLogs[idx] = { ...existingById[item.id], ...item, id: item.id };
            }
            overwriteCount++;
        } else {
            skipCount++;
        }
    });

    finalLogs.sort(function(a, b) {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
    if (finalLogs.length > 1000) finalLogs.length = 1000;

    saveAuditLogs(finalLogs);
    return { added: addCount, overwritten: overwriteCount, skipped: skipCount };
}

function restoreFlowRules(overwrite) {
    const existing = getFlowRules();
    if (!existing.updatedAt) {
        saveFlowRules(restorePackage.data.flowRules);
        return { added: 1, overwritten: 0, skipped: 0 };
    } else if (overwrite) {
        saveFlowRules(restorePackage.data.flowRules);
        return { added: 0, overwritten: 1, skipped: 0 };
    }
    return { added: 0, overwritten: 0, skipped: 1 };
}

function restoreViewPresets(overwrite) {
    const existing = getViewPresets();
    const existingById = {};
    const existingByName = {};
    const indexById = {};
    existing.forEach(function(v, i) {
        if (v.id) { existingById[v.id] = v; indexById[v.id] = i; }
        if (v.name) existingByName[v.name] = v;
    });

    let addCount = 0, overwriteCount = 0, skipCount = 0;
    const finalViews = existing.slice();
    const seenIds = {}, seenNames = {};

    restorePackage.data.viewPresets.forEach(function(item) {
        let isDup = false;
        if (item.id && seenIds[item.id]) isDup = true;
        if (!isDup && item.name && seenNames[item.name]) isDup = true;
        if (item.id) seenIds[item.id] = true;
        if (item.name) seenNames[item.name] = true;
        if (isDup) { skipCount++; return; }

        let match = null;
        if (item.id && existingById[item.id]) match = existingById[item.id];
        else if (item.name && existingByName[item.name]) match = existingByName[item.name];

        if (!match) {
            finalViews.push({ ...item, id: item.id || generateId() });
            addCount++;
        } else if (overwrite) {
            const idx = indexById[match.id];
            if (idx !== undefined) {
                finalViews[idx] = { ...match, ...item, id: match.id, updatedAt: new Date().toISOString() };
                overwriteCount++;
            }
        } else {
            skipCount++;
        }
    });

    saveViewPresets(finalViews);
    return { added: addCount, overwritten: overwriteCount, skipped: skipCount };
}

function refreshAllViews() {
    updateStats();
    renderDocumentList();
    renderTemplateSelect();
    renderAuditLogList();
    if (typeof renderDepartmentBoard === 'function') {
        renderDepartmentBoard();
    }
    if (typeof renderReminderCenter === 'function') {
        renderReminderCenter();
    }
    if (typeof renderRecycleBinList === 'function') {
        renderRecycleBinList();
    }
    if (typeof updateBatchToolbar === 'function') {
        updateBatchToolbar();
    }
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

    const oldDoc = { ...documents[docIndex] };
    documents[docIndex].reminderNote = note;
    documents[docIndex].reminderHistory.push({
        id: generateId(),
        type: 'note',
        note: note,
        createdAt: new Date().toISOString()
    });

    saveDocuments(documents);
    addChangeHistoryRecord(docId, AUDIT_ACTION.EDIT, '提醒备注变更', oldDoc, documents[docIndex], { type: 'note' });
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
    const extendHistoryRecord = addChangeHistoryRecord(docId, AUDIT_ACTION.EXTEND, null, oldDoc, doc, { extendDays: parseInt(days) });
    addAuditLog(AUDIT_ACTION.EXTEND, doc, oldDoc, {
        extendDays: parseInt(days),
        changeHistoryRecordId: extendHistoryRecord.id
    });
    updateStats();
    renderDocumentList();
    renderReminderCenter();
    return true;
}

function snoozeReminder(docId, snoozeDate) {
    const documents = loadAllDocuments();
    const docIndex = documents.findIndex(d => d.id === docId && !d.isDeleted);
    if (docIndex === -1) return false;

    const oldDoc = { ...documents[docIndex] };
    documents[docIndex].snoozeUntil = snoozeDate;
    documents[docIndex].reminderHistory.push({
        id: generateId(),
        type: 'snooze',
        snoozeUntil: snoozeDate,
        createdAt: new Date().toISOString()
    });

    saveDocuments(documents);
    addChangeHistoryRecord(docId, AUDIT_ACTION.EDIT, '设置暂不提醒', oldDoc, documents[docIndex], { type: 'snooze' });
    updateStats();
    renderDocumentList();
    renderReminderCenter();
    return true;
}

function cancelSnooze(docId) {
    const documents = loadAllDocuments();
    const docIndex = documents.findIndex(d => d.id === docId && !d.isDeleted);
    if (docIndex === -1) return false;

    const oldDoc = { ...documents[docIndex] };
    documents[docIndex].snoozeUntil = '';
    documents[docIndex].reminderHistory.push({
        id: generateId(),
        type: 'cancel_snooze',
        createdAt: new Date().toISOString()
    });

    saveDocuments(documents);
    addChangeHistoryRecord(docId, AUDIT_ACTION.EDIT, '取消暂不提醒', oldDoc, documents[docIndex], { type: 'cancel_snooze' });
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
    const supervisionCreateHistoryRecord = addChangeHistoryRecord(doc.id, AUDIT_ACTION.SUPERVISION_CREATE, null, oldDoc, doc, {
        supervisionId: supervisionRecord.id,
        reason: reason,
        supervisor: supervisor,
        feedbackDeadline: feedbackDeadline
    });
    addAuditLog(AUDIT_ACTION.SUPERVISION_CREATE, doc, oldDoc, {
        supervisionId: supervisionRecord.id,
        reason: reason,
        supervisor: supervisor,
        feedbackDeadline: feedbackDeadline,
        changeHistoryRecordId: supervisionCreateHistoryRecord.id
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
    const supervisionFeedbackHistoryRecord = addChangeHistoryRecord(doc.id, AUDIT_ACTION.SUPERVISION_FEEDBACK, null, oldDoc, doc, {
        supervisionId: supervisionId,
        reason: record.reason,
        supervisor: record.supervisor,
        feedbackDeadline: record.feedbackDeadline,
        result: result,
        feedbackAt: now
    });
    addAuditLog(AUDIT_ACTION.SUPERVISION_FEEDBACK, doc, oldDoc, {
        supervisionId: supervisionId,
        reason: record.reason,
        supervisor: record.supervisor,
        feedbackDeadline: record.feedbackDeadline,
        result: result,
        feedbackAt: now,
        changeHistoryRecordId: supervisionFeedbackHistoryRecord.id
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
        const canViewDetail = log.docId && log.action !== AUDIT_ACTION.PERMANENT_DELETE && log.action !== AUDIT_ACTION.BATCH_PERMANENT_DELETE && log.action !== AUDIT_ACTION.EMPTY_RECYCLE_BIN;

        return `
            <div class="audit-log-item">
                <div class="audit-log-icon">${icon}</div>
                <div class="audit-log-content">
                    <div class="audit-log-header">
                        <span class="audit-log-action">
                            ${escapeHtml(log.actionText)}${extraText}
                            ${canViewDetail ? '<span class="audit-log-view-detail" onclick="viewDocFromAuditLog(\'' + log.docId + '\', event, \'' + (log.extra && log.extra.changeHistoryRecordId ? log.extra.changeHistoryRecordId : '') + '\')">查看变更 →</span>' : ''}
                        </span>
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

function viewDocFromAuditLog(docId, event, changeRecordId) {
    if (event) {
        event.stopPropagation();
    }

    const allDocs = loadAllDocuments();
    const doc = allDocs.find(d => d.id === docId);
    if (!doc) {
        showToast('该收文不存在或已被彻底删除', 'warning');
        return;
    }

    if (changeRecordId) {
        changeHistoryScrollTargetId = changeRecordId;
    } else {
        shouldScrollToChangeHistorySection = true;
    }

    if (doc.isDeleted) {
        switchView('recycle_bin');
    } else {
        switchView('list');
    }

    setTimeout(function() {
        viewDocument(docId);
    }, 100);
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

        const batchFlowDropdown = document.querySelector('.batch-flow-dropdown');
        if (batchFlowDropdown && !batchFlowDropdown.contains(e.target)) {
            closeBatchFlowMenu();
        }
    });

    setupFileDragDrop();
    setupRestoreFileDragDrop();
    setupImportWizardEvents();

    migrateChangeHistory();

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
