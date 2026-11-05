// Inbox items per persona (04 §3.17 `InboxItem`, 03 §9 Notification). Every card key is in the catalogue. The unread
// totals match `counters.inboxUnread` in hub-today: 9 for the owner, 3 for Sara, 0 for the empty scenario.

import type { HubScenario, L } from './index';

export type InboxAction = 'decide' | 'acknowledge' | 'apply' | 'deliver' | 'claim' | 'verify' | 'approve';

export type InboxKind = 'routed_decision' | 'routed_need' | 'routed_handoff' | 'mention' | 'watch_update' | 'deadline_reminder' | 'escalation' | 'unblocked' | 'task_ready' | 'brief' | 'system';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  title: L;
  body: L | null;
  cardKey: string | null;
  /** Quick action the notification offers. It goes away once the card no longer offers it. */
  action?: InboxAction;
  /** The capture source this notification is about, when it has no card. */
  sourceId?: string;
  /** Where a card-less item leads. */
  link?: { view: 'today' | 'settings'; query?: Record<string, string> };
  /** `card:<key>`: later items with the same key within 30 min merge in the UI (03 §9). */
  groupKey: string | null;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
}

const l = (ar: string, en: string): L => ({ ar, en });
const T = (d: string, hm: string) => `2026-${d}T${hm}:00+03:00`;

function item(id: string, kind: InboxKind, at: string, title: L, body: L | null, cardKey: string | null, extra: Partial<Pick<InboxItem, 'action' | 'link' | 'readAt' | 'archivedAt' | 'sourceId'>> = {}): InboxItem {
  return { id, kind, title, body, cardKey, groupKey: cardKey ? `card:${cardKey}` : null, createdAt: at, readAt: null, archivedAt: null, ...extra };
}

const seen = (at: string) => ({ readAt: at });

const owner: InboxItem[] = [
  item('i-01', 'watch_update', T('11-04', '08:32'), l('سارة استلمت التغيير الكاسر', 'Sara acknowledged the breaking change'), l('«أكمل الأنواع والنماذج اليوم.»', '“I will finish the types and forms today.”'), 'GTV-255'),
  item('i-02', 'watch_update', T('11-04', '08:20'), l('تغيير كاسر على بطاقة تتابعها', 'A breaking change on a card you watch'), l('oasdiff رصد تغييرين كاسرين في عقد الاسترداد.', 'oasdiff found two breaking changes in the refund contract.'), 'GTV-255'),
  item('i-03', 'mention', T('11-04', '08:00'), l('وكيل يوسف أشار إليك', 'Yousef’s agent mentioned you'), l('«أحتاج القرار قبل الظهر لأكمل الدفع الحي.»', '“I need this before noon to finish live payments.”'), 'GTV-231', { action: 'decide' }),
  item('i-04', 'brief', T('11-04', '07:30'), l('موجز صباح 4 نوفمبر', 'Morning brief, 4 November'), l('عقد الاسترداد تغيّر، وأمران ينتظرانك وحدك.', 'The refund contract changed, and two things wait only for you.'), null, { link: { view: 'today' } }),
  item('i-05', 'system', T('11-03', '21:05'), l('مصدر backend docs يفشل', 'The backend docs source is failing'), l('فشل تحليل docs/map/index.html منذ 21:05.', 'Parsing docs/map/index.html has failed since 21:05.'), null, { sourceId: 's-docs', link: { view: 'settings', query: { tab: 'sources' } } }),
  item('i-06', 'escalation', T('11-03', '18:05'), l('صُعّد إليك بعد انقضاء الموعد', 'Escalated to you after the deadline passed'), l('انقضى الموعد بلا قرار بعد تذكيرين.', 'The deadline passed without a decision after two reminders.'), 'GTV-219', { action: 'decide' }),
  item('i-07', 'mention', T('11-03', '17:30'), l('ليلى أشارت إليك', 'Layla mentioned you'), l('«أضفت ملاحظات موردي الخليج في الوثيقة.»', '“I added the Gulf supplier notes to the doc.”'), 'GTV-236', { action: 'decide' }),
  item('i-08', 'routed_need', T('11-03', '15:20'), l('يوسف سلّم، والتحقق عليك', 'Yousef delivered, the check is yours'), l('المكان: 1Password › Goteav › Akbank', 'Location: 1Password › Goteav › Akbank'), 'GTV-247', { action: 'verify' }),
  item('i-09', 'deadline_reminder', T('11-03', '15:00'), l('تذكير: توكن PayTR مستحق خلال يومين', 'Reminder: the PayTR token is due in 2 days'), l('GTV-259 متوقفة عليه.', 'GTV-259 waits on it.'), 'GTV-240', { action: 'deliver' }),
  // Read from here on.
  item('i-10', 'watch_update', T('11-04', '01:40'), l('جلسة عمر بلا ملخص', 'Omar’s session has no summary'), l('6 commits على fix/refund-race.', '6 commits on fix/refund-race.'), 'GTV-253', seen(T('11-04', '02:00'))),
  item('i-11', 'watch_update', T('11-03', '20:30'), l('المحفظة v7-twin-tanks بانتظار موافقتك', 'Wallet v7-twin-tanks waits for your approval'), l('مراجعة ux-critic: 88/100.', 'ux-critic review: 88/100.'), 'GTV-252', { action: 'approve', ...seen(T('11-03', '20:50')) }),
  item('i-12', 'brief', T('11-03', '07:30'), l('موجز صباح 3 نوفمبر', 'Morning brief, 3 November'), null, null, { link: { view: 'today' }, ...seen(T('11-03', '08:10')) }),
  item('i-13', 'routed_handoff', T('11-03', '06:40'), l('إحالة إلى مدير المشروع: endpoint جديد', 'Handoff to PM: a new endpoint'), l('قائمة موردي الفنادق تحتاج صفحة في لوحة التحكم.', 'The hotel suppliers list needs a page in the dashboard.'), 'GTV-244', { action: 'acknowledge', ...seen(T('11-03', '09:00')) }),
  item('i-14', 'routed_decision', T('11-02', '16:12'), l('قرار موجّه إلى المحاسب', 'Decision routed to Accountant'), l('فتحه وكيل يوسف بثلاثة خيارات.', 'Opened by Yousef’s agent with three options.'), 'GTV-231', { action: 'decide', ...seen(T('11-02', '17:00')) }),
  item('i-15', 'task_ready', T('11-02', '13:05'), l('مهمة جاهزة لدورك', 'A task is ready for your role'), l('اقتراح مستورد: النسخ الاحتياطي الليلي.', 'An imported suggestion: nightly backups.'), 'GTV-258', { action: 'claim', ...seen(T('11-02', '14:00')) }),
  item('i-16', 'routed_decision', T('10-30', '11:01'), l('قرار موجّه إليك', 'Decision routed to you'), null, 'GTV-236', { action: 'decide', ...seen(T('10-30', '12:00')) }),
  item('i-17', 'routed_need', T('11-01', '09:32'), l('طلب وكيل يوسف توكن PayTR', 'Yousef’s agent asked for the PayTR token'), l('يُسلَّم إلى الخزنة فقط، ويُكتب هنا مكانه.', 'It goes to the vault only; only its location is written here.'), 'GTV-240', { action: 'deliver', ...seen(T('11-01', '10:00')) }),
  // Archived: listed only with `archived=1` (09 §15 acceptance).
  item('i-18', 'watch_update', T('10-31', '10:25'), l('إحالة طُبّقت: PricesDto.truncated', 'A handoff was applied: PricesDto.truncated'), null, 'GTV-220', { ...seen(T('10-31', '11:00')), archivedAt: T('11-01', '09:00') }),
];

const sara: InboxItem[] = [
  item('s-01', 'mention', T('11-04', '08:33'), l('كريم أشار إليك', 'Karim mentioned you'), l('«الموقع يستدعي الشكل القديم أيضًا، سأزامنه اليوم.»', '“Web calls the old shape too, I will sync it today.”'), 'GTV-255', { action: 'apply' }),
  item('s-02', 'task_ready', T('11-04', '07:50'), l('مهمة جاهزة لتخصصك', 'A task is ready for your specialty'), l('شاشة «يومي» في Hub.', 'The Hub Today page.'), 'GTV-263', { action: 'claim' }),
  item('s-03', 'watch_update', T('11-03', '19:10'), l('اعتُمد نقل الحجوزات v2', 'The bookings v2 port was approved'), l('«تُنقل بعد مزامنة الاسترداد.»', '“Port after the refund sync.”'), 'GTV-261', { action: 'claim' }),
  item('s-04', 'routed_handoff', T('11-04', '08:21'), l('إحالة إلى الفرونت إند: تغيير كاسر', 'Handoff to Frontend: a breaking change'), l('طلب الاسترداد يتطلب سببًا ووجهة.', 'A refund request now needs a reason and a destination.'), 'GTV-255', { action: 'acknowledge', ...seen(T('11-04', '08:30')) }),
  item('s-05', 'task_ready', T('11-03', '10:00'), l('مهمة جاهزة لتخصصك', 'A task is ready for your specialty'), l('إصلاح اتجاه أرقام الحجز في RTL.', 'Fix booking-number direction in RTL.'), 'GTV-264', { action: 'claim', ...seen(T('11-03', '11:00')) }),
];

export function inboxFor(scenario: HubScenario | 'error'): InboxItem[] {
  if (scenario === 'empty') return [];
  return scenario === 'frontend' ? sara : owner;
}
