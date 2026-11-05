import type { SourceHealth } from '@lab/mocks/hub-today';
import type { PluralForms } from '../../kit';

/**
 * Today's strings. `{key}` / `{cmd}` / `{when}` placeholders are split with `fill` so card keys and commands render
 * as LTR isolates inside Arabic sentences (08 §4 rule 2). Plurals use Intl.PluralRules categories.
 *
 * Voice: the act lane speaks in the first person, as the owner's headings do ("Awaiting me", "Ready for my roles").
 * The read lane addresses "you", as a letter does ("You were here"). Sentences never mix the two (review, copy).
 */
type Counter = 'inbox' | 'decisions' | 'needs' | 'handoffs' | 'redesigns';
type Kind = 'commits' | 'pr_opened' | 'pr_merged' | 'session' | 'handoff' | 'decided' | 'redesign' | 'doc' | 'release' | 'need_delivered';

interface Dict {
  title: string;
  greeting: { morning: string; summary: PluralForms; overdue: PluralForms };
  refresh: string;
  refreshed: string;
  updated: string;
  counters: {
    label: string;
    tiles: Record<Counter, string>;
    scope: string;
    scopeNeeds: string;
    scopeNone: string;
    overdue: PluralForms;
    series: string;
    quietAll: string;
  };
  stack: {
    title: string;
    cleared: string;
    groups: { urgent: string; soon: string; rest: string };
    overdueBy: string;
    escalated: string;
    dueSoon: string;
    due: string;
    stale: string;
    breaking: string;
    seeAll: string;
    emptyTitle: string;
    emptyBody: string;
    actionFor: string;
  };
  runway: {
    title: string;
    now: string;
    overdue: string;
    day24: string;
    later: string;
    empty: string;
    pin: string;
    pinInStack: string;
    inStackNote: PluralForms;
    escalated: string;
    jump: string;
  };
  ready: {
    title: string;
    claim: string;
    claimTask: string;
    blockedBy: string;
    effort: string;
    specialty: Record<'backend' | 'frontend' | 'design' | 'qa' | 'ops' | 'docs', string>;
    toast: string;
    blockedToast: string;
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
  };
  since: {
    title: string;
    seeAll: string;
    tide: string;
    pinned: string;
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
    offline: string;
    lastSeen: string;
    focus: string;
    noFocus: string;
    today: string;
    member: string;
    handoffsApplied: string;
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
    summaryOk: string;
    summaryLag: string;
    summaryFail: string;
    allLive: string;
  };
  loading: string;
  errorThing: string;
}

const ar: Dict = {
  title: 'يومي',
  greeting: {
    morning: 'صباح الخير يا {name}',
    summary: {
      zero: 'لا شيء بالانتظار هذا الصباح.',
      one: 'أمر واحد بالانتظار',
      two: 'أمران بالانتظار',
      few: '# أمور بالانتظار',
      many: '# أمرًا بالانتظار',
      other: '# أمر بالانتظار',
    },
    overdue: { one: '، وأحدها متأخر.', two: '، واثنان منها متأخران.', other: '، و# منها متأخرة.', zero: '.' },
  },
  refresh: 'تحديث',
  refreshed: 'حُدّثت الصفحة',
  updated: 'حُدّث {when}',
  counters: {
    label: 'نظرة سريعة',
    tiles: { inbox: 'الوارد غير المقروء', decisions: 'قراراتي', needs: 'احتياجاتي', handoffs: 'إحالاتي', redesigns: 'تصاميم قيد المراجعة' },
    scope: 'المفتوح كله: {all}',
    scopeNeeds: 'المفتوح وما ينتظر التحقق: {all}',
    scopeNone: 'لا شيء مفتوح',
    overdue: { one: 'قرار واحد متأخر', two: 'قراران متأخران', few: '# قرارات متأخرة', many: '# قرارًا متأخرًا', other: '# قرار متأخر', zero: 'لا شيء متأخر' },
    series: 'آخر 7 أيام: {values}',
    quietAll: 'أسبوع هادئ: لا شيء مفتوح.',
  },
  stack: {
    title: 'بانتظاري',
    cleared: 'أُنجز اليوم: {n}',
    groups: { urgent: 'متأخر أو مُصعَّد', soon: 'مستحق خلال 24 ساعة', rest: 'الباقي' },
    overdueBy: 'متأخر {d}',
    escalated: 'صُعِّد إليّ',
    dueSoon: 'مستحق {rel}',
    due: 'موعده {when}',
    stale: 'بلا استلام منذ {d}',
    breaking: 'تغيير كاسر',
    seeAll: 'اعرض الكل ({total})',
    emptyTitle: 'لا شيء بالانتظار.',
    emptyBody: 'القرارات والاحتياجات والإحالات الموجّهة لأدواري تظهر هنا أولًا.',
    actionFor: '{action} {key}',
  },
  runway: {
    title: 'المواعيد النهائية خلال 72 ساعة',
    now: 'الآن',
    overdue: 'متأخر',
    day24: '24 ساعة',
    later: 'لاحقًا',
    empty: 'لا مواعيد نهائية خلال الـ 72 ساعة القادمة.',
    pin: '{key}، {type}: {title}، موعده {when}',
    pinInStack: '{key}، {type}: {title}، موعده {when}. انتقل إليه في قائمة بانتظاري.',
    inStackNote: { one: 'وموعد آخر في قائمة بانتظاري أعلاه.', two: 'وموعدان آخران في قائمة بانتظاري أعلاه.', few: 'و# مواعيد أخرى في قائمة بانتظاري أعلاه.', many: 'و# موعدًا آخر في قائمة بانتظاري أعلاه.', other: 'و# موعد آخر في قائمة بانتظاري أعلاه.' },
    escalated: 'مُصعَّد',
    jump: 'في قائمتي',
  },
  ready: {
    title: 'جاهزة لأدواري',
    claim: 'احجز',
    claimTask: 'احجز {key}',
    blockedBy: 'متوقفة على {key}',
    effort: 'الجهد',
    specialty: { backend: 'باك إند', frontend: 'فرونت إند', design: 'تصميم', qa: 'جودة', ops: 'عمليات', docs: 'توثيق' },
    toast: 'تم حجز {key}. الصق هذا الأمر في Claude Code لتبدأ:',
    blockedToast: '{key} متوقفة على {blocker}، ولا يمكن حجزها الآن.',
    emptyTitle: 'لا مهام جاهزة لأدواري.',
    emptyBody: 'المهام الجاهزة لتخصصاتي تظهر هنا مرتبة بالأولوية.',
    emptyLink: 'افتح قائمة المهام',
  },
  letter: {
    title: 'رسالة الصباح',
    signed: 'كتبها وكيلك الساعة {when}',
    collapse: 'اختصر الرسالة',
    expand: 'اقرأ الرسالة كاملة',
    absentTitle: 'لم يكتب وكيلك رسالة اليوم بعد',
    absentBody: 'شغّل {cmd} في Claude Code ليكتبها من أقسام هذه الصفحة.',
  },
  since: {
    title: 'منذ زيارتك الأخيرة',
    seeAll: 'اعرض الكل في الخط الزمني ({total})',
    tide: 'زيارتك السابقة: {when}',
    pinned: 'تغيير في عقد الـ API',
    cards: 'بطاقات',
    commits: { one: 'commit واحد', two: '2 commits', other: '# commits' },
    events: { one: 'حدث واحد', two: 'حدثان', few: '# أحداث', many: '# حدثًا', other: '# حدث', zero: 'لا أحداث' },
    viaAgent: 'عبر الوكيل',
    kinds: {
      commits: 'دفع commits',
      pr_opened: 'فتح PR',
      pr_merged: 'دمج PR',
      session: 'تسجيل جلسة',
      handoff: 'إحالة عقد',
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
    same: 'بلا تغيير',
    lastWeek: 'من الأسبوع الماضي ({n})',
    activity: 'النشاط في آخر 14 يومًا',
    activityShort: 'النشاط في آخر 7 أيام',
    activityHint: 'الجلسات والـ commits والبطاقات المغلقة في كل يوم. الأعضاء مرتبون بالاسم.',
    fewer: 'أقل',
    more: 'أكثر',
    cell: { zero: '{name}، {date}: لا نشاط', one: '{name}، {date}: حدث واحد', two: '{name}، {date}: حدثان', few: '{name}، {date}: # أحداث', many: '{name}، {date}: # حدثًا', other: '{name}، {date}: # حدث' },
    readoutIdle: 'مرّر المؤشر على يوم أو انتقل إليه بالأسهم لترى العدد الدقيق.',
    online: 'على الخط الآن',
    offline: 'خارج الخط',
    lastSeen: 'آخر ظهور {rel}',
    focus: 'العمل على',
    noFocus: 'لا مهمة محجوزة',
    today: 'اليوم',
    member: 'العضو',
    handoffsApplied: 'إحالات طُبّقت',
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
    failing: 'يفشل',
    lastSuccess: 'آخر نجاح {when}',
    runs: 'تشغيلات 24 ساعة',
    cards: 'بطاقات 24 ساعة',
    summaryOk: 'يعمل {n}',
    summaryLag: 'متأخر {n}',
    summaryFail: 'يفشل {n}',
    allLive: 'المصادر كلها تعمل.',
  },
  loading: 'جارٍ تحميل صفحة يومي',
  errorThing: 'صفحة يومي',
};

const en: Dict = {
  title: 'Today',
  greeting: {
    morning: 'Good morning, {name}',
    summary: { zero: 'Nothing is waiting this morning.', one: '1 thing is waiting', other: '# things are waiting' },
    overdue: { one: ', and 1 is overdue.', other: ', and # are overdue.', zero: '.' },
  },
  refresh: 'Refresh',
  refreshed: 'Page refreshed',
  updated: 'Updated {when}',
  counters: {
    label: 'At a glance',
    tiles: { inbox: 'Inbox unread', decisions: 'My decisions', needs: 'My needs', handoffs: 'My handoffs', redesigns: 'Redesigns in review' },
    scope: 'of {all} open',
    scopeNeeds: 'of {all} open or awaiting a check',
    scopeNone: 'none open',
    overdue: { one: '1 overdue', other: '# overdue', zero: 'none overdue' },
    series: 'Last 7 days: {values}',
    quietAll: 'A quiet week: nothing is open.',
  },
  stack: {
    title: 'Awaiting me',
    cleared: '{n} cleared today',
    groups: { urgent: 'Overdue or escalated', soon: 'Due within 24 hours', rest: 'Everything else' },
    overdueBy: '{d} overdue',
    escalated: 'Escalated to me',
    dueSoon: 'Due {rel}',
    due: 'Due {when}',
    stale: 'Not received for {d}',
    breaking: 'Breaking change',
    seeAll: 'See all ({total})',
    emptyTitle: 'Nothing is waiting.',
    emptyBody: 'Decisions, needs and handoffs routed to my roles show up here first.',
    actionFor: '{action} {key}',
  },
  runway: {
    title: 'Deadlines in the next 72 hours',
    now: 'now',
    overdue: 'Overdue',
    day24: '24 h',
    later: 'later',
    empty: 'No deadlines in the next 72 hours.',
    pin: '{key}, {type}: {title}, due {when}',
    pinInStack: '{key}, {type}: {title}, due {when}. Jump to it in Awaiting me.',
    inStackNote: { one: 'And 1 more in Awaiting me above.', other: 'And # more in Awaiting me above.' },
    escalated: 'escalated',
    jump: 'in my stack',
  },
  ready: {
    title: 'Ready for my roles',
    claim: 'Claim',
    claimTask: 'Claim {key}',
    blockedBy: 'Blocked by {key}',
    effort: 'Effort',
    specialty: { backend: 'Backend', frontend: 'Frontend', design: 'Design', qa: 'QA', ops: 'Ops', docs: 'Docs' },
    toast: 'Claimed {key}. Paste this in Claude Code to start:',
    blockedToast: '{key} is blocked by {blocker}, so it cannot be claimed yet.',
    emptyTitle: 'No ready tasks for my roles.',
    emptyBody: 'Ready tasks for my specialties appear here, highest priority first.',
    emptyLink: 'Check the backlog',
  },
  letter: {
    title: 'Morning letter',
    signed: 'Written by your agent at {when}',
    collapse: 'Show less',
    expand: 'Read the whole letter',
    absentTitle: 'Your agent has not written today’s letter yet',
    absentBody: 'Run {cmd} in Claude Code and it writes one from the sections on this page.',
  },
  since: {
    title: 'Since your last visit',
    seeAll: 'See all in the timeline ({total})',
    tide: 'You were here {when}',
    pinned: 'API contract change',
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
    same: 'no change',
    lastWeek: 'from last week ({n})',
    activity: 'Activity, last 14 days',
    activityShort: 'Activity, last 7 days',
    activityHint: 'Sessions, commits and closed cards per day. Members are sorted by name.',
    fewer: 'Fewer',
    more: 'More',
    cell: { zero: '{name}, {date}: no activity', one: '{name}, {date}: 1 event', other: '{name}, {date}: # events' },
    readoutIdle: 'Hover a day, or move to it with the arrow keys, to see the exact count.',
    online: 'Online now',
    offline: 'Offline',
    lastSeen: 'Last seen {rel}',
    focus: 'Working on',
    noFocus: 'No claimed task',
    today: 'today',
    member: 'Member',
    handoffsApplied: 'Handoffs applied',
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
    summaryOk: '{n} live',
    summaryLag: '{n} behind',
    summaryFail: '{n} failing',
    allLive: 'Every source is live.',
  },
  loading: 'Loading Today',
  errorThing: 'Today',
};

export const messages = { ar, en };
