// Task cards the Tasks board needs beyond the ones Today already lists (09 §6, 03 §6 TaskDetail).
// The catalogue only had `ready` and `in_progress`; a board that shows work moving needs every column.
// Keys GTV-270..GTV-289 belong to this file. `index.ts` spreads `extraTasks` into `cards`.

import type { CardEvent, L, Priority, Role, TaskCard, TaskDetail } from './index';

const l = (ar: string, en: string): L => ({ ar, en });
const T = (d: string, hm: string) => `2026-${d}T${hm}:00+03:00`;

type Actor = { kind: 'user' | 'agent' | 'system'; id?: string; adapter?: string; via: CardEvent['via'] };
const user = (id: string): Actor => ({ kind: 'user', id, via: 'web' });
const agent = (id: string): Actor => ({ kind: 'agent', id, via: 'mcp' });
const github: Actor = { kind: 'system', adapter: 'github', via: 'adapter' };

function events(key: string, list: [kind: string, at: string, actor: Actor, data?: CardEvent['data']][]): CardEvent[] {
  return list.map(([kind, at, actor, data], i) => ({ id: `${key}-e${i + 1}`, seq: i + 1, kind, at, actorKind: actor.kind, actorId: actor.id, adapter: actor.adapter, via: actor.via, data: data ?? {} }));
}

const SPECIALTY_ROLE: Record<TaskDetail['specialty'], Role> = { backend: 'backend', frontend: 'frontend', design: 'designer', qa: 'qa', ops: 'pm', docs: 'pm' };

interface Seed {
  key: string;
  title: L;
  status: string;
  priority: Priority;
  specialty: TaskDetail['specialty'];
  effort: TaskDetail['effort'];
  repo?: TaskCard['repo'];
  module?: string;
  dueAt?: string;
  body?: L;
  acceptance?: L;
  prompt?: string;
  origin?: TaskDetail['origin'];
  by?: Actor;
  createdAt: string;
  claimedById?: string;
  claimedAt?: string;
  startedAt?: string;
  doneAt?: string;
  branch?: string;
  prUrl?: string;
  links?: TaskCard['links'];
  watchers?: string[];
  later?: [kind: string, at: string, actor: Actor, data?: CardEvent['data']][];
}

function task(s: Seed): TaskCard {
  const by = s.by ?? user('u-owner');
  const list = events(s.key, [['created', s.createdAt, by, { title: s.title.en, status: 'backlog', priority: s.priority }], ...(s.later ?? [])]);
  return {
    key: s.key,
    type: 'task',
    title: s.title,
    status: s.status,
    priority: s.priority,
    ownerRole: SPECIALTY_ROLE[s.specialty],
    dueAt: s.dueAt,
    repo: s.repo,
    branch: s.branch,
    module: s.module,
    effort: s.effort,
    specialty: s.specialty,
    body: s.body,
    createdAt: s.createdAt,
    lastEventAt: list[list.length - 1].at,
    createdByKind: by.kind,
    createdById: by.id,
    createdVia: by.via,
    assigneeId: s.claimedById,
    tags: [],
    watchers: s.watchers ?? (s.claimedById ? [s.claimedById] : []),
    links: s.links ?? [],
    events: list,
    comments: [],
    attachments: [],
    task: {
      specialty: s.specialty,
      effort: s.effort,
      acceptance: s.acceptance,
      prompt: s.prompt ?? `/hub:next ${s.key}`,
      origin: s.origin ?? 'manual',
      claimedById: s.claimedById,
      claimedAt: s.claimedAt,
      branch: s.branch,
      prUrl: s.prUrl,
      startedAt: s.startedAt,
      doneAt: s.doneAt,
    },
  } as TaskCard;
}

const claimed = (at: string, id: string, branch?: string): [string, string, Actor, CardEvent['data']] => ['claimed', at, user(id), branch ? { branch } : {}];
const moved = (at: string, actor: Actor, from: string, to: string): [string, string, Actor, CardEvent['data']] => ['status_changed', at, actor, { from, to }];

export const extraTasks: TaskCard[] = [
  // ── The port task approval created for GTV-261 (09 §10). Sara's Claim on that redesign acts on this card. ──────────
  task({
    key: 'GTV-288',
    title: l('نقل الحجوزات v2 إلى لوحة التحكم', 'Port bookings v2 into the dashboard'),
    status: 'ready',
    priority: 'P1',
    specialty: 'frontend',
    effort: 'L',
    repo: 'dashboard',
    createdAt: T('11-02', '10:00'),
    origin: 'redesign_port',
    prompt: 'Port dashboard/bookings-list/v2-dense-list. Touches: components/bookings/booking-row.tsx, components/ui/table.tsx',
    links: [{ kind: 'relates', key: 'GTV-261' }],
  }),
  // ── Backlog ─────────────────────────────────────────────────────────────────────────────────────
  task({
    key: 'GTV-270',
    title: l('موردو الفنادق: تخزين استجابة التوفر مؤقتًا', 'Hotel suppliers: cache the availability response'),
    status: 'backlog',
    priority: 'P2',
    specialty: 'backend',
    effort: 'M',
    repo: 'backend',
    module: 'catalog',
    createdAt: T('11-03', '17:40'),
    body: l('استجابة المورد تستغرق ثانيتين. نحتاج تخزينًا قصيرًا قبل فتح البحث للعملاء.', 'The supplier response takes two seconds. It needs a short cache before search opens to customers.'),
    acceptance: l('- [ ] تخزين لمدة 5 دقائق لكل مدينة وتاريخ\n- [ ] إبطال عند تغيير السعر\n- [ ] مقياس لنسبة الإصابة', '- [ ] 5 minute cache per city and date\n- [ ] Invalidated on a price change\n- [ ] A hit-rate metric'),
    links: [{ kind: 'relates', key: 'GTV-236' }],
  }),
  task({
    key: 'GTV-271',
    title: l('سجل المحفظة: حالة فارغة أوضح', 'Wallet history: a clearer empty state'),
    status: 'backlog',
    priority: 'P3',
    specialty: 'frontend',
    effort: 'S',
    repo: 'web',
    module: 'wallet',
    createdAt: T('10-29', '12:15'),
    by: user('u-sara'),
  }),
  task({
    key: 'GTV-272',
    title: l('نتائج الفنادق: أول مفاهيم التصميم', 'Hotel results: first design concepts'),
    status: 'backlog',
    priority: 'P2',
    specialty: 'design',
    effort: 'L',
    repo: 'web',
    module: 'catalog',
    createdAt: T('11-01', '10:20'),
    by: user('u-layla'),
    links: [{ kind: 'blocked_by', key: 'GTV-236' }],
  }),
  task({
    key: 'GTV-273',
    title: l('اختبار e2e: استرداد دفعة مقسّمة', 'E2E: refund a split payment'),
    status: 'backlog',
    priority: 'P2',
    specialty: 'qa',
    effort: 'M',
    repo: 'backend',
    module: 'payments',
    createdAt: T('11-03', '12:30'),
    by: agent('u-omar'),
    origin: 'session_followup',
    acceptance: l('- [ ] المحفظة أولًا ثم البطاقة\n- [ ] يظهر سطران في تقرير المحاسب', '- [ ] Wallet first, then the card\n- [ ] Two lines in the accountant report'),
    links: [{ kind: 'relates', key: 'GTV-246' }],
  }),
  task({
    key: 'GTV-274',
    title: l('توثيق مدة الاحتفاظ بعد قرار KVKK', 'Document the retention period after the KVKK decision'),
    status: 'backlog',
    priority: 'P3',
    specialty: 'docs',
    effort: 'S',
    repo: 'backend',
    module: 'compliance',
    createdAt: T('10-31', '09:50'),
    by: user('u-omar'),
    origin: 'decision',
    links: [{ kind: 'blocked_by', key: 'GTV-219' }],
  }),

  // ── Ready, for the specialties Today's two personas do not hold ─────────────────────────────────
  task({
    key: 'GTV-275',
    title: l('مفاتيح منع التكرار في شحن المحفظة', 'Idempotency keys on wallet top-up'),
    status: 'ready',
    priority: 'P1',
    specialty: 'backend',
    effort: 'M',
    repo: 'backend',
    module: 'wallet',
    dueAt: T('11-05', '15:00'),
    createdAt: T('11-03', '14:20'),
    by: agent('u-yousef'),
    origin: 'session_followup',
    body: l('طلب الشحن المكرر يخصم مرتين عند انقطاع الشبكة على الجوال.', 'A repeated top-up request charges twice when the network drops on a phone.'),
    acceptance: l('- [ ] رأس Idempotency-Key مطلوب\n- [ ] الطلب المكرر يعيد النتيجة نفسها\n- [ ] اختبار طلبين متزامنين', '- [ ] An Idempotency-Key header is required\n- [ ] A repeated request returns the same result\n- [ ] A test with two concurrent requests'),
    prompt: 'Read GTV-275. Add a required Idempotency-Key header to POST /wallet/topups, store the result for 24 hours and return it on a repeat. Add a concurrency test. When done call hub.log_session and mark GTV-275 done.',
    later: [moved(T('11-03', '14:40'), user('u-owner'), 'backlog', 'ready')],
  }),
  task({
    key: 'GTV-276',
    title: l('موجز إعادة تصميم معالج حجز الوكلاء', 'Redesign brief for the agent booking wizard'),
    status: 'ready',
    priority: 'P2',
    specialty: 'design',
    effort: 'S',
    repo: 'dashboard',
    module: 'booking',
    createdAt: T('11-02', '15:30'),
    later: [moved(T('11-03', '09:40'), user('u-owner'), 'backlog', 'ready')],
  }),
  task({
    key: 'GTV-277',
    title: l('اختبار تحمّل صفحة الدفع قبل الإطلاق', 'Load test the checkout before launch'),
    status: 'ready',
    priority: 'P1',
    specialty: 'qa',
    effort: 'L',
    repo: 'backend',
    module: 'payments',
    dueAt: T('11-09', '12:00'),
    createdAt: T('11-02', '11:10'),
    links: [{ kind: 'blocked_by', key: 'GTV-259' }],
  }),

  // ── Claimed ─────────────────────────────────────────────────────────────────────────────────────
  task({
    key: 'GTV-278',
    title: l('حفظ فلاتر الحجوزات في الرابط', 'Keep booking filters in the URL'),
    status: 'claimed',
    priority: 'P2',
    specialty: 'frontend',
    effort: 'S',
    repo: 'dashboard',
    module: 'booking',
    createdAt: T('11-02', '08:50'),
    claimedById: 'u-karim',
    claimedAt: T('11-03', '16:05'),
    branch: 'feat/booking-filters-url',
    links: [{ kind: 'relates', key: 'GTV-257' }],
    later: [claimed(T('11-03', '16:05'), 'u-karim', 'feat/booking-filters-url')],
  }),
  task({
    key: 'GTV-279',
    title: l('مراجعة صلاحيات رموز الوكلاء', 'Audit agent token scopes'),
    status: 'claimed',
    priority: 'P1',
    specialty: 'qa',
    effort: 'M',
    repo: 'hub',
    module: 'auth',
    dueAt: T('11-04', '18:00'),
    createdAt: T('11-03', '10:15'),
    claimedById: 'u-nour',
    claimedAt: T('11-03', '18:20'),
    later: [claimed(T('11-03', '18:20'), 'u-nour')],
  }),

  // ── In progress ─────────────────────────────────────────────────────────────────────────────────
  task({
    key: 'GTV-280',
    title: l('شاشة الحجز على الجوال: شريط الدفع الثابت', 'Mobile booking: the sticky pay bar'),
    status: 'in_progress',
    priority: 'P2',
    specialty: 'design',
    effort: 'M',
    repo: 'web',
    module: 'booking',
    createdAt: T('11-01', '13:00'),
    claimedById: 'u-layla',
    claimedAt: T('11-02', '09:00'),
    startedAt: T('11-02', '09:30'),
    later: [claimed(T('11-02', '09:00'), 'u-layla'), moved(T('11-02', '09:30'), user('u-layla'), 'claimed', 'in_progress')],
  }),

  // ── In review ───────────────────────────────────────────────────────────────────────────────────
  task({
    key: 'GTV-281',
    title: l('إعادة محاولة إشعارات الاسترداد من البوابة', 'Retry refund webhooks from the gateway'),
    status: 'in_review',
    priority: 'P1',
    specialty: 'backend',
    effort: 'M',
    repo: 'backend',
    module: 'payments',
    createdAt: T('10-30', '16:00'),
    claimedById: 'u-yousef',
    claimedAt: T('10-31', '09:10'),
    startedAt: T('10-31', '09:20'),
    branch: 'fix/refund-webhook-retry',
    prUrl: 'https://github.com/mohmedofficial515/Goteav-backend/pull/420',
    acceptance: l('- [x] ثلاث محاولات بفاصل متزايد\n- [x] تسجيل كل محاولة\n- [ ] مراجعة QA', '- [x] Three retries with growing delay\n- [x] Each attempt is logged\n- [ ] QA review'),
    later: [claimed(T('10-31', '09:10'), 'u-yousef', 'fix/refund-webhook-retry'), moved(T('10-31', '09:20'), user('u-yousef'), 'claimed', 'in_progress'), moved(T('11-03', '19:40'), agent('u-yousef'), 'in_progress', 'in_review')],
  }),
  task({
    key: 'GTV-282',
    title: l('بحث الرحلات: الإبقاء على الفلاتر عند الرجوع', 'Flight search: keep filters on Back'),
    status: 'in_review',
    priority: 'P2',
    specialty: 'frontend',
    effort: 'S',
    repo: 'web',
    module: 'search',
    createdAt: T('11-01', '11:40'),
    claimedById: 'u-sara',
    claimedAt: T('11-01', '14:00'),
    startedAt: T('11-01', '14:10'),
    branch: 'fix/search-back-filters',
    prUrl: 'https://github.com/Alremaal-Co/Goteav/pull/214',
    later: [claimed(T('11-01', '14:00'), 'u-sara', 'fix/search-back-filters'), moved(T('11-01', '14:10'), user('u-sara'), 'claimed', 'in_progress'), moved(T('11-03', '13:05'), user('u-sara'), 'in_progress', 'in_review')],
  }),

  // ── Done: the first three inside the 14-day window, the fourth outside it ───────────────────────
  task({
    key: 'GTV-283',
    title: l('دفع مقسّم: المحفظة ثم البطاقة', 'Split payment: wallet, then card'),
    status: 'done',
    priority: 'P1',
    specialty: 'backend',
    effort: 'L',
    repo: 'backend',
    module: 'payments',
    createdAt: T('10-21', '10:00'),
    claimedById: 'u-yousef',
    claimedAt: T('10-21', '11:00'),
    startedAt: T('10-21', '11:10'),
    doneAt: T('11-03', '11:20'),
    branch: 'feat/split-payment',
    links: [{ kind: 'relates', key: 'GTV-246' }],
    later: [claimed(T('10-21', '11:00'), 'u-yousef', 'feat/split-payment'), moved(T('11-03', '11:20'), user('u-omar'), 'in_review', 'done')],
  }),
  task({
    key: 'GTV-284',
    title: l('إصلاح اتجاه المبلغ في إيصال الدفع', 'Fix the amount direction on the payment receipt'),
    status: 'done',
    priority: 'P2',
    specialty: 'frontend',
    effort: 'S',
    repo: 'web',
    module: 'booking',
    createdAt: T('10-28', '09:00'),
    claimedById: 'u-karim',
    claimedAt: T('10-28', '09:30'),
    doneAt: T('11-02', '17:15'),
    later: [claimed(T('10-28', '09:30'), 'u-karim'), moved(T('11-02', '17:15'), user('u-nour'), 'in_review', 'done')],
  }),
  task({
    key: 'GTV-285',
    title: l('نسخ إعدادات Caddy إلى جهاز Hub الجديد', 'Copy the Caddy setup to the new Hub host'),
    status: 'done',
    priority: 'P2',
    specialty: 'ops',
    effort: 'S',
    repo: 'hub',
    module: 'infra',
    createdAt: T('10-26', '14:00'),
    claimedById: 'u-owner',
    claimedAt: T('10-26', '14:05'),
    doneAt: T('10-27', '11:30'),
    later: [claimed(T('10-26', '14:05'), 'u-owner'), moved(T('10-27', '11:30'), user('u-owner'), 'in_progress', 'done')],
  }),
  task({
    key: 'GTV-286',
    title: l('ترحيل العملات إلى الجدول الجديد', 'Migrate currencies to the new table'),
    status: 'done',
    priority: 'P2',
    specialty: 'backend',
    effort: 'M',
    repo: 'backend',
    module: 'finance',
    createdAt: T('10-05', '10:00'),
    claimedById: 'u-omar',
    claimedAt: T('10-05', '12:00'),
    doneAt: T('10-12', '16:30'),
    later: [claimed(T('10-05', '12:00'), 'u-omar'), moved(T('10-12', '16:30'), user('u-owner'), 'in_review', 'done')],
  }),

  // ── Cancelled: off the board, in the list with `status=cancelled` (09 §6 acceptance) ────────────
  task({
    key: 'GTV-287',
    title: l('دمج Moyasar بوابةً وحيدة', 'Integrate Moyasar as the only gateway'),
    status: 'cancelled',
    priority: 'P1',
    specialty: 'backend',
    effort: 'L',
    repo: 'backend',
    module: 'payments',
    createdAt: T('10-24', '09:00'),
    origin: 'decision',
    links: [{ kind: 'relates', key: 'GTV-228' }],
    later: [moved(T('11-03', '18:16'), user('u-owner'), 'ready', 'cancelled')],
  }),
];
