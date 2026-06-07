const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DocUtils = require('../src/utils.js');

const {
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
} = DocUtils;

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        failures.push({ name, error: e });
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
    }
}

function deepEqual(actual, expected, message) {
    assert.deepStrictEqual(actual, expected, message);
}

function equal(actual, expected, message) {
    assert.strictEqual(actual, expected, message);
}

function ok(value, message) {
    assert.ok(value, message);
}

console.log('\n========== 收文管理系统 - 轻量测试 ==========\n');

console.log('1. 常量与基础工具');
test('FLOW_STATUS 常量定义正确', () => {
    equal(FLOW_STATUS.PENDING_REVIEW, 'pending_review');
    equal(FLOW_STATUS.PROCESSING, 'processing');
    equal(FLOW_STATUS.PENDING_FEEDBACK, 'pending_feedback');
    equal(FLOW_STATUS.DONE, 'done');
});

test('URGENCY_LIST 包含三个紧急程度', () => {
    deepEqual(URGENCY_LIST, ['普通', '加急', '特急']);
});

test('generateId 生成非空字符串', () => {
    const id1 = generateId();
    const id2 = generateId();
    ok(typeof id1 === 'string' && id1.length > 0, 'ID 应为非空字符串');
    ok(id1 !== id2, '两次调用应生成不同 ID');
});

console.log('\n2. 流程规则与期限计算');
test('getDefaultFlowRules 返回默认规则', () => {
    const rules = getDefaultFlowRules();
    equal(rules.urgencyDeadlineDays['普通'], 7);
    equal(rules.urgencyDeadlineDays['加急'], 3);
    equal(rules.urgencyDeadlineDays['特急'], 1);
    equal(rules.requireProposeBeforeAssign, false);
    deepEqual(rules.completableStatuses, [FLOW_STATUS.PENDING_FEEDBACK]);
});

test('getDeadlineDaysByUrgency - 普通为 7 天', () => {
    equal(getDeadlineDaysByUrgency('普通'), 7);
});

test('getDeadlineDaysByUrgency - 加急为 3 天', () => {
    equal(getDeadlineDaysByUrgency('加急'), 3);
});

test('getDeadlineDaysByUrgency - 特急为 1 天', () => {
    equal(getDeadlineDaysByUrgency('特急'), 1);
});

test('getDeadlineDaysByUrgency - 未知紧急程度默认 7 天', () => {
    equal(getDeadlineDaysByUrgency('未知'), 7);
});

test('getDeadlineDaysByUrgency - 支持自定义规则', () => {
    const customRules = {
        urgencyDeadlineDays: { '普通': 10, '加急': 5, '特急': 2 }
    };
    equal(getDeadlineDaysByUrgency('普通', customRules), 10);
    equal(getDeadlineDaysByUrgency('加急', customRules), 5);
    equal(getDeadlineDaysByUrgency('特急', customRules), 2);
});

console.log('\n3. 收文迁移 (migrateDocument)');
test('迁移无 flowStatus 的未完成文档 - 默认设为 PROCESSING', () => {
    const doc = { title: '测试收文', completed: false };
    const migrated = migrateDocument(doc);
    equal(migrated.flowStatus, FLOW_STATUS.PROCESSING);
    equal(migrated.completed, false);
});

test('迁移无 flowStatus 的已完成文档 - 设为 DONE', () => {
    const doc = { title: '测试收文', completed: true };
    const migrated = migrateDocument(doc);
    equal(migrated.flowStatus, FLOW_STATUS.DONE);
    equal(migrated.completed, true);
});

test('迁移 flowStatus=DONE 但 completed=false 的文档 - 自动设为 true', () => {
    const doc = { title: '测试', flowStatus: FLOW_STATUS.DONE, completed: false };
    const migrated = migrateDocument(doc);
    equal(migrated.completed, true);
    equal(migrated.flowStatus, FLOW_STATUS.DONE);
});

test('迁移 completed=true 但 flowStatus 不是 DONE 的文档 - 自动设为 DONE', () => {
    const doc = { title: '测试', flowStatus: FLOW_STATUS.PROCESSING, completed: true };
    const migrated = migrateDocument(doc);
    equal(migrated.flowStatus, FLOW_STATUS.DONE);
    equal(migrated.completed, true);
});

test('迁移文档 - 自动填充 proposedDepartment 默认值', () => {
    const doc = { title: '测试' };
    const migrated = migrateDocument(doc);
    equal(migrated.proposedDepartment, '');
});

test('迁移文档 - undertakingDepartment 默认取 department', () => {
    const doc = { title: '测试', department: '办公室' };
    const migrated = migrateDocument(doc);
    equal(migrated.undertakingDepartment, '办公室');
});

test('迁移文档 - 已有 undertakingDepartment 时不覆盖', () => {
    const doc = { title: '测试', department: '办公室', undertakingDepartment: '业务一科' };
    const migrated = migrateDocument(doc);
    equal(migrated.undertakingDepartment, '业务一科');
});

test('迁移文档 - 自动初始化 coDepartments 为空数组', () => {
    const doc = { title: '测试' };
    const migrated = migrateDocument(doc);
    deepEqual(migrated.coDepartments, []);
});

test('迁移文档 - 自动创建 flowRecords（未完成状态）', () => {
    const doc = { title: '测试', flowStatus: FLOW_STATUS.PROCESSING };
    const migrated = migrateDocument(doc);
    ok(Array.isArray(migrated.flowRecords), 'flowRecords 应为数组');
    equal(migrated.flowRecords.length, 1);
    equal(migrated.flowRecords[0].action, FLOW_ACTION.CREATE);
    equal(migrated.flowRecords[0].toStatus, FLOW_STATUS.PROCESSING);
});

test('迁移文档 - 自动创建 flowRecords（已完成状态）', () => {
    const doc = { title: '测试', flowStatus: FLOW_STATUS.DONE, completed: true };
    const migrated = migrateDocument(doc);
    equal(migrated.flowRecords.length, 2);
    equal(migrated.flowRecords[0].action, FLOW_ACTION.CREATE);
    equal(migrated.flowRecords[1].action, FLOW_ACTION.COMPLETE);
    equal(migrated.flowRecords[1].toStatus, FLOW_STATUS.DONE);
});

test('迁移文档 - 已有 flowRecords 时不重建', () => {
    const existingRecords = [{ id: 'test_id', action: 'create' }];
    const doc = { title: '测试', flowRecords: existingRecords };
    const migrated = migrateDocument(doc);
    equal(migrated.flowRecords.length, 1);
    equal(migrated.flowRecords[0].id, 'test_id');
});

test('迁移文档 - 初始化提醒相关字段', () => {
    const doc = { title: '测试' };
    const migrated = migrateDocument(doc);
    equal(migrated.reminderNote, '');
    equal(migrated.snoozeUntil, '');
    equal(migrated.extendedDeadline, '');
    deepEqual(migrated.reminderHistory, []);
});

test('迁移文档 - 初始化删除标记', () => {
    const doc = { title: '测试' };
    const migrated = migrateDocument(doc);
    equal(migrated.isDeleted, false);
    equal(migrated.deletedAt, null);
});

test('迁移文档 - 初始化督办记录', () => {
    const doc = { title: '测试' };
    const migrated = migrateDocument(doc);
    deepEqual(migrated.supervisionRecords, []);
});

test('迁移文档 - 不修改原始对象', () => {
    const doc = { title: '测试' };
    const migrated = migrateDocument(doc);
    ok(migrated !== doc, '应返回新对象');
    equal(doc.flowStatus, undefined);
});

console.log('\n4. 期限与到期/逾期判断');
const today = new Date('2025-01-15');
today.setHours(0, 0, 0, 0);

test('getEffectiveDeadline - 使用 deadline', () => {
    const doc = { deadline: '2025-01-20', extendedDeadline: '' };
    equal(getEffectiveDeadline(doc), '2025-01-20');
});

test('getEffectiveDeadline - 有延期时优先用 extendedDeadline', () => {
    const doc = { deadline: '2025-01-20', extendedDeadline: '2025-01-25' };
    equal(getEffectiveDeadline(doc), '2025-01-25');
});

test('getDaysRemaining - 未来日期返回正数', () => {
    equal(getDaysRemaining('2025-01-20', today), 5);
});

test('getDaysRemaining - 今天返回 0', () => {
    equal(getDaysRemaining('2025-01-15', today), 0);
});

test('getDaysRemaining - 过去日期返回负数', () => {
    equal(getDaysRemaining('2025-01-10', today), -5);
});

test('getDeadlineStatus - 已办结文档始终为 normal', () => {
    const doc = { flowStatus: FLOW_STATUS.DONE, deadline: '2020-01-01' };
    equal(getDeadlineStatus(doc, today), 'normal');
});

test('getDeadlineStatus - 剩余 5 天为 normal', () => {
    const doc = { flowStatus: FLOW_STATUS.PROCESSING, deadline: '2025-01-20' };
    equal(getDeadlineStatus(doc, today), 'normal');
});

test('getDeadlineStatus - 剩余 3 天为 urgent', () => {
    const doc = { flowStatus: FLOW_STATUS.PROCESSING, deadline: '2025-01-18' };
    equal(getDeadlineStatus(doc, today), 'urgent');
});

test('getDeadlineStatus - 剩余 0 天（今天到期）为 urgent', () => {
    const doc = { flowStatus: FLOW_STATUS.PROCESSING, deadline: '2025-01-15' };
    equal(getDeadlineStatus(doc, today), 'urgent');
});

test('getDeadlineStatus - 逾期为 overdue', () => {
    const doc = { flowStatus: FLOW_STATUS.PROCESSING, deadline: '2025-01-10' };
    equal(getDeadlineStatus(doc, today), 'overdue');
});

test('getDeadlineStatus - 考虑延期期限', () => {
    const doc = {
        flowStatus: FLOW_STATUS.PROCESSING,
        deadline: '2025-01-10',
        extendedDeadline: '2025-01-20'
    };
    equal(getDeadlineStatus(doc, today), 'normal');
});

test('getDeadlineStatusText - 各状态文本正确', () => {
    equal(getDeadlineStatusText('normal'), '正常');
    equal(getDeadlineStatusText('urgent'), '即将到期');
    equal(getDeadlineStatusText('overdue'), '已逾期');
    equal(getDeadlineStatusText('unknown'), '正常');
});

test('getReminderGroup - 逾期', () => {
    const doc = { deadline: '2025-01-10' };
    equal(getReminderGroup(doc, today), 'overdue');
});

test('getReminderGroup - 今天到期', () => {
    const doc = { deadline: '2025-01-15' };
    equal(getReminderGroup(doc, today), 'today');
});

test('getReminderGroup - 3天内到期', () => {
    const doc = { deadline: '2025-01-18' };
    equal(getReminderGroup(doc, today), 'soon');
});

test('getReminderGroup - 正常', () => {
    const doc = { deadline: '2025-01-25' };
    equal(getReminderGroup(doc, today), 'normal');
});

test('isReminderSnoozed - 无 snoozeUntil 返回 false', () => {
    equal(isReminderSnoozed({}, today), false);
});

test('isReminderSnoozed -  snooze 在未来返回 true', () => {
    equal(isReminderSnoozed({ snoozeUntil: '2025-01-20' }, today), true);
});

test('isReminderSnoozed - snooze 在过去返回 false', () => {
    equal(isReminderSnoozed({ snoozeUntil: '2025-01-10' }, today), false);
});

test('shouldShowInReminderCenter - 已办结不显示', () => {
    const doc = { flowStatus: FLOW_STATUS.DONE, deadline: '2025-01-10' };
    equal(shouldShowInReminderCenter(doc, today), false);
});

test('shouldShowInReminderCenter - 已暂停不显示', () => {
    const doc = {
        flowStatus: FLOW_STATUS.PROCESSING,
        deadline: '2025-01-10',
        snoozeUntil: '2025-01-20'
    };
    equal(shouldShowInReminderCenter(doc, today), false);
});

test('shouldShowInReminderCenter - 3天内到期显示', () => {
    const doc = { flowStatus: FLOW_STATUS.PROCESSING, deadline: '2025-01-18' };
    equal(shouldShowInReminderCenter(doc, today), true);
});

test('shouldShowInReminderCenter - 超过3天不显示', () => {
    const doc = { flowStatus: FLOW_STATUS.PROCESSING, deadline: '2025-01-25' };
    equal(shouldShowInReminderCenter(doc, today), false);
});

console.log('\n5. 筛选功能');

function makeDoc(overrides) {
    return {
        id: generateId(),
        title: '测试收文',
        docNumber: 'SW-001',
        fromUnit: '测试单位',
        department: '办公室',
        undertakingDepartment: '办公室',
        flowStatus: FLOW_STATUS.PROCESSING,
        urgency: '普通',
        receiveDate: '2025-01-10',
        deadline: '2025-01-20',
        ...overrides
    };
}

test('filterDocuments - 按 tab 筛选 pending_review', () => {
    const docs = [
        makeDoc({ flowStatus: FLOW_STATUS.PENDING_REVIEW, title: '待拟办' }),
        makeDoc({ flowStatus: FLOW_STATUS.PROCESSING, title: '办理中' })
    ];
    const filtered = filterDocuments(docs, 'pending_review', '', {});
    equal(filtered.length, 1);
    equal(filtered[0].title, '待拟办');
});

test('filterDocuments - 按 tab 筛选 done', () => {
    const docs = [
        makeDoc({ flowStatus: FLOW_STATUS.DONE, title: '已办结' }),
        makeDoc({ flowStatus: FLOW_STATUS.PROCESSING, title: '办理中' })
    ];
    const filtered = filterDocuments(docs, 'done', '', {});
    equal(filtered.length, 1);
    equal(filtered[0].title, '已办结');
});

test('filterDocuments - 按 tab 筛选 urgent（含逾期）', () => {
    const docs = [
        makeDoc({ title: '逾期', deadline: '2025-01-10', flowStatus: FLOW_STATUS.PROCESSING }),
        makeDoc({ title: '即将到期', deadline: '2025-01-17', flowStatus: FLOW_STATUS.PROCESSING }),
        makeDoc({ title: '正常', deadline: '2025-01-30', flowStatus: FLOW_STATUS.PROCESSING })
    ];
    const filtered = filterDocuments(docs, 'urgent', '', {}, today);
    equal(filtered.length, 2);
});

test('filterDocuments - 按关键词搜索标题', () => {
    const docs = [
        makeDoc({ title: '关于开展调研的通知' }),
        makeDoc({ title: '工作总结报告' })
    ];
    const filtered = filterDocuments(docs, 'all', '调研', {});
    equal(filtered.length, 1);
    equal(filtered[0].title, '关于开展调研的通知');
});

test('filterDocuments - 按科室筛选', () => {
    const docs = [
        makeDoc({ undertakingDepartment: '办公室', title: '办公室的' }),
        makeDoc({ undertakingDepartment: '业务一科', title: '业务一科的' })
    ];
    const filtered = filterDocuments(docs, 'all', '', { department: '业务一科' });
    equal(filtered.length, 1);
    equal(filtered[0].title, '业务一科的');
});

test('filterDocuments - 按紧急程度筛选', () => {
    const docs = [
        makeDoc({ urgency: '普通', title: '普通件' }),
        makeDoc({ urgency: '特急', title: '特急件' })
    ];
    const filtered = filterDocuments(docs, 'all', '', { urgency: '特急' });
    equal(filtered.length, 1);
    equal(filtered[0].title, '特急件');
});

test('filterDocuments - 按收文日期范围筛选', () => {
    const docs = [
        makeDoc({ receiveDate: '2025-01-10', title: '10号' }),
        makeDoc({ receiveDate: '2025-01-15', title: '15号' }),
        makeDoc({ receiveDate: '2025-01-20', title: '20号' })
    ];
    const filtered = filterDocuments(docs, 'all', '', {
        receiveDateStart: '2025-01-12',
        receiveDateEnd: '2025-01-18'
    });
    equal(filtered.length, 1);
    equal(filtered[0].title, '15号');
});

test('filterDocuments - 按期限日期范围筛选', () => {
    const docs = [
        makeDoc({ deadline: '2025-01-10', title: '10号截止' }),
        makeDoc({ deadline: '2025-01-15', title: '15号截止' }),
        makeDoc({ deadline: '2025-01-20', title: '20号截止' })
    ];
    const filtered = filterDocuments(docs, 'all', '', {
        deadlineStart: '2025-01-12',
        deadlineEnd: '2025-01-18'
    });
    equal(filtered.length, 1);
    equal(filtered[0].title, '15号截止');
});

test('filterDocuments - 结果按状态和收文日期排序', () => {
    const docs = [
        makeDoc({ flowStatus: FLOW_STATUS.DONE, receiveDate: '2025-01-20', title: '已办结新' }),
        makeDoc({ flowStatus: FLOW_STATUS.PENDING_REVIEW, receiveDate: '2025-01-10', title: '待拟办旧' }),
        makeDoc({ flowStatus: FLOW_STATUS.PROCESSING, receiveDate: '2025-01-15', title: '办理中' })
    ];
    const filtered = filterDocuments(docs, 'all', '', {});
    equal(filtered.length, 3);
    equal(filtered[0].flowStatus, FLOW_STATUS.PENDING_REVIEW);
    equal(filtered[1].flowStatus, FLOW_STATUS.PROCESSING);
    equal(filtered[2].flowStatus, FLOW_STATUS.DONE);
});

test('hasAdvancedFilter - 空过滤器返回 false', () => {
    equal(hasAdvancedFilter({}), false);
});

test('hasAdvancedFilter - 有科室筛选返回 true', () => {
    equal(hasAdvancedFilter({ department: '办公室' }), true);
});

test('hasAdvancedFilter - null 返回 false', () => {
    equal(hasAdvancedFilter(null), false);
});

console.log('\n6. 统计功能');
test('getDocumentStats - 统计各状态数量', () => {
    const docs = [
        makeDoc({ flowStatus: FLOW_STATUS.PENDING_REVIEW }),
        makeDoc({ flowStatus: FLOW_STATUS.PROCESSING }),
        makeDoc({ flowStatus: FLOW_STATUS.PROCESSING }),
        makeDoc({ flowStatus: FLOW_STATUS.PENDING_FEEDBACK }),
        makeDoc({ flowStatus: FLOW_STATUS.DONE })
    ];
    const stats = getDocumentStats(docs);
    equal(stats.total, 5);
    equal(stats.pendingReview, 1);
    equal(stats.processing, 2);
    equal(stats.pendingFeedback, 1);
    equal(stats.done, 1);
});

test('getDocumentStats - 空数组返回全零', () => {
    const stats = getDocumentStats([]);
    equal(stats.total, 0);
    equal(stats.pendingReview, 0);
    equal(stats.processing, 0);
    equal(stats.pendingFeedback, 0);
    equal(stats.done, 0);
    equal(stats.urgent, 0);
    equal(stats.overdue, 0);
});

console.log('\n7. localStorage 模拟（导入后保存）');

function createMockLocalStorage() {
    const store = {};
    return {
        getItem: function(key) {
            return store[key] || null;
        },
        setItem: function(key, value) {
            store[key] = String(value);
        },
        removeItem: function(key) {
            delete store[key];
        },
        clear: function() {
            Object.keys(store).forEach(function(k) { delete store[k]; });
        },
        _getStore: function() {
            return { ...store };
        }
    };
}

const STORAGE_KEY = 'document_registry_data';

function saveDocuments(localStorage, documents) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
}

function loadDocuments(localStorage) {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

test('localStorage - 保存和读取文档', () => {
    const mockStorage = createMockLocalStorage();
    const docs = [makeDoc({ title: '测试文档1' }), makeDoc({ title: '测试文档2' })];
    saveDocuments(mockStorage, docs);
    const loaded = loadDocuments(mockStorage);
    equal(loaded.length, 2);
    equal(loaded[0].title, '测试文档1');
});

test('localStorage - 读取空数据返回空数组', () => {
    const mockStorage = createMockLocalStorage();
    const loaded = loadDocuments(mockStorage);
    deepEqual(loaded, []);
});

test('localStorage - 读取损坏数据返回空数组', () => {
    const mockStorage = createMockLocalStorage();
    mockStorage.setItem(STORAGE_KEY, '{invalid json}');
    const loaded = loadDocuments(mockStorage);
    deepEqual(loaded, []);
});

test('导入后保存 - 迁移后再保存', () => {
    const mockStorage = createMockLocalStorage();
    const oldDocs = [
        { title: '旧格式文档', completed: true }
    ];
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(oldDocs));

    const loaded = JSON.parse(mockStorage.getItem(STORAGE_KEY));
    const migrated = loaded.map(function(doc) {
        return migrateDocument(doc);
    });
    saveDocuments(mockStorage, migrated);

    const reloaded = JSON.parse(mockStorage.getItem(STORAGE_KEY));
    equal(reloaded.length, 1);
    equal(reloaded[0].flowStatus, FLOW_STATUS.DONE);
    ok(Array.isArray(reloaded[0].flowRecords), '迁移后应有 flowRecords');
});

test('导入后保存 - 批量导入数据验证持久化', () => {
    const mockStorage = createMockLocalStorage();
    const importData = [];
    for (let i = 0; i < 10; i++) {
        importData.push(makeDoc({ title: `导入文档${i}`, docNumber: `IMP-${i}` }));
    }
    saveDocuments(mockStorage, importData);

    const saved = JSON.parse(mockStorage.getItem(STORAGE_KEY));
    equal(saved.length, 10);
    equal(saved[0].docNumber, 'IMP-0');
    equal(saved[9].docNumber, 'IMP-9');
});

console.log('\n8. 幂等性与边界情况');
test('migrateDocument - 两次迁移结果一致（幂等）', () => {
    const doc = { title: '测试', completed: true };
    const m1 = migrateDocument(doc);
    const m2 = migrateDocument(m1);
    equal(m2.flowStatus, m1.flowStatus);
    equal(m2.flowRecords.length, m1.flowRecords.length);
});

test('filterDocuments - 空数组返回空数组', () => {
    const filtered = filterDocuments([], 'all', '', {});
    deepEqual(filtered, []);
});

test('filterDocuments - 无筛选条件返回全部', () => {
    const docs = [makeDoc(), makeDoc(), makeDoc()];
    const filtered = filterDocuments(docs, 'all', '', {});
    equal(filtered.length, 3);
});

test('getDeadlineDaysByUrgency - 不传规则时使用默认值', () => {
    equal(getDeadlineDaysByUrgency('普通'), 7);
    equal(getDeadlineDaysByUrgency('加急'), 3);
});

console.log('\n9. 生产级筛选统计集成测试');

const DEPARTMENTS = ['办公室', '综合科', '业务一科', '业务二科', '法制科', '财务科', '人事科', '信息科'];

function buildProductionDataset() {
    const docs = [];
    const baseDate = new Date('2025-01-15');
    baseDate.setHours(0, 0, 0, 0);
    let idCounter = 1;

    for (let i = 0; i < 120; i++) {
        const dept = DEPARTMENTS[i % DEPARTMENTS.length];
        const urgency = ['普通', '普通', '普通', '加急', '加急', '特急'][i % 6];
        const statuses = [
            FLOW_STATUS.PENDING_REVIEW,
            FLOW_STATUS.PROCESSING,
            FLOW_STATUS.PROCESSING,
            FLOW_STATUS.PROCESSING,
            FLOW_STATUS.PENDING_FEEDBACK,
            FLOW_STATUS.DONE
        ];
        const flowStatus = statuses[i % statuses.length];

        const receiveDate = new Date(baseDate);
        receiveDate.setDate(receiveDate.getDate() - (i % 30));
        const receiveDateStr = formatDateInput(receiveDate);

        const days = getDeadlineDaysByUrgency(urgency);
        const deadlineDate = new Date(receiveDate);
        deadlineDate.setDate(deadlineDate.getDate() + days + (i % 10) - 5);
        const deadlineStr = formatDateInput(deadlineDate);

        docs.push({
            id: 'doc_' + String(idCounter++).padStart(4, '0'),
            title: `第${i + 1}号收文 - ${dept}`,
            docNumber: `SW-2025-${String(i + 1).padStart(4, '0')}`,
            fromUnit: ['市政府', '市委办', '发改委', '教育局', '公安局'][i % 5],
            department: dept,
            undertakingDepartment: dept,
            flowStatus: flowStatus,
            urgency: urgency,
            receiveDate: receiveDateStr,
            deadline: deadlineStr,
            extendedDeadline: '',
            isDeleted: false,
            flowRecords: [{ id: 'r_' + i, action: 'create' }],
            createdAt: receiveDate.toISOString()
        });
    }

    return docs;
}

function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const prodDocs = buildProductionDataset();

test('生产级 - 数据集共 120 条，分布均衡', () => {
    equal(prodDocs.length, 120);
    const stats = getDocumentStats(prodDocs, today);
    equal(stats.total, 120);
    ok(stats.pendingReview > 0, '有待拟办');
    ok(stats.processing > 0, '有办理中');
    ok(stats.pendingFeedback > 0, '有待反馈');
    ok(stats.done > 0, '有已办结');
});

test('生产级 - 按 tab 筛选各状态数量正确', () => {
    const pending = filterDocuments(prodDocs, 'pending_review', '', {});
    const processing = filterDocuments(prodDocs, 'processing', '', {});
    const feedback = filterDocuments(prodDocs, 'pending_feedback', '', {});
    const done = filterDocuments(prodDocs, 'done', '', {});

    const stats = getDocumentStats(prodDocs, today);
    equal(pending.length, stats.pendingReview);
    equal(processing.length, stats.processing);
    equal(feedback.length, stats.pendingFeedback);
    equal(done.length, stats.done);
    equal(pending.length + processing.length + feedback.length + done.length, 120);
});

test('生产级 - 多条件组合筛选：科室+紧急程度+关键词', () => {
    const filter = {
        department: '业务一科',
        urgency: '加急'
    };
    const filtered = filterDocuments(prodDocs, 'all', 'SW-2025', filter);
    ok(filtered.length > 0, '应有匹配结果');

    filtered.forEach(doc => {
        equal(doc.undertakingDepartment, '业务一科');
        equal(doc.urgency, '加急');
        ok(doc.docNumber.includes('SW-2025'));
    });
});

test('生产级 - 日期范围筛选：收文日期 + 期限日期', () => {
    const filter = {
        receiveDateStart: '2025-01-01',
        receiveDateEnd: '2025-01-15',
        deadlineStart: '2025-01-05',
        deadlineEnd: '2025-01-25'
    };
    const filtered = filterDocuments(prodDocs, 'all', '', filter);
    ok(filtered.length > 0, '应有匹配结果');

    filtered.forEach(doc => {
        ok(doc.receiveDate >= '2025-01-01');
        ok(doc.receiveDate <= '2025-01-15');
        ok(getEffectiveDeadline(doc) >= '2025-01-05');
        ok(getEffectiveDeadline(doc) <= '2025-01-25');
    });
});

test('生产级 - urgent tab 包含即将到期 + 逾期', () => {
    const urgentDocs = filterDocuments(prodDocs, 'urgent', '', {}, today);
    const stats = getDocumentStats(prodDocs, today);
    equal(urgentDocs.length, stats.urgent + stats.overdue);

    urgentDocs.forEach(doc => {
        const s = getDeadlineStatus(doc, today);
        ok(s === 'urgent' || s === 'overdue', '状态应为 urgent 或 overdue');
    });
});

test('生产级 - 排序验证：先按状态再按收文日期倒序', () => {
    const filtered = filterDocuments(prodDocs, 'all', '', {});
    equal(filtered.length, 120);

    for (let i = 1; i < filtered.length; i++) {
        const order = { pending_review: 0, processing: 1, pending_feedback: 2, done: 3 };
        const prev = filtered[i - 1];
        const curr = filtered[i];
        const prevOrder = order[prev.flowStatus] !== undefined ? order[prev.flowStatus] : 0;
        const currOrder = order[curr.flowStatus] !== undefined ? order[curr.flowStatus] : 0;

        if (prevOrder !== currOrder) {
            ok(prevOrder < currOrder, '状态升序排列');
        } else {
            ok(prev.receiveDate >= curr.receiveDate, '同状态下收文日期倒序');
        }
    }
});

test('生产级 - 空筛选结果不报错', () => {
    const filter = { department: '不存在的科室' };
    const filtered = filterDocuments(prodDocs, 'all', '不存在的关键词', filter);
    deepEqual(filtered, []);
});

test('生产级 - hasAdvancedFilter 多条件都返回 true', () => {
    equal(hasAdvancedFilter({ department: '办公室' }), true);
    equal(hasAdvancedFilter({ urgency: '加急' }), true);
    equal(hasAdvancedFilter({ receiveDateStart: '2025-01-01' }), true);
    equal(hasAdvancedFilter({ receiveDateEnd: '2025-01-31' }), true);
    equal(hasAdvancedFilter({ deadlineStart: '2025-01-01' }), true);
    equal(hasAdvancedFilter({ deadlineEnd: '2025-01-31' }), true);
});

test('生产级 - getDocumentStats 各维度统计正确', () => {
    const stats = getDocumentStats(prodDocs, today);
    equal(stats.total, prodDocs.length);
    equal(stats.pendingReview + stats.processing + stats.pendingFeedback + stats.done, stats.total);
    ok(stats.urgent >= 0, 'urgent 不为负');
    ok(stats.overdue >= 0, 'overdue 不为负');
    ok(stats.urgent + stats.overdue <= stats.total - stats.done, '期限状态不包含已办结');
});

console.log('\n10. localStorage 导入保存完整回归测试');

const STORAGE_KEY_INTEGRATION = 'document_registry_data';

function createMockStorage() {
    const store = {};
    return {
        getItem: function(key) {
            return store[key] !== undefined ? store[key] : null;
        },
        setItem: function(key, value) {
            store[key] = String(value);
        },
        removeItem: function(key) {
            delete store[key];
        },
        clear: function() {
            Object.keys(store).forEach(function(k) { delete store[k]; });
        },
        _size: function() {
            return Object.keys(store).length;
        },
        _getRaw: function(key) {
            return store[key];
        }
    };
}

function storageLoadAll(storage) {
    const data = storage.getItem(STORAGE_KEY_INTEGRATION);
    if (!data) return [];
    try {
        const docs = JSON.parse(data);
        return docs.map(function(d) { return migrateDocument(d); });
    } catch (e) {
        return [];
    }
}

function storageSaveAll(storage, docs) {
    storage.setItem(STORAGE_KEY_INTEGRATION, JSON.stringify(docs));
}

function generateImportData(count, startIdx = 1) {
    const items = [];
    const baseDate = new Date('2025-02-01');
    baseDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < count; i++) {
        const idx = startIdx + i;
        const dept = DEPARTMENTS[idx % DEPARTMENTS.length];
        const urgency = ['普通', '加急', '特急'][idx % 3];

        const receiveDate = new Date(baseDate);
        receiveDate.setDate(receiveDate.getDate() + idx);
        const receiveStr = formatDateInput(receiveDate);

        const days = getDeadlineDaysByUrgency(urgency);
        const deadlineDate = new Date(receiveDate);
        deadlineDate.setDate(deadlineDate.getDate() + days);
        const deadlineStr = formatDateInput(deadlineDate);

        items.push({
            id: 'imp_' + idx,
            title: `导入文档第${idx}号`,
            docNumber: `IMP-${String(idx).padStart(5, '0')}`,
            fromUnit: '导入单位' + (idx % 5),
            department: dept,
            undertakingDepartment: dept,
            urgency: urgency,
            receiveDate: receiveStr,
            deadline: deadlineStr
        });
    }
    return items;
}

test('回归 - 完整导入链路：写入→读取→迁移→回读一致', () => {
    const storage = createMockStorage();
    const importData = generateImportData(20);

    storageSaveAll(storage, importData);
    const loaded = storageLoadAll(storage);

    equal(loaded.length, 20);
    loaded.forEach(doc => {
        ok(doc.flowStatus, '迁移后应有 flowStatus');
        ok(Array.isArray(doc.flowRecords) && doc.flowRecords.length > 0, '迁移后应有 flowRecords');
        ok(doc.isDeleted === false, 'isDeleted 默认 false');
        ok(doc.supervisionRecords !== undefined, '有 supervisionRecords');
    });

    storageSaveAll(storage, loaded);
    const reloaded = storageLoadAll(storage);
    equal(reloaded.length, 20);
    equal(reloaded[0].docNumber, loaded[0].docNumber);
    equal(reloaded[0].flowStatus, loaded[0].flowStatus);
});

test('回归 - 旧格式数据导入自动迁移', () => {
    const storage = createMockStorage();
    const oldFormatDocs = [
        { id: 'old_1', title: '老式收文1', completed: false, department: '办公室' },
        { id: 'old_2', title: '老式收文2', completed: true, completedRemark: '已办完', department: '业务一科' }
    ];

    storageSaveAll(storage, oldFormatDocs);
    const loaded = storageLoadAll(storage);

    equal(loaded.length, 2);
    equal(loaded[0].flowStatus, FLOW_STATUS.PROCESSING);
    equal(loaded[0].completed, false);
    equal(loaded[1].flowStatus, FLOW_STATUS.DONE);
    equal(loaded[1].completed, true);
    ok(loaded[0].flowRecords.length >= 1, '未完成有创建记录');
    ok(loaded[1].flowRecords.length >= 2, '已办结有创建+办结记录');
    ok(!!loaded[0].undertakingDepartment, '有承办科室');
});

test('回归 - 覆盖导入：相同 docNumber 替换', () => {
    const storage = createMockStorage();
    const initialDocs = generateImportData(10);
    storageSaveAll(storage, initialDocs);

    const loaded1 = storageLoadAll(storage);
    equal(loaded1.length, 10);
    const originalTitle = loaded1[0].title;

    const overwriteData = [...initialDocs];
    overwriteData[0] = { ...overwriteData[0], title: '覆盖后的新标题' };
    storageSaveAll(storage, overwriteData);

    const loaded2 = storageLoadAll(storage);
    equal(loaded2.length, 10);
    equal(loaded2[0].title, '覆盖后的新标题');
    ok(loaded2[0].title !== originalTitle, '标题确实被更新');
});

test('回归 - 导入后筛选统计一致性', () => {
    const storage = createMockStorage();
    const importData = generateImportData(50);
    storageSaveAll(storage, importData);

    const loaded = storageLoadAll(storage);
    const stats = getDocumentStats(loaded, today);
    equal(stats.total, 50);

    const doneDocs = filterDocuments(loaded, 'done', '', {});
    equal(doneDocs.length, stats.done);

    const urgentDocs = filterDocuments(loaded, 'urgent', '', {}, today);
    equal(urgentDocs.length, stats.urgent + stats.overdue);
});

test('回归 - 数据损坏时安全降级（返回空数组）', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY_INTEGRATION, '{bad json!!!');
    const loaded = storageLoadAll(storage);
    deepEqual(loaded, []);
});

test('回归 - 空存储返回空数组', () => {
    const storage = createMockStorage();
    const loaded = storageLoadAll(storage);
    deepEqual(loaded, []);
});

test('回归 - 幂等性：同一份数据保存两次结果一致', () => {
    const storage = createMockStorage();
    const docs = generateImportData(15);

    storageSaveAll(storage, docs);
    const loaded1 = storageLoadAll(storage);
    const checksum1 = JSON.stringify(loaded1.map(d => d.docNumber + d.flowStatus));

    storageSaveAll(storage, loaded1);
    const loaded2 = storageLoadAll(storage);
    const checksum2 = JSON.stringify(loaded2.map(d => d.docNumber + d.flowStatus));

    equal(checksum1, checksum2, '保存→读取→再保存→再读取，结果一致');
});

test('回归 - 大数据量导入持久化（100 条）', () => {
    const storage = createMockStorage();
    const docs = generateImportData(100, 1000);

    const start = Date.now();
    storageSaveAll(storage, docs);
    const saveTime = Date.now() - start;

    const loaded = storageLoadAll(storage);
    equal(loaded.length, 100);
    ok(saveTime < 500, '100 条保存应在 500ms 内完成（实际 ' + saveTime + 'ms）');

    const raw = storage._getRaw(STORAGE_KEY_INTEGRATION);
    ok(raw && raw.length > 0, '存储中有原始数据');
    ok(JSON.parse(raw).length === 100, '原始 JSON 数据量正确');
});

test('回归 - 导入后再迁移不重复生成 flowRecords', () => {
    const storage = createMockStorage();
    const docs = generateImportData(5);
    storageSaveAll(storage, docs);

    const firstLoad = storageLoadAll(storage);
    const firstRecordCount = firstLoad.map(d => d.flowRecords.length);

    storageSaveAll(storage, firstLoad);
    const secondLoad = storageLoadAll(storage);
    const secondRecordCount = secondLoad.map(d => d.flowRecords.length);

    deepEqual(firstRecordCount, secondRecordCount, '迁移幂等：flowRecords 数量不变');
});

test('回归 - 多键值模拟：文档 + 模板 + 规则 各自独立存储', () => {
    const storage = createMockStorage();
    const docs = generateImportData(10);
    const templates = [{ id: 'tpl_1', name: '模板1', useCount: 0 }];
    const rules = getDefaultFlowRules();

    storage.setItem(STORAGE_KEY_INTEGRATION, JSON.stringify(docs));
    storage.setItem('document_templates', JSON.stringify(templates));
    storage.setItem('document_flow_rules', JSON.stringify(rules));

    equal(storage._size(), 3);

    const loadedDocs = JSON.parse(storage.getItem(STORAGE_KEY_INTEGRATION));
    const loadedTemplates = JSON.parse(storage.getItem('document_templates'));
    const loadedRules = JSON.parse(storage.getItem('document_flow_rules'));

    equal(loadedDocs.length, 10);
    equal(loadedTemplates.length, 1);
    equal(loadedRules.urgencyDeadlineDays['普通'], 7);
});

test('回归 - localStorage 清空后可重新写入', () => {
    const storage = createMockStorage();
    const docs = generateImportData(5);

    storageSaveAll(storage, docs);
    equal(storageLoadAll(storage).length, 5);

    storage.clear();
    equal(storageLoadAll(storage).length, 0);

    storageSaveAll(storage, docs);
    equal(storageLoadAll(storage).length, 5);
});

test('回归 - 已删除文档在 getDocuments 语义下被过滤', () => {
    const storage = createMockStorage();
    const docs = generateImportData(10);
    docs[3].isDeleted = true;
    docs[7].isDeleted = true;

    storageSaveAll(storage, docs);
    const allDocs = storageLoadAll(storage);
    equal(allDocs.length, 10);

    const activeDocs = allDocs.filter(function(d) { return !d.isDeleted; });
    equal(activeDocs.length, 8);
});

console.log('\n11. 文档状态与流转记录');

test('getDocumentStatus - 有 flowStatus 时直接返回', () => {
    equal(getDocumentStatus({ flowStatus: FLOW_STATUS.PROCESSING }), FLOW_STATUS.PROCESSING);
    equal(getDocumentStatus({ flowStatus: FLOW_STATUS.DONE }), FLOW_STATUS.DONE);
});

test('getDocumentStatus - 无 flowStatus 时默认 PENDING_REVIEW', () => {
    equal(getDocumentStatus({}), FLOW_STATUS.PENDING_REVIEW);
    equal(getDocumentStatus({ title: '测试' }), FLOW_STATUS.PENDING_REVIEW);
});

test('hasProposeFlowRecord - 有拟办记录返回 true', () => {
    const doc = {
        flowRecords: [
            { id: '1', action: FLOW_ACTION.CREATE },
            { id: '2', action: FLOW_ACTION.PROPOSE }
        ]
    };
    equal(hasProposeFlowRecord(doc), true);
});

test('hasProposeFlowRecord - 无拟办记录返回 false', () => {
    const doc = {
        flowRecords: [
            { id: '1', action: FLOW_ACTION.CREATE },
            { id: '2', action: FLOW_ACTION.ASSIGN }
        ]
    };
    equal(hasProposeFlowRecord(doc), false);
});

test('hasProposeFlowRecord - 无 flowRecords 返回 false', () => {
    equal(hasProposeFlowRecord({}), false);
    equal(hasProposeFlowRecord({ flowRecords: [] }), false);
});

console.log('\n12. 督办相关');

test('SUPERVISION_STATUS 常量定义正确', () => {
    equal(SUPERVISION_STATUS.PENDING, 'pending');
    equal(SUPERVISION_STATUS.FEEDBACK, 'feedback');
});

test('SUPERVISION_STATUS_TEXT 文案正确', () => {
    equal(SUPERVISION_STATUS_TEXT['pending'], '待反馈');
    equal(SUPERVISION_STATUS_TEXT['feedback'], '已反馈');
});

test('hasPendingSupervision - 有待处理督办返回 true', () => {
    const doc = {
        supervisionRecords: [
            { id: '1', status: SUPERVISION_STATUS.PENDING }
        ]
    };
    equal(hasPendingSupervision(doc), true);
});

test('hasPendingSupervision - 所有督办已反馈返回 false', () => {
    const doc = {
        supervisionRecords: [
            { id: '1', status: SUPERVISION_STATUS.FEEDBACK }
        ]
    };
    equal(hasPendingSupervision(doc), false);
});

test('hasPendingSupervision - 无督办记录返回 false', () => {
    equal(hasPendingSupervision({}), false);
    equal(hasPendingSupervision({ supervisionRecords: [] }), false);
});

test('getLatestSupervision - 返回最新的督办记录', () => {
    const doc = {
        supervisionRecords: [
            { id: '1', status: SUPERVISION_STATUS.PENDING, createdAt: '2025-01-10T00:00:00Z' },
            { id: '2', status: SUPERVISION_STATUS.FEEDBACK, createdAt: '2025-01-15T00:00:00Z' }
        ]
    };
    const latest = getLatestSupervision(doc);
    ok(latest, '应返回最新记录');
    equal(latest.id, '2');
    equal(latest.status, SUPERVISION_STATUS.FEEDBACK);
});

test('getLatestSupervision - 无记录返回 null', () => {
    equal(getLatestSupervision({}), null);
    equal(getLatestSupervision({ supervisionRecords: [] }), null);
});

console.log('\n13. 高风险与办理天数');

const testToday = new Date('2025-01-15');
testToday.setHours(0, 0, 0, 0);

test('get7DaysAgo - 返回7天前的日期', () => {
    const result = get7DaysAgo(testToday);
    equal(result.getFullYear(), 2025);
    equal(result.getMonth(), 0);
    equal(result.getDate(), 8);
});

test('get7DaysAgo - 不传参数时返回日期对象', () => {
    const result = get7DaysAgo();
    ok(result instanceof Date, '应返回 Date 对象');
});

test('getDocProcessingDays - 未办结文档从收文日期到今天', () => {
    const doc = {
        receiveDate: '2025-01-10',
        flowStatus: FLOW_STATUS.PROCESSING
    };
    equal(getDocProcessingDays(doc, testToday), 5);
});

test('getDocProcessingDays - 已办结文档从收文日期到办结日期', () => {
    const doc = {
        receiveDate: '2025-01-10',
        flowStatus: FLOW_STATUS.DONE,
        completedAt: '2025-01-20T00:00:00Z'
    };
    equal(getDocProcessingDays(doc, testToday), 10);
});

test('getDocProcessingDays - 当天收文返回 0 天', () => {
    const doc = {
        receiveDate: '2025-01-15',
        flowStatus: FLOW_STATUS.PROCESSING
    };
    equal(getDocProcessingDays(doc, testToday), 0);
});

test('isHighRiskDoc - 有待处理督办为高风险', () => {
    const doc = {
        flowStatus: FLOW_STATUS.PROCESSING,
        deadline: '2025-01-20',
        urgency: '普通',
        supervisionRecords: [
            { id: '1', status: SUPERVISION_STATUS.PENDING }
        ]
    };
    equal(isHighRiskDoc(doc, testToday), true);
});

test('isHighRiskDoc - 逾期且特急为高风险', () => {
    const doc = {
        flowStatus: FLOW_STATUS.PROCESSING,
        deadline: '2025-01-10',
        urgency: '特急'
    };
    equal(isHighRiskDoc(doc, testToday), true);
});

test('isHighRiskDoc - 逾期但普通不是高风险', () => {
    const doc = {
        flowStatus: FLOW_STATUS.PROCESSING,
        deadline: '2025-01-10',
        urgency: '普通'
    };
    equal(isHighRiskDoc(doc, testToday), false);
});

test('isHighRiskDoc - 即将到期且特急不是高风险', () => {
    const doc = {
        flowStatus: FLOW_STATUS.PROCESSING,
        deadline: '2025-01-17',
        urgency: '特急'
    };
    equal(isHighRiskDoc(doc, testToday), false);
});

test('isHighRiskDoc - 已办结文档不是高风险', () => {
    const doc = {
        flowStatus: FLOW_STATUS.DONE,
        deadline: '2025-01-10',
        urgency: '特急'
    };
    equal(isHighRiskDoc(doc, testToday), false);
});

console.log('\n14. 科室统计（calcDepartmentStats）');

function makeTestDoc(overrides) {
    return {
        id: generateId(),
        title: '测试收文',
        docNumber: 'SW-001',
        fromUnit: '测试单位',
        department: '办公室',
        undertakingDepartment: '办公室',
        flowStatus: FLOW_STATUS.PROCESSING,
        urgency: '普通',
        receiveDate: '2025-01-10',
        deadline: '2025-01-20',
        createdAt: '2025-01-10T00:00:00Z',
        ...overrides
    };
}

test('calcDepartmentStats - 按科室统计各状态数量', () => {
    const docs = [
        makeTestDoc({ undertakingDepartment: '办公室', flowStatus: FLOW_STATUS.PENDING_REVIEW }),
        makeTestDoc({ undertakingDepartment: '办公室', flowStatus: FLOW_STATUS.PROCESSING }),
        makeTestDoc({ undertakingDepartment: '业务一科', flowStatus: FLOW_STATUS.PROCESSING }),
        makeTestDoc({ undertakingDepartment: '业务一科', flowStatus: FLOW_STATUS.DONE }),
        makeTestDoc({ undertakingDepartment: '业务一科', flowStatus: FLOW_STATUS.PENDING_FEEDBACK })
    ];
    const deptNames = ['办公室', '业务一科'];
    const stats = calcDepartmentStats(docs, deptNames, testToday);

    equal(stats['办公室'].total, 2);
    equal(stats['办公室'].pending_review, 1);
    equal(stats['办公室'].processing, 1);
    equal(stats['业务一科'].total, 3);
    equal(stats['业务一科'].processing, 1);
    equal(stats['业务一科'].pending_feedback, 1);
    equal(stats['业务一科'].done, 1);
});

test('calcDepartmentStats - 统计逾期和即将到期数量', () => {
    const docs = [
        makeTestDoc({ undertakingDepartment: '办公室', deadline: '2025-01-20', flowStatus: FLOW_STATUS.PROCESSING }),
        makeTestDoc({ undertakingDepartment: '办公室', deadline: '2025-01-17', flowStatus: FLOW_STATUS.PROCESSING }),
        makeTestDoc({ undertakingDepartment: '办公室', deadline: '2025-01-10', flowStatus: FLOW_STATUS.PROCESSING })
    ];
    const stats = calcDepartmentStats(docs, ['办公室'], testToday);

    equal(stats['办公室'].total, 3);
    equal(stats['办公室'].urgent, 1);
    equal(stats['办公室'].overdue, 1);
});

test('calcDepartmentStats - 计算逾期率和平均办理天数', () => {
    const docs = [
        makeTestDoc({ undertakingDepartment: '业务一科', deadline: '2025-01-10', flowStatus: FLOW_STATUS.PROCESSING, receiveDate: '2025-01-05' }),
        makeTestDoc({ undertakingDepartment: '业务一科', deadline: '2025-01-20', flowStatus: FLOW_STATUS.PROCESSING, receiveDate: '2025-01-01' }),
        makeTestDoc({ undertakingDepartment: '业务一科', deadline: '2025-01-25', flowStatus: FLOW_STATUS.PROCESSING, receiveDate: '2025-01-10' })
    ];
    const stats = calcDepartmentStats(docs, ['业务一科'], testToday);

    equal(stats['业务一科'].overdueRate, 33);
    ok(typeof stats['业务一科'].avgProcessingDays === 'number', 'avgProcessingDays 应为数字');
    ok(stats['业务一科'].avgProcessingDays > 0, '平均办理天数应大于 0');
});

test('calcDepartmentStats - 统计高风险收文数量', () => {
    const docs = [
        makeTestDoc({
            undertakingDepartment: '办公室',
            deadline: '2025-01-10',
            urgency: '特急',
            flowStatus: FLOW_STATUS.PROCESSING
        }),
        makeTestDoc({
            undertakingDepartment: '办公室',
            deadline: '2025-01-20',
            urgency: '普通',
            flowStatus: FLOW_STATUS.PROCESSING,
            supervisionRecords: [{ id: '1', status: SUPERVISION_STATUS.PENDING }]
        }),
        makeTestDoc({
            undertakingDepartment: '办公室',
            deadline: '2025-01-20',
            urgency: '普通',
            flowStatus: FLOW_STATUS.PROCESSING
        })
    ];
    const stats = calcDepartmentStats(docs, ['办公室'], testToday);

    equal(stats['办公室'].highRiskCount, 2);
});

test('calcDepartmentStats - 近7天新增统计', () => {
    const docs = [
        makeTestDoc({ undertakingDepartment: '办公室', createdAt: '2025-01-14T00:00:00Z' }),
        makeTestDoc({ undertakingDepartment: '办公室', createdAt: '2025-01-10T00:00:00Z' }),
        makeTestDoc({ undertakingDepartment: '办公室', createdAt: '2025-01-01T00:00:00Z' })
    ];
    const stats = calcDepartmentStats(docs, ['办公室'], testToday);

    equal(stats['办公室'].recent7DaysNew, 2);
});

test('calcDepartmentStats - 空科室列表但有文档时会自动统计文档中的科室', () => {
    const docs = [makeTestDoc({ undertakingDepartment: '办公室' })];
    const stats = calcDepartmentStats(docs, [], testToday);
    equal(stats['办公室'].total, 1);
});

test('calcDepartmentStats - 科室无数据时统计项为0', () => {
    const stats = calcDepartmentStats([], ['办公室', '业务一科'], testToday);
    equal(stats['办公室'].total, 0);
    equal(stats['办公室'].pending_review, 0);
    equal(stats['办公室'].overdueRate, 0);
    equal(stats['办公室'].avgProcessingDays, 0);
    equal(stats['业务一科'].total, 0);
});

console.log('\n15. 看板钻取筛选与排序');

test('applyBoardDrillFilters - 无钻取上下文返回原数组', () => {
    const docs = [makeTestDoc(), makeTestDoc()];
    const result = applyBoardDrillFilters(docs, null, testToday);
    equal(result.length, 2);
});

test('applyBoardDrillFilters - 仅逾期筛选', () => {
    const docs = [
        makeTestDoc({ deadline: '2025-01-10', flowStatus: FLOW_STATUS.PROCESSING, title: '逾期' }),
        makeTestDoc({ deadline: '2025-01-20', flowStatus: FLOW_STATUS.PROCESSING, title: '正常' })
    ];
    const context = { overdueOnly: true };
    const result = applyBoardDrillFilters(docs, context, testToday);
    equal(result.length, 1);
    equal(result[0].title, '逾期');
});

test('applyBoardDrillFilters - 仅近7天新增筛选', () => {
    const docs = [
        makeTestDoc({ createdAt: '2025-01-14T00:00:00Z', title: '近期' }),
        makeTestDoc({ createdAt: '2025-01-01T00:00:00Z', title: '远期' })
    ];
    const context = { recent7DaysOnly: true };
    const result = applyBoardDrillFilters(docs, context, testToday);
    equal(result.length, 1);
    equal(result[0].title, '近期');
});

test('applyBoardDrillFilters - 仅高风险筛选', () => {
    const docs = [
        makeTestDoc({
            deadline: '2025-01-10',
            urgency: '特急',
            flowStatus: FLOW_STATUS.PROCESSING,
            title: '高风险'
        }),
        makeTestDoc({
            deadline: '2025-01-20',
            urgency: '普通',
            flowStatus: FLOW_STATUS.PROCESSING,
            title: '低风险'
        })
    ];
    const context = { highRiskOnly: true };
    const result = applyBoardDrillFilters(docs, context, testToday);
    equal(result.length, 1);
    equal(result[0].title, '高风险');
});

test('applyBoardDrillSorting - 无排序上下文返回原数组', () => {
    const docs = [makeTestDoc({ title: 'A' }), makeTestDoc({ title: 'B' })];
    const result = applyBoardDrillSorting(docs, null);
    equal(result.length, 2);
});

test('applyBoardDrillSorting - 按办理天数降序排序', () => {
    const docs = [
        makeTestDoc({ receiveDate: '2025-01-14', title: '天数少' }),
        makeTestDoc({ receiveDate: '2025-01-01', title: '天数多' })
    ];
    const context = { sortByProcessingDays: true };
    const result = applyBoardDrillSorting(docs, context);
    equal(result.length, 2);
    equal(result[0].title, '天数多');
    equal(result[1].title, '天数少');
});

console.log('\n16. 流转动作与批量流转校验');

test('BATCH_FLOW_ACTION 常量定义正确', () => {
    equal(BATCH_FLOW_ACTION.PROPOSE, 'propose');
    equal(BATCH_FLOW_ACTION.TRANSFER, 'transfer');
    equal(BATCH_FLOW_ACTION.ASSIGN_CO, 'assign_co');
    equal(BATCH_FLOW_ACTION.FEEDBACK, 'feedback');
    equal(BATCH_FLOW_ACTION.SUPERVISION, 'supervision');
});

test('BATCH_FLOW_ACTION_TEXT 文案正确', () => {
    equal(BATCH_FLOW_ACTION_TEXT['propose'], '批量拟办');
    equal(BATCH_FLOW_ACTION_TEXT['transfer'], '批量转办');
    equal(BATCH_FLOW_ACTION_TEXT['assign_co'], '批量指定协办');
    equal(BATCH_FLOW_ACTION_TEXT['feedback'], '批量反馈');
    equal(BATCH_FLOW_ACTION_TEXT['supervision'], '批量督办');
});

test('canCompleteFromStatus - 默认规则下 pending_feedback 可办结', () => {
    const rules = getDefaultFlowRules();
    equal(canCompleteFromStatus(FLOW_STATUS.PENDING_FEEDBACK, rules), true);
});

test('canCompleteFromStatus - 默认规则下 processing 不可办结', () => {
    const rules = getDefaultFlowRules();
    equal(canCompleteFromStatus(FLOW_STATUS.PROCESSING, rules), false);
});

test('canCompleteFromStatus - 自定义规则可修改可办结状态', () => {
    const customRules = {
        ...getDefaultFlowRules(),
        completableStatuses: [FLOW_STATUS.PROCESSING, FLOW_STATUS.PENDING_FEEDBACK]
    };
    equal(canCompleteFromStatus(FLOW_STATUS.PROCESSING, customRules), true);
    equal(canCompleteFromStatus(FLOW_STATUS.PENDING_FEEDBACK, customRules), true);
});

test('getAvailableFlowActions - 待拟办状态有拟办和交办动作', () => {
    const doc = { flowStatus: FLOW_STATUS.PENDING_REVIEW, flowRecords: [] };
    const actions = getAvailableFlowActions(doc);
    ok(actions.some(a => a.key === 'propose'), '应有拟办动作');
    ok(actions.some(a => a.key === 'assign'), '应有交办动作');
});

test('getAvailableFlowActions - 办理中状态有进展更新和申请反馈', () => {
    const doc = { flowStatus: FLOW_STATUS.PROCESSING, flowRecords: [] };
    const actions = getAvailableFlowActions(doc);
    ok(actions.some(a => a.key === 'progress'), '应有进展更新动作');
    ok(actions.some(a => a.key === 'feedback'), '应有申请反馈动作');
});

test('getAvailableFlowActions - 已办结状态无可用动作', () => {
    const doc = { flowStatus: FLOW_STATUS.DONE, flowRecords: [] };
    const actions = getAvailableFlowActions(doc);
    equal(actions.length, 0);
});

test('canPerformBatchFlowAction - 已办结不能拟办', () => {
    const doc = { flowStatus: FLOW_STATUS.DONE, isDeleted: false };
    const result = canPerformBatchFlowAction(doc, BATCH_FLOW_ACTION.PROPOSE);
    equal(result.valid, false);
    equal(result.reason, '已办结的收文不能拟办');
});

test('canPerformBatchFlowAction - 未办结可以拟办', () => {
    const doc = { flowStatus: FLOW_STATUS.PROCESSING, isDeleted: false };
    const result = canPerformBatchFlowAction(doc, BATCH_FLOW_ACTION.PROPOSE);
    equal(result.valid, true);
});

test('canPerformBatchFlowAction - 需先拟办才能转办（规则开启时）', () => {
    const rules = {
        ...getDefaultFlowRules(),
        requireProposeBeforeAssign: true
    };
    const doc = { flowStatus: FLOW_STATUS.PROCESSING, isDeleted: false, flowRecords: [] };
    const result = canPerformBatchFlowAction(doc, BATCH_FLOW_ACTION.TRANSFER, rules);
    equal(result.valid, false);
    equal(result.reason, '需先拟办才能转办');
});

test('canPerformBatchFlowAction - 有拟办记录可以转办', () => {
    const rules = {
        ...getDefaultFlowRules(),
        requireProposeBeforeAssign: true
    };
    const doc = {
        flowStatus: FLOW_STATUS.PROCESSING,
        isDeleted: false,
        flowRecords: [{ action: FLOW_ACTION.PROPOSE }]
    };
    const result = canPerformBatchFlowAction(doc, BATCH_FLOW_ACTION.TRANSFER, rules);
    equal(result.valid, true);
});

test('canPerformBatchFlowAction - 仅办理中可以申请反馈', () => {
    const doc1 = { flowStatus: FLOW_STATUS.PROCESSING, isDeleted: false };
    const doc2 = { flowStatus: FLOW_STATUS.PENDING_FEEDBACK, isDeleted: false };
    const result1 = canPerformBatchFlowAction(doc1, BATCH_FLOW_ACTION.FEEDBACK);
    const result2 = canPerformBatchFlowAction(doc2, BATCH_FLOW_ACTION.FEEDBACK);
    equal(result1.valid, true);
    equal(result2.valid, false);
});

test('canPerformBatchFlowAction - 已删除文档不能操作', () => {
    const doc = { flowStatus: FLOW_STATUS.PROCESSING, isDeleted: true };
    const result = canPerformBatchFlowAction(doc, BATCH_FLOW_ACTION.PROPOSE);
    equal(result.valid, false);
    equal(result.reason, '收文不存在或已删除');
});

test('validateBatchFlowDocuments - 正确分类有效和跳过的文档', () => {
    const docs = [
        { id: '1', flowStatus: FLOW_STATUS.PROCESSING, isDeleted: false, title: '有效1' },
        { id: '2', flowStatus: FLOW_STATUS.DONE, isDeleted: false, title: '跳过1' },
        { id: '3', flowStatus: FLOW_STATUS.PENDING_REVIEW, isDeleted: false, title: '有效2' }
    ];
    const result = validateBatchFlowDocuments(docs, BATCH_FLOW_ACTION.PROPOSE);
    equal(result.valid.length, 2);
    equal(result.skipped.length, 1);
    equal(result.skipped[0].doc.title, '跳过1');
    equal(result.skipped[0].reason, '已办结的收文不能拟办');
});

console.log('\n17. 规则变更摘要');

test('getFlowRulesChangesSummary - 无变更返回空数组', () => {
    const rules = getDefaultFlowRules();
    const changes = getFlowRulesChangesSummary(rules, rules);
    deepEqual(changes, []);
});

test('getFlowRulesChangesSummary - 紧急程度天数变更', () => {
    const oldRules = getDefaultFlowRules();
    const newRules = {
        ...getDefaultFlowRules(),
        urgencyDeadlineDays: {
            '普通': 10,
            '加急': 5,
            '特急': 2
        }
    };
    const changes = getFlowRulesChangesSummary(oldRules, newRules);
    ok(changes.length > 0, '应有变更项');
    ok(changes.some(c => c.includes('普通')), '应包含普通天数变更');
    ok(changes.some(c => c.includes('加急')), '应包含加急天数变更');
    ok(changes.some(c => c.includes('特急')), '应包含特急天数变更');
});

test('getFlowRulesChangesSummary - 必须先拟办变更', () => {
    const oldRules = { ...getDefaultFlowRules(), requireProposeBeforeAssign: false };
    const newRules = { ...getDefaultFlowRules(), requireProposeBeforeAssign: true };
    const changes = getFlowRulesChangesSummary(oldRules, newRules);
    ok(changes.some(c => c.includes('必须先拟办再交办')), '应包含先拟办再交办变更');
});

test('getFlowRulesChangesSummary - 允许办结状态变更', () => {
    const oldRules = { ...getDefaultFlowRules(), completableStatuses: [FLOW_STATUS.PENDING_FEEDBACK] };
    const newRules = { ...getDefaultFlowRules(), completableStatuses: [FLOW_STATUS.PROCESSING, FLOW_STATUS.PENDING_FEEDBACK] };
    const changes = getFlowRulesChangesSummary(oldRules, newRules);
    ok(changes.some(c => c.includes('允许办结状态')), '应包含允许办结状态变更');
});

console.log('\n18. 生产入口回归测试');

function createProductionHarness(initialStore) {
    const store = { ...(initialStore || {}) };
    const elements = {};
    const documentMock = {
        addEventListener: function() {},
        querySelector: function() { return null; },
        querySelectorAll: function() { return []; },
        createElement: function() {
            return {
                style: {},
                click: function() {},
                setAttribute: function() {},
                appendChild: function() {}
            };
        },
        body: {
            appendChild: function() {},
            removeChild: function() {}
        },
        getElementById: function(id) {
            if (!elements[id]) {
                elements[id] = {
                    id: id,
                    textContent: '',
                    innerHTML: '',
                    value: '',
                    className: '',
                    style: {},
                    addEventListener: function() {},
                    querySelector: function() { return null; },
                    querySelectorAll: function() { return []; },
                    appendChild: function() {},
                    removeChild: function() {}
                };
            }
            return elements[id];
        }
    };

    const context = {
        console: console,
        DocUtils: DocUtils,
        document: documentMock,
        localStorage: {
            getItem: function(key) {
                return store[key] !== undefined ? store[key] : null;
            },
            setItem: function(key, value) {
                store[key] = String(value);
            },
            removeItem: function(key) {
                delete store[key];
            },
            clear: function() {
                Object.keys(store).forEach(function(key) { delete store[key]; });
            }
        },
        window: {},
        navigator: {},
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        confirm: function() { return true; },
        alert: function() {},
        FileReader: function() {},
        Blob: function() {},
        URL: {
            createObjectURL: function() { return 'blob:test'; },
            revokeObjectURL: function() {}
        }
    };
    context.window = context;

    vm.createContext(context);
    const appPath = path.join(__dirname, '..', 'app.js');
    vm.runInContext(fs.readFileSync(appPath, 'utf8'), context, { filename: appPath });

    return {
        context: context,
        store: store,
        elements: elements
    };
}

test('生产入口 - loadAllDocuments 读取旧格式后迁移并回写 localStorage', () => {
    const oldDocs = [
        { id: 'old_1', title: '旧格式待办', completed: false, department: '办公室' },
        { id: 'old_2', title: '旧格式办结', completed: true, department: '综合科' }
    ];
    const harness = createProductionHarness({
        document_registry_data: JSON.stringify(oldDocs)
    });

    const loaded = harness.context.loadAllDocuments();
    equal(loaded.length, 2);
    equal(loaded[0].flowStatus, FLOW_STATUS.PROCESSING);
    equal(loaded[1].flowStatus, FLOW_STATUS.DONE);
    ok(Array.isArray(loaded[0].flowRecords) && loaded[0].flowRecords.length > 0, '迁移后生成流转记录');
    ok(loaded[0].isDeleted === false, '迁移后补齐删除标记');

    const persisted = JSON.parse(harness.store.document_registry_data);
    equal(persisted[0].flowStatus, FLOW_STATUS.PROCESSING);
    equal(persisted[1].flowStatus, FLOW_STATUS.DONE);
    ok(Array.isArray(persisted[0].flowRecords) && persisted[0].flowRecords.length > 0, '生产入口已回写迁移结果');
});

test('生产入口 - loadAllDocuments 遇到损坏 localStorage 数据安全返回空数组', () => {
    const harness = createProductionHarness({
        document_registry_data: '{bad json!!!'
    });

    const allDocs = harness.context.loadAllDocuments();
    const activeDocs = harness.context.getDocuments();
    ok(Array.isArray(allDocs), '生产入口返回数组');
    ok(Array.isArray(activeDocs), 'getDocuments 返回数组');
    equal(allDocs.length, 0);
    equal(activeDocs.length, 0);
});

test('生产入口 - saveDocuments 写入后 loadAllDocuments 可回读迁移结果', () => {
    const harness = createProductionHarness();
    const docs = generateImportData(12, 200);

    harness.context.saveDocuments(docs);
    const loaded = harness.context.loadAllDocuments();

    equal(loaded.length, 12);
    equal(loaded[0].docNumber, docs[0].docNumber);
    ok(loaded[0].flowStatus, '生产入口回读时执行迁移');
    ok(harness.store.document_registry_data && harness.store.document_registry_data.length > 0, '生产入口写入 localStorage');
});

test('生产入口 - getDocuments 过滤软删除文档', () => {
    const docs = generateImportData(6, 300);
    docs[1].isDeleted = true;
    docs[4].isDeleted = true;
    const harness = createProductionHarness({
        document_registry_data: JSON.stringify(docs)
    });

    const activeDocs = harness.context.getDocuments();
    equal(activeDocs.length, 4);
    ok(activeDocs.every(function(doc) { return !doc.isDeleted; }), '生产入口只返回未删除文档');
});

test('生产入口 - updateStats 写入统计卡片和 tab 徽标', () => {
    const statsDocs = [
        generateImportData(1, 400)[0],
        { ...generateImportData(1, 401)[0], flowStatus: FLOW_STATUS.PROCESSING, deadline: '2026-06-08' },
        { ...generateImportData(1, 402)[0], flowStatus: FLOW_STATUS.PENDING_FEEDBACK, deadline: '2026-06-01' },
        { ...generateImportData(1, 403)[0], flowStatus: FLOW_STATUS.DONE, deadline: '2026-06-01', completed: true }
    ];
    statsDocs[0].flowStatus = FLOW_STATUS.PENDING_REVIEW;
    statsDocs[0].deadline = '2026-06-20';

    const harness = createProductionHarness({
        document_registry_data: JSON.stringify(statsDocs)
    });

    harness.context.updateStats();

    equal(harness.elements.pendingCount.textContent, 1);
    equal(harness.elements.processingCount.textContent, 1);
    equal(harness.elements.feedbackCount.textContent, 1);
    equal(harness.elements.doneCount.textContent, 1);
    equal(harness.elements.totalCount.textContent, 4);
    equal(harness.elements.urgentCount.textContent, 2);
    equal(harness.elements.tabPendingReviewBadge.textContent, 1);
    equal(harness.elements.tabProcessingBadge.textContent, 1);
    equal(harness.elements.tabFeedbackBadge.textContent, 1);
    equal(harness.elements.tabDoneBadge.textContent, 1);
    equal(harness.elements.tabUrgentBadge.textContent, 2);
});

console.log('\n==============================================');
console.log(`通过: ${passed} | 失败: ${failed}`);
console.log('==============================================\n');

if (failed > 0) {
    console.log('失败详情：\n');
    failures.forEach(f => {
        console.log(`  ${f.name}`);
        console.log(`    ${f.error.stack}`);
    });
    process.exit(1);
} else {
    console.log('✓ 所有测试通过！\n');
    process.exit(0);
}
