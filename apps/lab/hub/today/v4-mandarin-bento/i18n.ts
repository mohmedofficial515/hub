import type { Action, CardType, EventKind, Role, SourceHealth } from '@lab/mocks/hub-today';
import type { PluralForms } from './parts/format';

/**
 * All visible text. `{key}` / `{cmd}` / `{when}` placeholders are split by the components so card keys
 * and commands render as LTR isolates inside Arabic sentences (docs/08 §4 rule 2). Plurals are given as
 * Intl.PluralRules categories (Arabic needs zero/one/two/few/many). The page speaks to "you" everywhere.
 */
type Specialty = 'backend' | 'frontend' | 'design' | 'qa' | 'ops' | 'docs';

interface Dict {
  skip: string;
  masthead: {
    greeting: string;
    ready: PluralForms;
    since: PluralForms;
    sources: PluralForms;
    and: string;
    quiet: string;
    refresh: string;
    refreshing: string;
    updated: string;
  };
  keys: {
    open: string;
    title: string;
    toggle: string;
    on: string;
    off: string;
    offHint: string;
    list: { keys: string[]; label: string }[];
  };
  types: Record<CardType, string>;
  roles: Record<Role, string>;
  actions: Record<Action, string>;
  done: Record<Action, string>;
  undo: string;
  dismiss: string;
  row: {
    details: string;
    openCard: string;
    copyKey: string;
  };
  needs: {
    waiting: string;
    overdue: PluralForms;
    soon: PluralForms;
    cleared: PluralForms;
    overdueBy: string;
    escalated: string;
    dueSoon: string;
    dueLater: string;
    blocks: PluralForms;
    breaking: string;
    forRole: string;
    openedBy: string;
    openedByAgent: string;
    openedBySystem: string;
    fieldOpened: string;
    fieldModule: string;
    fieldStatus: string;
    fieldFor: string;
    fieldDue: string;
    fieldNote: string;
    allDueHere: string;
    dueTitle: string;
    dueLate: string;
    dueNone: string;
    alsoDue: string;
    seeAll: string;
    emptyTitle: string;
    emptyBody: string;
    emptyLink: string;
  };
  letter: {
    title: string;
    signed: string;
    collapse: string;
    expand: string;
    absentTitle: string;
    absentBody: string;
    cardLink: string;
  };
  ready: {
    title: string;
    claim: string;
    claimTask: string;
    blockedBy: string;
    blockedToast: string;
    effort: string;
    specialty: Record<Specialty, string>;
    toast: string;
    seeAll: string;
    emptyTitle: string;
    emptyBody: string;
    emptyLink: string;
  };
  sessions: {
    title: string;
    noSummary: string;
    hint: string;
    minutes: string;
    files: PluralForms;
    commits: PluralForms;
    empty: string;
  };
  since: {
    title: string;
    seeAll: string;
    tide: string;
    pinned: string;
    before: string;
    after: string;
    viaAgent: string;
    kinds: Record<EventKind, string>;
    more: PluralForms;
    empty: string;
    system: string;
    fieldBranch: string;
    fieldRepo: string;
    fieldCard: string;
  };
  team: {
    title: string;
    week: string;
    up: string;
    down: string;
    same: string;
    lastWeek: string;
    activity: string;
    activityShort: string;
    activityHint: string;
    fewer: string;
    more: string;
    cell: PluralForms;
    readoutIdle: string;
    online: string;
    lastSeen: string;
    focus: string;
    noFocus: string;
    today: string;
    member: string;
  };
  flow: {
    title: string;
    hint: string;
    created: string;
    closed: string;
    netMore: string;
    netFewer: string;
    netEven: string;
  };
  sources: {
    title: string;
    kinds: Record<SourceHealth['kind'], string>;
    ok: string;
    lagging: string;
    failing: string;
    lastSuccess: string;
    runs: string;
    cards: string;
    summary: string;
    allLive: string;
  };
  elsewhere: {
    title: string;
    inbox: string;
    decisions: string;
    needs: string;
    handoffs: string;
    redesigns: string;
    quiet: string;
  };
  copy: { copied: string; label: string };
  loading: { label: string; still: string };
  error: { title: string; body: string; code: string; retry: string };
}

const ar: Dict = {
  skip: 'انتقل إلى ما ينتظرك',
  masthead: {
    greeting: 'صباح الخير يا {name}',
    ready: {
      one: 'مهمة واحدة جاهزة للحجز',
      two: 'مهمتان جاهزتان للحجز',
      few: '# مهام جاهزة للحجز',
      many: '# مهمة جاهزة للحجز',
      other: '# مهمة جاهزة للحجز',
    },
    since: {
      one: 'تحديث واحد منذ {when}',
      two: 'تحديثان منذ {when}',
      few: '# تحديثات منذ {when}',
      many: '# تحديثًا منذ {when}',
      other: '# تحديث منذ {when}',
    },
    sources: {
      one: 'مصدر التقاط واحد يحتاج نظرة',
      two: 'مصدرا التقاط يحتاجان نظرة',
      few: '# مصادر التقاط تحتاج نظرة',
      many: '# مصدرًا يحتاج نظرة',
      other: '# مصدر يحتاج نظرة',
    },
    and: ' و',
    quiet: 'صباح هادئ، ولا جديد منذ {when}.',
    refresh: 'تحديث',
    refreshing: 'جارٍ التحديث',
    updated: 'حُدّث {when}',
  },
  keys: {
    open: 'اختصارات لوحة المفاتيح',
    title: 'اختصارات لوحة المفاتيح',
    toggle: 'اختصارات المفتاح الواحد',
    on: 'تعمل',
    off: 'متوقفة',
    offHint: 'التراجع يبقى متاحًا بـ Ctrl+Z.',
    list: [
      { keys: ['j', 'k'], label: 'الصف التالي والسابق' },
      { keys: ['Enter', 'o'], label: 'فتح الصف' },
      { keys: ['c'], label: 'حجز المهمة' },
      { keys: ['u'], label: 'التراجع عن آخر إجراء' },
      { keys: ['r'], label: 'تحديث الصفحة' },
      { keys: ['?'], label: 'هذه القائمة' },
    ],
  },
  types: {
    task: 'مهمة',
    decision: 'قرار',
    need: 'احتياج',
    change: 'تغيير',
    handoff: 'تسليم',
    redesign: 'تصميم',
    doc: 'وثيقة',
    release: 'إصدار',
  },
  roles: {
    owner: 'المالك',
    pm: 'مدير المشروع',
    accountant: 'المحاسب',
    backend: 'باك إند',
    frontend: 'فرونت إند',
    designer: 'مصمم',
    qa: 'الجودة',
  },
  actions: {
    decide: 'قرّر',
    deliver: 'سلّم',
    verify: 'تحقّق',
    acknowledge: 'استلم',
    review: 'راجع',
    approve: 'وافق',
    claim: 'احجز',
  },
  done: {
    decide: 'سُجّل قرارك على {key}',
    deliver: 'سُلّم {key}',
    verify: 'تحقّقتَ من {key}',
    acknowledge: 'استلمتَ {key}',
    review: 'راجعتَ {key}',
    approve: 'وافقتَ على {key}',
    claim: 'حجزتَ {key}',
  },
  undo: 'تراجع',
  dismiss: 'إغلاق',
  row: {
    details: 'التفاصيل',
    openCard: 'افتح صفحة البطاقة',
    copyKey: 'انسخ المفتاح {key}',
  },
  needs: {
    waiting: 'بانتظارك',
    overdue: { one: 'واحد متأخر', two: 'اثنان متأخران', few: '# متأخرة', many: '# متأخرًا', other: '# متأخر', zero: '' },
    soon: {
      one: 'واحد مستحق خلال 24 ساعة',
      two: 'اثنان مستحقان خلال 24 ساعة',
      few: '# مستحقة خلال 24 ساعة',
      many: '# مستحقًا خلال 24 ساعة',
      other: '# مستحق خلال 24 ساعة',
      zero: '',
    },
    cleared: { one: 'أنجزتَ واحدًا اليوم', two: 'أنجزتَ اثنين اليوم', few: 'أنجزتَ # اليوم', many: 'أنجزتَ # اليوم', other: 'أنجزتَ # اليوم', zero: '' },
    overdueBy: 'متأخر {d}',
    escalated: 'صُعِّد إليك',
    dueSoon: 'مستحق {rel}، {when}',
    dueLater: 'موعده {when}',
    blocks: { one: 'يوقف بطاقة واحدة', two: 'يوقف بطاقتين', few: 'يوقف # بطاقات', many: 'يوقف # بطاقة', other: 'يوقف # بطاقة' },
    breaking: 'تغيير كاسر',
    forRole: 'بصفتك {role}',
    openedBy: 'فتحه {who}',
    openedByAgent: 'فتحه وكيل {who}',
    openedBySystem: 'فتحه النظام',
    fieldOpened: 'المصدر',
    fieldModule: 'الوحدة',
    fieldStatus: 'الحالة',
    fieldFor: 'الدور',
    fieldDue: 'الموعد',
    fieldNote: 'ملاحظة',
    allDueHere: 'كل المواعيد النهائية خلال 72 ساعة في هذه القائمة.',
    dueTitle: 'مواعيد الاستحقاق',
    dueLate: 'متأخر',
    dueNone: 'بلا موعد',
    alsoDue: 'مواعيد قريبة لا تنتظرك',
    seeAll: 'اعرض الكل ({total})',
    emptyTitle: 'لا شيء ينتظرك.',
    emptyBody: 'القرارات والاحتياجات والتسليمات الموجّهة لأدوارك تظهر هنا أولًا.',
    emptyLink: 'افتح الخط الزمني',
  },
  letter: {
    title: 'رسالة الصباح',
    signed: 'كتبها وكيلك الساعة {when}',
    collapse: 'اختصر الرسالة',
    expand: 'اقرأ الرسالة كاملة',
    absentTitle: 'لم يكتب وكيلك رسالة اليوم بعد',
    absentBody: 'شغّل {cmd} في Claude Code ليكتبها من أقسام هذه الصفحة.',
    cardLink: '{type} {key}',
  },
  ready: {
    title: 'جاهزة لك',
    claim: 'احجز',
    claimTask: 'احجز {key}',
    blockedBy: 'متوقفة على {key}',
    blockedToast: 'لا يمكن حجز {key} لأنها متوقفة على {blocker}.',
    effort: 'الجهد',
    specialty: { backend: 'باك إند', frontend: 'فرونت إند', design: 'تصميم', qa: 'جودة', ops: 'عمليات', docs: 'توثيق' },
    toast: 'حجزتَ {key}. الصق هذا الأمر في Claude Code لتبدأ:',
    seeAll: 'اعرض الكل ({total})',
    emptyTitle: 'لا مهام جاهزة لأدوارك.',
    emptyBody: 'المهام الجاهزة لتخصصاتك تظهر هنا مرتبة بالأولوية.',
    emptyLink: 'افتح قائمة المهام',
  },
  sessions: {
    title: 'جلساتك بلا ملخص',
    noSummary: 'بلا ملخص',
    hint: 'شغّل {cmd} في Claude Code لكتابة الملخص.',
    minutes: '{n} دقيقة',
    files: { one: 'ملف واحد', two: 'ملفان', few: '# ملفات', many: '# ملفًا', other: '# ملف' },
    commits: { one: 'commit واحد', two: '2 commits', other: '# commits' },
    empty: 'كل جلساتك لها ملخص.',
  },
  since: {
    title: 'منذ زيارتك الأخيرة',
    seeAll: 'اعرض الـ {total} في الخط الزمني',
    tide: 'كنتَ هنا {when}',
    pinned: 'تغيير في عقد الـ API',
    before: 'قبل',
    after: 'بعد',
    viaAgent: 'عبر الوكيل',
    kinds: {
      commits: 'commits جديدة',
      pr_opened: 'PR مفتوح',
      pr_merged: 'PR مدموج',
      session: 'جلسة عمل',
      handoff: 'تسليم عقد',
      decided: 'قرار محسوم',
      redesign: 'تصميم للمراجعة',
      doc: 'تحديث وثيقة',
      release: 'إصدار جديد',
      need_delivered: 'احتياج مُسلَّم',
    },
    more: { one: 'وحدث آخر', two: 'وحدثان آخران', few: 'و# أحداث أخرى', many: 'و# حدثًا آخر', other: 'و# حدث آخر' },
    empty: 'لا تغييرات منذ {when}.',
    system: 'النظام',
    fieldBranch: 'الفرع',
    fieldRepo: 'المستودع',
    fieldCard: 'البطاقة',
  },
  team: {
    title: 'الفريق هذا الأسبوع',
    week: '{from} إلى {to}',
    up: 'أكثر بـ {n}',
    down: 'أقل بـ {n}',
    same: 'مثل الأسبوع الماضي',
    lastWeek: 'كان {n}',
    activity: 'النشاط في آخر 14 يومًا',
    activityShort: 'النشاط في آخر 7 أيام',
    activityHint: 'الجلسات والـ commits والبطاقات المغلقة في كل يوم. الأعضاء مرتبون بالاسم.',
    fewer: 'أقل',
    more: 'أكثر',
    cell: {
      zero: '{name}، {date}: لا نشاط',
      one: '{name}، {date}: حدث واحد',
      two: '{name}، {date}: حدثان',
      few: '{name}، {date}: # أحداث',
      many: '{name}، {date}: # حدثًا',
      other: '{name}، {date}: # حدث',
    },
    readoutIdle: 'مرّر المؤشر على يوم أو انتقل إليه بالأسهم لترى العدد الدقيق.',
    online: 'متصل',
    lastSeen: 'آخر ظهور {rel}',
    focus: 'يعمل على',
    noFocus: 'لا مهمة محجوزة',
    today: 'اليوم',
    member: 'العضو',
  },
  flow: {
    title: 'حركة البطاقات حسب النوع',
    hint: 'ما أُنشئ مقابل ما أُغلق هذا الأسبوع.',
    created: 'أُنشئ',
    closed: 'أُغلق',
    netMore: 'المفتوح زاد {n}',
    netFewer: 'المفتوح قلّ {n}',
    netEven: 'متوازن',
  },
  sources: {
    title: 'مصادر الالتقاط',
    kinds: { github_repo: 'مستودع GitHub', openapi: 'عقد OpenAPI', lab: 'مختبر التصميم', docs_folder: 'مجلد الوثائق' },
    ok: 'يعمل، آخر مزامنة {rel}',
    lagging: 'متأخر {d}',
    failing: 'متعطّل',
    lastSuccess: 'آخر نجاح {when}',
    runs: 'تشغيلات 24 ساعة',
    cards: 'بطاقات 24 ساعة',
    summary: '{ok} تعمل، {lag} متأخر، {fail} متعطّل',
    allLive: 'المصادر كلها تعمل.',
  },
  elsewhere: {
    title: 'في بقية Hub',
    inbox: 'الوارد غير المقروء',
    decisions: 'قرارات مفتوحة في المساحة',
    needs: 'احتياجات مفتوحة في المساحة',
    handoffs: 'تسليمات معلّقة في المساحة',
    redesigns: 'تصاميم قيد المراجعة',
    quiet: 'لا شيء مفتوح في مساحة العمل.',
  },
  copy: { copied: 'نُسخ', label: 'انسخ الأمر {cmd}' },
  loading: { label: 'جارٍ تحميل صفحة يومي', still: 'ما زال التحميل جاريًا…' },
  error: {
    title: 'تعذّر تحميل صفحة يومي',
    body: 'الخادم لم يرد. تبقى بياناتك كما هي، وأعد المحاولة بعد لحظة.',
    code: 'HTTP 503 hub.today.unavailable',
    retry: 'أعد المحاولة',
  },
};

const en: Dict = {
  skip: 'Skip to what needs you',
  masthead: {
    greeting: 'Good morning, {name}',
    ready: { one: '1 task ready to claim', other: '# tasks ready to claim' },
    since: { one: '1 update since {when}', other: '# updates since {when}' },
    sources: { one: '1 capture source needs a look', other: '# capture sources need a look' },
    and: ' and ',
    quiet: 'A quiet morning, with nothing new since {when}.',
    refresh: 'Refresh',
    refreshing: 'Refreshing',
    updated: 'Updated {when}',
  },
  keys: {
    open: 'Keyboard shortcuts',
    title: 'Keyboard shortcuts',
    toggle: 'One-key shortcuts',
    on: 'On',
    off: 'Off',
    offHint: 'Undo stays available with Ctrl+Z.',
    list: [
      { keys: ['j', 'k'], label: 'Next and previous row' },
      { keys: ['Enter', 'o'], label: 'Open the row' },
      { keys: ['c'], label: 'Claim the task' },
      { keys: ['u'], label: 'Undo the last action' },
      { keys: ['r'], label: 'Refresh the page' },
      { keys: ['?'], label: 'This list' },
    ],
  },
  types: {
    task: 'Task',
    decision: 'Decision',
    need: 'Need',
    change: 'Change',
    handoff: 'Handoff',
    redesign: 'Redesign',
    doc: 'Doc',
    release: 'Release',
  },
  roles: {
    owner: 'Owner',
    pm: 'PM',
    accountant: 'Accountant',
    backend: 'Backend',
    frontend: 'Frontend',
    designer: 'Designer',
    qa: 'QA',
  },
  actions: {
    decide: 'Decide',
    deliver: 'Deliver',
    verify: 'Verify',
    acknowledge: 'Acknowledge',
    review: 'Review',
    approve: 'Approve',
    claim: 'Claim',
  },
  done: {
    decide: 'Decision recorded on {key}',
    deliver: 'Delivered {key}',
    verify: 'Verified {key}',
    acknowledge: 'Acknowledged {key}',
    review: 'Reviewed {key}',
    approve: 'Approved {key}',
    claim: 'Claimed {key}',
  },
  undo: 'Undo',
  dismiss: 'Dismiss',
  row: {
    details: 'Details',
    openCard: 'Open the card page',
    copyKey: 'Copy the key {key}',
  },
  needs: {
    waiting: 'waiting on you',
    overdue: { one: '1 overdue', other: '# overdue', zero: '' },
    soon: { one: '1 due within 24 hours', other: '# due within 24 hours', zero: '' },
    cleared: { one: 'You cleared 1 today', other: 'You cleared # today', zero: '' },
    overdueBy: '{d} overdue',
    escalated: 'Escalated to you',
    dueSoon: 'Due {rel}, {when}',
    dueLater: 'Due {when}',
    blocks: { one: 'Blocks 1 card', other: 'Blocks # cards' },
    breaking: 'Breaking change',
    forRole: 'As {role}',
    openedBy: 'Opened by {who}',
    openedByAgent: 'Opened by {who}’s agent',
    openedBySystem: 'Opened by the system',
    fieldOpened: 'Source',
    fieldModule: 'Module',
    fieldStatus: 'Status',
    fieldFor: 'Role',
    fieldDue: 'Due',
    fieldNote: 'Note',
    allDueHere: 'Every deadline in the next 72 hours is in this list.',
    dueTitle: 'When they fall due',
    dueLate: 'overdue',
    dueNone: 'no date',
    alsoDue: 'Due soon, not waiting on you',
    seeAll: 'See all ({total})',
    emptyTitle: 'Nothing waits for you.',
    emptyBody: 'Decisions, needs and handoffs routed to your roles show up here first.',
    emptyLink: 'Open the timeline',
  },
  letter: {
    title: 'Morning letter',
    signed: 'Written by your agent at {when}',
    collapse: 'Show less',
    expand: 'Read the whole letter',
    absentTitle: 'Your agent has not written today’s letter yet',
    absentBody: 'Run {cmd} in Claude Code and it writes one from the sections on this page.',
    cardLink: '{type} {key}',
  },
  ready: {
    title: 'Ready for you',
    claim: 'Claim',
    claimTask: 'Claim {key}',
    blockedBy: 'Blocked by {key}',
    blockedToast: '{key} can’t be claimed yet: it is blocked by {blocker}.',
    effort: 'Effort',
    specialty: { backend: 'Backend', frontend: 'Frontend', design: 'Design', qa: 'QA', ops: 'Ops', docs: 'Docs' },
    toast: 'Claimed {key}. Paste this in Claude Code to start:',
    seeAll: 'See all ({total})',
    emptyTitle: 'No ready tasks for your roles.',
    emptyBody: 'Ready tasks for your specialties appear here, highest priority first.',
    emptyLink: 'Check the backlog',
  },
  sessions: {
    title: 'Your sessions without a summary',
    noSummary: 'No summary',
    hint: 'Run {cmd} in Claude Code to write the summary.',
    minutes: '{n} min',
    files: { one: '1 file', other: '# files' },
    commits: { one: '1 commit', other: '# commits' },
    empty: 'Every session of yours has a summary.',
  },
  since: {
    title: 'Since your last visit',
    seeAll: 'See all {total} in the timeline',
    tide: 'You were here {when}',
    pinned: 'API contract change',
    before: 'Before',
    after: 'After',
    viaAgent: 'via agent',
    kinds: {
      commits: 'pushed commits',
      pr_opened: 'opened a PR',
      pr_merged: 'merged a PR',
      session: 'logged a session',
      handoff: 'contract handoff',
      decided: 'made a decision',
      redesign: 'sent a redesign to review',
      doc: 'updated a doc',
      release: 'released',
      need_delivered: 'delivered a need',
    },
    more: { one: 'and 1 more event', other: 'and # more events' },
    empty: 'No changes since {when}.',
    system: 'System',
    fieldBranch: 'Branch',
    fieldRepo: 'Repo',
    fieldCard: 'Card',
  },
  team: {
    title: 'Team this week',
    week: '{from} to {to}',
    up: 'Up {n}',
    down: 'Down {n}',
    same: 'Same as last week',
    lastWeek: 'was {n}',
    activity: 'Activity, last 14 days',
    activityShort: 'Activity, last 7 days',
    activityHint: 'Sessions, commits and closed cards per day. Members are sorted by name.',
    fewer: 'Fewer',
    more: 'More',
    cell: { zero: '{name}, {date}: no activity', one: '{name}, {date}: 1 event', other: '{name}, {date}: # events' },
    readoutIdle: 'Hover a day, or move to it with the arrow keys, to see the exact count.',
    online: 'Online',
    lastSeen: 'Last seen {rel}',
    focus: 'Working on',
    noFocus: 'No claimed task',
    today: 'today',
    member: 'Member',
  },
  flow: {
    title: 'Card flow by type',
    hint: 'Created against closed this week.',
    created: 'created',
    closed: 'closed',
    netMore: '{n} more open',
    netFewer: '{n} fewer open',
    netEven: 'Even',
  },
  sources: {
    title: 'Capture sources',
    kinds: { github_repo: 'GitHub repo', openapi: 'OpenAPI contract', lab: 'Redesign lab', docs_folder: 'Docs folder' },
    ok: 'Live, synced {rel}',
    lagging: '{d} behind',
    failing: 'Failing',
    lastSuccess: 'Last success {when}',
    runs: 'Runs in 24 h',
    cards: 'Cards in 24 h',
    summary: '{ok} live, {lag} behind, {fail} failing',
    allLive: 'Every source is live.',
  },
  elsewhere: {
    title: 'Elsewhere in Hub',
    inbox: 'Inbox unread',
    decisions: 'Open decisions in the workspace',
    needs: 'Open needs in the workspace',
    handoffs: 'Pending handoffs in the workspace',
    redesigns: 'Redesigns in review',
    quiet: 'Nothing is open in the workspace.',
  },
  copy: { copied: 'Copied', label: 'Copy the command {cmd}' },
  loading: { label: 'Loading Today', still: 'Still loading…' },
  error: {
    title: 'Couldn’t load Today',
    body: 'The server did not answer. Your data is safe. Try again in a moment.',
    code: 'HTTP 503 hub.today.unavailable',
    retry: 'Try again',
  },
};

export const messages = { ar, en };
export type Messages = Dict;
