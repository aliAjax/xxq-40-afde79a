(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DocUtils = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

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
        SUPERVISION: 'supervision',
        COMPLETE: 'complete'
    };

    const URGENCY_LIST = ['普通', '加急', '特急'];

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

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
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

    function getDeadlineDaysByUrgency(urgency, rules) {
        if (!rules) {
            rules = getDefaultFlowRules();
        }
        const days = rules.urgencyDeadlineDays[urgency];
        return days !== undefined ? days : 7;
    }

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

    function getDaysRemaining(deadline, today) {
        const deadlineDate = new Date(deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        const todayDate = today || getToday();
        const diffTime = deadlineDate - todayDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    function getDeadlineStatus(doc, today) {
        if (doc.flowStatus === FLOW_STATUS.DONE) {
            return 'normal';
        }
        const effectiveDeadline = getEffectiveDeadline(doc);
        const daysRemaining = getDaysRemaining(effectiveDeadline, today);
        if (daysRemaining < 0) {
            return 'overdue';
        }
        if (daysRemaining <= 3) {
            return 'urgent';
        }
        return 'normal';
    }

    function getDeadlineStatusText(status) {
        const statusMap = {
            'normal': '正常',
            'urgent': '即将到期',
            'overdue': '已逾期'
        };
        return statusMap[status] || '正常';
    }

    function getReminderGroup(doc, today) {
        const effectiveDeadline = getEffectiveDeadline(doc);
        const daysRemaining = getDaysRemaining(effectiveDeadline, today);
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

    function isReminderSnoozed(doc, today) {
        if (!doc.snoozeUntil) return false;
        const snoozeDate = new Date(doc.snoozeUntil);
        snoozeDate.setHours(0, 0, 0, 0);
        const todayDate = today || getToday();
        return todayDate <= snoozeDate;
    }

    function shouldShowInReminderCenter(doc, today) {
        if (doc.flowStatus === FLOW_STATUS.DONE) {
            return false;
        }
        if (isReminderSnoozed(doc, today)) {
            return false;
        }
        const effectiveDeadline = getEffectiveDeadline(doc);
        const daysRemaining = getDaysRemaining(effectiveDeadline, today);
        return daysRemaining <= 3;
    }

    function filterDocuments(documents, tab, keyword, filter, today) {
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
                const deadlineStatus = getDeadlineStatus(doc, today);
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

        if (filter && filter.department) {
            filtered = filtered.filter(doc => {
                const dept = doc.undertakingDepartment || doc.department || '';
                return dept === filter.department;
            });
        }

        if (filter && filter.urgency) {
            filtered = filtered.filter(doc => doc.urgency === filter.urgency);
        }

        if (filter && filter.receiveDateStart) {
            filtered = filtered.filter(doc => doc.receiveDate >= filter.receiveDateStart);
        }

        if (filter && filter.receiveDateEnd) {
            filtered = filtered.filter(doc => doc.receiveDate <= filter.receiveDateEnd);
        }

        if (filter && filter.deadlineStart) {
            filtered = filtered.filter(doc => getEffectiveDeadline(doc) >= filter.deadlineStart);
        }

        if (filter && filter.deadlineEnd) {
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

    function hasAdvancedFilter(filter) {
        if (!filter) return false;
        return !!(filter.department ||
            filter.urgency ||
            filter.receiveDateStart ||
            filter.receiveDateEnd ||
            filter.deadlineStart ||
            filter.deadlineEnd);
    }

    function getDocumentStats(documents, today) {
        const stats = {
            total: documents.length,
            pendingReview: 0,
            processing: 0,
            pendingFeedback: 0,
            done: 0,
            urgent: 0,
            overdue: 0
        };

        documents.forEach(doc => {
            switch (doc.flowStatus) {
                case FLOW_STATUS.PENDING_REVIEW:
                    stats.pendingReview++;
                    break;
                case FLOW_STATUS.PROCESSING:
                    stats.processing++;
                    break;
                case FLOW_STATUS.PENDING_FEEDBACK:
                    stats.pendingFeedback++;
                    break;
                case FLOW_STATUS.DONE:
                    stats.done++;
                    break;
            }

            const deadlineStatus = getDeadlineStatus(doc, today);
            if (deadlineStatus === 'urgent') {
                stats.urgent++;
            } else if (deadlineStatus === 'overdue') {
                stats.overdue++;
            }
        });

        return stats;
    }

    function getDocumentStatus(doc) {
        return doc.flowStatus || FLOW_STATUS.PENDING_REVIEW;
    }

    function hasProposeFlowRecord(doc) {
        return Array.isArray(doc.flowRecords) && doc.flowRecords.some(function(record) {
            return record.action === FLOW_ACTION.PROPOSE;
        });
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

    function get7DaysAgo(today) {
        const date = today ? new Date(today) : new Date();
        date.setDate(date.getDate() - 7);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function getDocProcessingDays(doc, today) {
        const receiveDate = new Date(doc.receiveDate);
        receiveDate.setHours(0, 0, 0, 0);
        let endDate;
        if (doc.flowStatus === FLOW_STATUS.DONE && doc.completedAt) {
            endDate = new Date(doc.completedAt);
        } else {
            endDate = today ? new Date(today) : new Date();
        }
        endDate.setHours(0, 0, 0, 0);
        const diffTime = endDate - receiveDate;
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        return diffDays;
    }

    function isHighRiskDoc(doc, today) {
        const deadlineStatus = getDeadlineStatus(doc, today);
        const hasPendingSup = hasPendingSupervision(doc);
        if (hasPendingSup) return true;
        if (deadlineStatus === 'overdue' && doc.urgency === '特急') return true;
        return false;
    }

    function calcDepartmentStats(documents, departmentNames, today) {
        const stats = {};
        const sevenDaysAgo = get7DaysAgo(today);

        const deptNames = departmentNames || [];
        deptNames.forEach(function(dept) {
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

        documents.forEach(function(doc) {
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
            const deadlineStatus = getDeadlineStatus(doc, today);

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

            if (isHighRiskDoc(doc, today)) {
                stats[dept].highRiskCount++;
            }

            if (doc.receiveDate) {
                const days = getDocProcessingDays(doc, today);
                stats[dept]._processingDaysTotal += days;
                stats[dept]._processingDaysCount++;
            }
        });

        Object.keys(stats).forEach(function(dept) {
            const s = stats[dept];
            s.overdueRate = s.total > 0 ? Math.round(s.overdue / s.total * 100) : 0;
            s.avgProcessingDays = s._processingDaysCount > 0 ? Math.round(s._processingDaysTotal / s._processingDaysCount * 10) / 10 : 0;
            delete s._processingDaysTotal;
            delete s._processingDaysCount;
        });

        return stats;
    }

    function applyBoardDrillFilters(docs, drillContext, today) {
        if (!drillContext) return docs;

        let filtered = docs.slice();

        if (drillContext.overdueOnly) {
            filtered = filtered.filter(function(doc) {
                const deadlineStatus = getDeadlineStatus(doc, today);
                return deadlineStatus === 'overdue';
            });
        }

        if (drillContext.recent7DaysOnly) {
            const sevenDaysAgo = get7DaysAgo(today);
            filtered = filtered.filter(function(doc) {
                const createdAt = new Date(doc.createdAt || doc.receiveDate);
                return createdAt >= sevenDaysAgo;
            });
        }

        if (drillContext.highRiskOnly) {
            filtered = filtered.filter(function(doc) {
                return isHighRiskDoc(doc, today);
            });
        }

        return filtered;
    }

    function applyBoardDrillSorting(docs, drillContext) {
        if (!drillContext || !drillContext.sortByProcessingDays) return docs;

        const sorted = docs.slice().sort(function(a, b) {
            const daysA = getDocProcessingDays(a);
            const daysB = getDocProcessingDays(b);
            return daysB - daysA;
        });

        return sorted;
    }

    function canCompleteFromStatus(status, rules) {
        const flowRules = rules || getDefaultFlowRules();
        return flowRules.completableStatuses.includes(status);
    }

    function getAvailableFlowActions(doc, rules) {
        const status = doc.flowStatus;
        const actions = [];
        const flowRules = rules || getDefaultFlowRules();
        const requirePropose = flowRules.requireProposeBeforeAssign;
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

        if (canCompleteFromStatus(status, flowRules)) {
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

    function canPerformBatchFlowAction(doc, action, rules) {
        if (!doc || doc.isDeleted) return { valid: false, reason: '收文不存在或已删除' };

        const status = doc.flowStatus;
        const flowRules = rules || getDefaultFlowRules();
        const requirePropose = flowRules.requireProposeBeforeAssign;
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

    function validateBatchFlowDocuments(docs, action, rules) {
        const valid = [];
        const skipped = [];

        docs.forEach(function(doc) {
            const result = canPerformBatchFlowAction(doc, action, rules);
            if (result.valid) {
                valid.push(doc);
            } else {
                skipped.push({ doc: doc, reason: result.reason });
            }
        });

        return { valid: valid, skipped: skipped };
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

        return changes;
    }

    return {
        FLOW_STATUS,
        FLOW_STATUS_TEXT,
        FLOW_ACTION,
        URGENCY_LIST,
        SUPERVISION_STATUS,
        SUPERVISION_STATUS_TEXT,
        BATCH_FLOW_ACTION,
        BATCH_FLOW_ACTION_TEXT,
        BATCH_FLOW_ACTION_ICON,
        generateId,
        getDefaultFlowRules,
        getDeadlineDaysByUrgency,
        migrateDocument,
        getToday,
        getEffectiveDeadline,
        getDaysRemaining,
        getDeadlineStatus,
        getDeadlineStatusText,
        getReminderGroup,
        isReminderSnoozed,
        shouldShowInReminderCenter,
        filterDocuments,
        hasAdvancedFilter,
        getDocumentStats,
        getDocumentStatus,
        hasProposeFlowRecord,
        hasPendingSupervision,
        getLatestSupervision,
        get7DaysAgo,
        getDocProcessingDays,
        isHighRiskDoc,
        calcDepartmentStats,
        applyBoardDrillFilters,
        applyBoardDrillSorting,
        canCompleteFromStatus,
        getAvailableFlowActions,
        canPerformBatchFlowAction,
        validateBatchFlowDocuments,
        getFlowRulesChangesSummary
    };
}));
