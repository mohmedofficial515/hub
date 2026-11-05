// Hub "Today" fixtures, shaped after F:/Goteav/project-hub/docs/04-api-reference.md §3.23
// (GET /workspaces/{ws}/today + /counters + /system) plus the owner-requested team stats
// (proposed endpoint GET /workspaces/{ws}/stats/team — not in doc 04 yet; add it when ported).
//
// Real card titles are single-language strings; here every visible string is { ar, en } so the
// lab can show both locales. Keys, branches, SHAs and paths are never translated.
// "Now" is fixed: Wednesday 2026-11-04 08:45 Europe/Istanbul (UTC+3).

export type L = { ar: string; en: string };
export type Role = 'owner' | 'pm' | 'accountant' | 'backend' | 'frontend' | 'designer' | 'qa';
export type CardType = 'task' | 'decision' | 'need' | 'change' | 'handoff' | 'redesign' | 'doc' | 'release';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type Action = 'decide' | 'deliver' | 'verify' | 'acknowledge' | 'review' | 'approve' | 'claim';

export interface Member {
  id: string;
  name: L;
  initials: L;
  avatarColor: number; // 1..12 → --avatar-n
  roles: Role[];
  online: boolean;
  lastActiveAt: string;
}

export interface CardRow {
  key: string;
  type: CardType;
  title: L;
  status: string;
  priority: Priority;
  ownerRole: Role | null;
  dueAt?: string;
  action?: Action;
  repo?: 'backend' | 'web' | 'dashboard' | 'hub';
  branch?: string;
  module?: string;
  effort?: 'S' | 'M' | 'L' | 'XL';
  specialty?: 'backend' | 'frontend' | 'design' | 'qa' | 'ops' | 'docs';
  severity?: 'breaking' | 'notable' | 'info';
  createdBy?: { kind: 'user' | 'agent' | 'system'; memberId?: string };
  flags?: Partial<{ overdue: boolean; escalated: boolean; blocked: boolean; stale: boolean }>;
  meta?: L; // one short secondary line
  blocks?: number; // how many cards wait on this one
}

export type EventKind =
  | 'commits'
  | 'pr_opened'
  | 'pr_merged'
  | 'session'
  | 'handoff'
  | 'decided'
  | 'redesign'
  | 'doc'
  | 'release'
  | 'need_delivered';

export interface TimelineRow {
  id: string;
  at: string;
  kind: EventKind;
  actorId: string | 'system';
  viaAgent?: boolean;
  card: { key: string; type: CardType; title: L };
  repo?: 'backend' | 'web' | 'dashboard' | 'hub';
  branch?: string;
  detail: L;
  count?: number; // commits in the group, files, …
  /** Contract handoffs only: the changed endpoints as oasdiff reports them (code stays untranslated). */
  diff?: { endpoint: string; label: L; before: string; after: string }[];
}

/** A card the agent mentions in the narrative: render a CardChip right after `after` (per locale). */
export interface NarrativeRef {
  key: string;
  type: CardType;
  after: L;
}

export interface SessionRow {
  sessionId: string;
  at: string;
  repo: 'backend' | 'web' | 'dashboard' | 'hub';
  branch: string;
  commits: number;
  files: number;
  durationMin: number;
}

export interface SourceHealth {
  name: string;
  kind: 'github_repo' | 'openapi' | 'lab' | 'docs_folder';
  target: string;
  status: 'ok' | 'lagging' | 'failing';
  lastSuccessAt: string;
  lagSec: number;
  runs24h: number;
  cards24h: number;
  lastError?: L;
}

export interface TeamMemberStats {
  memberId: string;
  sessions: number;
  commits: number;
  cardsClosed: number;
  handoffsSent: number;
  activity: number[]; // last 14 days, oldest first (events/day)
  focus: { key: string; title: L } | null; // currently claimed task
}

export const NOW = '2026-11-04T08:45:00+03:00';

export const members: Member[] = [
  { id: 'u-owner', name: { ar: 'محمد أحمد', en: 'Mohamed Ahmed' }, initials: { ar: 'م', en: 'MA' }, avatarColor: 7, roles: ['owner', 'pm', 'accountant'], online: true, lastActiveAt: '2026-11-04T08:44:00+03:00' },
  { id: 'u-sara', name: { ar: 'سارة الحربي', en: 'Sara Alharbi' }, initials: { ar: 'س', en: 'SA' }, avatarColor: 11, roles: ['frontend'], online: true, lastActiveAt: '2026-11-04T08:39:00+03:00' },
  { id: 'u-yousef', name: { ar: 'يوسف القحطاني', en: 'Yousef Alqahtani' }, initials: { ar: 'ي', en: 'YQ' }, avatarColor: 3, roles: ['backend'], online: true, lastActiveAt: '2026-11-04T08:31:00+03:00' },
  { id: 'u-omar', name: { ar: 'عمر سليمان', en: 'Omar Suleiman' }, initials: { ar: 'ع', en: 'OS' }, avatarColor: 1, roles: ['backend', 'qa'], online: false, lastActiveAt: '2026-11-03T23:12:00+03:00' },
  { id: 'u-layla', name: { ar: 'ليلى منصور', en: 'Layla Mansour' }, initials: { ar: 'ل', en: 'LM' }, avatarColor: 9, roles: ['designer'], online: false, lastActiveAt: '2026-11-03T19:05:00+03:00' },
  { id: 'u-karim', name: { ar: 'كريم عادل', en: 'Karim Adel' }, initials: { ar: 'ك', en: 'KA' }, avatarColor: 5, roles: ['frontend'], online: true, lastActiveAt: '2026-11-04T08:12:00+03:00' },
  { id: 'u-nour', name: { ar: 'نور الهدى', en: 'Nour Alhuda' }, initials: { ar: 'ن', en: 'NH' }, avatarColor: 12, roles: ['qa'], online: false, lastActiveAt: '2026-11-03T18:40:00+03:00' },
];

export const memberById = (id: string) => members.find((m) => m.id === id);

export const workspace = { slug: 'goteav', name: { ar: 'جوتيف', en: 'Goteav' }, keyPrefix: 'GTV', timezone: 'Europe/Istanbul' };

// ── Default persona: the owner (owner + pm + accountant) ─────────────────────────────────────────

const narrative = {
  by: 'u-owner',
  at: '2026-11-04T08:41:00+03:00',
  markdown: {
    en: 'Yesterday the backend **changed the refund contract** (breaking): the dashboard and web need `pnpm api:sync` — Sara has acknowledged it. Two things wait only for you: the **Moyasar fee decision** (due at noon, the PayTR adapter is blocked on it) and the **live PayTR token**. The wallet redesign v7 passed review with 88/100. Omar\'s refund-race session has no summary yet.',
    ar: 'أمس **غيّر الباك إند عقد الاسترداد** (تغيير كاسر)، ولوحة التحكم والموقع يحتاجان `pnpm api:sync`، وقد استلمته سارة. أمران ينتظرانك وحدك: **قرار رسوم Moyasar** (موعده الظهر، ومحوّل PayTR متوقف عليه) و**توكن PayTR الحي**. نسخة المحفظة v7 اجتازت المراجعة بـ 88/100. جلسة عمر عن سباق الاسترداد بلا ملخص بعد.',
  } satisfies L,
  // Cards the narrative mentions (the agent links them when it calls hub.save_brief).
  refs: [
    { key: 'GTV-255', type: 'handoff', after: { ar: 'غيّر الباك إند عقد الاسترداد', en: 'changed the refund contract' } },
    { key: 'GTV-231', type: 'decision', after: { ar: 'قرار رسوم Moyasar', en: 'Moyasar fee decision' } },
    { key: 'GTV-240', type: 'need', after: { ar: 'توكن PayTR الحي', en: 'live PayTR token' } },
    { key: 'GTV-252', type: 'redesign', after: { ar: 'نسخة المحفظة v7', en: 'wallet redesign v7' } },
    { key: 'GTV-253', type: 'change', after: { ar: 'جلسة عمر عن سباق الاسترداد', en: 'refund-race session' } },
  ] satisfies NarrativeRef[],
};

const awaitingMe: CardRow[] = [
  {
    key: 'GTV-231', type: 'decision', status: 'open', priority: 'P0', ownerRole: 'accountant', action: 'decide',
    title: { ar: 'رسوم Moyasar: على العميل أم على المنصة؟', en: 'Moyasar fees: customer or platform?' },
    dueAt: '2026-11-04T12:00:00+03:00', module: 'payments', blocks: 2, createdBy: { kind: 'agent', memberId: 'u-yousef' },
    meta: { ar: 'خياران · فتحه وكيل يوسف', en: '2 options · opened by Yousef’s agent' },
  },
  {
    key: 'GTV-240', type: 'need', status: 'requested', priority: 'P1', ownerRole: 'owner', action: 'deliver',
    title: { ar: 'توكن PayTR الحي (live)', en: 'PayTR live token' },
    dueAt: '2026-11-05T17:00:00+03:00', module: 'payments', blocks: 1, createdBy: { kind: 'agent', memberId: 'u-yousef' },
    meta: { ar: 'توكن · يُسلَّم إلى الخزنة فقط', en: 'Token · deliver to the vault only' },
  },
  {
    key: 'GTV-236', type: 'decision', status: 'open', priority: 'P1', ownerRole: 'owner', action: 'decide',
    title: { ar: 'الفنادق: نبدأ بتركيا ومصر أم بالخليج؟', en: 'Hotels: start with Turkey + Egypt or the Gulf?' },
    dueAt: '2026-11-06T18:00:00+03:00', module: 'catalog', createdBy: { kind: 'user', memberId: 'u-owner' },
    meta: { ar: '3 خيارات · 4 تعليقات', en: '3 options · 4 comments' },
  },
  {
    key: 'GTV-252', type: 'redesign', status: 'review', priority: 'P2', ownerRole: 'owner', action: 'approve',
    title: { ar: 'المحفظة · v7-twin-tanks', en: 'Wallet · v7-twin-tanks' },
    meta: { ar: 'مراجعة ux-critic: 88/100', en: 'ux-critic review: 88/100' },
  },
  {
    key: 'GTV-247', type: 'need', status: 'delivered', priority: 'P2', ownerRole: 'accountant', action: 'verify',
    title: { ar: 'التحقق من عمولة Akbank للبطاقات الأجنبية (2%)', en: 'Verify Akbank foreign-card fee (2%)' },
    module: 'payments', meta: { ar: 'سلّمه يوسف · ينتظر تحققك', en: 'Delivered by Yousef · awaiting your check' },
  },
  {
    key: 'GTV-244', type: 'handoff', status: 'pending', priority: 'P1', ownerRole: 'pm', action: 'acknowledge', severity: 'notable',
    title: { ar: 'endpoint جديد: GET /admin/hotels/suppliers', en: 'New endpoint: GET /admin/hotels/suppliers' },
    repo: 'backend', meta: { ar: 'من الباك إند · منذ 26 ساعة', en: 'From backend · 26 h ago' }, flags: { stale: false },
  },
];

const deadlines: CardRow[] = [
  { key: 'GTV-219', type: 'decision', status: 'open', priority: 'P1', ownerRole: 'pm', title: { ar: 'سياسة الاحتفاظ بالبيانات KVKK: 5 أم 10 سنوات', en: 'KVKK retention: 5 or 10 years' }, dueAt: '2026-11-03T18:00:00+03:00', flags: { overdue: true, escalated: true }, meta: { ar: 'تأخر 15 ساعة · صُعِّد إليك', en: '15 h overdue · escalated to you' } },
  { key: 'GTV-231', type: 'decision', status: 'open', priority: 'P0', ownerRole: 'accountant', title: { ar: 'رسوم Moyasar: على العميل أم على المنصة؟', en: 'Moyasar fees: customer or platform?' }, dueAt: '2026-11-04T12:00:00+03:00', meta: { ar: 'بعد 3 ساعات', en: 'in 3 h' } },
  { key: 'GTV-240', type: 'need', status: 'requested', priority: 'P1', ownerRole: 'owner', title: { ar: 'توكن PayTR الحي (live)', en: 'PayTR live token' }, dueAt: '2026-11-05T17:00:00+03:00', meta: { ar: 'غدًا 17:00', en: 'tomorrow 17:00' } },
  { key: 'GTV-236', type: 'decision', status: 'open', priority: 'P1', ownerRole: 'owner', title: { ar: 'الفنادق: نبدأ بتركيا ومصر أم بالخليج؟', en: 'Hotels: start with Turkey + Egypt or the Gulf?' }, dueAt: '2026-11-06T18:00:00+03:00', meta: { ar: 'الجمعة 18:00', en: 'Fri 18:00' } },
];

const readyTasks: CardRow[] = [
  { key: 'GTV-258', type: 'task', status: 'ready', priority: 'P0', ownerRole: 'pm', specialty: 'ops', effort: 'S', title: { ar: 'تفعيل النسخ الاحتياطي الليلي على جهاز Hub', en: 'Enable nightly backups on the Hub host' }, meta: { ar: 'عمليات · من اقتراح مستورد', en: 'Ops · imported suggestion' } },
  { key: 'GTV-249', type: 'task', status: 'ready', priority: 'P1', ownerRole: 'pm', specialty: 'docs', effort: 'M', title: { ar: 'تحديث وثيقة الإطلاق 25 بعد قرار PayTR', en: 'Update launch doc 25 after the PayTR decision' }, meta: { ar: 'توثيق · متوقف على GTV-231', en: 'Docs · blocked by GTV-231' }, flags: { blocked: true } },
  { key: 'GTV-262', type: 'task', status: 'ready', priority: 'P2', ownerRole: 'pm', specialty: 'ops', effort: 'S', title: { ar: 'دعوة نور ولـيلى إلى Hub وتوزيع الأدوار', en: 'Invite Nour and Layla to Hub and set roles' }, meta: { ar: 'عمليات · متابعة من جلسة', en: 'Ops · session follow-up' } },
];

const changesSince: TimelineRow[] = [
  { id: 'e1', at: '2026-11-04T08:20:00+03:00', kind: 'handoff', actorId: 'system', card: { key: 'GTV-255', type: 'handoff', title: { ar: 'تغيير كاسر: POST /admin/payments/{id}/refund', en: 'Breaking: POST /admin/payments/{id}/refund' } }, repo: 'backend', detail: { ar: 'oasdiff · 2 endpoints · سارة استلمته', en: 'oasdiff · 2 endpoints · acknowledged by Sara' },
    diff: [
      { endpoint: 'POST /admin/payments/{id}/refund', label: { ar: 'حقل مطلوب جديد في الطلب', en: 'New required request field' }, before: '{ amount }', after: '{ amount, reason, refundTo }' },
      { endpoint: 'GET /admin/payments/{id}', label: { ar: 'حقل الاستجابة صار قائمة', en: 'Response field became a list' }, before: 'refundedAt: string', after: 'refunds: Refund[]' },
    ] },
  { id: 'e2', at: '2026-11-04T08:05:00+03:00', kind: 'session', actorId: 'u-sara', viaAgent: true, card: { key: 'GTV-256', type: 'change', title: { ar: 'جلسة: مزامنة عقد الاسترداد في لوحة التحكم', en: 'Session: sync refund contract in the dashboard' } }, repo: 'dashboard', branch: 'fix/refund-contract', detail: { ar: 'تم: الأنواع والنماذج · بقي: اختبار e2e', en: 'Done: types + forms · Left: e2e test' } },
  { id: 'e3', at: '2026-11-04T01:40:00+03:00', kind: 'commits', actorId: 'u-omar', card: { key: 'GTV-253', type: 'change', title: { ar: 'إصلاح سباق الاسترداد المزدوج', en: 'Fix the double-refund race' } }, repo: 'backend', branch: 'fix/refund-race', count: 6, detail: { ar: '6 commits · 14 ملفًا', en: '6 commits · 14 files' } },
  { id: 'e4', at: '2026-11-03T22:10:00+03:00', kind: 'pr_merged', actorId: 'u-yousef', card: { key: 'GTV-251', type: 'change', title: { ar: 'PR #418: محوّل PayTR (sandbox)', en: 'PR #418: PayTR adapter (sandbox)' } }, repo: 'backend', branch: 'feat/paytr', detail: { ar: 'دُمج في main', en: 'Merged into main' } },
  { id: 'e5', at: '2026-11-03T20:30:00+03:00', kind: 'redesign', actorId: 'u-layla', card: { key: 'GTV-252', type: 'redesign', title: { ar: 'المحفظة · v7-twin-tanks', en: 'Wallet · v7-twin-tanks' } }, detail: { ar: 'أُرسل للمراجعة · 88/100', en: 'Sent to review · 88/100' } },
  { id: 'e6', at: '2026-11-03T18:15:00+03:00', kind: 'decided', actorId: 'u-owner', card: { key: 'GTV-228', type: 'decision', title: { ar: 'البوابة الأساسية: PayTR', en: 'Primary gateway: PayTR' } }, detail: { ar: 'اختير: PayTR + Akbank احتياطًا · ADR-0017 في PR', en: 'Chosen: PayTR + Akbank backup · ADR-0017 in PR' } },
  { id: 'e7', at: '2026-11-03T16:50:00+03:00', kind: 'pr_opened', actorId: 'u-karim', card: { key: 'GTV-257', type: 'change', title: { ar: 'PR #212: صفحة الحجوزات — فلاتر محفوظة', en: 'PR #212: bookings page — saved filters' } }, repo: 'web', branch: 'feat/saved-filters', detail: { ar: 'مفتوح · ينتظر مراجعة', en: 'Open · awaiting review' } },
  { id: 'e8', at: '2026-11-03T15:20:00+03:00', kind: 'need_delivered', actorId: 'u-yousef', card: { key: 'GTV-247', type: 'need', title: { ar: 'عمولة Akbank للبطاقات الأجنبية', en: 'Akbank foreign-card fee' } }, detail: { ar: 'سُلِّم: 1Password › Goteav › Akbank', en: 'Delivered: 1Password › Goteav › Akbank' } },
  { id: 'e9', at: '2026-11-03T14:05:00+03:00', kind: 'doc', actorId: 'u-yousef', card: { key: 'GTV-180', type: 'doc', title: { ar: 'وثيقة 21 · أمان التأكيد', en: 'Doc 21 · Confirmation safety' } }, repo: 'backend', detail: { ar: 'قسم جديد: الحجز قبل الخصم', en: 'New section: hold before charge' } },
  { id: 'e10', at: '2026-11-03T12:00:00+03:00', kind: 'release', actorId: 'u-owner', card: { key: 'GTV-246', type: 'release', title: { ar: 'إصدار 2026-11-03 · الدفع المقسّم', en: 'Release 2026-11-03 · split payments' } }, detail: { ar: '12 تغييرًا · ملاحظات للمحاسب جاهزة', en: '12 changes · accountant notes ready' } },
];

const noSummarySessions: SessionRow[] = [
  { sessionId: '7f3a…c21', at: '2026-11-03T17:20:00+03:00', repo: 'hub', branch: 'feat/h1-02-session-logging', commits: 4, files: 9, durationMin: 96 },
];

const decided = [
  { key: 'GTV-228', title: { ar: 'البوابة الأساسية: PayTR', en: 'Primary gateway: PayTR' }, option: { ar: 'PayTR + Akbank احتياطًا', en: 'PayTR + Akbank as backup' }, rationale: { ar: 'تسوية بالدولار تغذي Duffel مباشرة', en: 'USD settlement feeds Duffel directly' } },
];

const blocked = [
  { key: 'GTV-249', title: { ar: 'تحديث وثيقة الإطلاق 25', en: 'Update launch doc 25' }, blockerKey: 'GTV-231', blockerRole: 'accountant' as Role },
];

const counters = {
  inboxUnread: 9,
  awaitingMe: 6,
  decisionsOpen: 5,
  decisionsOverdue: 1,
  needsOpen: 3,
  handoffsPending: 2,
  tasksReadyForMe: 3,
  redesignInReview: 2,
  noSummarySessions: 1,
};

// Team stats for the current ISO week (Mon 3 Nov → today) and the previous one for deltas.
const team = {
  week: { label: { ar: 'هذا الأسبوع', en: 'This week' }, from: '2026-11-03', to: '2026-11-09' },
  totals: [
    { key: 'sessions', label: { ar: 'جلسات AI', en: 'AI sessions' }, value: 23, prev: 17 },
    { key: 'commits', label: { ar: 'Commits', en: 'Commits' }, value: 64, prev: 71 },
    { key: 'prsMerged', label: { ar: 'PRs مدموجة', en: 'PRs merged' }, value: 5, prev: 3 },
    { key: 'decided', label: { ar: 'قرارات حُسمت', en: 'Decisions made' }, value: 4, prev: 2 },
    { key: 'handoffs', label: { ar: 'تسليمات طُبّقت', en: 'Handoffs applied' }, value: 6, prev: 6 },
    { key: 'closed', label: { ar: 'بطاقات أُغلقت', en: 'Cards closed' }, value: 31, prev: 24 },
  ],
  // Cards created vs closed this week, per type (the "flow")
  flow: [
    { type: 'task' as CardType, created: 14, closed: 11 },
    { type: 'decision' as CardType, created: 3, closed: 4 },
    { type: 'need' as CardType, created: 4, closed: 2 },
    { type: 'change' as CardType, created: 38, closed: 38 },
    { type: 'handoff' as CardType, created: 7, closed: 6 },
    { type: 'redesign' as CardType, created: 3, closed: 1 },
    { type: 'doc' as CardType, created: 5, closed: 5 },
    { type: 'release' as CardType, created: 1, closed: 1 },
  ],
  members: [
    { memberId: 'u-yousef', sessions: 7, commits: 22, cardsClosed: 9, handoffsSent: 3, activity: [4, 6, 2, 0, 0, 7, 9, 5, 8, 11, 0, 1, 12, 6], focus: { key: 'GTV-259', title: { ar: 'محوّل PayTR: الدفع الحي', en: 'PayTR adapter: live payments' } } },
    { memberId: 'u-sara', sessions: 6, commits: 15, cardsClosed: 8, handoffsSent: 0, activity: [3, 5, 6, 1, 0, 6, 7, 8, 6, 9, 2, 0, 10, 7], focus: { key: 'GTV-260', title: { ar: 'مزامنة عقد الاسترداد', en: 'Sync refund contract' } } },
    { memberId: 'u-omar', sessions: 4, commits: 13, cardsClosed: 5, handoffsSent: 1, activity: [2, 0, 4, 3, 0, 0, 5, 6, 2, 7, 0, 0, 8, 3], focus: { key: 'GTV-253', title: { ar: 'سباق الاسترداد المزدوج', en: 'Double-refund race' } } },
    { memberId: 'u-karim', sessions: 3, commits: 9, cardsClosed: 4, handoffsSent: 0, activity: [1, 2, 3, 2, 0, 0, 4, 3, 5, 2, 0, 0, 6, 2], focus: { key: 'GTV-257', title: { ar: 'فلاتر محفوظة للحجوزات', en: 'Saved booking filters' } } },
    { memberId: 'u-owner', sessions: 2, commits: 4, cardsClosed: 3, handoffsSent: 0, activity: [2, 1, 1, 3, 1, 0, 2, 4, 2, 3, 1, 0, 5, 3], focus: null },
    { memberId: 'u-layla', sessions: 1, commits: 1, cardsClosed: 2, handoffsSent: 2, activity: [0, 3, 2, 0, 0, 0, 1, 2, 4, 1, 0, 0, 3, 0], focus: { key: 'GTV-261', title: { ar: 'الحجوزات v2: قائمة كثيفة', en: 'Bookings v2: dense list' } } },
    { memberId: 'u-nour', sessions: 0, commits: 0, cardsClosed: 0, handoffsSent: 0, activity: [0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0], focus: null },
  ] satisfies TeamMemberStats[],
};

const sources: SourceHealth[] = [
  { name: 'backend', kind: 'github_repo', target: 'mohmedofficial515/Goteav-backend', status: 'ok', lastSuccessAt: '2026-11-04T08:44:10+03:00', lagSec: 50, runs24h: 720, cards24h: 9 },
  { name: 'web', kind: 'github_repo', target: 'Alremaal-Co/Goteav', status: 'ok', lastSuccessAt: '2026-11-04T08:43:55+03:00', lagSec: 65, runs24h: 720, cards24h: 3 },
  { name: 'dashboard', kind: 'github_repo', target: 'Alremaal-Co/Goteav-Dashboard', status: 'lagging', lastSuccessAt: '2026-11-04T08:31:02+03:00', lagSec: 838, runs24h: 702, cards24h: 4, lastError: { ar: 'تجاوز حد GitHub مؤقتًا · إعادة المحاولة 08:47', en: 'GitHub secondary rate limit · retry at 08:47' } },
  { name: 'contract', kind: 'openapi', target: 'backend · openapi/openapi.json', status: 'ok', lastSuccessAt: '2026-11-04T08:20:00+03:00', lagSec: 0, runs24h: 3, cards24h: 1 },
  { name: 'lab', kind: 'lab', target: 'hub · apps/lab', status: 'ok', lastSuccessAt: '2026-11-04T08:44:30+03:00', lagSec: 30, runs24h: 1440, cards24h: 1 },
  { name: 'backend docs', kind: 'docs_folder', target: 'backend · docs/', status: 'failing', lastSuccessAt: '2026-11-03T21:00:00+03:00', lagSec: 42300, runs24h: 140, cards24h: 0, lastError: { ar: 'فشل تحليل docs/map/index.html (مستثنى؟)', en: 'Failed to parse docs/map/index.html (should be excluded?)' } },
];

export const today = {
  now: NOW,
  me: 'u-owner',
  lastSeenAt: '2026-11-03T11:30:00+03:00',
  brief: { date: '2026-11-04', generatedNow: false },
  narrative,
  counters,
  awaitingMe,
  deadlines,
  readyTasks,
  changesSince: { since: '2026-11-03T11:30:00+03:00', total: 27, events: changesSince },
  noSummarySessions,
  decided,
  blocked,
  releases: [{ version: '2026-11-03', title: { ar: 'الدفع المقسّم', en: 'Split payments' } }],
  team,
  sources,
};

export type Today = typeof today;

// ── Scenarios (read with scenarioFromHash()) ───────────────────────────────────────────────────

/** `frontend`: Sara's view (frontend only): no admin cards, ready tasks for frontend, a pending handoff. */
const frontendToday: Today = {
  ...today,
  me: 'u-sara',
  lastSeenAt: '2026-11-03T18:00:00+03:00',
  narrative: null as unknown as Today['narrative'],
  counters: { ...counters, inboxUnread: 3, awaitingMe: 2, tasksReadyForMe: 4, redesignInReview: 0, noSummarySessions: 0 },
  awaitingMe: [
    { key: 'GTV-255', type: 'handoff', status: 'acknowledged', priority: 'P0', ownerRole: 'frontend', action: 'acknowledge', severity: 'breaking', repo: 'backend', title: { ar: 'تغيير كاسر: POST /admin/payments/{id}/refund', en: 'Breaking: POST /admin/payments/{id}/refund' }, meta: { ar: 'استلمتِه · طبّقيه بعد api:sync', en: 'Acknowledged · apply after api:sync' } },
    { key: 'GTV-261', type: 'redesign', status: 'approved', priority: 'P1', ownerRole: 'frontend', action: 'claim', title: { ar: 'نقل الحجوزات v2 إلى لوحة التحكم', en: 'Port bookings v2 into the dashboard' }, meta: { ar: 'مهمة نقل تلقائية · redesign-porter', en: 'Auto port task · redesign-porter' } },
  ],
  deadlines: [],
  readyTasks: [
    { key: 'GTV-263', type: 'task', status: 'ready', priority: 'P1', ownerRole: 'frontend', specialty: 'frontend', effort: 'M', title: { ar: 'شاشة «يومي» في Hub: الأقسام الستة', en: 'Hub Today page: the six sections' } },
    { key: 'GTV-264', type: 'task', status: 'ready', priority: 'P2', ownerRole: 'frontend', specialty: 'frontend', effort: 'S', title: { ar: 'إصلاح اتجاه أرقام الحجز في RTL', en: 'Fix booking-number direction in RTL' } },
    { key: 'GTV-265', type: 'task', status: 'ready', priority: 'P2', ownerRole: 'frontend', specialty: 'frontend', effort: 'L', title: { ar: 'صفحة المحفظة: نقل v7 بعد الموافقة', en: 'Wallet page: port v7 after approval' }, flags: { blocked: true }, meta: { ar: 'متوقف على GTV-252', en: 'Blocked by GTV-252' } },
    { key: 'GTV-266', type: 'task', status: 'ready', priority: 'P3', ownerRole: 'frontend', specialty: 'frontend', effort: 'S', title: { ar: 'تحسين حالة التحميل في الجداول', en: 'Better loading state in tables' } },
  ],
  noSummarySessions: [],
};

/** `empty`: a quiet morning — nothing waits, everything healthy. */
const emptyToday: Today = {
  ...today,
  narrative: null as unknown as Today['narrative'],
  counters: { inboxUnread: 0, awaitingMe: 0, decisionsOpen: 0, decisionsOverdue: 0, needsOpen: 0, handoffsPending: 0, tasksReadyForMe: 0, redesignInReview: 0, noSummarySessions: 0 },
  awaitingMe: [],
  deadlines: [],
  readyTasks: [],
  changesSince: { since: today.lastSeenAt, total: 0, events: [] },
  noSummarySessions: [],
  decided: [],
  blocked: [],
  releases: [],
  sources: sources.map((s) => ({ ...s, status: 'ok' as const, lagSec: 40, lastError: undefined })),
};

export type HubScenario = 'default' | 'frontend' | 'empty' | 'loading';

export function scenarioFromHash(): HubScenario {
  const [, query = ''] = location.hash.split('?');
  return (new URLSearchParams(query).get('scenario') as HubScenario) || 'default';
}

export function todayFor(scenario: HubScenario): Today {
  if (scenario === 'frontend') return frontendToday;
  if (scenario === 'empty') return emptyToday;
  return today;
}

// ── Small helpers versions may use ─────────────────────────────────────────────────────────────

const MIN = 60_000;
/** Relative time against NOW, e.g. { ar: 'قبل 25 دقيقة', en: '25 min ago' } or 'in 3 h'. */
export function relative(iso: string): L {
  const diff = new Date(iso).getTime() - new Date(NOW).getTime();
  const future = diff > 0;
  const m = Math.round(Math.abs(diff) / MIN);
  const h = Math.round(m / 60);
  const d = Math.round(h / 24);
  const [ar, en] =
    m < 60 ? [`${m} دقيقة`, `${m} min`] : h < 36 ? [`${h} ساعة`, `${h} h`] : [`${d} يوم`, `${d} d`];
  return future ? { ar: `بعد ${ar}`, en: `in ${en}` } : { ar: `قبل ${ar}`, en: `${en} ago` };
}
