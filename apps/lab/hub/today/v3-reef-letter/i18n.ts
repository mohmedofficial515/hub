import type { Action, CardType, Role, SourceHealth, EventKind } from '@lab/mocks/hub-today';
import type { PluralForms } from './parts/format';

/**
 * All visible text. `{key}` / `{cmd}` / `{when}` placeholders are split by the components so that card
 * keys and commands render as LTR isolates inside Arabic sentences (docs/08 §4 rule 2). Plural nouns
 * are given as Intl.PluralRules categories (Arabic needs zero/one/two/few/many).
 *
 * Arabic verbs and event labels avoid a gender: past-tense verbs are unvocalised ("راجعت") and timeline
 * events use the verbal noun ("تسجيل جلسة"), so the same string works for Sara and for Yousef.
 */
type Specialty = 'backend' | 'frontend' | 'design' | 'qa' | 'ops' | 'docs';

interface Dict {
  page: {
    name: string;
    skip: string;
    refresh: string;
    updated: string;
    updating: string;
    refreshed: string;
    shortcuts: string;
  };
  greeting: { morning: string; afternoon: string; evening: string };
  summary: {
    overdue: PluralForms;
    overdueNext: string;
    overdueOnly: string;
    nextOnly: string;
    calm: string;
    clear: string;
  };
  hero: {
    title: string;
    left: string;
    leftOf: string;
    allClear: string;
    overdueKey: string;
    soonKey: string;
    ready: PluralForms;
    sessions: PluralForms;
    changed: PluralForms;
    quiet: string;
    aria: string;
    ariaNeeds: string;
    ariaCleared: string;
    segmentRow: string;
    typeCount: Record<CardType, PluralForms>;
  };
  types: Record<CardType, string>;
  roles: Record<Role, string>;
  actions: Record<Action, string>;
  done: Record<Action, string>;
  undo: string;
  dismiss: string;
  needs: {
    title: string;
    order: string;
    overdueBy: string;
    escalated: string;
    dueSoon: string;
    due: string;
    blocks: PluralForms;
    breaking: string;
    seeAll: string;
    emptyTitle: string;
    emptyBody: string;
    clearedTitle: string;
    clearedBody: string;
    alsoDue: string;
    showDetails: string;
    details: {
      status: string;
      routedTo: string;
      priority: string;
      due: string;
      openedBy: string;
      module: string;
      blocks: string;
      none: string;
      open: string;
      agentOf: string;
    };
    status: Record<string, string>;
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
  since: {
    title: string;
    seeAll: string;
    tide: string;
    pinned: string;
    before: string;
    after: string;
    today: string;
    yesterday: string;
    viaAgent: string;
    moreEvents: string;
    kinds: Record<EventKind, string>;
    empty: string;
    system: string;
  };
  sessions: {
    title: string;
    hint: string;
    minutes: string;
    files: PluralForms;
    commits: PluralForms;
  };
  team: {
    title: string;
    vs: string;
    up: string;
    down: string;
    same: string;
    lastWeek: string;
    activity: string;
    activityShort: string;
    activityHint: string;
    legendLabel: string;
    cell: PluralForms;
    readoutIdle: string;
    online: string;
    lastSeen: string;
    focus: string;
    noFocus: string;
    today: string;
    member: string;
    flow: string;
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
    summary: string;
    allLive: string;
    tooltip: string;
  };
  keys: {
    title: string;
    intro: string;
    toggle: string;
    on: string;
    off: string;
    close: string;
    list: { keys: string[]; label: string }[];
    hint: string;
    undoHint: string;
  };
  copy: { copied: string; label: string };
  loading: { label: string; still: string };
  error: { title: string; body: string; retry: string; code: string };
}

const ar: Dict = {
  page: {
    name: 'يومي',
    skip: 'انتقل إلى ما ينتظرك',
    refresh: 'تحديث',
    updated: 'حُدّث {when}',
    updating: 'يجري التحديث',
    refreshed: 'اكتمل التحديث',
    shortcuts: 'اختصارات لوحة المفاتيح',
  },
  greeting: { morning: 'صباح الخير يا {name}', afternoon: 'طاب يومك يا {name}', evening: 'مساء الخير يا {name}' },
  summary: {
    overdue: { one: 'أمر واحد متأخر', two: 'أمران متأخران', few: '# أمور متأخرة', many: '# أمرًا متأخرًا', other: '# أمر متأخر' },
    overdueNext: '{overdue}، وأقرب موعد {when}.',
    overdueOnly: '{overdue}، ولا مواعيد أخرى قريبة.',
    nextOnly: 'لا شيء متأخر، وأقرب موعد {when}.',
    calm: 'لا شيء متأخر، ولا مواعيد قريبة.',
    clear: 'لا شيء ينتظرك الآن.',
  },
  hero: {
    title: 'شكل يومك',
    left: 'ينتظرك',
    leftOf: 'بقي من {total}',
    allClear: 'لا شيء ينتظرك',
    overdueKey: 'متأخر',
    soonKey: 'خلال 24 ساعة',
    ready: { one: 'مهمة جاهزة لأدوارك', two: 'مهمتان جاهزتان لأدوارك', few: 'مهام جاهزة لأدوارك', many: 'مهمة جاهزة لأدوارك', other: 'مهمة جاهزة لأدوارك' },
    sessions: { one: 'جلسة بلا ملخص', two: 'جلستان بلا ملخص', few: 'جلسات بلا ملخص', many: 'جلسة بلا ملخص', other: 'جلسة بلا ملخص' },
    changed: { one: 'تغيير منذ زيارتك', two: 'تغييران منذ زيارتك', few: 'تغييرات منذ زيارتك', many: 'تغييرًا منذ زيارتك', other: 'تغيير منذ زيارتك' },
    quiet: 'لا مهام جاهزة، ولا تغييرات منذ زيارتك.',
    aria: 'شكل يومك: {parts}',
    ariaNeeds: '{n} ينتظرك: {types}',
    ariaCleared: '{n} أُنجز',
    segmentRow: '{type} {key}',
    typeCount: {
      decision: { one: 'قرار واحد', two: 'قراران', few: '# قرارات', many: '# قرارًا', other: '# قرار' },
      need: { one: 'احتياج واحد', two: 'احتياجان', few: '# احتياجات', many: '# احتياجًا', other: '# احتياج' },
      handoff: { one: 'تسليم واحد', two: 'تسليمان', few: '# تسليمات', many: '# تسليمًا', other: '# تسليم' },
      redesign: { one: 'تصميم واحد', two: 'تصميمان', few: '# تصاميم', many: '# تصميمًا', other: '# تصميم' },
      task: { one: 'مهمة واحدة', two: 'مهمتان', few: '# مهام', many: '# مهمة', other: '# مهمة' },
      change: { one: 'تغيير واحد', two: 'تغييران', few: '# تغييرات', many: '# تغييرًا', other: '# تغيير' },
      doc: { one: 'وثيقة واحدة', two: 'وثيقتان', few: '# وثائق', many: '# وثيقة', other: '# وثيقة' },
      release: { one: 'إصدار واحد', two: 'إصداران', few: '# إصدارات', many: '# إصدارًا', other: '# إصدار' },
    },
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
    verify: 'تم التحقق من {key}',
    acknowledge: 'استُلم {key}',
    review: 'تمت مراجعة {key}',
    approve: 'تمت الموافقة على {key}',
    claim: 'حُجز {key}',
  },
  undo: 'تراجع',
  dismiss: 'إغلاق',
  needs: {
    title: 'ينتظرك',
    order: 'المتأخر أولًا، ثم ما يحين خلال 24 ساعة.',
    overdueBy: 'متأخر {d}',
    escalated: 'صُعِّد إليك',
    dueSoon: '{rel}',
    due: 'موعده {when}',
    blocks: { one: 'يوقف بطاقة واحدة', two: 'يوقف بطاقتين', few: 'يوقف # بطاقات', many: 'يوقف # بطاقة', other: 'يوقف # بطاقة' },
    breaking: 'تغيير كاسر',
    seeAll: 'اعرض الكل ({total})',
    emptyTitle: 'لا شيء ينتظرك.',
    emptyBody: 'استمتع بيومك. ما يُوجَّه إلى أدوارك يظهر هنا أولًا.',
    clearedTitle: 'أنجزت كل ما كان ينتظرك.',
    clearedBody: 'ما يصل بعد الآن يظهر هنا أولًا.',
    alsoDue: 'يحين أيضًا خلال 72 ساعة',
    showDetails: 'اعرض تفاصيل {key}',
    details: {
      status: 'الحالة',
      routedTo: 'موجّه إلى',
      priority: 'الأولوية',
      due: 'الموعد',
      openedBy: 'فتحه',
      module: 'الوحدة',
      blocks: 'يوقف',
      none: 'لا يوجد',
      open: 'افتح البطاقة',
      agentOf: 'وكيل {name}',
    },
    status: {
      open: 'مفتوح',
      requested: 'مطلوب',
      review: 'قيد المراجعة',
      delivered: 'سُلّم',
      pending: 'معلّق',
      acknowledged: 'استُلم',
      approved: 'معتمد',
      ready: 'جاهز',
    },
  },
  ready: {
    title: 'جاهزة لأدوارك',
    claim: 'احجز',
    claimTask: 'احجز {key}',
    blockedBy: 'متوقفة على {key}',
    blockedToast: '{key} متوقفة على {blocker}، فلا يمكن حجزها الآن.',
    effort: 'الجهد',
    specialty: { backend: 'باك إند', frontend: 'فرونت إند', design: 'تصميم', qa: 'جودة', ops: 'عمليات', docs: 'توثيق' },
    toast: 'حُجز {key}. الصق هذا الأمر في Claude Code لتبدأ:',
    emptyTitle: 'لا مهام جاهزة لأدوارك.',
    emptyBody: 'تظهر هنا المهام الجاهزة لتخصصاتك، الأعلى أولوية أولًا.',
    emptyLink: 'افتح قائمة المهام',
  },
  letter: {
    title: 'رسالة الصباح',
    signed: 'كتبها وكيلك الساعة {when}',
    collapse: 'اطوِ الرسالة',
    expand: 'اقرأ الرسالة كاملة',
    absentTitle: 'لم يكتب وكيلك رسالة اليوم بعد.',
    absentBody: 'شغّل {cmd} في Claude Code ليكتبها من أقسام هذه الصفحة.',
    cardLink: '{type} {key}',
  },
  since: {
    title: 'منذ زيارتك الأخيرة',
    seeAll: 'اعرض الـ {total} كلها في الخط الزمني',
    tide: 'كنت هنا {when}',
    pinned: 'تغيير في عقد الـ API',
    before: 'قبل',
    after: 'بعد',
    today: 'اليوم',
    yesterday: 'أمس',
    viaAgent: 'عبر الوكيل',
    moreEvents: 'و{n} أحداث أخرى على هذه البطاقة',
    kinds: {
      commits: 'دفع commits',
      pr_opened: 'فتح PR',
      pr_merged: 'دمج PR',
      session: 'تسجيل جلسة',
      handoff: 'تسليم عقد',
      decided: 'حسم قرار',
      redesign: 'إرسال تصميم للمراجعة',
      doc: 'تحديث وثيقة',
      release: 'إصدار',
      need_delivered: 'تسليم احتياج',
    },
    empty: 'لا تغييرات منذ {when}.',
    system: 'النظام',
  },
  sessions: {
    title: 'جلسات بلا ملخص',
    hint: 'شغّل {cmd} في Claude Code لكتابة الملخص.',
    minutes: '{n} دقيقة',
    files: { one: 'ملف واحد', two: 'ملفان', few: '# ملفات', many: '# ملفًا', other: '# ملف' },
    commits: { one: 'commit واحد', two: '2 commits', other: '# commits' },
  },
  team: {
    title: 'الفريق هذا الأسبوع',
    vs: 'الفرق عن الأسبوع الماضي.',
    up: 'أكثر بـ {n}',
    down: 'أقل بـ {n}',
    same: 'بلا تغيّر',
    lastWeek: 'الأسبوع الماضي: {n}',
    activity: 'النشاط في آخر 14 يومًا',
    activityShort: 'النشاط في آخر 7 أيام',
    activityHint: 'الجلسات والـ commits والبطاقات المغلقة في كل يوم. الأسماء مرتبة أبجديًا.',
    legendLabel: 'الأحداث في اليوم',
    cell: { zero: '{name}، {date}: لا نشاط', one: '{name}، {date}: حدث واحد', two: '{name}، {date}: حدثان', few: '{name}، {date}: # أحداث', many: '{name}، {date}: # حدثًا', other: '{name}، {date}: # حدث' },
    readoutIdle: 'مرّر المؤشر على يوم، أو انتقل إليه بالأسهم، لترى العدد.',
    online: 'متصل الآن',
    lastSeen: 'آخر ظهور {rel}',
    focus: 'يعمل على',
    noFocus: 'لا مهمة محجوزة',
    today: 'اليوم',
    member: 'العضو',
    flow: 'حركة البطاقات حسب النوع',
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
    summary: '{ok} تعمل، {lag} متأخر، {fail} متعطّل',
    allLive: 'المصادر كلها تعمل.',
    tooltip: '{kind}: {target}. في 24 ساعة: {runs} تشغيلًا، {cards} بطاقة.',
  },
  keys: {
    title: 'اختصارات لوحة المفاتيح',
    intro: 'تعمل حين لا يكون المؤشر داخل حقل نص.',
    toggle: 'الاختصارات ذات المفتاح الواحد',
    on: 'مفعّلة',
    off: 'متوقفة',
    close: 'إغلاق',
    list: [
      { keys: ['j', 'k'], label: 'الصف التالي والسابق' },
      { keys: ['Enter', 'o'], label: 'افتح تفاصيل الصف' },
      { keys: ['c'], label: 'احجز المهمة المحددة' },
      { keys: ['a'], label: 'استلم التسليم المحدد' },
      { keys: ['u'], label: 'تراجع عن آخر إجراء' },
      { keys: ['r'], label: 'حدّث الصفحة' },
      { keys: ['?'], label: 'اعرض هذه القائمة' },
    ],
    hint: 'اضغط ؟ لعرض الاختصارات.',
    undoHint: 'أو اضغط u',
  },
  copy: { copied: 'نُسخ', label: 'انسخ الأمر {cmd}' },
  loading: { label: 'جارٍ تحميل صفحة يومي', still: 'ما زال التحميل جاريًا…' },
  error: {
    title: 'تعذّر تحميل صفحة يومي',
    body: 'لم يستجب الخادم. أعد المحاولة، وإن تكرر الخطأ فأرسل الرمز أدناه لمدير المشروع.',
    retry: 'أعد المحاولة',
    code: 'hub.today.unavailable',
  },
};

const en: Dict = {
  page: {
    name: 'Today',
    skip: 'Skip to what needs you',
    refresh: 'Refresh',
    updated: 'Updated {when}',
    updating: 'Updating',
    refreshed: 'Up to date',
    shortcuts: 'Keyboard shortcuts',
  },
  greeting: { morning: 'Good morning, {name}', afternoon: 'Good afternoon, {name}', evening: 'Good evening, {name}' },
  summary: {
    overdue: { one: 'One item is overdue', other: '# items are overdue' },
    overdueNext: '{overdue}, and the next deadline is {when}.',
    overdueOnly: '{overdue}, and no other deadline is close.',
    nextOnly: 'Nothing is overdue, and the next deadline is {when}.',
    calm: 'Nothing is overdue, and no deadline is close.',
    clear: 'Nothing needs you right now.',
  },
  hero: {
    title: 'The shape of your day',
    left: 'need you',
    leftOf: 'left of {total}',
    allClear: 'Nothing needs you',
    overdueKey: 'Overdue',
    soonKey: 'Within 24 h',
    ready: { one: 'task ready for your roles', other: 'tasks ready for your roles' },
    sessions: { one: 'session without a summary', other: 'sessions without a summary' },
    changed: { one: 'change since your visit', other: 'changes since your visit' },
    quiet: 'No tasks ready, and no changes since your visit.',
    aria: 'The shape of your day: {parts}',
    ariaNeeds: '{n} need you: {types}',
    ariaCleared: '{n} cleared',
    segmentRow: '{type} {key}',
    typeCount: {
      decision: { one: '1 decision', other: '# decisions' },
      need: { one: '1 need', other: '# needs' },
      handoff: { one: '1 handoff', other: '# handoffs' },
      redesign: { one: '1 redesign', other: '# redesigns' },
      task: { one: '1 task', other: '# tasks' },
      change: { one: '1 change', other: '# changes' },
      doc: { one: '1 doc', other: '# docs' },
      release: { one: '1 release', other: '# releases' },
    },
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
  needs: {
    title: 'Needs you',
    order: 'Overdue first, then anything due within 24 hours.',
    overdueBy: '{d} overdue',
    escalated: 'Escalated to you',
    dueSoon: 'Due {rel}',
    due: 'Due {when}',
    blocks: { one: 'Blocks 1 card', other: 'Blocks # cards' },
    breaking: 'Breaking change',
    seeAll: 'See all ({total})',
    emptyTitle: 'Nothing waits for you.',
    emptyBody: 'Enjoy your day. Anything routed to your roles shows up here first.',
    clearedTitle: 'You cleared everything that was waiting.',
    clearedBody: 'Anything new shows up here first.',
    alsoDue: 'Also due within 72 hours',
    showDetails: 'Show details of {key}',
    details: {
      status: 'Status',
      routedTo: 'Routed to',
      priority: 'Priority',
      due: 'Due',
      openedBy: 'Opened by',
      module: 'Module',
      blocks: 'Blocks',
      none: 'None',
      open: 'Open the card',
      agentOf: '{name}’s agent',
    },
    status: {
      open: 'Open',
      requested: 'Requested',
      review: 'In review',
      delivered: 'Delivered',
      pending: 'Pending',
      acknowledged: 'Acknowledged',
      approved: 'Approved',
      ready: 'Ready',
    },
  },
  ready: {
    title: 'Ready for your roles',
    claim: 'Claim',
    claimTask: 'Claim {key}',
    blockedBy: 'Blocked by {key}',
    blockedToast: '{key} is blocked by {blocker}, so it can’t be claimed yet.',
    effort: 'Effort',
    specialty: { backend: 'Backend', frontend: 'Frontend', design: 'Design', qa: 'QA', ops: 'Ops', docs: 'Docs' },
    toast: 'Claimed {key}. Paste this in Claude Code to start:',
    emptyTitle: 'No ready tasks for your roles.',
    emptyBody: 'Ready tasks for your specialties appear here, highest priority first.',
    emptyLink: 'Check the backlog',
  },
  letter: {
    title: 'Morning letter',
    signed: 'Written by your agent at {when}',
    collapse: 'Fold the letter',
    expand: 'Read the whole letter',
    absentTitle: 'Your agent has not written today’s letter yet.',
    absentBody: 'Run {cmd} in Claude Code and it writes one from the sections on this page.',
    cardLink: '{type} {key}',
  },
  since: {
    title: 'Since your last visit',
    seeAll: 'See all {total} in the timeline',
    tide: 'You were here {when}',
    pinned: 'API contract change',
    before: 'Before',
    after: 'After',
    today: 'Today',
    yesterday: 'Yesterday',
    viaAgent: 'via agent',
    moreEvents: 'and {n} more events on this card',
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
    empty: 'No changes since {when}.',
    system: 'System',
  },
  sessions: {
    title: 'Sessions without a summary',
    hint: 'Run {cmd} in Claude Code to write the summary.',
    minutes: '{n} min',
    files: { one: '1 file', other: '# files' },
    commits: { one: '1 commit', other: '# commits' },
  },
  team: {
    title: 'The team this week',
    vs: 'Change from last week.',
    up: '{n} more',
    down: '{n} fewer',
    same: 'no change',
    lastWeek: 'Last week: {n}',
    activity: 'Activity, last 14 days',
    activityShort: 'Activity, last 7 days',
    activityHint: 'Sessions, commits and closed cards per day. Names are in alphabetical order.',
    legendLabel: 'Events a day',
    cell: { zero: '{name}, {date}: no activity', one: '{name}, {date}: 1 event', other: '{name}, {date}: # events' },
    readoutIdle: 'Hover a day, or move to it with the arrow keys, to see the count.',
    online: 'Online now',
    lastSeen: 'Last seen {rel}',
    focus: 'Working on',
    noFocus: 'No claimed task',
    today: 'today',
    member: 'Member',
    flow: 'Card flow by type',
    created: 'Created',
    closed: 'Closed',
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
    summary: '{ok} live, {lag} behind, {fail} failing',
    allLive: 'Every source is live.',
    tooltip: '{kind}: {target}. In 24 h: {runs} runs, {cards} cards.',
  },
  keys: {
    title: 'Keyboard shortcuts',
    intro: 'They work whenever the cursor is not in a text field.',
    toggle: 'Single-key shortcuts',
    on: 'On',
    off: 'Off',
    close: 'Close',
    list: [
      { keys: ['j', 'k'], label: 'Next and previous row' },
      { keys: ['Enter', 'o'], label: 'Open the row’s details' },
      { keys: ['c'], label: 'Claim the selected task' },
      { keys: ['a'], label: 'Acknowledge the selected handoff' },
      { keys: ['u'], label: 'Undo the last action' },
      { keys: ['r'], label: 'Refresh the page' },
      { keys: ['?'], label: 'Show this list' },
    ],
    hint: 'Press ? for shortcuts.',
    undoHint: 'or press u',
  },
  copy: { copied: 'Copied', label: 'Copy the command {cmd}' },
  loading: { label: 'Loading Today', still: 'Still loading…' },
  error: {
    title: 'Couldn’t load Today',
    body: 'The server did not respond. Try again, and if it keeps failing send the code below to your PM.',
    retry: 'Try again',
    code: 'hub.today.unavailable',
  },
};

export const messages = { ar, en };
export type Messages = Dict;
