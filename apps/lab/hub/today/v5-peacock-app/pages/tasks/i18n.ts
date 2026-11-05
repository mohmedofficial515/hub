import type { PluralForms } from '../../kit';

export type Column = 'backlog' | 'ready' | 'claimed' | 'in_progress' | 'in_review' | 'done';

interface Dict {
  title: string;
  errorThing: string;
  summary: { ready: PluralForms; mine: PluralForms; review: PluralForms };
  view: { label: string; board: string; list: string };
  newTask: string;
  filters: {
    scope: string;
    mine: string;
    reviewGroup: string;
    review: string;
    specialty: string;
    priority: string;
    anyPriority: string;
    module: string;
    anyModule: string;
    search: string;
    status: string;
    anyStatus: string;
    clear: string;
  };
  board: {
    label: string;
    columns: Record<Column, string>;
    blocked: PluralForms;
    expand: string;
    collapse: string;
    count: PluralForms;
    doneWindow: string;
    readyEmpty: string;
    columnEmpty: string;
    readOnly: string;
    next: string;
  };
  card: {
    blockedBy: string;
    assignee: string;
    due: string;
    overdueBy: string;
    dueSoon: string;
    pr: string;
    noRole: string;
    blockedToast: string;
    claimTask: string;
  };
  table: {
    caption: string;
    key: string;
    task: string;
    specialty: string;
    effort: string;
    priority: string;
    status: string;
    assignee: string;
    branch: string;
    due: string;
    updated: string;
    none: string;
    sortBy: string;
    setPriority: string;
    action: string;
  };
  empty: {
    firstTitle: string;
    firstBody: string;
    firstBodyMember: string;
    firstLink: string;
    noMatch: string;
    noMatchBody: string;
  };
}

const ar: Dict = {
  title: 'المهام',
  errorThing: 'المهام',
  summary: {
    ready: { zero: 'لا مهام جاهزة لأدوارك', one: 'مهمة جاهزة لأدوارك', two: 'مهمتان جاهزتان لأدوارك', few: '# مهام جاهزة لأدوارك', many: '# مهمة جاهزة لأدوارك', other: '# مهمة جاهزة لأدوارك' },
    mine: { zero: '', one: '، وواحدة بين يديك', two: '، واثنتان بين يديك', few: '، و# بين يديك', many: '، و# بين يديك', other: '، و# بين يديك' },
    review: { zero: '', one: '، وواحدة تنتظر المراجعة', two: '، واثنتان تنتظران المراجعة', few: '، و# تنتظر المراجعة', many: '، و# تنتظر المراجعة', other: '، و# تنتظر المراجعة' },
  },
  view: { label: 'طريقة العرض', board: 'اللوحة', list: 'القائمة' },
  newTask: 'مهمة جديدة',
  filters: {
    scope: 'نطاق المهام',
    mine: 'مهامي',
    reviewGroup: 'المراجعة',
    review: 'بانتظار المراجعة',
    specialty: 'التخصص',
    priority: 'الأولوية',
    anyPriority: 'كل الأولويات',
    module: 'الوحدة',
    anyModule: 'كل الوحدات',
    search: 'ابحث بالمفتاح أو العنوان…',
    status: 'الحالة',
    anyStatus: 'كل الحالات',
    clear: 'امسح الفلاتر',
  },
  board: {
    label: 'لوحة المهام',
    columns: { backlog: 'مؤجلة', ready: 'جاهزة', claimed: 'محجوزة', in_progress: 'قيد التنفيذ', in_review: 'قيد المراجعة', done: 'منجزة' },
    blocked: { one: '1 متوقفة', two: '2 متوقفتان', few: '# متوقفة', many: '# متوقفة', other: '# متوقفة' },
    expand: 'افتح عمود {name}',
    collapse: 'اطوِ عمود {name}',
    count: { zero: 'لا مهام', one: 'مهمة واحدة', two: 'مهمتان', few: '# مهام', many: '# مهمة', other: '# مهمة' },
    doneWindow: 'آخر 14 يومًا',
    readyEmpty: 'لا مهام جاهزة لهذا التخصص.',
    columnEmpty: 'لا شيء هنا الآن.',
    readOnly: 'تعرض هذه الصفحة المهام للاطلاع فقط لدور المحاسب.',
    next: 'تنتقل المهام من هنا إلى {name}',
  },
  card: {
    blockedBy: 'متوقفة على {key}',
    assignee: 'يعمل عليها',
    due: 'الموعد {when}',
    overdueBy: 'متأخرة {d}',
    dueSoon: 'مستحقة {rel}',
    pr: 'PR',
    noRole: 'هذا الإجراء يحتاج دور {role}.',
    blockedToast: '{key} متوقفة على {blocker}',
    claimTask: 'احجز {key}',
  },
  table: {
    caption: 'قائمة المهام',
    key: 'المفتاح',
    task: 'المهمة',
    specialty: 'التخصص',
    effort: 'الجهد',
    priority: 'الأولوية',
    status: 'الحالة',
    assignee: 'المكلّف',
    branch: 'الفرع أو PR',
    due: 'الموعد',
    updated: 'آخر تحديث',
    none: 'لا يوجد',
    sortBy: 'رتّب حسب {name}',
    setPriority: 'أولوية {key}',
    action: 'الإجراء',
  },
  empty: {
    firstTitle: 'لا مهام بعد',
    firstBody: 'أنشئ أول مهمة، أو استورد اقتراحات جوتيف من صفحة المصادر في الإعدادات.',
    firstBodyMember: 'تظهر المهام هنا حين ينشئها مدير المشروع أو تصل من جلسة أو إحالة.',
    firstLink: 'افتح المصادر',
    noMatch: 'لا مهام تطابق هذه الفلاتر',
    noMatchBody: 'جرّب تخصصًا آخر أو امسح الفلاتر.',
  },
};

const en: Dict = {
  title: 'Tasks',
  errorThing: 'tasks',
  summary: {
    ready: { zero: 'Nothing ready for your roles', one: '1 ready for your roles', other: '# ready for your roles' },
    mine: { zero: '', one: ', 1 in your hands', other: ', # in your hands' },
    review: { zero: '', one: ', 1 waiting for review', other: ', # waiting for review' },
  },
  view: { label: 'View', board: 'Board', list: 'List' },
  newTask: 'New task',
  filters: {
    scope: 'Task scope',
    mine: 'Mine',
    reviewGroup: 'Review',
    review: 'Awaiting review',
    specialty: 'Specialty',
    priority: 'Priority',
    anyPriority: 'All priorities',
    module: 'Module',
    anyModule: 'All modules',
    search: 'Search by key or title…',
    status: 'Status',
    anyStatus: 'All statuses',
    clear: 'Clear filters',
  },
  board: {
    label: 'Task board',
    columns: { backlog: 'Backlog', ready: 'Ready', claimed: 'Claimed', in_progress: 'In progress', in_review: 'In review', done: 'Done' },
    blocked: { one: '1 blocked', other: '# blocked' },
    expand: 'Open the {name} column',
    collapse: 'Fold the {name} column',
    count: { zero: 'No tasks', one: '1 task', other: '# tasks' },
    doneWindow: 'Last 14 days',
    readyEmpty: 'No ready tasks for this specialty.',
    columnEmpty: 'Nothing here right now.',
    readOnly: 'The Accountant role sees this page read-only.',
    next: 'Tasks move from here to {name}',
  },
  card: {
    blockedBy: 'Blocked by {key}',
    assignee: 'Assignee',
    due: 'Due {when}',
    overdueBy: '{d} overdue',
    dueSoon: 'Due {rel}',
    pr: 'PR',
    noRole: 'This action needs the {role} role.',
    blockedToast: '{key} is blocked by {blocker}',
    claimTask: 'Claim {key}',
  },
  table: {
    caption: 'Task list',
    key: 'Key',
    task: 'Task',
    specialty: 'Specialty',
    effort: 'Effort',
    priority: 'Priority',
    status: 'Status',
    assignee: 'Assignee',
    branch: 'Branch or PR',
    due: 'Due',
    updated: 'Updated',
    none: 'None',
    sortBy: 'Sort by {name}',
    setPriority: 'Priority of {key}',
    action: 'Action',
  },
  empty: {
    firstTitle: 'No tasks yet',
    firstBody: 'Create the first task, or import the Goteav suggestions from Sources in Settings.',
    firstBodyMember: 'Tasks appear here when a PM creates them or they arrive from a session or a handoff.',
    firstLink: 'Open sources',
    noMatch: 'No tasks match these filters',
    noMatchBody: 'Try another specialty, or clear the filters.',
  },
};

export const messages = { ar, en };
