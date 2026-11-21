// Redesign gallery fixtures, shaped after GET /workspaces/{ws}/redesign/pages (04 §3.14) and 10-lab-integration.md.
// The versions and pictures are the lab's real folders: web/wallet, dashboard/finance-currencies and hub/today, plus
// the catalogue's GTV-252 and GTV-261. Per 10 §4, an import rewrites old `review` versions to `draft`, so only two
// versions are in review here, matching `counters.redesignInReview`.
//
// `redesignCards` joins the catalogue through `cards` in ./index. This file imports only types from there.
// Screenshots load through a lazy glob: nothing is fetched until a picture is on screen.

import type { L, RedesignCard, Role } from './index';

const l = (ar: string, en: string): L => ({ ar, en });
const T = (d: string, hm: string) => `2026-${d}T${hm}:00+03:00`;

// ── Screenshots ──────────────────────────────────────────────────────────────────────────────────

export type ShotTheme = 'light' | 'dark';
export type ShotDir = 'rtl' | 'ltr';

export interface ShotMeta {
  name: string;
  width: number;
  dir: ShotDir;
  theme: ShotTheme;
  load: () => Promise<string>;
}

const loaders = import.meta.glob(
  [
    '../../../web/wallet/*/shots/*.png',
    '../../../web/wallet/v1-baseline/*.png',
    '../../../dashboard/finance-currencies/*/shots/*.png',
    '../../../dashboard/finance-currencies/v1-baseline/*.png',
    '../../../hub/today/v2-peacock-lanes/shots/*.png',
    '../../../hub/today/v5-peacock-app/shots/*.png',
  ],
  { query: '?url', import: 'default' },
) as Record<string, () => Promise<string>>;

const SHOT_NAME = /^(?:owner-)?(\d{3,4})-(rtl|ltr)-(light|dark)\.png$/;
/** Two captures in the lab folders came out blank (2-10 kB, one flat colour). They stay on disk; the gallery skips them. */
const BLANK = new Set(['web/wallet/v6-departure-board/shots/1440-ltr-dark.png', 'web/wallet/v7-twin-tanks/shots/390-rtl-dark.png']);

const shotIndex = new Map<string, ShotMeta[]>();
for (const [path, load] of Object.entries(loaders)) {
  const parts = path.replace(/^(\.\.\/)+/, '').split('/');
  if (BLANK.has(parts.join('/'))) continue;
  const name = parts[parts.length - 1];
  const match = SHOT_NAME.exec(name);
  if (!match) continue; // Named states (bulk-, diff-, sheet-) are not part of the width × direction × theme matrix.
  const labPath = parts.slice(0, 3).join('/');
  const list = shotIndex.get(labPath) ?? [];
  list.push({ name, width: Number(match[1]), dir: match[2] as ShotDir, theme: match[3] as ShotTheme, load });
  shotIndex.set(labPath, list);
}

/** Every screenshot of a version, widest first, in a stable order. */
export function shotsOf(labPath: string): ShotMeta[] {
  return [...(shotIndex.get(labPath) ?? [])].sort((a, b) => b.width - a.width || a.name.localeCompare(b.name));
}

/**
 * The picture closest to what was asked: the exact file when it exists, otherwise the nearest width, then the same
 * direction, then the same theme. A version's older folders do not have all 12 combinations.
 */
export function pickShot(shots: ShotMeta[], want: { width: number; dir: ShotDir; theme: ShotTheme }): ShotMeta | undefined {
  const score = (s: ShotMeta) => Math.abs(s.width - want.width) * 10 + (s.dir === want.dir ? 0 : 3) + (s.theme === want.theme ? 0 : 2);
  return [...shots].sort((a, b) => score(a) - score(b))[0];
}

// ── Pages ────────────────────────────────────────────────────────────────────────────────────────

export type BriefStatus = 'brief' | 'researching' | 'designing' | 'decided' | 'ported';

export interface LabPage {
  app: 'web' | 'dashboard' | 'hub';
  page: string;
  title: L;
  route: string;
  liveUrl?: string;
  status: BriefStatus;
  /** Oldest first: a page reads in the order its versions were made. */
  versionKeys: string[];
}

export const labPages: LabPage[] = [
  {
    app: 'web',
    page: 'wallet',
    title: l('المحفظة', 'Wallet'),
    route: '/[locale]/account/wallet',
    liveUrl: '/ar/account/wallet',
    status: 'researching',
    versionKeys: ['GTV-120', 'GTV-121', 'GTV-122', 'GTV-123', 'GTV-124', 'GTV-125', 'GTV-252'],
  },
  {
    app: 'hub',
    page: 'today',
    title: l('اليوم في Hub', 'Hub Today'),
    route: '/[ws]/today',
    status: 'designing',
    versionKeys: ['GTV-128', 'GTV-129', 'GTV-130', 'GTV-131', 'GTV-132'],
  },
  {
    app: 'dashboard',
    page: 'bookings-list',
    title: l('قائمة الحجوزات', 'Bookings list'),
    route: '/admin/bookings',
    liveUrl: '/ar/admin/bookings',
    status: 'decided',
    versionKeys: ['GTV-133', 'GTV-261'],
  },
  {
    app: 'dashboard',
    page: 'finance-currencies',
    title: l('العملات في المالية', 'Finance currencies'),
    route: '/admin/finance/currencies',
    liveUrl: '/ar/admin/finance/currencies',
    status: 'ported',
    versionKeys: ['GTV-126', 'GTV-127'],
  },
];

// ── Version cards the catalogue does not carry ───────────────────────────────────────────────────

interface VersionInput {
  key: string;
  app: LabPage['app'];
  page: string;
  version: string;
  pageTitle: L;
  status: string;
  at: string;
  base?: string;
  concept: L;
  touches?: string[];
  score?: number;
  summary?: L;
  ownerRole?: Role | null;
  decision?: Partial<Pick<RedesignCard['redesign'], 'approvedById' | 'approvedAt' | 'rejectedById' | 'rejectedAt' | 'decisionNote' | 'portedRef'>>;
  assigneeId?: string;
  eventKind?: string;
}

function version(v: VersionInput): RedesignCard {
  const labPath = `${v.app}/${v.page}/${v.version}`;
  const lastAt = v.decision?.approvedAt ?? v.decision?.rejectedAt ?? v.at;
  return {
    key: v.key,
    type: 'redesign',
    title: { ar: `${v.pageTitle.ar} · ${v.version}`, en: `${v.pageTitle.en} · ${v.version}` },
    status: v.status,
    priority: 'P2',
    ownerRole: v.ownerRole ?? null,
    repo: v.app === 'hub' ? 'hub' : v.app === 'web' ? 'web' : 'dashboard',
    createdAt: v.at,
    lastEventAt: lastAt,
    createdByKind: 'system',
    createdVia: 'adapter',
    assigneeId: v.assigneeId,
    tags: [],
    watchers: ['u-owner', 'u-layla'],
    links: [],
    comments: [],
    attachments: [
      ...shotsOf(labPath).map((s) => ({ kind: 'screenshot' as const, name: s.name, url: `/lab/${labPath}/shots/${s.name}` })),
      ...(v.score !== undefined ? [{ kind: 'review' as const, name: 'review.md', url: `/lab/${labPath}/review.md` }] : []),
    ],
    events: [
      { id: `${v.key}-1`, seq: 1, kind: 'created', actorKind: 'system', adapter: 'lab', via: 'adapter', at: v.at, data: { title: v.version, status: v.status === 'reference' ? 'reference' : 'draft' } },
      ...(v.eventKind
        ? [{ id: `${v.key}-2`, seq: 2, kind: v.eventKind, actorKind: 'user' as const, actorId: v.decision?.approvedById ?? v.decision?.rejectedById ?? 'u-layla', via: 'web' as const, at: lastAt, data: {} }]
        : []),
    ],
    redesign: {
      app: v.app,
      page: v.page,
      version: v.version,
      labPath,
      labUrl: `/lab/#/${labPath}`,
      base: v.base,
      concept: v.concept,
      touchesComponents: v.touches ?? [],
      reviewScore: v.score,
      reviewSummary: v.summary,
      ...v.decision,
    },
  };
}

const wallet = l('المحفظة', 'Wallet');
const walletFiles = ['features/account/wallet-settings.tsx', 'features/account/wallet/balance-card.tsx', 'features/account/wallet/top-up-card.tsx', 'features/account/wallet/wallet-history.tsx'];
const hubToday = l('اليوم في Hub', 'Hub Today');
const bookings = l('قائمة الحجوزات', 'Bookings list');
const finance = l('العملات في المالية', 'Finance currencies');

export const redesignCards: RedesignCard[] = [
  version({ key: 'GTV-120', app: 'web', page: 'wallet', version: 'v1-baseline', pageTitle: wallet, status: 'reference', at: T('10-27', '09:00'), concept: l('الصفحة الحالية كما هي، مرجعًا للمقارنة.', 'The current page as it is, kept as the reference.') }),
  version({
    key: 'GTV-121',
    app: 'web',
    page: 'wallet',
    version: 'v2-flight-path',
    pageTitle: wallet,
    status: 'draft',
    at: T('10-27', '11:30'),
    base: 'v1-baseline',
    concept: l('المحفظة مسار رحلة عمودي: قمرة تعرض الآن، وما تحتها يقرأ بالزمن.', 'The wallet as one vertical flight path: a cockpit shows now, and the rest reads along time.'),
    touches: walletFiles.slice(1),
    score: 75,
    summary: l('الفكرة قوية، لكن شحن الرصيد مدفون تحت القمرة.', 'A strong idea, but the top-up sits buried under the cockpit.'),
  }),
  version({
    key: 'GTV-122',
    app: 'web',
    page: 'wallet',
    version: 'v3-departure-board',
    pageTitle: wallet,
    status: 'draft',
    at: T('10-27', '12:10'),
    base: 'v1-baseline',
    concept: l('لوحة مغادرة: ما يشتريه رصيدك من وجهات، برقم واحد بارز.', 'A departures board: what your balance can buy, under one prominent number.'),
    score: 72,
    summary: l('الأرقام المتقلبة ممتعة، والقراءة بالعربية تحتاج عملًا.', 'The split-flap digits are fun, and the Arabic reading needs work.'),
  }),
  version({
    key: 'GTV-123',
    app: 'web',
    page: 'wallet',
    version: 'v4-twin-tanks',
    pageTitle: wallet,
    status: 'draft',
    at: T('10-27', '13:00'),
    base: 'v1-baseline',
    concept: l('خزانان متساويان: النقد والنقاط جنبًا إلى جنب.', 'Two equal tanks: cash and points side by side.'),
    touches: walletFiles,
    score: 70,
    summary: l('المقارنة واضحة، والخزان لا يُشحن من مكانه.', 'The comparison is clear, but a tank cannot be topped up in place.'),
  }),
  version({
    key: 'GTV-124',
    app: 'web',
    page: 'wallet',
    version: 'v5-flight-path',
    pageTitle: wallet,
    status: 'draft',
    at: T('10-28', '10:00'),
    base: 'v2-flight-path',
    concept: l('جولة إصلاح على المسار: الشحن صار داخل القمرة.', 'A fix round on the flight path: the top-up now lives in the cockpit.'),
    touches: walletFiles.slice(1),
    score: 83,
    summary: l('حُلّت ملاحظة الشحن. يبقى السجل طويلًا على الجوال.', 'The top-up finding is resolved. The history stays long on phones.'),
  }),
  version({
    key: 'GTV-125',
    app: 'web',
    page: 'wallet',
    version: 'v6-departure-board',
    pageTitle: wallet,
    status: 'draft',
    at: T('10-28', '11:20'),
    base: 'v3-departure-board',
    concept: l('جولة إصلاح على اللوحة: وجهات حقيقية من بحث الرحلات.', 'A fix round on the board: real destinations from flight search.'),
    score: 80,
    summary: l('أوضح من v3-departure-board، ويعتمد على بيانات بحث لا تملكها الصفحة بعد.', 'Clearer than v3-departure-board, and it needs search data the page does not have yet.'),
  }),

  version({
    key: 'GTV-126',
    app: 'dashboard',
    page: 'finance-currencies',
    version: 'v1-baseline',
    pageTitle: finance,
    status: 'reference',
    at: T('10-28', '09:00'),
    concept: l('الصفحة الحالية كما هي، مرجعًا للمقارنة.', 'The current page as it is, kept as the reference.'),
  }),
  version({
    key: 'GTV-127',
    app: 'dashboard',
    page: 'finance-currencies',
    version: 'v2-rich-table-panel',
    pageTitle: finance,
    status: 'ported',
    at: T('10-28', '15:00'),
    base: 'v1-baseline',
    concept: l('جدول واحد للعملات العشر، وكل ما لا يتسع للصف في لوحة جانبية.', 'One table of the ten currencies, with everything a row cannot hold in a side panel.'),
    touches: ['components/finance/currency-table.tsx', 'components/finance/currency-panel.tsx'],
    score: 90,
    summary: l('القائمة لا تفقد سياقها، وتغيير السعر يطلب رمز PIN.', 'The list keeps its context, and a rate change asks for the PIN.'),
    decision: { approvedById: 'u-owner', approvedAt: T('10-29', '09:30'), decisionNote: l('انقلوها كما هي.', 'Port it as it is.'), portedRef: 'feat/currency-symbols@23c5807 (Goteav-Dashboard)' },
    eventKind: 'ported',
  }),

  version({ key: 'GTV-128', app: 'hub', page: 'today', version: 'v1-baseline', pageTitle: hubToday, status: 'reference', at: T('11-03', '20:00'), concept: l('مخطط المواصفة: لا صفحة حقيقية بعد.', 'The spec wireframe: there is no real page yet.') }),
  version({
    key: 'GTV-129',
    app: 'hub',
    page: 'today',
    version: 'v2-peacock-lanes',
    pageTitle: hubToday,
    status: 'draft',
    at: T('11-03', '21:15'),
    base: 'v1-baseline',
    concept: l('الطاووس الليلي بمسارين: ما أعمله في جهة وما أقرؤه في جهة.', 'Night Peacock in two lanes: what I act on one side, what I read on the other.'),
    score: 78,
    summary: l('لوحة الألوان والمساران محفوظان. البطاقات الملونة صاخبة.', 'The palette and the lanes hold up. The tinted cards are loud.'),
  }),
  version({
    key: 'GTV-130',
    app: 'hub',
    page: 'today',
    version: 'v3-reef-letter',
    pageTitle: hubToday,
    status: 'rejected',
    at: T('11-03', '21:30'),
    base: 'v1-baseline',
    concept: l('رسالة صباحية هادئة على ألوان الشعاب.', 'A calm morning letter in reef colours.'),
    decision: { rejectedById: 'u-owner', rejectedAt: T('11-04', '00:10'), decisionNote: l('اخترنا الطاووس الليلي.', 'We picked Night Peacock.') },
    eventKind: 'rejected',
  }),
  version({
    key: 'GTV-131',
    app: 'hub',
    page: 'today',
    version: 'v4-mandarin-bento',
    pageTitle: hubToday,
    status: 'rejected',
    at: T('11-03', '21:40'),
    base: 'v1-baseline',
    concept: l('شبكة بنتو بحبر الماندرين.', 'A bento grid in Mandarin ink.'),
    decision: { rejectedById: 'u-owner', rejectedAt: T('11-04', '00:10'), decisionNote: l('كثيفة أكثر مما يلزم لصفحة تُقرأ كل صباح.', 'Too dense for a page read every morning.') },
    eventKind: 'rejected',
  }),
  version({
    key: 'GTV-132',
    app: 'hub',
    page: 'today',
    version: 'v5-peacock-app',
    pageTitle: hubToday,
    status: 'review',
    at: T('11-04', '02:30'),
    base: 'v2-peacock-lanes',
    ownerRole: 'owner',
    assigneeId: 'u-layla',
    concept: l('المسار نفسه داخل التطبيق الكامل: شريط جانبي ورأس وبطاقات هادئة بشريط لون.', 'The same lanes inside the full app: a sidebar, a header and calm cards with a colour stripe.'),
    touches: ['app/(app)/[workspace]/layout.tsx', 'components/layout/sidebar.tsx', 'components/layout/top-bar.tsx', 'components/cards/card-row.tsx', 'components/cards/card-sheet.tsx'],
    score: 87,
    summary: l('عولجت كل ملاحظات المراجعة السابقة. بقي سؤال: هل تكفي نبرة الرسالة بخط Cairo؟', 'Every finding of the last review is answered. One question stays: is the letter’s voice enough in Cairo?'),
    eventKind: 'status_changed',
  }),

  version({ key: 'GTV-133', app: 'dashboard', page: 'bookings-list', version: 'v1-baseline', pageTitle: bookings, status: 'reference', at: T('10-30', '10:00'), concept: l('الصفحة الحالية كما هي، مرجعًا للمقارنة.', 'The current page as it is, kept as the reference.') }),
];

// ── review.md ────────────────────────────────────────────────────────────────────────────────────

/** Stands in for `GET /redesign/{key}/readme` → `review`. The real file comes from the lab folder. */
export function reviewMarkdown(card: RedesignCard): string {
  const r = card.redesign;
  return [
    `# Review: ${r.labPath}`,
    '',
    '| Pillar | Score /10 |',
    '| --- | --- |',
    `| Hierarchy | ${(((r.reviewScore ?? 70) + 4) / 10).toFixed(1)} |`,
    `| Task speed | ${((r.reviewScore ?? 70) / 10).toFixed(1)} |`,
    `| Arabic and RTL | ${(((r.reviewScore ?? 70) - 4) / 10).toFixed(1)} |`,
    '',
    r.reviewSummary?.en ?? '',
    '',
    '## Findings',
    '',
    '- [x] Contrast measured at 390, 768 and 1440 in both themes',
    '- [x] Keyboard path through the main action',
    '- [ ] Check the phone layout with two Arabic-first members',
  ].join('\n');
}
