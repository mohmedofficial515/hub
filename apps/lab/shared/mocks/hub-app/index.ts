// Hub app catalogue: every card the v5 app can open, with the detail fields of
// F:/Goteav/project-hub/docs/03-data-model.md §5–§6. Rows (key, type, title, status, priority, role, due)
// are read from `@lab/mocks/hub-today` so both mocks always agree; only the detail is added here.
//
// Page-specific data goes in a new file next to this one (`shared/mocks/hub-app/<domain>.ts`, import
// as `@lab/mocks/hub-app/<domain>`). Do not edit this index for that; add a card here only when a page
// needs a key that does not exist yet.

import {
  NOW,
  members,
  today,
  todayFor,
  workspace,
  type Action,
  type CardRow,
  type HubScenario,
  type L,
  type Member,
  type Role,
  type Today,
} from '../hub-today';
import { docCards } from './docs';
import { extraDecisions } from './decisions';
import { stepsLeft } from './onboarding';
import { redesignCards } from './redesign';
import { releaseCards } from './releases';
import { extraHandoffs, handoffTasks } from './handoffs';
import { extraNeeds } from './needs';
import { extraTasks } from './tasks';
import { extraChanges } from './timeline';

export { NOW, members, today, todayFor, workspace };
export type { Action, CardRow, HubScenario, L, Member, Role, Today };
export type { CardType, Priority } from '../hub-today';

// ── Shapes (03-data-model §5) ─────────────────────────────────────────────────────────────────────

export type ActorKind = 'user' | 'agent' | 'system';
export type Via = 'web' | 'mcp' | 'hook' | 'adapter' | 'import' | 'scheduler' | 'telegram';

/** A row of `card_events`. `data` is kind-specific (03 §5.2); `field_changed` carries `{ field, from, to }`. */
export interface CardEvent {
  id: string;
  seq: number;
  kind: string;
  actorKind: ActorKind;
  actorId?: string;
  /** Adapter name when `actorKind` is `system` (github, oasdiff, lab, docs, scheduler). */
  adapter?: string;
  via: Via;
  at: string;
  data: Record<string, string | number | boolean | null>;
}

export interface CardComment {
  id: string;
  authorKind: 'user' | 'agent';
  authorId: string;
  via: Via;
  body: L;
  at: string;
  editedAt?: string;
  redacted?: boolean;
}

export type LinkKind = 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'duplicates';
export interface CardLink {
  kind: LinkKind;
  key: string;
}

export interface CardAttachment {
  kind: 'screenshot' | 'review' | 'file';
  name: string;
  url: string;
}

// ── Per-type detail (03-data-model §6) ────────────────────────────────────────────────────────────

export interface TaskDetail {
  specialty: 'backend' | 'frontend' | 'design' | 'qa' | 'ops' | 'docs';
  effort?: 'S' | 'M' | 'L' | 'XL';
  /** Markdown checklist, one `- [ ]` / `- [x]` per line. */
  acceptance?: L;
  prompt?: string;
  origin: 'manual' | 'import_suggestion' | 'session_followup' | 'redesign_port' | 'decision' | 'handoff';
  claimedById?: string;
  claimedAt?: string;
  branch?: string;
  prUrl?: string;
  startedAt?: string;
  doneAt?: string;
}

export interface DecisionOption {
  id: string;
  title: L;
  pros: L[];
  cons: L[];
  cost?: L;
  recommended?: boolean;
}

export interface DecisionDetail {
  kind: 'product' | 'technical' | 'financial' | 'design';
  question: L;
  options: DecisionOption[];
  deciderRole: Role;
  chosenOptionId?: string;
  rationale?: L;
  decidedById?: string;
  decidedAt?: string;
  /** Hours before the due date at which a reminder went out. */
  remindersSent: number[];
  escalatedAt?: string;
  escalatedToRole?: Role;
  adrPath?: string;
  adrPrUrl?: string;
  adrStatus: 'none' | 'drafted' | 'pr_opened' | 'merged' | 'failed';
}

export interface NeedDetail {
  kind: 'token' | 'account' | 'contract' | 'value_check' | 'file' | 'access' | 'other';
  responsibleRole: Role;
  requesterId?: string;
  /** Where the value was put, never the value itself. Shown after delivery. */
  location?: string;
  deliveredById?: string;
  deliveredAt?: string;
  verifiedById?: string;
  verifiedAt?: string;
  verificationNote?: L;
  /** The person who verified is the person who delivered (owner decision 2026-11-04). */
  selfVerified?: boolean;
}

export interface ChangeCommit {
  sha: string;
  message: string;
  at: string;
  files: number;
  additions: number;
  deletions: number;
}

export interface ChangeSession {
  sessionId: string;
  changed?: L;
  remaining?: L;
  durationSec: number;
  noSummary: boolean;
}

export interface ChangeDetail {
  kind: 'commits' | 'pull_request' | 'session';
  authorLogin?: string;
  authorUserId?: string;
  commits: ChangeCommit[];
  commitCount: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  windowStart?: string;
  windowEnd?: string;
  prNumber?: number;
  prState?: 'open' | 'merged' | 'closed';
  prUrl?: string;
  session?: ChangeSession;
}

/** One entry of the oasdiff changelog, as `HandoffDetail.payload` stores it. */
export interface OasdiffChange {
  endpoint: string;
  severity: 'breaking' | 'non-breaking';
  change: L;
  before?: string;
  after?: string;
}

export interface HandoffDetail {
  fromRole: Role;
  toRole: Role;
  kind: 'contract' | 'component' | 'design' | 'data' | 'other';
  severity: 'breaking' | 'notable' | 'info';
  summary: L;
  prompt?: string;
  payload: { oasdiff?: OasdiffChange[]; schemas?: string[]; files?: string[] };
  sourceCardKey?: string;
  acknowledgedById?: string;
  acknowledgedAt?: string;
  appliedById?: string;
  appliedAt?: string;
  appliedTaskKey?: string;
}

export interface RedesignDetail {
  app: 'web' | 'dashboard' | 'hub';
  page: string;
  version: string;
  labPath: string;
  labUrl: string;
  base?: string;
  concept: L;
  touchesComponents: string[];
  reviewScore?: number;
  reviewSummary?: L;
  approvedById?: string;
  approvedAt?: string;
  rejectedById?: string;
  rejectedAt?: string;
  decisionNote?: L;
  portTaskKey?: string;
  portedRef?: string;
}

export interface DocHeading {
  level: number;
  text: string;
  anchor: string;
}

export interface DocDetail {
  sourceName: string;
  path: string;
  kind: 'doc' | 'adr' | 'status' | 'readme' | 'other';
  lang: 'en' | 'ar';
  headings: DocHeading[];
  wordCount: number;
  lastCommitSha: string;
  lastIndexedAt: string;
  referencedBy: string[];
}

export interface ReleaseDetail {
  version: string;
  repo?: string;
  tag?: string;
  releasedAt?: string;
  includedKeys: string[];
  notes: { team: L; owner: L; accountant: L };
}

interface CardCore extends Omit<CardRow, 'type' | 'meta' | 'createdBy'> {
  meta?: L;
  body?: L;
  createdAt: string;
  lastEventAt: string;
  createdByKind: ActorKind;
  createdById?: string;
  createdVia: Via;
  assigneeId?: string;
  tags: string[];
  /** Member ids. */
  watchers: string[];
  links: CardLink[];
  events: CardEvent[];
  comments: CardComment[];
  attachments: CardAttachment[];
  archivedAt?: string;
}

export type TaskCard = CardCore & { type: 'task'; task: TaskDetail };
export type DecisionCard = CardCore & { type: 'decision'; decision: DecisionDetail };
export type NeedCard = CardCore & { type: 'need'; need: NeedDetail };
export type ChangeCard = CardCore & { type: 'change'; change: ChangeDetail };
export type HandoffCard = CardCore & { type: 'handoff'; handoff: HandoffDetail };
export type RedesignCard = CardCore & { type: 'redesign'; redesign: RedesignDetail };
export type DocCard = CardCore & { type: 'doc'; doc: DocDetail };
export type ReleaseCard = CardCore & { type: 'release'; release: ReleaseDetail };

/** The card as `GET /cards/{key}` returns it: narrow on `card.type` to reach its detail. */
export type HubCard = TaskCard | DecisionCard | NeedCard | ChangeCard | HandoffCard | RedesignCard | DocCard | ReleaseCard;

// ── Building blocks ───────────────────────────────────────────────────────────────────────────────

const l = (ar: string, en: string): L => ({ ar, en });
const T = (d: string, hm: string) => `2026-${d}T${hm}:00+03:00`;

/** Every list row of hub-today, so a catalogue card can never disagree with what Today shows. */
const rows = new Map<string, CardRow>();
const sara = todayFor('frontend');
for (const list of [today.awaitingMe, today.deadlines, today.readyTasks, sara.awaitingMe, sara.readyTasks]) {
  for (const row of list) if (!rows.has(row.key)) rows.set(row.key, row);
}

const evt = (
  id: string,
  seq: number,
  kind: string,
  at: string,
  actor: { kind: ActorKind; id?: string; adapter?: string; via: Via },
  data: CardEvent['data'] = {},
): CardEvent => ({ id, seq, kind, at, actorKind: actor.kind, actorId: actor.id, adapter: actor.adapter, via: actor.via, data });

const by = {
  owner: { kind: 'user', id: 'u-owner', via: 'web' },
  yousef: { kind: 'user', id: 'u-yousef', via: 'web' },
  yousefAgent: { kind: 'agent', id: 'u-yousef', via: 'mcp' },
  sara: { kind: 'user', id: 'u-sara', via: 'web' },
  saraAgent: { kind: 'agent', id: 'u-sara', via: 'mcp' },
  omar: { kind: 'user', id: 'u-omar', via: 'web' },
  layla: { kind: 'user', id: 'u-layla', via: 'web' },
  karim: { kind: 'user', id: 'u-karim', via: 'web' },
  github: { kind: 'system', adapter: 'github', via: 'adapter' },
  oasdiff: { kind: 'system', adapter: 'oasdiff', via: 'adapter' },
  lab: { kind: 'system', adapter: 'lab', via: 'adapter' },
  docs: { kind: 'system', adapter: 'docs', via: 'adapter' },
  scheduler: { kind: 'system', adapter: 'scheduler', via: 'scheduler' },
} as const;

const note = (id: string, author: string, at: string, ar: string, en: string, kind: 'user' | 'agent' = 'user'): CardComment => ({
  id,
  authorKind: kind,
  authorId: author,
  via: kind === 'agent' ? 'mcp' : 'web',
  body: l(ar, en),
  at,
});

type Extra = Partial<Omit<CardCore, 'key'>> & { createdAt: string };

/** Merge a hub-today row (when it has one) with the catalogue's own fields. */
function core(key: string, type: HubCard['type'], extra: Extra): CardCore & { type: HubCard['type'] } {
  const row = rows.get(key);
  const { createdBy: rowCreatedBy, type: _rowType, ...rowFields } = row ?? ({} as CardRow);
  const defaults: Omit<CardCore, 'createdAt'> = {
    key,
    title: l('', ''),
    status: 'open',
    priority: 'P2',
    ownerRole: null,
    lastEventAt: extra.createdAt,
    createdByKind: rowCreatedBy?.kind ?? 'user',
    createdById: rowCreatedBy?.memberId,
    createdVia: rowCreatedBy?.kind === 'agent' ? 'mcp' : 'web',
    tags: [],
    watchers: [],
    links: [],
    events: [],
    comments: [],
    attachments: [],
  };
  return { ...defaults, ...rowFields, ...extra, key, type };
}

// ── Catalogue ─────────────────────────────────────────────────────────────────────────────────────

const decisions: DecisionCard[] = [
  {
    ...core('GTV-231', 'decision', {
      createdAt: T('11-02', '16:10'),
      lastEventAt: T('11-04', '08:00'),
      createdById: 'u-yousef',
      body: l(
        'محوّل PayTR جاهز، لكنه يحتاج أن نعرف من يتحمّل رسوم Moyasar قبل أن نثبّت المبلغ في صفحة الدفع. القرار يؤثر في السعر الظاهر وفي تقرير المحاسب.',
        'The PayTR adapter is ready, but it needs to know who carries the Moyasar fee before we fix the amount on the checkout page. The choice changes the visible price and the accountant report.',
      ),
      tags: ['payments', 'pricing'],
      watchers: ['u-owner', 'u-yousef'],
      links: [
        { kind: 'blocks', key: 'GTV-249' },
        { kind: 'blocks', key: 'GTV-259' },
        { kind: 'relates', key: 'GTV-228' },
      ],
      events: [
        evt('d231-1', 1, 'created', T('11-02', '16:10'), by.yousefAgent, { title: 'Moyasar fees', status: 'open', priority: 'P1' }),
        evt('d231-2', 2, 'field_changed', T('11-03', '09:20'), by.owner, { field: 'priority', from: 'P1', to: 'P0' }),
        evt('d231-3', 3, 'linked', T('11-03', '09:22'), by.owner, { kind: 'blocks', otherCardKey: 'GTV-259' }),
        evt('d231-4', 4, 'reminder_sent', T('11-03', '12:00'), by.scheduler, { offsetHours: 24, channels: 'inbox, telegram' }),
        evt('d231-5', 5, 'commented', T('11-04', '08:00'), by.yousef, { excerpt: 'Yousef asks to decide before noon' }),
      ],
      comments: [
        note('c231-1', 'u-yousef', T('11-03', '10:02'), 'الخيار ب أسهل للمحاسبة، لكنه يقلّص هامش الرحلات الداخلية.', 'Option B is easier to book, but it shrinks the domestic flight margin.'),
        note('c231-2', 'u-yousef', T('11-04', '08:00'), 'أحتاج القرار قبل الظهر لأكمل الدفع الحي. GTV-259 متوقفة عليه.', 'I need this before noon to finish live payments. GTV-259 waits on it.', 'agent'),
      ],
    }),
    type: 'decision',
    decision: {
      kind: 'financial',
      question: l('من يتحمّل رسوم Moyasar على كل عملية دفع؟', 'Who carries the Moyasar fee on each payment?'),
      deciderRole: 'accountant',
      remindersSent: [24],
      adrStatus: 'none',
      options: [
        {
          id: 'o1',
          title: l('العميل يدفع الرسوم', 'The customer pays the fee'),
          pros: [l('هامشنا ثابت على كل حجز', 'Our margin stays fixed on every booking'), l('التقرير المالي أبسط', 'The finance report stays simple')],
          cons: [l('السعر النهائي يرتفع عند الدفع', 'The final price rises at checkout'), l('قد يقل التحويل على الجوال', 'Phone conversion may drop')],
          cost: l('لا تكلفة على المنصة', 'No cost to the platform'),
        },
        {
          id: 'o2',
          title: l('المنصة تتحمل الرسوم', 'The platform absorbs the fee'),
          pros: [l('السعر الظاهر لا يتغير', 'The shown price never changes'), l('تجربة دفع أنظف', 'A cleaner checkout')],
          cons: [l('يقلّص هامش الرحلات الداخلية', 'Shrinks the domestic flight margin')],
          cost: l('نحو 2.75% من كل عملية', 'About 2.75% of each payment'),
          recommended: true,
        },
        {
          id: 'o3',
          title: l('حد أدنى: المنصة تتحمل فوق 1000 ر.س', 'Threshold: the platform absorbs above SAR 1,000'),
          pros: [l('يحمي الهامش في الحجوزات الصغيرة', 'Protects the margin on small bookings')],
          cons: [l('قاعدة يصعب شرحها للعميل', 'A rule that is hard to explain to customers'), l('تحتاج اختبارات إضافية', 'Needs extra tests')],
        },
      ],
    },
  } as DecisionCard,
  {
    ...core('GTV-236', 'decision', {
      createdAt: T('10-30', '11:00'),
      lastEventAt: T('11-03', '17:30'),
      createdById: 'u-owner',
      body: l('نختار سوق البداية لخدمة الفنادق بعد قرار الموردين في المرحلة الأولى.', 'Pick the launch market for hotels, following the supplier research in stage one.'),
      tags: ['hotels'],
      watchers: ['u-owner', 'u-layla', 'u-yousef'],
      links: [{ kind: 'relates', key: 'GTV-180' }],
      events: [
        evt('d236-1', 1, 'created', T('10-30', '11:00'), by.owner, { title: 'Hotels market', status: 'open', priority: 'P1' }),
        evt('d236-2', 2, 'commented', T('11-03', '17:30'), by.layla, { excerpt: 'Layla adds the Gulf supplier notes' }),
      ],
      comments: [
        note('c236-1', 'u-yousef', T('10-31', '10:05'), 'تركيا ومصر لديهما موردون جاهزون بعقود قصيرة.', 'Turkey and Egypt have ready suppliers on short contracts.'),
        note('c236-2', 'u-layla', T('11-01', '12:40'), 'الخليج يحتاج تصميم إقامة طويلة مختلفًا.', 'The Gulf needs a different long-stay design.'),
        note('c236-3', 'u-omar', T('11-02', '09:15'), 'اختبار التحمل أسهل إذا بدأنا بسوق واحد.', 'Load testing is easier if we start with one market.'),
        note('c236-4', 'u-layla', T('11-03', '17:30'), 'أضفت ملاحظات موردي الخليج في الوثيقة.', 'I added the Gulf supplier notes to the doc.'),
      ],
    }),
    type: 'decision',
    decision: {
      kind: 'product',
      question: l('أين نطلق الفنادق أولًا؟', 'Where do hotels launch first?'),
      deciderRole: 'owner',
      remindersSent: [],
      adrStatus: 'none',
      options: [
        {
          id: 'o1',
          title: l('تركيا ومصر', 'Turkey + Egypt'),
          pros: [l('موردون جاهزون', 'Suppliers are ready'), l('طلب قائم من عملاء الرحلات', 'Existing demand from flight customers')],
          cons: [l('هوامش أقل في مصر', 'Lower margins in Egypt')],
          recommended: true,
        },
        {
          id: 'o2',
          title: l('الخليج', 'The Gulf'),
          pros: [l('متوسط حجز أعلى', 'Higher average booking')],
          cons: [l('يحتاج تصميم إقامة طويلة', 'Needs a long-stay design'), l('عقود الموردين أبطأ', 'Slower supplier contracts')],
        },
        {
          id: 'o3',
          title: l('عالمي عبر مجمّع واحد', 'Global through one aggregator'),
          pros: [l('تغطية كاملة من اليوم الأول', 'Full coverage from day one')],
          cons: [l('هامش ضعيف', 'Thin margin'), l('دعم أصعب', 'Harder support')],
        },
      ],
    },
  } as DecisionCard,
  {
    ...core('GTV-219', 'decision', {
      createdAt: T('10-20', '14:00'),
      lastEventAt: T('11-03', '18:05'),
      createdById: 'u-omar',
      body: l('نحتاج مدة احتفاظ موثقة قبل مراجعة KVKK. تغيير المدة لاحقًا يكلف ترحيل بيانات.', 'We need a documented retention period before the KVKK review. Changing it later costs a data migration.'),
      tags: ['compliance'],
      watchers: ['u-owner', 'u-omar'],
      links: [{ kind: 'relates', key: 'GTV-180' }],
      events: [
        evt('d219-1', 1, 'created', T('10-20', '14:00'), by.omar, { title: 'KVKK retention', status: 'open', priority: 'P1' }),
        evt('d219-2', 2, 'reminder_sent', T('11-02', '18:00'), by.scheduler, { offsetHours: 24, channels: 'inbox, telegram' }),
        evt('d219-3', 3, 'reminder_sent', T('11-03', '16:00'), by.scheduler, { offsetHours: 2, channels: 'inbox, telegram' }),
        evt('d219-4', 4, 'escalated', T('11-03', '18:05'), by.scheduler, { toRole: 'pm', afterHours: 0 }),
      ],
      comments: [note('c219-1', 'u-omar', T('10-28', '09:30'), 'الاستشاري يرى 10 سنوات أسلم للفواتير.', 'The consultant says 10 years is safer for invoices.')],
    }),
    type: 'decision',
    decision: {
      kind: 'technical',
      question: l('كم نحتفظ ببيانات الحجز الشخصية؟', 'How long do we keep personal booking data?'),
      deciderRole: 'pm',
      remindersSent: [24, 2],
      escalatedAt: T('11-03', '18:05'),
      escalatedToRole: 'pm',
      adrStatus: 'none',
      options: [
        {
          id: 'o1',
          title: l('5 سنوات', '5 years'),
          pros: [l('أقل بيانات شخصية محفوظة', 'Less personal data on hand')],
          cons: [l('قد لا يكفي للفواتير', 'May fall short for invoices')],
        },
        {
          id: 'o2',
          title: l('10 سنوات', '10 years'),
          pros: [l('يوافق متطلبات الفوترة', 'Matches invoicing rules')],
          cons: [l('تكلفة تخزين أعلى', 'Higher storage cost'), l('يتطلب تقنيعًا بعد 5 سنوات', 'Needs masking after 5 years')],
          recommended: true,
        },
      ],
    },
  } as DecisionCard,
  {
    ...core('GTV-228', 'decision', {
      title: l('البوابة الأساسية: PayTR', 'Primary gateway: PayTR'),
      status: 'decided',
      priority: 'P0',
      ownerRole: 'owner',
      createdAt: T('10-25', '10:00'),
      lastEventAt: T('11-03', '18:15'),
      createdById: 'u-owner',
      body: l('اختيار البوابة الأساسية بعد مقارنة التسوية والرسوم.', 'Choosing the primary gateway after comparing settlement and fees.'),
      tags: ['payments'],
      watchers: ['u-owner', 'u-yousef'],
      links: [{ kind: 'relates', key: 'GTV-231' }],
      events: [
        evt('d228-1', 1, 'created', T('10-25', '10:00'), by.owner, { title: 'Primary gateway', status: 'open', priority: 'P0' }),
        evt('d228-2', 2, 'decided', T('11-03', '18:15'), by.owner, { optionId: 'o1', optionTitle: 'PayTR + Akbank backup', rationale: 'USD settlement feeds Duffel directly' }),
      ],
    }),
    type: 'decision',
    decision: {
      kind: 'financial',
      question: l('أي بوابة دفع نعتمدها أساسًا؟', 'Which payment gateway is primary?'),
      deciderRole: 'owner',
      remindersSent: [],
      chosenOptionId: 'o1',
      rationale: l('تسوية بالدولار تغذي Duffel مباشرة', 'USD settlement feeds Duffel directly'),
      decidedById: 'u-owner',
      decidedAt: T('11-03', '18:15'),
      adrPath: 'docs/adr/0017-primary-gateway.md',
      adrPrUrl: 'https://github.com/mohmedofficial515/Goteav-backend/pull/421',
      adrStatus: 'pr_opened',
      options: [
        {
          id: 'o1',
          title: l('PayTR مع Akbank احتياطًا', 'PayTR with Akbank as backup'),
          pros: [l('تسوية بالدولار', 'USD settlement')],
          cons: [l('دمج أطول', 'A longer integration')],
          recommended: true,
        },
        {
          id: 'o2',
          title: l('Moyasar وحدها', 'Moyasar only'),
          pros: [l('دمج أسرع', 'A faster integration')],
          cons: [l('لا تسوية بالدولار', 'No USD settlement')],
        },
      ],
    },
  } as DecisionCard,
];

const needs: NeedCard[] = [
  {
    ...core('GTV-240', 'need', {
      createdAt: T('11-01', '09:30'),
      lastEventAt: T('11-03', '15:00'),
      createdById: 'u-yousef',
      body: l('توكن الإنتاج لبوابة PayTR. يوضع في الخزنة ولا يُكتب هنا أبدًا.', 'The production token for PayTR. It goes in the vault and is never written here.'),
      watchers: ['u-owner', 'u-yousef'],
      links: [{ kind: 'blocks', key: 'GTV-259' }],
      events: [
        evt('n240-1', 1, 'created', T('11-01', '09:30'), by.yousefAgent, { title: 'PayTR live token', status: 'requested', priority: 'P1' }),
        evt('n240-2', 2, 'reminder_sent', T('11-03', '15:00'), by.scheduler, { offsetHours: 48, channels: 'inbox' }),
      ],
    }),
    type: 'need',
    need: { kind: 'token', responsibleRole: 'owner', requesterId: 'u-yousef' },
  } as NeedCard,
  {
    ...core('GTV-247', 'need', {
      createdAt: T('11-02', '11:00'),
      lastEventAt: T('11-03', '15:20'),
      createdById: 'u-owner',
      body: l('تأكيد نسبة عمولة Akbank للبطاقات الأجنبية من العقد الموقّع.', 'Confirm the Akbank foreign-card fee against the signed contract.'),
      watchers: ['u-owner', 'u-yousef'],
      events: [
        evt('n247-1', 1, 'created', T('11-02', '11:00'), by.owner, { title: 'Akbank fee', status: 'requested', priority: 'P2' }),
        evt('n247-2', 2, 'status_changed', T('11-03', '10:00'), by.yousef, { from: 'requested', to: 'in_progress' }),
        evt('n247-3', 3, 'delivered', T('11-03', '15:20'), by.yousef, { location: '1Password › Goteav › Akbank' }),
      ],
    }),
    type: 'need',
    need: {
      kind: 'value_check',
      responsibleRole: 'accountant',
      requesterId: 'u-owner',
      location: '1Password › Goteav › Akbank',
      deliveredById: 'u-yousef',
      deliveredAt: T('11-03', '15:20'),
    },
  } as NeedCard,
];

const handoffs: HandoffCard[] = [
  {
    ...core('GTV-244', 'handoff', {
      createdAt: T('11-03', '06:40'),
      lastEventAt: T('11-03', '06:40'),
      createdByKind: 'system',
      createdVia: 'adapter',
      watchers: ['u-owner'],
      links: [{ kind: 'relates', key: 'GTV-236' }],
      events: [evt('h244-1', 1, 'created', T('11-03', '06:40'), by.oasdiff, { title: 'New endpoint', status: 'pending', priority: 'P1' })],
    }),
    type: 'handoff',
    handoff: {
      fromRole: 'backend',
      toRole: 'pm',
      kind: 'contract',
      severity: 'notable',
      summary: l('أضاف الباك إند قائمة موردي الفنادق. لا شيء يتعطل، لكن لوحة التحكم تحتاج صفحة لها.', 'The backend added a hotel suppliers list. Nothing breaks, but the dashboard needs a page for it.'),
      prompt: 'Run pnpm api:sync in Goteav-Dashboard, then add a read-only suppliers table under /admin/hotels.',
      payload: {
        oasdiff: [{ endpoint: 'GET /admin/hotels/suppliers', severity: 'non-breaking', change: l('endpoint جديد', 'New endpoint') }],
        schemas: ['HotelSupplier', 'HotelSupplierList'],
      },
      sourceCardKey: 'GTV-251',
    },
  } as HandoffCard,
  {
    ...core('GTV-255', 'handoff', {
      createdAt: T('11-04', '08:20'),
      lastEventAt: T('11-04', '08:32'),
      createdByKind: 'system',
      createdVia: 'adapter',
      title: l('تغيير كاسر: POST /admin/payments/{id}/refund', 'Breaking: POST /admin/payments/{id}/refund'),
      status: 'acknowledged',
      priority: 'P0',
      ownerRole: 'frontend',
      repo: 'backend',
      severity: 'breaking',
      watchers: ['u-owner', 'u-sara', 'u-karim'],
      links: [
        { kind: 'relates', key: 'GTV-253' },
        { kind: 'relates', key: 'GTV-260' },
      ],
      events: [
        evt('h255-1', 1, 'created', T('11-04', '08:20'), by.oasdiff, { title: 'Breaking refund change', status: 'pending', priority: 'P0' }),
        evt('h255-2', 2, 'acknowledged', T('11-04', '08:32'), by.sara, { note: 'Applying after api:sync' }),
      ],
      comments: [note('c255-1', 'u-sara', T('11-04', '08:33'), 'استلمته. أكمل الأنواع والنماذج اليوم.', 'Got it. I will finish the types and forms today.')],
    }),
    type: 'handoff',
    handoff: {
      fromRole: 'backend',
      toRole: 'frontend',
      kind: 'contract',
      severity: 'breaking',
      summary: l('صار طلب الاسترداد يتطلب سببًا ووجهة، وصار حقل الاسترداد في الدفعة قائمة.', 'A refund request now needs a reason and a destination, and the payment refund field became a list.'),
      prompt: 'Run pnpm api:sync. Add reason and refundTo to the refund form, then read refunds[] on the payment page.',
      payload: {
        oasdiff: [
          { endpoint: 'POST /admin/payments/{id}/refund', severity: 'breaking', change: l('حقل مطلوب جديد في الطلب', 'New required request field'), before: '{ amount }', after: '{ amount, reason, refundTo }' },
          { endpoint: 'GET /admin/payments/{id}', severity: 'breaking', change: l('حقل الاستجابة صار قائمة', 'Response field became a list'), before: 'refundedAt: string', after: 'refunds: Refund[]' },
          { endpoint: 'GET /admin/payments', severity: 'non-breaking', change: l('فلتر اختياري جديد', 'New optional filter'), after: '?refundTo=wallet|card' },
        ],
        schemas: ['Refund', 'RefundRequest'],
      },
      sourceCardKey: 'GTV-253',
      acknowledgedById: 'u-sara',
      acknowledgedAt: T('11-04', '08:32'),
      appliedTaskKey: 'GTV-260',
    },
  } as HandoffCard,
];

const taskCore = (key: string, extra: Extra) => core(key, 'task', extra);

const tasks: TaskCard[] = [
  {
    ...taskCore('GTV-258', {
      createdAt: T('11-02', '13:00'),
      createdVia: 'import',
      body: l('جهاز Hub بلا نسخ احتياطي ليلي بعد نقله. أضف المهمة وتأكد من استعادة نسخة واحدة.', 'The Hub host has no nightly backup since it moved. Add the job and prove one restore.'),
      watchers: ['u-owner'],
      events: [evt('t258-1', 1, 'created', T('11-02', '13:00'), { kind: 'system', adapter: 'import', via: 'import' }, { title: 'Nightly backups', status: 'ready', priority: 'P0' })],
    }),
    type: 'task',
    task: {
      specialty: 'ops',
      effort: 'S',
      origin: 'import_suggestion',
      acceptance: l('- [ ] مهمة cron تعمل كل ليلة\n- [ ] نسخة مستعادة على جهاز آخر\n- [ ] تنبيه عند الفشل', '- [ ] A cron job runs every night\n- [ ] One copy restored on another host\n- [ ] An alert fires on failure'),
      prompt: '/hub:next GTV-258',
    },
  } as TaskCard,
  {
    ...taskCore('GTV-249', {
      createdAt: T('11-03', '18:20'),
      createdVia: 'mcp',
      createdByKind: 'agent',
      createdById: 'u-yousef',
      links: [{ kind: 'blocked_by', key: 'GTV-231' }],
      events: [evt('t249-1', 1, 'created', T('11-03', '18:20'), by.yousefAgent, { title: 'Launch doc 25', status: 'ready', priority: 'P1' })],
    }),
    type: 'task',
    task: {
      specialty: 'docs',
      effort: 'M',
      origin: 'decision',
      acceptance: l('- [ ] قسم الرسوم محدّث\n- [ ] مراجعة المالك', '- [ ] The fees section is updated\n- [ ] Owner review'),
      prompt: '/hub:next GTV-249',
    },
  } as TaskCard,
  {
    ...taskCore('GTV-262', {
      createdAt: T('11-03', '21:00'),
      createdVia: 'mcp',
      createdByKind: 'agent',
      createdById: 'u-owner',
      events: [evt('t262-1', 1, 'created', T('11-03', '21:00'), { kind: 'agent', id: 'u-owner', via: 'mcp' }, { title: 'Invite members', status: 'ready', priority: 'P2' })],
    }),
    type: 'task',
    task: { specialty: 'ops', effort: 'S', origin: 'session_followup', prompt: '/hub:next GTV-262' },
  } as TaskCard,
  {
    ...taskCore('GTV-259', {
      title: l('محوّل PayTR: الدفع الحي', 'PayTR adapter: live payments'),
      status: 'in_progress',
      priority: 'P0',
      ownerRole: 'backend',
      repo: 'backend',
      branch: 'feat/paytr-live',
      assigneeId: 'u-yousef',
      createdAt: T('11-01', '10:00'),
      watchers: ['u-yousef', 'u-owner'],
      links: [
        { kind: 'blocked_by', key: 'GTV-231' },
        { kind: 'blocked_by', key: 'GTV-240' },
      ],
      events: [
        evt('t259-1', 1, 'created', T('11-01', '10:00'), by.yousefAgent, { title: 'PayTR live', status: 'ready', priority: 'P0' }),
        evt('t259-2', 2, 'claimed', T('11-01', '10:05'), by.yousef, { branch: 'feat/paytr-live' }),
        evt('t259-3', 3, 'status_changed', T('11-01', '10:30'), by.yousef, { from: 'claimed', to: 'in_progress' }),
      ],
    }),
    type: 'task',
    task: { specialty: 'backend', effort: 'L', origin: 'decision', claimedById: 'u-yousef', claimedAt: T('11-01', '10:05'), startedAt: T('11-01', '10:30'), branch: 'feat/paytr-live', prompt: '/hub:next GTV-259' },
  } as TaskCard,
  {
    ...taskCore('GTV-260', {
      title: l('مزامنة عقد الاسترداد', 'Sync refund contract'),
      status: 'in_progress',
      priority: 'P0',
      ownerRole: 'frontend',
      repo: 'dashboard',
      branch: 'fix/refund-contract',
      assigneeId: 'u-sara',
      createdAt: T('11-04', '08:34'),
      links: [{ kind: 'relates', key: 'GTV-255' }],
      events: [evt('t260-1', 1, 'created', T('11-04', '08:34'), by.saraAgent, { title: 'Sync refund contract', status: 'in_progress', priority: 'P0' })],
    }),
    type: 'task',
    task: { specialty: 'frontend', effort: 'M', origin: 'handoff', claimedById: 'u-sara', claimedAt: T('11-04', '08:34'), startedAt: T('11-04', '08:34'), branch: 'fix/refund-contract', prompt: '/hub:next GTV-260' },
  } as TaskCard,
  ...(['GTV-263', 'GTV-264', 'GTV-266'] as const).map(
    (key, i) =>
      ({
        ...taskCore(key, {
          createdAt: T('11-02', '09:00'),
          repo: key === 'GTV-263' ? 'hub' : 'dashboard',
          events: [evt(`t${key}-1`, 1, 'created', T('11-02', '09:00'), by.owner, { title: key, status: 'ready', priority: i === 0 ? 'P1' : 'P2' })],
        }),
        type: 'task',
        task: { specialty: 'frontend', effort: rows.get(key)?.effort, origin: 'manual', prompt: `/hub:next ${key}` },
      }) as TaskCard,
  ),
  {
    ...taskCore('GTV-265', {
      createdAt: T('11-03', '20:40'),
      repo: 'web',
      links: [{ kind: 'blocked_by', key: 'GTV-252' }],
      events: [evt('t265-1', 1, 'created', T('11-03', '20:40'), by.lab, { title: 'Port wallet v7', status: 'ready', priority: 'P2' })],
    }),
    type: 'task',
    task: { specialty: 'frontend', effort: 'L', origin: 'redesign_port', prompt: '/hub:next GTV-265' },
  } as TaskCard,
  {
    // A deadline assigned to the owner that is not in Awaiting me (09 §4 "routed to my roles or assigned to me").
    // This is the case the runway exists for, so the default persona shows it.
    ...taskCore('GTV-267', {
      title: l('مراجعة عقد Akbank قبل التوقيع', 'Review the Akbank contract before signing'),
      status: 'in_progress',
      priority: 'P1',
      ownerRole: 'owner',
      assigneeId: 'u-owner',
      dueAt: T('11-06', '10:00'),
      module: 'payments',
      createdAt: T('11-02', '14:00'),
      watchers: ['u-owner'],
      body: l('البند 7 يغيّر رسوم البطاقات الأجنبية، والتوقيع يوم الجمعة.', 'Clause 7 changes the foreign-card fee, and signing is on Friday.'),
      events: [
        evt('t267-1', 1, 'created', T('11-02', '14:00'), by.owner, { title: 'Akbank contract', status: 'ready', priority: 'P1' }),
        evt('t267-2', 2, 'claimed', T('11-02', '14:01'), by.owner, {}),
      ],
    }),
    type: 'task',
    task: { specialty: 'ops', effort: 'S', origin: 'manual', claimedById: 'u-owner', claimedAt: T('11-02', '14:01'), startedAt: T('11-02', '14:01') },
  } as TaskCard,
];

const changes: ChangeCard[] = [
  {
    ...core('GTV-253', 'change', {
      title: l('إصلاح سباق الاسترداد المزدوج', 'Fix the double-refund race'),
      status: 'recorded',
      priority: 'P1',
      ownerRole: 'backend',
      repo: 'backend',
      branch: 'fix/refund-race',
      assigneeId: 'u-omar',
      createdByKind: 'system',
      createdVia: 'adapter',
      createdAt: T('11-04', '00:10'),
      lastEventAt: T('11-04', '01:40'),
      links: [{ kind: 'relates', key: 'GTV-255' }],
      events: [
        evt('c253-1', 1, 'created', T('11-04', '00:10'), by.github, { title: 'refund-race commits', status: 'recorded', priority: 'P1' }),
        evt('c253-2', 2, 'commit', T('11-04', '00:10'), by.github, { sha: 'a91f3c2', message: 'lock refund row before capture', files: 3 }),
        evt('c253-3', 3, 'session_logged', T('11-04', '01:40'), { kind: 'agent', id: 'u-omar', via: 'hook' }, { sessionId: '7f3a…c21', hasSummary: false }),
      ],
    }),
    type: 'change',
    change: {
      kind: 'commits',
      authorLogin: 'omar-suleiman',
      authorUserId: 'u-omar',
      commitCount: 6,
      filesChanged: 14,
      additions: 212,
      deletions: 88,
      windowStart: T('11-04', '00:10'),
      windowEnd: T('11-04', '01:40'),
      commits: [
        { sha: 'a91f3c2', message: 'lock refund row before capture', at: T('11-04', '00:10'), files: 3, additions: 41, deletions: 12 },
        { sha: '4be0d17', message: 'add idempotency key to refund', at: T('11-04', '00:32'), files: 4, additions: 66, deletions: 20 },
        { sha: 'c2d88a0', message: 'e2e: concurrent refund', at: T('11-04', '01:12'), files: 2, additions: 58, deletions: 0 },
      ],
      session: { sessionId: '7f3a…c21', durationSec: 5760, noSummary: true },
    },
  } as ChangeCard,
  {
    ...core('GTV-251', 'change', {
      title: l('PR #418: محوّل PayTR (sandbox)', 'PR #418: PayTR adapter (sandbox)'),
      status: 'recorded',
      priority: 'P1',
      ownerRole: 'backend',
      repo: 'backend',
      branch: 'feat/paytr',
      createdByKind: 'system',
      createdVia: 'adapter',
      createdAt: T('11-01', '16:00'),
      lastEventAt: T('11-03', '22:10'),
      events: [
        evt('c251-1', 1, 'pr_opened', T('11-01', '16:00'), by.github, { number: 418, base: 'main', head: 'feat/paytr' }),
        evt('c251-2', 2, 'pr_merged', T('11-03', '22:10'), by.github, { number: 418, base: 'main', head: 'feat/paytr' }),
      ],
    }),
    type: 'change',
    change: { kind: 'pull_request', authorLogin: 'yousef-q', authorUserId: 'u-yousef', commits: [], commitCount: 11, filesChanged: 27, additions: 940, deletions: 112, prNumber: 418, prState: 'merged', prUrl: 'https://github.com/mohmedofficial515/Goteav-backend/pull/418' },
  } as ChangeCard,
  {
    ...core('GTV-256', 'change', {
      title: l('جلسة: مزامنة عقد الاسترداد في لوحة التحكم', 'Session: sync refund contract in the dashboard'),
      status: 'recorded',
      priority: 'P2',
      ownerRole: 'frontend',
      repo: 'dashboard',
      branch: 'fix/refund-contract',
      assigneeId: 'u-sara',
      createdByKind: 'agent',
      createdById: 'u-sara',
      createdVia: 'hook',
      createdAt: T('11-04', '08:05'),
      events: [evt('c256-1', 1, 'session_logged', T('11-04', '08:05'), { kind: 'agent', id: 'u-sara', via: 'mcp' }, { sessionId: 'b12e…90f', hasSummary: true })],
    }),
    type: 'change',
    change: {
      kind: 'session',
      authorUserId: 'u-sara',
      commits: [],
      commitCount: 3,
      filesChanged: 8,
      additions: 120,
      deletions: 44,
      session: {
        sessionId: 'b12e…90f',
        changed: l('الأنواع والنماذج', 'Types and forms'),
        remaining: l('اختبار e2e', 'The e2e test'),
        durationSec: 3120,
        noSummary: false,
      },
    },
  } as ChangeCard,
  {
    ...core('GTV-257', 'change', {
      title: l('PR #212: صفحة الحجوزات — فلاتر محفوظة', 'PR #212: bookings page — saved filters'),
      status: 'recorded',
      priority: 'P2',
      ownerRole: 'frontend',
      repo: 'web',
      branch: 'feat/saved-filters',
      assigneeId: 'u-karim',
      createdByKind: 'system',
      createdVia: 'adapter',
      createdAt: T('11-03', '16:50'),
      events: [evt('c257-1', 1, 'pr_opened', T('11-03', '16:50'), by.github, { number: 212, base: 'main', head: 'feat/saved-filters' })],
    }),
    type: 'change',
    change: { kind: 'pull_request', authorLogin: 'karim-adel', authorUserId: 'u-karim', commits: [], commitCount: 7, filesChanged: 12, additions: 305, deletions: 61, prNumber: 212, prState: 'open', prUrl: 'https://github.com/Alremaal-Co/Goteav/pull/212' },
  } as ChangeCard,
];

const redesigns: RedesignCard[] = [
  {
    ...core('GTV-252', 'redesign', {
      createdByKind: 'system',
      createdVia: 'adapter',
      createdAt: T('11-03', '20:30'),
      assigneeId: 'u-layla',
      watchers: ['u-owner', 'u-layla'],
      links: [{ kind: 'blocks', key: 'GTV-265' }],
      events: [
        evt('r252-1', 1, 'created', T('11-03', '20:30'), by.lab, { title: 'Wallet v7', status: 'draft', priority: 'P2' }),
        evt('r252-2', 2, 'status_changed', T('11-03', '20:30'), by.layla, { from: 'draft', to: 'review' }),
      ],
      attachments: [
        { kind: 'screenshot', name: '1440-rtl-light.png', url: '/lab/web/wallet/v7-twin-tanks/shots/1440-rtl-light.png' },
        { kind: 'screenshot', name: '1440-rtl-dark.png', url: '/lab/web/wallet/v7-twin-tanks/shots/1440-rtl-dark.png' },
        { kind: 'screenshot', name: '390-rtl-light.png', url: '/lab/web/wallet/v7-twin-tanks/shots/390-rtl-light.png' },
        { kind: 'screenshot', name: '390-ltr-dark.png', url: '/lab/web/wallet/v7-twin-tanks/shots/390-ltr-dark.png' },
        { kind: 'review', name: 'review.md', url: '/lab/web/wallet/v7-twin-tanks/review.md' },
      ],
    }),
    type: 'redesign',
    redesign: {
      app: 'web',
      page: 'wallet',
      version: 'v7-twin-tanks',
      labPath: 'web/wallet/v7-twin-tanks',
      labUrl: '/lab/#/web/wallet/v7-twin-tanks',
      base: 'v4-twin-tanks',
      concept: l('خزّانان متجاوران: الرصيد الآخذ في الاستخدام والرصيد المتاح.', 'Two side-by-side tanks: the balance in use and the balance available.'),
      touchesComponents: ['components/wallet/balance-tank.tsx', 'components/wallet/topup-sheet.tsx', 'components/ui/stat.tsx'],
      reviewScore: 88,
      reviewSummary: l('الهرمية قوية والمقارنة واضحة. ملاحظة واحدة متوسطة عن شحن الرصيد على الجوال.', 'Strong hierarchy and a clear comparison. One medium finding about top-up on phones.'),
    },
  } as RedesignCard,
  {
    ...core('GTV-261', 'redesign', {
      createdByKind: 'system',
      createdVia: 'adapter',
      createdAt: T('11-02', '10:00'),
      watchers: ['u-owner', 'u-sara', 'u-layla'],
      events: [
        evt('r261-1', 1, 'created', T('11-01', '09:00'), by.lab, { title: 'Bookings v2', status: 'review', priority: 'P1' }),
        evt('r261-2', 2, 'approved', T('11-02', '10:00'), by.owner, { note: 'Port after the refund sync' }),
      ],
    }),
    type: 'redesign',
    redesign: {
      app: 'dashboard',
      page: 'bookings-list',
      version: 'v2-dense-list',
      labPath: 'dashboard/bookings-list/v2-dense-list',
      labUrl: '/lab/#/dashboard/bookings-list/v2-dense-list',
      base: 'v1-baseline',
      concept: l('قائمة كثيفة مع لوحة جانبية بدل صفحة تفاصيل.', 'A dense list with a side panel instead of a details page.'),
      touchesComponents: ['components/bookings/booking-row.tsx', 'components/ui/table.tsx'],
      reviewScore: 91,
      reviewSummary: l('جاهزة للنقل.', 'Ready to port.'),
      approvedById: 'u-owner',
      approvedAt: T('11-02', '10:00'),
      portTaskKey: 'GTV-288',
      decisionNote: l('تُنقل بعد مزامنة الاسترداد.', 'Port after the refund sync.'),
    },
  } as RedesignCard,
];

const docs: DocCard[] = [
  {
    ...core('GTV-180', 'doc', {
      title: l('وثيقة 21 · أمان التأكيد', 'Doc 21 · Confirmation safety'),
      status: 'current',
      priority: 'P3',
      repo: 'backend',
      createdByKind: 'system',
      createdVia: 'adapter',
      createdAt: T('10-27', '12:00'),
      lastEventAt: T('11-03', '14:05'),
      watchers: ['u-yousef'],
      links: [{ kind: 'relates', key: 'GTV-219' }],
      events: [
        evt('dc180-1', 1, 'created', T('10-27', '12:00'), by.docs, { title: 'Doc 21', status: 'current', priority: 'P3' }),
        evt('dc180-2', 2, 'field_changed', T('11-03', '14:05'), by.docs, { field: 'body', from: '3f9ac10', to: '7be2d04' }),
      ],
    }),
    type: 'doc',
    doc: {
      sourceName: 'backend docs',
      path: 'docs/21-confirmation-safety.md',
      kind: 'doc',
      lang: 'en',
      wordCount: 2140,
      lastCommitSha: '7be2d04',
      lastIndexedAt: T('11-03', '14:06'),
      referencedBy: ['GTV-219', 'GTV-236'],
      headings: [
        { level: 2, text: 'Hold before charge', anchor: 'hold-before-charge' },
        { level: 2, text: 'Customer-chosen refund', anchor: 'customer-chosen-refund' },
        { level: 3, text: 'Wallet default', anchor: 'wallet-default' },
        { level: 2, text: 'Deferred: authorize and capture', anchor: 'deferred-authorize-and-capture' },
      ],
    },
  } as DocCard,
];

const releases: ReleaseCard[] = [
  {
    ...core('GTV-246', 'release', {
      title: l('إصدار 2026-11-03 · الدفع المقسّم', 'Release 2026-11-03 · split payments'),
      status: 'released',
      priority: 'P2',
      ownerRole: 'owner',
      repo: 'backend',
      createdAt: T('11-02', '18:00'),
      lastEventAt: T('11-03', '12:00'),
      createdById: 'u-owner',
      links: [{ kind: 'relates', key: 'GTV-228' }],
      events: [
        evt('rl246-1', 1, 'created', T('11-02', '18:00'), by.owner, { title: 'Release', status: 'planned', priority: 'P2' }),
        evt('rl246-2', 2, 'status_changed', T('11-03', '12:00'), by.owner, { from: 'planned', to: 'released' }),
      ],
    }),
    type: 'release',
    release: {
      version: '2026-11-03',
      repo: 'backend',
      tag: 'v2026.11.03',
      releasedAt: T('11-03', '12:00'),
      includedKeys: ['GTV-228', 'GTV-251', 'GTV-247', 'GTV-180'],
      notes: {
        team: l('الدفع المقسّم متاح خلف علم. راقبوا سجلات التسوية.', 'Split payments sit behind a flag. Watch the settlement logs.'),
        owner: l('يمكن للعميل الآن تقسيم الدفع بين المحفظة والبطاقة.', 'Customers can now split a payment between wallet and card.'),
        accountant: l('تظهر العمليات المقسّمة في التقرير سطرين مرتبطين.', 'Split payments appear in the report as two linked lines.'),
      },
    },
  } as ReleaseCard,
];

/** Every card the app can open. Treat as read-only: the v5 kit overlays actions in its card store. */
export const cards: HubCard[] = [...decisions, ...extraDecisions, ...needs, ...extraNeeds, ...handoffs, ...extraHandoffs, ...tasks, ...handoffTasks, ...extraTasks, ...changes, ...extraChanges, ...redesigns, ...redesignCards, ...docs, ...docCards, ...releases, ...releaseCards];

const byKey = new Map(cards.map((c) => [c.key, c]));
export const cardByKey = (key: string): HubCard | undefined => byKey.get(key);
export const cardsOfType = <T extends HubCard['type']>(type: T) => cards.filter((c) => c.type === type) as Extract<HubCard, { type: T }>[];

// ── Persona helpers ───────────────────────────────────────────────────────────────────────────────

/** Deadlines of a persona: the ones hub-today lists, plus cards assigned to me that are not in my stack. */
export function deadlinesFor(scenario: HubScenario): CardRow[] {
  const data = todayFor(scenario);
  if (scenario !== 'default' && scenario !== 'loading') return data.deadlines;
  const akbank = cardByKey('GTV-267')!;
  return [...data.deadlines, { key: akbank.key, type: akbank.type, title: akbank.title, status: akbank.status, priority: akbank.priority, ownerRole: akbank.ownerRole, dueAt: akbank.dueAt }];
}

/** Sidebar counts doc 08 §2 needs that the Today counters do not carry. */
export function navExtras(scenario: HubScenario) {
  const data = todayFor(scenario);
  const sourceProblems = data.sources.filter((s) => s.status !== 'ok').length;
  const isSara = data.me === 'u-sara';
  return {
    newEvents: data.changesSince.total,
    /** New members only; the item stays but the count hides once done. */
    onboardingLeft: isSara ? stepsLeft('u-sara', ['frontend']) : 0,
    pendingInvites: isSara || scenario === 'empty' ? 0 : 2,
    sourceProblems: isSara ? 0 : sourceProblems,
  };
}

export const otherWorkspaces = [
  { slug: 'hub-sandbox', name: l('تجربة Hub', 'Hub sandbox'), keyPrefix: 'SBX' },
];

/** Keys the palette lists as recent before the member opens anything (doc 08 §5.5). */
export const seedRecentKeys = ['GTV-231', 'GTV-255', 'GTV-252'];
