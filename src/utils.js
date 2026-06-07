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

    return {
        FLOW_STATUS,
        FLOW_STATUS_TEXT,
        FLOW_ACTION,
        URGENCY_LIST,
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
        getDocumentStats
    };
}));
