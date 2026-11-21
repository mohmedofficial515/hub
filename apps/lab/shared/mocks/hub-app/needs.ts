// Needs beyond GTV-240 and GTV-247. Open (requested + in progress) stays at the 3 `counters.needsOpen` promises, and
// the responsible roles keep the owner at 2 of mine and Sara at 0.
//
// `location` is always a pointer: a vault path, a file, or the NAME of an env key. No value, no masked value, nothing
// that looks like a token appears in this file.

import { adapter, agentOf, base, evt, l, person, T } from './card-base';
import type { NeedCard } from './index';

export const extraNeeds: NeedCard[] = [
  {
    ...base({
      key: 'GTV-233',
      title: l('حساب تجريبي في بيئة Akbank', 'A test account in the Akbank sandbox'),
      status: 'requested',
      priority: 'P2',
      ownerRole: 'qa',
      flags: { stale: true },
      createdAt: T('10-28', '11:20'),
      lastEventAt: T('11-02', '11:20'),
      createdById: 'u-omar',
      body: l('اختبارات الاسترداد المتزامن تحتاج حسابًا تجريبيًا ببطاقات أجنبية. البيانات تبقى في الخزنة.', 'The concurrent refund tests need a sandbox account with foreign cards. The credentials stay in the vault.'),
      watchers: ['u-omar', 'u-nour'],
      links: [
        { kind: 'blocks', key: 'GTV-259' },
        { kind: 'blocks', key: 'GTV-267' },
      ],
      events: [
        evt('n233-1', 1, 'created', T('10-28', '11:20'), person('u-omar'), { title: 'Akbank sandbox', status: 'requested', priority: 'P2' }),
        evt('n233-2', 2, 'reminder_sent', T('11-02', '11:20'), adapter('scheduler'), { afterDays: 5, channels: 'inbox' }),
      ],
    }),
    type: 'need',
    need: { kind: 'account', responsibleRole: 'qa', requesterId: 'u-omar' },
  } as NeedCard,
  {
    ...base({
      key: 'GTV-212',
      title: l('ملف ترخيص مجموعة الأيقونات', 'The licence file for the icon set'),
      status: 'in_progress',
      priority: 'P3',
      ownerRole: 'designer',
      createdAt: T('11-02', '09:40'),
      lastEventAt: T('11-03', '12:15'),
      createdById: 'u-karim',
      body: l('نحتاج نسخة الترخيص قبل استخدام الأيقونات في الموقع العام.', 'We need the licence copy before the icons go on the public site.'),
      watchers: ['u-karim', 'u-layla'],
      events: [
        evt('n212-1', 1, 'created', T('11-02', '09:40'), person('u-karim'), { title: 'Icon licence', status: 'requested', priority: 'P3' }),
        evt('n212-2', 2, 'status_changed', T('11-03', '12:15'), person('u-layla'), { from: 'requested', to: 'in_progress' }),
      ],
    }),
    type: 'need',
    need: { kind: 'file', responsibleRole: 'designer', requesterId: 'u-karim' },
  } as NeedCard,
  {
    ...base({
      key: 'GTV-205',
      title: l('توكن PayTR التجريبي', 'PayTR sandbox token'),
      status: 'delivered',
      priority: 'P1',
      ownerRole: 'backend',
      createdAt: T('10-30', '10:00'),
      lastEventAt: T('11-03', '19:30'),
      createdByKind: 'agent',
      createdById: 'u-yousef',
      createdVia: 'mcp',
      body: l('للتجربة على staging فقط. التوكن الحي طلب منفصل في GTV-240.', 'For staging only. The live token is a separate request in GTV-240.'),
      watchers: ['u-yousef', 'u-omar'],
      links: [{ kind: 'relates', key: 'GTV-240' }],
      events: [
        evt('n205-1', 1, 'created', T('10-30', '10:00'), agentOf('u-yousef'), { title: 'PayTR sandbox', status: 'requested', priority: 'P1' }),
        evt('n205-2', 2, 'delivered', T('11-03', '19:30'), person('u-omar'), { location: 'backend .env on staging, key PAYTR_SANDBOX_TOKEN' }),
      ],
    }),
    type: 'need',
    need: {
      kind: 'token',
      responsibleRole: 'backend',
      requesterId: 'u-yousef',
      location: 'backend .env on staging, key PAYTR_SANDBOX_TOKEN',
      deliveredById: 'u-omar',
      deliveredAt: T('11-03', '19:30'),
    },
  } as NeedCard,

  // ── Closed: shown with "Show verified" ─────────────────────────────────────────────────────────
  {
    ...base({
      key: 'GTV-201',
      title: l('توكن Duffel الحي', 'Duffel live token'),
      status: 'verified',
      priority: 'P0',
      ownerRole: 'owner',
      createdAt: T('10-12', '10:00'),
      lastEventAt: T('10-16', '09:30'),
      createdById: 'u-yousef',
      body: l('توكن الإنتاج لواجهة الحجز.', 'The production token for the booking API.'),
      watchers: ['u-owner', 'u-yousef'],
      events: [
        evt('n201-1', 1, 'created', T('10-12', '10:00'), person('u-yousef'), { title: 'Duffel live', status: 'requested', priority: 'P0' }),
        evt('n201-2', 2, 'delivered', T('10-15', '17:00'), person('u-owner'), { location: '1Password › Goteav › Duffel' }),
        evt('n201-3', 3, 'verified', T('10-16', '09:30'), person('u-yousef'), { note: 'A live search returned offers.' }),
      ],
    }),
    type: 'need',
    need: {
      kind: 'token',
      responsibleRole: 'owner',
      requesterId: 'u-yousef',
      location: '1Password › Goteav › Duffel',
      deliveredById: 'u-owner',
      deliveredAt: T('10-15', '17:00'),
      verifiedById: 'u-yousef',
      verifiedAt: T('10-16', '09:30'),
      verificationNote: l('بحث حي أعاد عروضًا.', 'A live search returned offers.'),
    },
  } as NeedCard,
  {
    ...base({
      key: 'GTV-193',
      title: l('نسبة ضريبة الرحلات إلى تركيا', 'The VAT rate on flights to Turkey'),
      status: 'verified',
      priority: 'P2',
      ownerRole: 'accountant',
      createdAt: T('10-05', '12:00'),
      lastEventAt: T('10-09', '14:00'),
      createdById: 'u-yousef',
      body: l('النسبة الصحيحة قبل تثبيت حساب الضريبة.', 'The correct rate before the tax calculation is fixed.'),
      events: [
        evt('n193-1', 1, 'created', T('10-05', '12:00'), person('u-yousef'), { title: 'VAT rate', status: 'requested', priority: 'P2' }),
        evt('n193-2', 2, 'delivered', T('10-08', '10:00'), person('u-owner'), { location: 'docs/finance/vat-turkey.md' }),
        evt('n193-3', 3, 'verified', T('10-09', '14:00'), person('u-yousef'), {}),
      ],
    }),
    type: 'need',
    need: {
      kind: 'value_check',
      responsibleRole: 'accountant',
      requesterId: 'u-yousef',
      location: 'docs/finance/vat-turkey.md',
      deliveredById: 'u-owner',
      deliveredAt: T('10-08', '10:00'),
      verifiedById: 'u-yousef',
      verifiedAt: T('10-09', '14:00'),
    },
  } as NeedCard,
  {
    ...base({
      key: 'GTV-189',
      title: l('حساب Stripe للسوق التركية', 'A Stripe account for the Turkish market'),
      status: 'cancelled',
      priority: 'P3',
      ownerRole: 'owner',
      createdAt: T('10-02', '09:00'),
      lastEventAt: T('10-06', '11:00'),
      createdById: 'u-yousef',
      body: l('أُلغي لأن Stripe لا يخدم الشركات التركية.', 'Cancelled because Stripe does not serve Turkish companies.'),
      events: [
        evt('n189-1', 1, 'created', T('10-02', '09:00'), person('u-yousef'), { title: 'Stripe', status: 'requested', priority: 'P3' }),
        evt('n189-2', 2, 'status_changed', T('10-06', '11:00'), person('u-owner'), { from: 'requested', to: 'cancelled', reason: 'Not available for Turkish companies.' }),
      ],
    }),
    type: 'need',
    need: { kind: 'account', responsibleRole: 'owner', requesterId: 'u-yousef' },
  } as NeedCard,
];
