import type { PluralForms } from '../../kit';

interface Dict {
  title: string;
  errorThing: string;
  meta: PluralForms;
  refresh: string;
  refreshed: string;
  newEvents: PluralForms;
  today: string;
  yesterday: string;
  dayEvents: PluralForms;
  quiet: string;
  tide: string;
  filters: {
    open: string;
    openCount: string;
    title: string;
    done: string;
    clear: string;
    roles: string;
    types: string;
    repo: string;
    anyRepo: string;
    module: string;
    anyModule: string;
    member: string;
    anyMember: string;
    range: string;
    anyRange: string;
    rangeToday: string;
    rangeWeek: string;
    rangeVisit: string;
    rangeCustom: string;
  };
  rail: { label: string };
  row: {
    more: PluralForms;
    less: string;
    copyPrompt: string;
    openPr: string;
    openLab: string;
    commits: PluralForms;
    files: PluralForms;
    blocks: PluralForms;
    dueIn: string;
    overdueBy: string;
    pendingFor: string;
    noSummary: string;
    score: string;
    included: PluralForms;
    escalatedTo: string;
    onto: string;
    hasSummary: string;
    route: string;
    takenBy: string;
    unclaimed: string;
  };
  empty: {
    noMatch: string;
    noMatchBody: string;
    firstTitle: string;
    firstBody: string;
    firstLink: string;
  };
  older: string;
  olderLoaded: PluralForms;
  start: string;
}

const ar: Dict = {
  title: 'الخط الزمني',
  errorThing: 'الخط الزمني',
  meta: { zero: 'لا أحداث مطابقة', one: 'حدث واحد في هذا العرض', two: 'حدثان في هذا العرض', few: '# أحداث في هذا العرض', many: '# حدثًا في هذا العرض', other: '# حدث في هذا العرض' },
  refresh: 'اعرض الجديد',
  refreshed: 'وصلت الأحداث الجديدة',
  newEvents: { one: 'وصل حدث أثناء وجودك', two: 'وصل حدثان أثناء وجودك', few: 'وصلت # أحداث أثناء وجودك', many: 'وصل # حدثًا أثناء وجودك', other: 'وصل # حدث أثناء وجودك' },
  today: 'اليوم',
  yesterday: 'أمس',
  dayEvents: { one: 'حدث واحد', two: 'حدثان', few: '# أحداث', many: '# حدثًا', other: '# حدث' },
  quiet: 'هدوء {d}',
  tide: 'آخر زيارة لك: {when}',
  filters: {
    open: 'الفلاتر',
    openCount: 'الفلاتر ({n})',
    title: 'فلترة الخط الزمني',
    done: 'تم',
    clear: 'امسح الفلاتر',
    roles: 'الدور',
    types: 'نوع البطاقة',
    repo: 'المستودع',
    anyRepo: 'كل المستودعات',
    module: 'الوحدة',
    anyModule: 'كل الوحدات',
    member: 'العضو',
    anyMember: 'كل الأعضاء',
    range: 'المدة',
    anyRange: 'كل الوقت',
    rangeToday: 'اليوم',
    rangeWeek: 'آخر 7 أيام',
    rangeVisit: 'منذ آخر زيارة',
    rangeCustom: 'مدة مخصصة',
  },
  rail: { label: 'الانتقال إلى يوم' },
  row: {
    more: { one: '+1', two: '+2', few: '+#', many: '+#', other: '+#' },
    less: 'أخفِ',
    copyPrompt: 'انسخ الأمر',
    openPr: 'افتح PR',
    openLab: 'افتح في المختبر',
    commits: { one: 'commit واحد', two: 'commitان', few: '# commits', many: '# commit', other: '# commit' },
    files: { one: 'ملف واحد', two: 'ملفان', few: '# ملفات', many: '# ملفًا', other: '# ملف' },
    blocks: { one: 'يوقف بطاقة', two: 'يوقف بطاقتين', few: 'يوقف # بطاقات', many: 'يوقف # بطاقة', other: 'يوقف # بطاقة' },
    dueIn: 'مستحق {rel}',
    overdueBy: 'متأخر {d}',
    pendingFor: 'بانتظار الاستلام منذ {d}',
    noSummary: 'بلا ملخص',
    score: 'التقييم {n}/100',
    included: { one: 'يشمل بطاقة', two: 'يشمل بطاقتين', few: 'يشمل # بطاقات', many: 'يشمل # بطاقة', other: 'يشمل # بطاقة' },
    escalatedTo: 'صُعّد إلى {role}',
    onto: 'إلى {base}',
    hasSummary: 'بملخص',
    route: '{from} إلى {to}',
    takenBy: 'الحجز: {name}',
    unclaimed: 'غير محجوزة',
  },
  empty: {
    noMatch: 'لا أحداث تطابق هذه الفلاتر',
    noMatchBody: 'وسّع المدة أو امسح الفلاتر.',
    firstTitle: 'لا أحداث بعد',
    firstBody: 'يبدأ الخط الزمني بالامتلاء عند ربط مصدر أو إنشاء بطاقة.',
    firstLink: 'اربط مصدرًا في الإعدادات',
  },
  older: 'حمّل الأقدم',
  olderLoaded: { one: 'حُمّل حدث أقدم', two: 'حُمّل حدثان أقدم', few: 'حُمّلت # أحداث أقدم', many: 'حُمّل # حدثًا أقدم', other: 'حُمّل # حدث أقدم' },
  start: 'هنا بدأ السجل.',
};

const en: Dict = {
  title: 'Timeline',
  errorThing: 'the timeline',
  meta: { zero: 'No matching events', one: '1 event in this view', other: '# events in this view' },
  refresh: 'Show new events',
  refreshed: 'New events added',
  newEvents: { one: '1 arrived while you were here', other: '# arrived while you were here' },
  today: 'Today',
  yesterday: 'Yesterday',
  dayEvents: { one: '1 event', other: '# events' },
  quiet: '{d} quiet',
  tide: 'Your last visit: {when}',
  filters: {
    open: 'Filters',
    openCount: 'Filters ({n})',
    title: 'Filter the timeline',
    done: 'Done',
    clear: 'Clear filters',
    roles: 'Role',
    types: 'Card type',
    repo: 'Repo',
    anyRepo: 'All repos',
    module: 'Module',
    anyModule: 'All modules',
    member: 'Member',
    anyMember: 'All members',
    range: 'Date range',
    anyRange: 'All time',
    rangeToday: 'Today',
    rangeWeek: 'Last 7 days',
    rangeVisit: 'Since my last visit',
    rangeCustom: 'Custom range',
  },
  rail: { label: 'Jump to a day' },
  row: {
    more: { other: '+#' },
    less: 'Hide',
    copyPrompt: 'Copy prompt',
    openPr: 'Open PR',
    openLab: 'Open in lab',
    commits: { one: '1 commit', other: '# commits' },
    files: { one: '1 file', other: '# files' },
    blocks: { one: 'Blocks 1 card', other: 'Blocks # cards' },
    dueIn: 'Due {rel}',
    overdueBy: '{d} overdue',
    pendingFor: 'Pending for {d}',
    noSummary: 'No summary',
    score: 'Score {n}/100',
    included: { one: 'Includes 1 card', other: 'Includes # cards' },
    escalatedTo: 'Escalated to {role}',
    onto: 'into {base}',
    hasSummary: 'With summary',
    route: '{from} to {to}',
    takenBy: 'Claimed by {name}',
    unclaimed: 'Not claimed',
  },
  empty: {
    noMatch: 'No events match these filters',
    noMatchBody: 'Widen the date range or clear the filters.',
    firstTitle: 'No events yet',
    firstBody: 'The timeline fills up as soon as a source is connected or a card is created.',
    firstLink: 'Connect a source in Settings',
  },
  older: 'Load older',
  olderLoaded: { one: 'Loaded 1 older event', other: 'Loaded # older events' },
  start: 'This is where the record starts.',
};

export const messages = { ar, en };
