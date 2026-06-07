const assert = require('assert');
const DocUtils = require('../src/utils.js');

const {
    FLOW_STATUS,
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
