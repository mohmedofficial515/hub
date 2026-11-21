// Releases fixtures, shaped after GET /workspaces/{ws}/releases (04 §3.20), with the finished cards they include. The
// finished cards are history that only this page needs to reach: done tasks, one applied handoff, decided decisions.
//
// `releaseCards` joins the catalogue through `cards` in ./index. This file imports only types from there.
// Notes are deterministic templates (D06, 07 §6.3): Hub writes the skeleton, and a member's Claude Code may polish it
// through hub.update_card, which changes the author chip.

import type { CardType, DecisionCard, HandoffCard, HubCard, L, ReleaseCard, Role, TaskCard } from './index';

const l = (ar: string, en: string): L => ({ ar, en });
const T = (d: string, hm: string) => `2026-${d}T${hm}:00+03:00`;

const common = (key: string, at: string, ownerRole: Role | null, repo: HubCard['repo']) => ({
  key,
  priority: 'P2' as const,
  ownerRole,
  repo,
  createdAt: at,
  lastEventAt: at,
  createdByKind: 'user' as const,
  createdById: 'u-owner',
  createdVia: 'web' as const,
  tags: [],
  watchers: [],
  links: [],
  comments: [],
  attachments: [],
  events: [],
});

function done(key: string, at: string, repo: HubCard['repo'], role: Role, specialty: TaskCard['task']['specialty'], title: L, assigneeId: string): TaskCard {
  return { ...common(key, at, role, repo), type: 'task', status: 'done', title, assigneeId, task: { specialty, origin: 'manual', claimedById: assigneeId, doneAt: at } };
}

function decided(key: string, at: string, title: L, question: L, chosen: L): DecisionCard {
  return {
    ...common(key, at, 'owner', 'backend'),
    type: 'decision',
    status: 'decided',
    title,
    decision: {
      kind: 'product',
      question,
      deciderRole: 'owner',
      options: [{ id: 'o1', title: chosen, pros: [], cons: [], recommended: true }],
      chosenOptionId: 'o1',
      decidedById: 'u-owner',
      decidedAt: at,
      remindersSent: [],
      adrStatus: 'none',
    },
  };
}

const handoff: HandoffCard = {
  ...common('GTV-188', T('11-02', '17:00'), 'frontend', 'backend'),
  type: 'handoff',
  status: 'applied',
  title: l('حقل جديد في الحجز: وجهة الاسترداد', 'New booking field: refund destination'),
  handoff: {
    fromRole: 'backend',
    toRole: 'frontend',
    kind: 'contract',
    severity: 'notable',
    summary: l('صارت تفاصيل الحجز تعيد وجهة الاسترداد.', 'Booking details now return the refund destination.'),
    payload: { schemas: ['BookingRefund'] },
    appliedById: 'u-sara',
    appliedAt: T('11-02', '17:00'),
  },
};

const history: HubCard[] = [
  done('GTV-181', T('10-26', '18:00'), 'backend', 'backend', 'backend', l('حجز صامت قبل الخصم', 'Silent hold before charge'), 'u-yousef'),
  done('GTV-182', T('10-27', '16:30'), 'backend', 'backend', 'backend', l('وجهة الاسترداد باختيار العميل', 'Customer-chosen refund destination'), 'u-omar'),
  done('GTV-183', T('10-30', '12:00'), 'dashboard', 'frontend', 'frontend', l('رمز PIN عند تغيير سعر العملة', 'PIN on a currency rate change'), 'u-sara'),
  done('GTV-184', T('10-21', '15:00'), 'web', 'frontend', 'frontend', l('تبديل العملة أثناء الدفع', 'Switch currency at checkout'), 'u-karim'),
  done('GTV-185', T('10-21', '11:00'), 'backend', 'backend', 'backend', l('حارس 409 عند تبديل العملة', 'The 409 guard on a currency switch'), 'u-yousef'),
  done('GTV-186', T('09-25', '13:00'), 'backend', 'backend', 'backend', l('سلم القفل بعد محاولات الدخول الفاشلة', 'The lockout ladder after failed logins'), 'u-omar'),
  done('GTV-187', T('11-03', '10:00'), 'backend', 'backend', 'backend', l('مهلات Duffel وتقصير نافذة الطلب', 'Duffel timeouts and a shorter order window'), 'u-yousef'),
  handoff,
  done('GTV-198', T('11-03', '16:00'), 'backend', 'backend', 'backend', l('رفع الصور فقط وإعادة ترميزها', 'Image-only uploads, re-encoded'), 'u-omar'),
  decided('GTV-195', T('11-03', '11:15'), l('حد الحافز للاسترداد إلى المحفظة: 5%', 'Wallet refund incentive capped at 5%'), l('كم نمنح من حافز للاسترداد إلى المحفظة؟', 'What incentive do we give for a wallet refund?'), l('5% بحد أقصى', 'Up to 5%')),
  done('GTV-196', T('11-03', '19:30'), 'backend', 'qa', 'qa', l('اختبار e2e لسباق الاسترداد المزدوج', 'e2e test for the double-refund race'), 'u-nour'),
  done('GTV-197', T('11-02', '12:00'), 'dashboard', 'frontend', 'frontend', l('فلاتر محفوظة في قائمة الحجوزات', 'Saved filters in the bookings list'), 'u-sara'),
];

// ── Note templates ───────────────────────────────────────────────────────────────────────────────

const GROUP_ORDER: CardType[] = ['decision', 'task', 'handoff', 'redesign', 'change', 'need', 'doc', 'release'];

const GROUP_WORD: Record<CardType, L> = {
  decision: l('القرارات', 'Decisions'),
  task: l('المهام', 'Tasks'),
  handoff: l('الإحالات', 'Handoffs'),
  redesign: l('التصميمات', 'Redesigns'),
  change: l('التغييرات', 'Changes'),
  need: l('الاحتياجات', 'Needs'),
  doc: l('الوثائق', 'Docs'),
  release: l('الإصدارات', 'Releases'),
};

const AUDIENCE: Record<'team' | 'owner' | 'accountant', L> = {
  team: l('للفريق: ما تغيّر وما يجب الانتباه له.', 'For the team: what changed and what to watch.'),
  owner: l('للمالك: ما يراه العميل الآن.', 'For the owner: what customers see now.'),
  accountant: l('للمحاسب: ما يؤثر في التقارير والرسوم.', 'For the accountant: what affects reports and fees.'),
};

type IncludedRow = { key: string; type: CardType; title: L };

/** 07 §6.3: one audience's skeleton, grouped by type. Pure template, no model call (D06). */
export function notesSkeleton(rows: IncludedRow[]): ReleaseCard['release']['notes'] {
  const body = (locale: 'ar' | 'en') =>
    GROUP_ORDER.filter((type) => rows.some((r) => r.type === type))
      .map((type) => [GROUP_WORD[type][locale], ...rows.filter((r) => r.type === type).map((r) => `- ${r.key}: ${r.title[locale]}`)].join('\n'))
      .join('\n\n');
  const note = (audience: keyof typeof AUDIENCE): L => ({
    ar: `${AUDIENCE[audience].ar}\n\n${body('ar')}`,
    en: `${AUDIENCE[audience].en}\n\n${body('en')}`,
  });
  return { team: note('team'), owner: note('owner'), accountant: note('accountant') };
}

const rowOf = (key: string): IncludedRow => {
  const card = history.find((c) => c.key === key);
  return card ? { key, type: card.type, title: card.title } : { key, type: 'change', title: l('إصلاح سباق الاسترداد المزدوج', 'Fix the double-refund race') };
};

/**
 * Who wrote each release's notes: `system` is Hub's template, `agent` means a member's Claude Code polished them.
 * The real API has this on the note's events; here it is a small map the page can update.
 */
export const notesAuthors = new Map<string, { kind: 'system' | 'agent'; memberId?: string }>([
  ['GTV-246', { kind: 'agent', memberId: 'u-owner' }],
  ['GTV-190', { kind: 'system' }],
  ['GTV-191', { kind: 'agent', memberId: 'u-sara' }],
  ['GTV-192', { kind: 'agent', memberId: 'u-yousef' }],
  ['GTV-200', { kind: 'system' }],
  ['GTV-194', { kind: 'system' }],
]);

function release(key: string, at: string, repo: HubCard['repo'], version: string, name: L, included: string[], released: boolean, notes?: ReleaseCard['release']['notes']): ReleaseCard {
  const rows = included.map(rowOf);
  return {
    ...common(key, at, 'owner', repo),
    type: 'release',
    status: released ? 'released' : 'planned',
    title: { ar: `إصدار ${version} · ${name.ar}`, en: `Release ${version} · ${name.en}` },
    events: [
      { id: `${key}-1`, seq: 1, kind: 'created', actorKind: 'user', actorId: 'u-owner', via: 'web', at, data: { title: name.en, status: 'planned', priority: 'P2' } },
      ...(released ? [{ id: `${key}-2`, seq: 2, kind: 'status_changed', actorKind: 'user' as const, actorId: 'u-owner', via: 'web' as const, at, data: { from: 'planned', to: 'released' } }] : []),
    ],
    release: { version, repo, tag: released ? `v${version.replaceAll('-', '.')}` : undefined, releasedAt: released ? at : undefined, includedKeys: included, notes: notes ?? notesSkeleton(rows) },
  };
}

export const releaseCards: HubCard[] = [
  ...history,
  release('GTV-190', T('11-03', '20:00'), 'backend', '2026-11-10', l('الدفع الحي عبر PayTR', 'PayTR live payments'), ['GTV-187', 'GTV-188', 'GTV-253'], false),
  release('GTV-191', T('10-31', '11:00'), 'dashboard', '2026-10-31', l('جدول العملات', 'The currencies table'), ['GTV-127', 'GTV-183'], true, {
    team: l('جدول العملات الجديد صار الافتراضي. لوحة التفاصيل تستبدل الصفحة القديمة.', 'The new currencies table is now the default. Its side panel replaces the old page.'),
    owner: l('تغيير سعر أي عملة صار يطلب رمز PIN ويُسجَّل في السجل.', 'Changing any currency rate now asks for the PIN and lands in the audit log.'),
    accountant: l('صار سجل تغيّر الأسعار ظاهرًا لكل عملة في لوحتها.', 'The rate history is now visible for each currency in its panel.'),
  }),
  release('GTV-192', T('10-28', '13:00'), 'backend', '2026-10-28', l('أمان التأكيد', 'Confirmation safety'), ['GTV-180', 'GTV-181', 'GTV-182'], true, {
    team: l('الحجز الصامت مفعّل قبل الخصم خلال 72 ساعة من المغادرة. راقبوا سجل flights.confirmation-sweep.', 'The silent hold now runs before the charge within 72 hours of departure. Watch the flights.confirmation-sweep log.'),
    owner: l('إذا رفضت شركة الطيران فلن يُخصم من العميل، وإذا خُصم يختار وجهة الاسترداد.', 'If the airline refuses, the customer is not charged. If they were, they choose where the refund goes.'),
    accountant: l('استرداد البطاقة قد ينتظر اختيار العميل حتى 24 ساعة قبل أن يظهر في التسوية.', 'A card refund may wait up to 24 hours for the customer’s choice before it shows in settlement.'),
  }),
  release('GTV-200', T('10-22', '10:30'), 'web', '2026-10-22', l('تبديل العملة عند الدفع', 'Currency switch at checkout'), ['GTV-184', 'GTV-185'], true),
  release('GTV-194', T('09-26', '12:00'), 'backend', '2026-09-26', l('أمان حسابات الموظفين', 'Staff account security'), ['GTV-186'], true),
];

// ── What a new release can include (09 §16) ──────────────────────────────────────────────────────

const FINISHED: Partial<Record<CardType, string>> = { task: 'done', handoff: 'applied', decision: 'decided', redesign: 'ported' };

/** Done tasks, applied handoffs, decided decisions and ported redesigns that are not in a release yet, since the last one. */
export function eligibleForRelease(all: HubCard[]): HubCard[] {
  const taken = new Set(all.flatMap((c) => (c.type === 'release' ? c.release.includedKeys : [])));
  const released = all.filter((c): c is ReleaseCard => c.type === 'release' && c.status === 'released');
  const lastRelease = Math.max(...released.map((c) => Date.parse(c.release.releasedAt ?? c.createdAt)), 0);
  return all.filter((c) => FINISHED[c.type] === c.status && !taken.has(c.key) && Date.parse(c.lastEventAt) >= lastRelease - 7 * 86_400_000);
}
