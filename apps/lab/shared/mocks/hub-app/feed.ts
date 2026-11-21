// The stand-in for the unified feed of the Timeline surface (hub/timeline, v2-timeline-views).
//
// One list with three sources folded together the way concept A does it client-side:
//   - `GET /timeline` rows (card event + the card's CURRENT header + older events folded into the row),
//   - `GET /inbox` items (the "why" chip: routed / mention / watch / reminder / escalation, and read state),
//   - card-less system items (brief, source problem) that only the Inbox has today.
// The shape is therefore a TimelineRow with an InboxItem's `why` and `readAt` joined on, which is the adapter
// `toFeedRow(TimelineRow | InboxItem)` of concepts.md section 2.1. "Now" is the mock's fixed 2026-11-04 08:45.
//
// Titles are single short strings per locale; keys, branches, SHAs and paths are never translated.
// Own cards use GTV-2xx keys that exist in the Today mock; generated history uses GTV-1xx.

import { NOW, today, type CardType, type L, type Priority, type Role } from '../hub-today';

export { NOW };
export type { CardType, L, Priority, Role };

export type FeedAction = 'decide' | 'deliver' | 'verify' | 'acknowledge' | 'approve' | 'apply' | 'claim' | 'summarize';
export type WhyKind = 'routed' | 'mention' | 'watch' | 'reminder' | 'escalation';
/** Card-less (`brief`, `source`) or card-bound (`reminder`, `escalation`) items drawn as system rows. */
export type SystemKind = 'brief' | 'reminder' | 'escalation' | 'source';

export interface FeedCard {
  key: string;
  type: CardType;
  title: L;
  status: string;
  priority: Priority;
  ownerRole: Role | null;
  dueAt?: string;
  /** The API's own `card.awaiting` verb for me. Missing means nothing waits on me. */
  awaiting?: FeedAction;
  blocks?: number;
  blockedBy?: string;
  overdue?: boolean;
  escalated?: boolean;
}

export interface FeedItem {
  id: string;
  at: string;
  card: FeedCard | null;
  system?: SystemKind;
  /** `u-*` member, `system` for adapters, `me` for my own action. */
  actorId: string;
  viaAgent?: boolean;
  /** What happened, one sentence with the actor in it. */
  what: L;
  /** Branch, path or SHA: rendered LTR. */
  ref?: string;
  why: { kind: WhyKind; role?: Role } | null;
  /** New for me: an event by someone else after the last visit, or an unread notification. */
  unread: boolean;
  /** Older events of the same card folded into this row (30 minute collapse), newest first. */
  earlier?: { at: string; what: L }[];
  /** Brief and source problem only. */
  body?: L;
  /** A card-less item's destination. */
  link?: 'settings';
}

export type LiveStep =
  | { type: 'status'; afterMs: number; key: string; to: string; action: FeedAction | null; at: string; actorId: string; what: L }
  | { type: 'arrive'; afterMs: number; item: FeedItem };

export interface Feed {
  me: string;
  lastSeenAt: string;
  items: FeedItem[];
  /** "Also for you": tasks I can claim and sessions without a summary. Not part of the stream views. */
  ready: FeedItem[];
  sessions: FeedItem[];
  live: LiveStep[];
  brief: { at: string; text: L };
}

export type FeedScenario = 'default' | 'empty' | 'loading' | 'long' | 'error';

export function feedScenarioFromHash(): FeedScenario {
  const [, query = ''] = location.hash.split('?');
  const s = new URLSearchParams(query).get('scenario');
  return s === 'empty' || s === 'loading' || s === 'long' || s === 'error' ? s : 'default';
}

const l = (ar: string, en: string): L => ({ ar, en });
const T = (d: string, hm: string) => `2026-${d}T${hm}:00+03:00`;

const card = (c: FeedCard): FeedCard => c;

const decision231 = card({
  key: 'GTV-231', type: 'decision', status: 'open', priority: 'P0', ownerRole: 'accountant', awaiting: 'decide',
  title: l('رسوم Moyasar: على من؟', 'Moyasar fees: who pays?'), dueAt: T('11-04', '12:00'), blocks: 2,
});
const decision236 = card({
  key: 'GTV-236', type: 'decision', status: 'open', priority: 'P1', ownerRole: 'owner', awaiting: 'decide',
  title: l('الفنادق: نبدأ بالخليج؟', 'Hotels: start with the Gulf?'), dueAt: T('11-06', '18:00'),
});
const decision219 = card({
  key: 'GTV-219', type: 'decision', status: 'open', priority: 'P1', ownerRole: 'pm', awaiting: 'decide',
  title: l('الاحتفاظ بالبيانات: 5 أم 10 سنوات؟', 'Data retention: 5 or 10 years?'), dueAt: T('11-03', '18:00'), overdue: true, escalated: true,
});

const base: FeedItem[] = [
  {
    id: 'f-brief-1104', at: T('11-04', '07:30'), card: null, system: 'brief', actorId: 'system', viaAgent: true,
    what: l('موجز صباح 4 نوفمبر', 'Morning brief, 4 November'), why: null, unread: true,
    body: today.narrative.markdown,
  },
  {
    id: 'f-255', at: T('11-04', '08:32'), actorId: 'u-sara', why: { kind: 'watch' }, unread: true, ref: 'POST /admin/payments/{id}/refund',
    card: card({
      key: 'GTV-255', type: 'handoff', status: 'acknowledged', priority: 'P0', ownerRole: 'frontend',
      title: l('تغيير كاسر في عقد الاسترداد يتطلب مزامنة لوحة التحكم والموقع قبل الإصدار القادم', 'Breaking change in the refund contract: the dashboard and the web must sync before the next release'),
    }),
    what: l('استلمت سارة التغيير الكاسر', 'Sara acknowledged the breaking change'),
    earlier: [{ at: T('11-04', '08:20'), what: l('رصد oasdiff تغييرين كاسرين في العقد', 'oasdiff found two breaking changes in the contract') }],
  },
  {
    id: 'f-256', at: T('11-04', '08:05'), actorId: 'u-sara', viaAgent: true, why: { kind: 'watch' }, unread: true, ref: 'fix/refund-contract',
    card: card({ key: 'GTV-256', type: 'change', status: 'in_progress', priority: 'P2', ownerRole: 'frontend', title: l('مزامنة عقد الاسترداد', 'Sync the refund contract') }),
    what: l('جلسة سارة: الأنواع والنماذج تمّت، وبقي اختبار e2e', 'Sara’s session: types and forms done, the e2e test is left'),
  },
  {
    id: 'f-231', at: T('11-04', '08:00'), actorId: 'u-yousef', viaAgent: true, why: { kind: 'mention' }, unread: true,
    card: decision231,
    what: l('طلب وكيل يوسف حسمه قبل الظهر ليكمل الدفع الحي', 'Yousef’s agent asked for a call before noon to finish live payments'),
    earlier: [
      { at: T('11-04', '07:40'), what: l('أضاف وكيل يوسف الخيار الثالث', 'Yousef’s agent added the third option') },
      { at: T('11-04', '07:25'), what: l('علّق: الرسوم تحدد تصميم المحوّل', 'Commented: the fees decide the adapter design') },
      { at: T('11-04', '07:10'), what: l('فتح وكيل يوسف القرار بخيارين', 'Yousef’s agent opened it with two options') },
    ],
  },
  {
    id: 'f-253', at: T('11-04', '01:40'), actorId: 'u-omar', why: null, unread: true, ref: 'fix/refund-race',
    card: card({ key: 'GTV-253', type: 'change', status: 'recorded', priority: 'P2', ownerRole: 'backend', title: l('سباق الاسترداد المزدوج', 'The double-refund race') }),
    what: l('دفع عمر 6 commits وجلسته بلا ملخص', 'Omar pushed 6 commits, his session has no summary'),
  },
  {
    id: 'f-esc-219', at: T('11-03', '18:05'), actorId: 'system', system: 'escalation', why: { kind: 'escalation' }, unread: true,
    card: decision219,
    what: l('صُعِّد إليك بعد انقضاء الموعد وتذكيرين', 'Escalated to you: the deadline passed after two reminders'),
  },
  {
    id: 'f-251', at: T('11-03', '22:10'), actorId: 'u-yousef', why: null, unread: true, ref: 'feat/paytr',
    card: card({ key: 'GTV-251', type: 'change', status: 'merged', priority: 'P2', ownerRole: 'backend', title: l('محوّل PayTR (sandbox)', 'PayTR adapter (sandbox)') }),
    what: l('دمج يوسف PR #418 في main', 'Yousef merged PR #418 into main'),
  },
  {
    id: 'f-src-docs', at: T('11-03', '21:05'), card: null, system: 'source', actorId: 'system', why: null, unread: true, link: 'settings',
    what: l('مصدر backend docs يفشل', 'The backend docs source is failing'),
    body: l('فشل تحليل docs/map/index.html منذ 21:05.', 'Parsing docs/map/index.html has failed since 21:05.'),
  },
  {
    id: 'f-252', at: T('11-03', '20:30'), actorId: 'u-layla', why: { kind: 'watch' }, unread: true,
    card: card({ key: 'GTV-252', type: 'redesign', status: 'review', priority: 'P2', ownerRole: 'owner', awaiting: 'approve', title: l('نسخة المحفظة v7', 'Wallet redesign v7') }),
    what: l('أرسلت ليلى النسخة للمراجعة: 88/100', 'Layla sent the version to review: 88/100'),
  },
  {
    id: 'f-228', at: T('11-03', '18:15'), actorId: 'me', why: null, unread: false,
    card: card({ key: 'GTV-228', type: 'decision', status: 'decided', priority: 'P1', ownerRole: 'owner', title: l('البوابة الأساسية: PayTR', 'Primary gateway: PayTR') }),
    what: l('حسمتَ: PayTR مع Akbank احتياطًا', 'You decided: PayTR with Akbank as backup'),
  },
  {
    id: 'f-236', at: T('11-03', '17:30'), actorId: 'u-layla', why: { kind: 'mention' }, unread: true,
    card: decision236,
    what: l('أشارت إليك ليلى: أضفتُ ملاحظات موردي الخليج', 'Layla mentioned you: I added the Gulf supplier notes'),
  },
  {
    id: 'f-257', at: T('11-03', '16:50'), actorId: 'u-karim', why: null, unread: false, ref: 'feat/saved-filters',
    card: card({ key: 'GTV-257', type: 'change', status: 'open', priority: 'P2', ownerRole: 'frontend', title: l('فلاتر الحجوزات المحفوظة', 'Saved booking filters') }),
    what: l('فتح كريم PR #212 وينتظر مراجعة', 'Karim opened PR #212, it waits for a review'),
  },
  {
    id: 'f-247', at: T('11-03', '15:20'), actorId: 'u-yousef', why: { kind: 'routed', role: 'accountant' }, unread: false,
    card: card({ key: 'GTV-247', type: 'need', status: 'delivered', priority: 'P2', ownerRole: 'accountant', awaiting: 'verify', title: l('تحقق من عمولة Akbank 2%', 'Verify the Akbank 2% fee') }),
    what: l('سلّم يوسف العمولة، والتحقق عليك', 'Yousef delivered the fee, the check is yours'),
  },
  {
    id: 'f-rem-240', at: T('11-03', '15:00'), actorId: 'system', system: 'reminder', why: { kind: 'reminder' }, unread: true,
    card: card({ key: 'GTV-240', type: 'need', status: 'requested', priority: 'P1', ownerRole: 'owner', awaiting: 'deliver', title: l('توكن PayTR الحي', 'PayTR live token'), dueAt: T('11-05', '17:00'), blocks: 1 }),
    what: l('تذكير: موعد التسليم بعد يومين وGTV-259 تنتظره', 'Reminder: due in 2 days and GTV-259 waits on it'),
  },
  {
    id: 'f-180', at: T('11-03', '14:05'), actorId: 'u-yousef', why: null, unread: false,
    card: card({ key: 'GTV-180', type: 'doc', status: 'published', priority: 'P3', ownerRole: 'backend', title: l('وثيقة 21: أمان التأكيد', 'Doc 21: confirmation safety') }),
    what: l('قسم جديد في الوثيقة: الحجز قبل الخصم', 'New section: hold before charge'),
  },
  {
    id: 'f-246', at: T('11-03', '12:00'), actorId: 'me', why: null, unread: false,
    card: card({ key: 'GTV-246', type: 'release', status: 'released', priority: 'P2', ownerRole: 'owner', title: l('إصدار 2026-11-03', 'Release 2026-11-03') }),
    what: l('أصدرتَ النسخة: 12 تغييرًا', 'You shipped the release: 12 changes'),
  },
  {
    id: 'f-brief-1103', at: T('11-03', '07:30'), card: null, system: 'brief', actorId: 'system', viaAgent: true, why: null, unread: false,
    what: l('موجز صباح 3 نوفمبر', 'Morning brief, 3 November'),
    body: l('أمس دُمج محوّل PayTR التجريبي، ووُثّقت ثلاثة قرارات.', 'Yesterday the sandbox PayTR adapter was merged and three decisions were logged.'),
  },
  {
    id: 'f-244', at: T('11-03', '06:40'), actorId: 'system', why: { kind: 'routed', role: 'pm' }, unread: false, ref: 'GET /admin/hotels/suppliers',
    card: card({ key: 'GTV-244', type: 'handoff', status: 'pending', priority: 'P1', ownerRole: 'pm', awaiting: 'acknowledge', title: l('نقطة جديدة: موردو الفنادق', 'New endpoint: hotel suppliers') }),
    what: l('أنشأ الباك إند نقطة جديدة وتحتاج استلامًا', 'The backend added a new endpoint and it needs a receiver'),
  },
  {
    id: 'f-258', at: T('11-02', '13:05'), actorId: 'system', why: null, unread: false,
    card: card({ key: 'GTV-258', type: 'task', status: 'ready', priority: 'P0', ownerRole: 'pm', title: l('تفعيل النسخ الاحتياطي الليلي', 'Enable nightly backups') }),
    what: l('اقتُرحت من مستورد وصارت جاهزة', 'Suggested by an importer and marked ready'),
  },
  {
    id: 'f-230', at: T('11-02', '11:40'), actorId: 'u-yousef', why: null, unread: false,
    card: card({ key: 'GTV-230', type: 'doc', status: 'published', priority: 'P3', ownerRole: 'backend', title: l('وثيقة 18: تسوية الدفع', 'Doc 18: payment settlement') }),
    what: l('تحديث قسم الاسترداد', 'Updated the refund section'),
  },
];

const ready: FeedItem[] = [
  {
    id: 'r-258', at: T('11-02', '13:05'), actorId: 'system', why: { kind: 'routed', role: 'pm' }, unread: false,
    card: card({ key: 'GTV-258', type: 'task', status: 'ready', priority: 'P0', ownerRole: 'pm', awaiting: 'claim', title: l('تفعيل النسخ الاحتياطي الليلي', 'Enable nightly backups') }),
    what: l('جاهزة لدورك', 'Ready for your role'),
  },
  {
    id: 'r-249', at: T('11-03', '10:00'), actorId: 'system', why: { kind: 'routed', role: 'pm' }, unread: false,
    card: card({ key: 'GTV-249', type: 'task', status: 'ready', priority: 'P1', ownerRole: 'pm', awaiting: 'claim', blockedBy: 'GTV-231', title: l('تحديث وثيقة الإطلاق 25', 'Update launch doc 25') }),
    what: l('متوقفة على قرار الرسوم', 'Blocked until the fee decision'),
  },
  {
    id: 'r-262', at: T('11-03', '09:10'), actorId: 'system', why: { kind: 'routed', role: 'pm' }, unread: false,
    card: card({ key: 'GTV-262', type: 'task', status: 'ready', priority: 'P2', ownerRole: 'pm', awaiting: 'claim', title: l('دعوة نور وليلى إلى Hub', 'Invite Nour and Layla to Hub') }),
    what: l('متابعة من جلسة سابقة', 'Follow-up from a session'),
  },
];

const sessions: FeedItem[] = [
  {
    id: 's-292', at: T('11-03', '17:20'), actorId: 'me', why: null, unread: false, ref: 'feat/h1-02-session-logging',
    card: card({ key: 'GTV-292', type: 'change', status: 'recorded', priority: 'P2', ownerRole: 'backend', awaiting: 'summarize', title: l('جلسة: تسجيل الجلسات في Hub', 'Session: session logging in Hub') }),
    what: l('جلسة 96 دقيقة و4 commits بلا ملخص', 'A 96 minute session with 4 commits and no summary'),
  },
];

const live: LiveStep[] = [
  {
    type: 'status', afterMs: 5000, key: 'GTV-244', to: 'acknowledged', action: 'apply', at: T('11-04', '08:46'), actorId: 'u-sara',
    what: l('استلمت سارة الإحالة، والتطبيق عليك الآن', 'Sara acknowledged the handoff, applying it is yours now'),
  },
  {
    type: 'arrive', afterMs: 12000,
    item: {
      id: 'f-259-live', at: T('11-04', '08:47'), actorId: 'u-yousef', viaAgent: true, why: null, unread: true, ref: '91ad4e6',
      card: card({ key: 'GTV-259', type: 'task', status: 'in_progress', priority: 'P1', ownerRole: 'backend', title: l('محوّل PayTR: الدفع الحي', 'PayTR adapter: live payments') }),
      what: l('ربط وكيل يوسف أكواد أخطاء PayTR الحية', 'Yousef’s agent mapped the live PayTR error codes'),
    },
  },
];

// ── A long list: 240 older rows from the last three weeks ───────────────────────────────────────

const POOL: { type: CardType; title: L; status: string; what: L }[] = [
  { type: 'change', title: l('إصلاح تقريب العملات', 'Fix currency rounding'), status: 'merged', what: l('دُمج PR في main', 'A PR was merged into main') },
  { type: 'task', title: l('شاشة تأكيد الحجز', 'Booking confirmation screen'), status: 'done', what: l('أُنجزت المهمة', 'The task was completed') },
  { type: 'decision', title: l('مزود الرسائل القصيرة', 'SMS provider'), status: 'decided', what: l('حُسم القرار بخيارين', 'Decided between two options') },
  { type: 'handoff', title: l('حقل جديد في الحجوزات', 'A new field on bookings'), status: 'applied', what: l('طُبّقت الإحالة', 'The handoff was applied') },
  { type: 'doc', title: l('وثيقة الإشعارات', 'Notifications doc'), status: 'published', what: l('تحديث قسم القنوات', 'Updated the channels section') },
  { type: 'change', title: l('تسريع بحث الرحلات', 'Faster flight search'), status: 'recorded', what: l('5 commits خلال ساعة', '5 commits within an hour') },
  { type: 'need', title: l('مفتاح خدمة الخرائط', 'Maps service key'), status: 'verified', what: l('سُلِّم المفتاح وتم التحقق', 'Delivered and verified') },
  { type: 'redesign', title: l('صفحة الحجوزات v2', 'Bookings page v2'), status: 'approved', what: l('اعتُمدت النسخة', 'The version was approved') },
  { type: 'release', title: l('إصدار أسبوعي', 'Weekly release'), status: 'released', what: l('أُصدرت النسخة', 'The release shipped') },
  { type: 'task', title: l('دعم الدفع بالتقسيط', 'Installment payments'), status: 'in_review', what: l('أُرسلت للمراجعة', 'Sent to review') },
];
const ACTORS = ['u-sara', 'u-yousef', 'u-omar', 'u-layla', 'u-karim', 'u-nour'];

function history(count: number): FeedItem[] {
  const out: FeedItem[] = [];
  let ms = new Date(T('11-02', '10:00')).getTime();
  for (let i = 0; i < count; i++) {
    const p = POOL[(i * 7 + 3) % POOL.length]!;
    ms -= (18 + ((i * 37) % 70)) * 60_000;
    out.push({
      id: `h-${i}`, at: new Date(ms + 3 * 3_600_000).toISOString().slice(0, 19) + '+03:00', actorId: ACTORS[i % ACTORS.length]!, why: i % 13 === 0 ? { kind: 'watch' } : null, unread: false,
      card: card({ key: `GTV-${190 - (i % 80)}`, type: p.type, title: p.title, status: p.status, priority: (['P1', 'P2', 'P2', 'P3'] as const)[i % 4]!, ownerRole: 'backend' }),
      what: p.what,
    });
  }
  return out;
}

const byAtDesc = (a: FeedItem, b: FeedItem) => new Date(b.at).getTime() - new Date(a.at).getTime();

const brief = { at: T('11-04', '07:30'), text: today.narrative.markdown };

export function feedFor(scenario: FeedScenario): Feed {
  const common = { me: 'u-owner', lastSeenAt: today.lastSeenAt, live, brief };
  if (scenario === 'empty') {
    // A quiet morning: nothing waits, nothing is new, and a few old read rows remain.
    const quiet = base.filter((i) => !i.unread && !i.card?.awaiting && i.system !== 'brief').slice(-4);
    return { ...common, items: quiet.sort(byAtDesc), ready: [], sessions: [], live: [] };
  }
  const items = [...base].sort(byAtDesc);
  if (scenario === 'long') return { ...common, items: [...items, ...history(240)], ready, sessions };
  return { ...common, items, ready, sessions };
}
