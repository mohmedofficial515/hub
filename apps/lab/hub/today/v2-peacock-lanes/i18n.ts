import type { Action, CardType, Role, SourceHealth } from '@lab/mocks/hub-today';
import type { PluralForms } from './parts/format';

/**
 * All visible text. `{key}` / `{cmd}` / `{when}` placeholders are split by the components so that
 * card keys and commands render as LTR isolates inside Arabic sentences (docs/08 §4 rule 2).
 * Plural nouns are given as Intl.PluralRules categories (Arabic needs zero/one/two/few/many).
 */
type Groups = 'urgent' | 'soon' | 'decision' | 'need' | 'handoff' | 'redesign' | 'review' | 'other';
type Specialty = 'backend' | 'frontend' | 'design' | 'qa' | 'ops' | 'docs';
type Counter = 'inbox' | 'awaiting' | 'decisions' | 'needs' | 'handoffs' | 'tasks' | 'redesigns' | 'sessions';
type Kind = 'commits' | 'pr_opened' | 'pr_merged' | 'session' | 'handoff' | 'decided' | 'redesign' | 'doc' | 'release' | 'need_delivered';

interface Dict {
  greeting: { morning: string; summary: PluralForms; overdue: PluralForms };
  refresh: string;
  updated: string;
  shortcuts: string;
  counters: {
    label: string;
    tiles: Record<Counter, string>;
    overdue: PluralForms;
    trend: { rising: string; falling: string; steady: string; quiet: string };
    series: string;
  };
  types: Record<CardType, string>;
  roles: Record<Role, string>;
  routed: string;
  actions: Record<Action, string>;
  done: Record<Action, string>;
  undo: string;
  stack: {
    title: string;
    cleared: string;
    groups: Record<Groups, string>;
    overdueBy: string;
    escalated: string;
    dueSoon: string;
    due: string;
    blocks: PluralForms;
    breaking: string;
    seeAll: string;
    emptyTitle: string;
    emptyBody: string;
  };
  runway: {
    title: string;
    now: string;
    overdue: string;
    day24: string;
    empty: string;
    pin: string;
    escalated: string;
  };
  ready: {
    title: string;
    claim: string;
    claimTask: string;
    blockedBy: string;
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
    showing: string;
    seeAll: string;
    tide: string;
    pinned: string;
    before: string;
    after: string;
    cards: string;
    commits: PluralForms;
    events: PluralForms;
    viaAgent: string;
    kinds: Record<Kind, string>;
    empty: string;
    system: string;
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
    flow: string;
    flowHint: string;
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
  copy: { copied: string; label: string };
  loading: { label: string; still: string };
  dismiss: string;
}

const ar: Dict = {
  greeting: {
    morning: 'صباح الخير يا {name}',
    summary: {
      zero: 'لا شيء ينتظرك هذا الصباح.',
      one: 'أمر واحد ينتظرك',
      two: 'أمران ينتظرانك',
      few: '# أمور تنتظرك',
      many: '# أمرًا ينتظرك',
      other: '# أمر ينتظرك',
    },
    overdue: { one: '، وأحدها متأخر.', two: '، واثنان منها متأخران.', other: '، و# منها متأخرة.', zero: '.' },
  },
  refresh: 'تحديث',
  updated: 'حُدّث {when}',
  shortcuts: 'اختصارات: j و k للتنقل، c للحجز، r للتحديث',
  counters: {
    label: 'نظرة سريعة',
    tiles: {
      inbox: 'غير مقروء في الوارد',
      awaiting: 'بانتظاري',
      decisions: 'قرارات مفتوحة',
      needs: 'احتياجات مفتوحة',
      handoffs: 'تسليمات معلّقة',
      tasks: 'مهام جاهزة لي',
      redesigns: 'تصاميم قيد المراجعة',
      sessions: 'جلسات بلا ملخص',
    },
    overdue: { one: 'قرار واحد متأخر', two: 'قراران متأخران', few: '# قرارات متأخرة', many: '# قرارًا متأخرًا', other: '# قرار متأخر', zero: 'لا متأخر' },
    trend: { rising: 'في ازدياد', falling: 'في تراجع', steady: 'مستقر', quiet: 'هادئ طوال الأسبوع' },
    series: 'آخر 7 أيام: {values}',
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
  routed: 'موجّه إلى دورك: {role}',
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
  stack: {
    title: 'بانتظاري',
    cleared: 'أُنجز اليوم: {n}',
    groups: {
      urgent: 'متأخر أو مُصعَّد',
      soon: 'مستحق خلال 24 ساعة',
      decision: 'قرارات',
      need: 'احتياجات',
      handoff: 'تسليمات',
      redesign: 'تصاميم',
      review: 'مراجعات',
      other: 'أخرى',
    },
    overdueBy: 'متأخر {d}',
    escalated: 'صُعِّد إليك',
    dueSoon: 'مستحق {rel}',
    due: 'موعده {when}',
    blocks: { one: 'يوقف بطاقة واحدة', two: 'يوقف بطاقتين', few: 'يوقف # بطاقات', many: 'يوقف # بطاقة', other: 'يوقف # بطاقة' },
    breaking: 'تغيير كاسر',
    seeAll: 'اعرض الكل ({total})',
    emptyTitle: 'لا شيء ينتظرك.',
    emptyBody: 'استمتع بالهدوء. القرارات والاحتياجات والتسليمات الموجّهة لأدوارك تظهر هنا أولًا.',
  },
  runway: {
    title: 'المواعيد خلال 72 ساعة',
    now: 'الآن',
    overdue: 'متأخر',
    day24: '24 ساعة',
    empty: 'لا مواعيد خلال الـ 72 ساعة القادمة.',
    pin: '{key}، {type}: {title}، موعده {when}',
    escalated: 'مُصعَّد',
  },
  ready: {
    title: 'جاهزة لأدواري',
    claim: 'احجز',
    claimTask: 'احجز {key}',
    blockedBy: 'متوقفة على {key}',
    effort: 'الجهد',
    specialty: { backend: 'باك إند', frontend: 'فرونت إند', design: 'تصميم', qa: 'جودة', ops: 'عمليات', docs: 'توثيق' },
    toast: 'حجزتَ {key}. الصق هذا الأمر في Claude Code لتبدأ:',
    emptyTitle: 'لا مهام جاهزة لأدوارك.',
    emptyBody: 'المهام الجاهزة لتخصصاتك تظهر هنا مرتبة بالأولوية.',
    emptyLink: 'افتح قائمة المهام',
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
  since: {
    title: 'منذ زيارتك الأخيرة',
    showing: 'يظهر {shown} من {total}',
    seeAll: 'اعرض الـ {total} في الخط الزمني',
    tide: 'كنتَ هنا {when}',
    pinned: 'تغيير في عقد الـ API',
    before: 'قبل',
    after: 'بعد',
    cards: 'بطاقات',
    commits: { one: 'commit واحد', two: '2 commits', other: '# commits' },
    events: { one: 'حدث واحد', two: 'حدثان', few: '# أحداث', many: '# حدثًا', other: '# حدث', zero: 'لا أحداث' },
    viaAgent: 'عبر الوكيل',
    kinds: {
      commits: 'دفع commits',
      pr_opened: 'فتح PR',
      pr_merged: 'دمج PR',
      session: 'سجّل جلسة',
      handoff: 'تسليم عقد',
      decided: 'حسم قرارًا',
      redesign: 'أرسل تصميمًا للمراجعة',
      doc: 'حدّث وثيقة',
      release: 'أصدر',
      need_delivered: 'سلّم احتياجًا',
    },
    empty: 'لا تغييرات منذ {when}.',
    system: 'النظام',
  },
  sessions: {
    title: 'جلسات بلا ملخص',
    noSummary: 'بلا ملخص',
    hint: 'شغّل {cmd} في Claude Code لكتابة الملخص.',
    minutes: '{n} دقيقة',
    files: { one: 'ملف واحد', two: 'ملفان', few: '# ملفات', many: '# ملفًا', other: '# ملف' },
    commits: { one: 'commit واحد', two: '2 commits', other: '# commits' },
    empty: 'كل جلساتك لها ملخص.',
  },
  team: {
    title: 'الفريق هذا الأسبوع',
    week: '{from} – {to}',
    up: 'أكثر بـ {n}',
    down: 'أقل بـ {n}',
    same: 'مثل الأسبوع الماضي',
    lastWeek: 'من الأسبوع الماضي ({n})',
    activity: 'النشاط في آخر 14 يومًا',
    activityShort: 'النشاط في آخر 7 أيام',
    activityHint: 'الجلسات والـ commits والبطاقات المغلقة في كل يوم. الأعضاء مرتبون بالاسم.',
    fewer: 'أقل',
    more: 'أكثر',
    cell: { zero: '{name}، {date}: لا نشاط', one: '{name}، {date}: حدث واحد', two: '{name}، {date}: حدثان', few: '{name}، {date}: # أحداث', many: '{name}، {date}: # حدثًا', other: '{name}، {date}: # حدث' },
    readoutIdle: 'مرّر المؤشر على يوم أو انتقل إليه بالأسهم لترى العدد الدقيق.',
    online: 'متصل الآن',
    lastSeen: 'آخر ظهور {rel}',
    focus: 'يعمل على',
    noFocus: 'لا مهمة محجوزة',
    today: 'اليوم',
    member: 'العضو',
    flow: 'حركة البطاقات حسب النوع',
    flowHint: 'ما أُنشئ مقابل ما أُغلق هذا الأسبوع.',
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
  copy: { copied: 'نُسخ', label: 'انسخ الأمر {cmd}' },
  loading: { label: 'جارٍ تحميل صفحة يومي', still: 'ما زال التحميل جاريًا…' },
  dismiss: 'إغلاق',
};

const en: Dict = {
  greeting: {
    morning: 'Good morning, {name}',
    summary: { zero: 'Nothing waits for you this morning.', one: '1 thing waits for you', other: '# things wait for you' },
    overdue: { one: ', and 1 is overdue.', other: ', and # are overdue.', zero: '.' },
  },
  refresh: 'Refresh',
  updated: 'Updated {when}',
  shortcuts: 'Shortcuts: j and k move, c claims, r refreshes',
  counters: {
    label: 'At a glance',
    tiles: {
      inbox: 'Inbox unread',
      awaiting: 'Awaiting me',
      decisions: 'Decisions open',
      needs: 'Needs open',
      handoffs: 'Handoffs pending',
      tasks: 'Tasks ready for me',
      redesigns: 'Redesigns in review',
      sessions: 'Sessions without summary',
    },
    overdue: { one: '1 overdue', other: '# overdue', zero: 'none overdue' },
    trend: { rising: 'rising', falling: 'falling', steady: 'steady', quiet: 'quiet all week' },
    series: 'Last 7 days: {values}',
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
  routed: 'Routed to your role: {role}',
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
  stack: {
    title: 'Awaiting me',
    cleared: '{n} cleared today',
    groups: {
      urgent: 'Overdue or escalated',
      soon: 'Due within 24 hours',
      decision: 'Decisions',
      need: 'Needs',
      handoff: 'Handoffs',
      redesign: 'Redesigns',
      review: 'Reviews',
      other: 'Other',
    },
    overdueBy: '{d} overdue',
    escalated: 'Escalated to you',
    dueSoon: 'Due {rel}',
    due: 'Due {when}',
    blocks: { one: 'Blocks 1 card', other: 'Blocks # cards' },
    breaking: 'Breaking change',
    seeAll: 'See all ({total})',
    emptyTitle: 'Nothing waits for you.',
    emptyBody: 'Enjoy the quiet. Decisions, needs and handoffs routed to your roles show up here first.',
  },
  runway: {
    title: 'Deadlines in the next 72 hours',
    now: 'now',
    overdue: 'Overdue',
    day24: '24 h',
    empty: 'No deadlines in the next 72 hours.',
    pin: '{key}, {type}: {title}, due {when}',
    escalated: 'escalated',
  },
  ready: {
    title: 'Ready for my roles',
    claim: 'Claim',
    claimTask: 'Claim {key}',
    blockedBy: 'Blocked by {key}',
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
    collapse: 'Show less',
    expand: 'Read the whole letter',
    absentTitle: 'Your agent has not written today’s letter yet',
    absentBody: 'Run {cmd} in Claude Code and it writes one from the sections on this page.',
    cardLink: '{type} {key}',
  },
  since: {
    title: 'Since your last visit',
    showing: 'showing {shown} of {total}',
    seeAll: 'See all {total} in the timeline',
    tide: 'You were here {when}',
    pinned: 'API contract change',
    before: 'Before',
    after: 'After',
    cards: 'Cards',
    commits: { one: '1 commit', other: '# commits' },
    events: { one: '1 event', other: '# events', zero: 'no events' },
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
    empty: 'No changes since {when}.',
    system: 'System',
  },
  sessions: {
    title: 'Sessions without summary',
    noSummary: 'No summary',
    hint: 'Run {cmd} in Claude Code to write the summary.',
    minutes: '{n} min',
    files: { one: '1 file', other: '# files' },
    commits: { one: '1 commit', other: '# commits' },
    empty: 'Every session of yours has a summary.',
  },
  team: {
    title: 'Team this week',
    week: '{from} – {to}',
    up: 'up {n}',
    down: 'down {n}',
    same: 'same as last week',
    lastWeek: 'from last week ({n})',
    activity: 'Activity, last 14 days',
    activityShort: 'Activity, last 7 days',
    activityHint: 'Sessions, commits and closed cards per day. Members are sorted by name.',
    fewer: 'Fewer',
    more: 'More',
    cell: { zero: '{name}, {date}: no activity', one: '{name}, {date}: 1 event', other: '{name}, {date}: # events' },
    readoutIdle: 'Hover a day, or move to it with the arrow keys, to see the exact count.',
    online: 'Online now',
    lastSeen: 'Last seen {rel}',
    focus: 'Working on',
    noFocus: 'No claimed task',
    today: 'today',
    member: 'Member',
    flow: 'Card flow by type',
    flowHint: 'Created against closed this week.',
    created: 'created',
    closed: 'closed',
    netMore: '{n} more open',
    netFewer: '{n} fewer open',
    netEven: 'even',
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
  copy: { copied: 'Copied', label: 'Copy the command {cmd}' },
  loading: { label: 'Loading Today', still: 'Still loading…' },
  dismiss: 'Dismiss',
};

export const messages = { ar, en };
export type Messages = Dict;
