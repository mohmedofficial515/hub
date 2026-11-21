// Docs fixtures, shaped after GET /workspaces/{ws}/docs/tree and /docs/{key} (04 §3.15, §3.23). File names are the real
// ones under backend/docs, Goteav-Dashboard/docs and project-hub/docs. Seven docs carry a sample condensed from their
// real text, with some details invented, enough to read and to search. The others carry one opening sentence. Doc titles stay in the doc's own
// language, as the real cards do.
//
// `docCards` joins the catalogue through `cards` in ./index. This file imports only types from there.

import type { DocCard, L } from './index';

const T = (d: string, hm: string) => `2026-${d}T${hm}:00+03:00`;

export type DocKind = DocCard['doc']['kind'];

export interface DocSource {
  id: string;
  name: string;
  repo: 'backend' | 'dashboard' | 'hub';
  /** Repo URL without a trailing slash. */
  github: string;
}

export const docSources: DocSource[] = [
  { id: 'backend', name: 'backend docs', repo: 'backend', github: 'https://github.com/mohmedofficial515/Goteav-backend/blob/main' },
  { id: 'dashboard', name: 'dashboard docs', repo: 'dashboard', github: 'https://github.com/Alremaal-Co/Goteav-Dashboard/blob/main' },
  { id: 'hub', name: 'hub docs', repo: 'hub', github: 'https://github.com/Alremaal-Co/hub/blob/main' },
];

interface Entry {
  source: string;
  /** File path inside the repo. */
  path: string;
  title: string | L;
  kind?: DocKind;
  lang?: 'en' | 'ar';
  /** Opening sentence for a doc with no excerpt below. */
  lede?: string;
  at?: string;
  sha?: string;
  words?: number;
  referencedBy?: string[];
  stale?: boolean;
  /** A fixed key. */
  key?: string;
}

const adr = (file: string, title: string, lede: string): Entry => ({ source: 'backend', path: `docs/adr/${file}.md`, title: `ADR ${file.slice(0, 4)} · ${title}`, kind: 'adr', lede, at: T('10-14', '11:00'), words: 340 });
const status = (file: string, title: string, lang: 'en' | 'ar' = 'ar'): Entry => ({ source: 'backend', path: `docs/status/${file}.md`, title, kind: 'status', lang, at: T(`${file.slice(5, 10)}`, '20:00'), words: 620, lede: lang === 'ar' ? 'ملخص ما أُنجز في هذه الدفعة، وما تبقى، وما ينتظر قرارًا.' : 'What was finished in this batch, what remains and what waits on a decision.' });
const num = (source: string, path: string, title: string, lede: string, extra: Partial<Entry> = {}): Entry => ({ source, path, title, lede, at: T('10-20', '10:00'), words: 1800, ...extra });

const entries: Entry[] = [
  // backend: the numbered docs
  num('backend', 'docs/README.md', 'Goteav backend docs', 'What Goteav is: a flight booking platform for the Gulf, Turkey and Egypt. Start here, then read 01-architecture.', { kind: 'readme', words: 420, at: T('10-30', '09:00') }),
  num('backend', 'docs/00-decisions.md', '00 · Decisions', 'The stack and architecture decisions that everything else assumes.', { at: T('10-27', '18:00') }),
  num('backend', 'docs/01-architecture.md', '01 · Architecture', 'A modular monolith with a context map, ports and a transactional outbox. Section 3 draws the context map.', { at: T('10-11', '15:00'), words: 3100 }),
  num('backend', 'docs/04-data-model.md', '04 · Data model', 'Prisma schema by context, with the rules each table protects.'),
  num('backend', 'docs/05-flights-and-payments.md', '05 · Flights and payments', 'How a search becomes a priced offer, an order and a payment, and which provider does what.', { at: T('10-22', '12:00'), words: 4200 }),
  num('backend', 'docs/11-api-reference.md', '11 · API reference', 'Every public and admin endpoint, generated from the OpenAPI document and kept in step by CI.', { at: T('11-02', '11:40'), words: 9400 }),
  { source: 'backend', path: 'docs/11-api-reference.ar.md', title: '11 · مرجع API', lang: 'ar', lede: 'كل نقاط النهاية العامة والإدارية، مولّدة من وثيقة OpenAPI ويبقيها CI متطابقة.', at: T('11-02', '11:40'), words: 8800 },
  num('backend', 'docs/12-operations.md', '12 · Operations', 'Deploying, backing up and restoring, with the alerts that wake someone.'),
  { source: 'backend', path: 'docs/15-admin-account-lifecycle-and-login-security.md', title: '15 · Admin account lifecycle and login security', at: T('10-18', '16:00'), words: 2600, referencedBy: ['GTV-258'] },
  num('backend', 'docs/17-admin-agent-booking.md', '17 · Admin agent booking', 'The eight-step wizard staff use to book for a customer, in slices R1 to R4.', { stale: true, at: T('11-04', '07:20'), sha: 'e41c09b' }),
  { source: 'backend', path: 'docs/18-post-booking-services-admin.md', title: '18 · Post-booking services: staff path, cancel, re-buy', at: T('10-28', '19:00'), words: 3400, referencedBy: ['GTV-255'] },
  { key: 'GTV-180', source: 'backend', path: 'docs/21-confirmation-safety.md', title: { ar: 'وثيقة 21 · أمان التأكيد', en: 'Doc 21 · Confirmation safety' } },
  { source: 'backend', path: 'docs/21-confirmation-safety.ar.md', title: '21 · أمان التأكيد', lang: 'ar', at: T('11-03', '14:05'), words: 960, sha: '7be2d04' },
  num('backend', 'docs/23-kvkk-retention.md', '23 · KVKK retention', 'How long personal booking data stays, and what masking applies after that.', { at: T('10-20', '14:00'), referencedBy: ['GTV-219'] }),
  num('backend', 'docs/25-launch-readiness.md', '25 · Launch readiness', 'The list that must be green before live payments, with an owner for every line.', { at: T('11-03', '18:20'), referencedBy: ['GTV-249'] }),
  num('backend', 'docs/27-image-only-uploads.md', '27 · Image-only uploads', 'JPEG, PNG and WebP only, re-encoded on arrival. The browser converts a PDF first.', { at: T('11-03', '16:00'), words: 1100 }),

  // backend: ADRs (14, as in the real folder)
  adr('0001-modular-monolith-ddd', 'Modular monolith with DDD', 'One deployable with strict context boundaries, because the team is small and the domains are not.'),
  adr('0002-cqrs-nestjs-cqrs', 'CQRS with @nestjs/cqrs', 'Commands and queries are separate handlers, so reads never carry write rules.'),
  adr('0003-zod-nestjs-zod', 'Zod through nestjs-zod', 'One schema gives validation, types and OpenAPI.'),
  adr('0004-uuid-v7', 'UUID v7', 'Time-ordered ids keep indexes healthy and need no central sequence.'),
  { source: 'backend', path: 'docs/adr/0005-payments-tokenised-and-duffel-balance.md', title: 'ADR 0005 · Payments: tokenised, Duffel paid from balance', kind: 'adr', at: T('09-15', '12:00'), words: 410, referencedBy: ['GTV-228'] },
  adr('0006-settings-rule-engine', 'Settings rule engine', 'Behaviour that changes by route or airline lives in settings rules, not in code.'),
  adr('0007-transactional-outbox', 'Transactional outbox', 'An event is written with its transaction and published after it, so none are lost.'),
  adr('0008-prisma-multi-file-schema', 'Prisma multi-file schema', 'One schema file per context, and no foreign keys across contexts.'),
  adr('0009-api-documentation-standard', 'API documentation standard', 'Every endpoint carries a summary, errors and examples, in both languages.'),
  adr('0010-provider-neutral-public-contract', 'Provider-neutral public contract', 'Opaque ids and our own vocabulary, so a supplier can change behind the contract.'),
  adr('0011-currency-catalogue-and-fx-overrides', 'Currency catalogue and FX overrides', 'Ten currencies with manual overrides over the daily rates.'),
  adr('0012-login-attempts-as-a-first-class-table', 'Login attempts as a table', 'A rejected login leaves a row, written outside the failing transaction.'),
  adr('0013-admin-ip-allowlist-in-settings-with-an-env-break-glass', 'Admin IP allowlist', 'The allowlist lives in settings, and an environment variable breaks glass.'),
  adr('0016-tax-engine-is-jurisdiction-neutral', 'Jurisdiction-neutral tax engine', 'Tax rules are data per jurisdiction, so a new market needs no new code.'),

  // backend: status reports (13)
  status('2026-09-16-progress-ar', 'تقرير التقدم 16 سبتمبر'),
  status('2026-09-17-audit', 'Audit, 17 September', 'en'),
  status('2026-09-18-progress-ar', 'تقرير التقدم 18 سبتمبر'),
  status('2026-09-20-m7-progress-ar', 'تقدم M7'),
  status('2026-09-20-progress-ar', 'تقرير التقدم 20 سبتمبر'),
  status('2026-09-20-web-breaking-changes', 'Web breaking changes, 20 September', 'en'),
  status('2026-09-21-m8-progress-ar', 'تقدم M8'),
  status('2026-09-21-m9-progress-ar', 'تقدم M9'),
  status('2026-09-24-m11-progress-ar', 'تقدم M11'),
  status('2026-09-28-m12-progress-ar', 'تقدم M12'),
  status('2026-10-08-wizard-review', 'Wizard review, 8 October', 'en'),
  status('2026-10-21-currency-switch-ar', 'تبديل العملة عند الدفع'),
  status('2026-10-28-phase2-recovery-ar', 'المرحلة الثانية: استرداد كل دفعة'),

  // dashboard
  num('dashboard', 'docs/ARCHITECTURE.md', 'Dashboard architecture', 'Next.js App Router with a BFF, feature folders and one API layer.', { kind: 'readme', at: T('10-05', '10:00') }),
  { source: 'dashboard', path: 'docs/api-integration/README.md', title: 'API Integration Plan', at: T('09-27', '17:00'), words: 1300, referencedBy: ['GTV-260'] },
  num('dashboard', 'docs/api-integration/01-architecture.md', '01 · API layer architecture', 'One layer under src/apiEndpoint: config, then one folder for each OpenAPI tag.'),
  num('dashboard', 'docs/api-integration/03-auth-and-session.md', '03 · Auth and session', 'Tokens stay in an encrypted cookie behind the BFF and never reach the browser.', { at: T('09-28', '12:00') }),
  num('dashboard', 'docs/api-integration/04-http-errors-security.md', '04 · HTTP, errors, security', 'One ky client, one error shape and the headers every call carries.', { at: T('09-28', '13:00') }),
  num('dashboard', 'docs/api-integration/05-cache-and-query.md', '05 · Cache and query', 'Query keys per module, and which writes invalidate what.', { at: T('09-28', '14:00') }),
  num('dashboard', 'docs/api-integration/07-openapi-sync-and-scripts.md', '07 · OpenAPI sync and scripts', 'api:sync, api:watch and api:check bring every backend change into types and Zod schemas.', { at: T('09-29', '09:00') }),
  num('dashboard', 'docs/api-integration/09-module-catalog.md', '09 · Module catalogue', 'Each admin module, its tag, and the pages that use it.', { at: T('09-29', '10:00') }),
  num('dashboard', 'docs/flight-booking-wizard/README.md', 'Flight booking wizard', 'The eight steps of an agent booking, and the review that closed them.', { at: T('10-08', '18:00') }),
  num('dashboard', 'docs/post-booking-services/README.md', 'Post-booking services', 'Staff extras, cancellation and re-buy on the booking page.', { at: T('10-12', '12:00') }),

  // hub
  num('hub', 'docs/README.md', 'Project Hub', 'An operations tool for the team: one timeline of cards, decisions and handoffs, with no AI on the server.', { kind: 'readme', at: T('11-03', '09:00') }),
  num('hub', 'docs/00-decisions.md', '00 · Decisions', 'D01 to D20: the choices the plan rests on. D06 says Hub makes no model calls and holds no AI credential.', { at: T('11-03', '09:30') }),
  num('hub', 'docs/01-architecture.md', '01 · Architecture', 'API, worker, MCP and web on one LAN host, with Postgres and Redis.'),
  num('hub', 'docs/03-data-model.md', '03 · Data model', 'Cards, events and per-type detail tables.', { at: T('11-03', '10:00') }),
  num('hub', 'docs/04-api-reference.md', '04 · API reference', 'Every endpoint with roles, errors and effects. It wins over the page text on naming.', { at: T('11-03', '10:30') }),
  { source: 'hub', path: 'docs/05-mcp-and-claude-code.md', title: '05 · MCP and Claude Code', at: T('11-03', '11:00'), words: 5200 },
  num('hub', 'docs/08-ux-and-design.md', '08 · UX and design', 'Principles P1 to P7, tokens and the component rules every page follows.', { at: T('11-03', '12:00') }),
  num('hub', 'docs/09-pages.md', '09 · Pages', 'Every page: data, URL state, role differences and acceptance.', { at: T('11-03', '13:00') }),
  num('hub', 'docs/10-lab-integration.md', '10 · Lab integration', 'How the lab moves into the monorepo and how Hub writes decisions back to its front-matter.', { at: T('11-03', '14:00') }),
  num('hub', 'docs/14-agent-execution-guide.md', '14 · Agent execution guide', 'What an agent may do alone, what it must ask, and what it must never do.', { at: T('11-03', '15:00') }),
];

// ── Condensed samples ────────────────────────────────────────────────────────────────────

const CONTENT: Record<string, string> = {
  'docs/21-confirmation-safety.md': `# 21 — Confirmation safety: never charge for a seat the airline refuses

Status: **approved 2026-10-27** (R1–R3 and tests now; R4 after, with visual approval; §7 deferred).

## 1. Problem

Booking \`GT-VUHSMS\` (MS CAI→DXB, departing in 23 h, paid 228.99 USD from the wallet):

| UTC | Event |
| --- | --- |
| 12:05:51 | offer seen in search |
| 12:06:48 | payment captured (wallet) |
| 12:06:49 | \`offers.price\` → TIMEOUT after 10.5 s |
| 12:07:04 | \`offers.price\` → 200, offer available |
| 12:07:09 | \`orders.create\` → **422 \`offer_no_longer_available\`** |
| 12:07:15 | booking FAILED → auto refund → REFUNDED |

Design gap, also true in live mode: the saga **charges first and asks the airline second**. A successful re-price does not guarantee the order.

## 2. Goals

1. When the airline will refuse, refuse **before** any money moves (hold-first).
2. When money did move and the airline refused, avoid the gateway fee and keep the customer: they choose the refund destination, and the wallet is the default.
3. Shorten the window between "price OK" and "order".
4. Every behaviour can be switched and scoped from dashboard settings.

Non-goal: making airlines accept every booking. This is about who carries the cost when they don't.

## 4. R1: Silent hold before charge

### 4.1 Where it runs

The hold runs after the re-price and before the charge. The customer sees nothing: a refused hold ends the checkout with the usual "no longer available" page, and no money has moved.

### 4.3 Settings

The switch is \`flight_provider.preChargeHold\`, scoped with the flight-policy rules:

\`\`\`json
{
  "enabled": true,
  "onlyWhenDepartureWithinHours": 72,
  "excludeAirlines": ["ZZ"]
}
\`\`\`

## 5. R2: Customer chooses the refund destination

Today \`refundCollectedPayments\` hard-codes the destination: a card payment always goes back to the card. Staff refunds follow [doc 18](./18-post-booking-services-admin.md).

### 5.1 Behaviour

| Payment | Customer | Result |
| --- | --- | --- |
| Wallet | any | Wallet, immediately. |
| Card or gateway | signed-in | Refund created **AWAITING_CHOICE**. Wallet now plus an incentive, or card. No answer by the deadline applies \`defaultChoice\`. |
| Card or gateway | guest | Card, immediately: a guest has no wallet. |
| Mixed | signed-in | The wallet part goes to the wallet now; the card part follows the choice. |

### 5.2 Settings

| Field | Default | Meaning |
| --- | --- | --- |
| \`mode\` | \`CUSTOMER_CHOICE\` | \`ORIGINAL_METHOD\` keeps today's behaviour. |
| \`defaultChoice\` | \`WALLET\` | Applied when the choice window ends. |
| \`choiceWindowHours\` | 24 | How long the customer has to choose. |

## 7. Deferred: card authorize and capture

Payment-provider planning decides this. This doc only reserves the seam. See [ADR 0005](./adr/0005-payments-tokenised-and-duffel-balance.md) for why card data never reaches the backend.

## 10. Delivery slices

- [x] R1 silent hold before charge
- [x] R2 refund destination chosen by the customer
- [x] R3 timeouts and the price-to-order window
- [ ] R4 keep the customer, after visual approval
`,

  'docs/21-confirmation-safety.ar.md': `# 21 — أمان التأكيد: لا نخصم ثمن مقعد ترفضه شركة الطيران

الحالة: **معتمد في 27 أكتوبر 2026**. الشرائح R1 إلى R3 والاختبارات الآن، وR4 بعد الموافقة البصرية.

## 1. المشكلة

تخصم الرحلة أولًا ثم تسأل شركة الطيران. نجاح إعادة التسعير لا يضمن الطلب، وقد يُغلق المقعد بين الخطوتين، خصوصًا قرب موعد المغادرة. كل فشل كهذا على بطاقة يضيّع رسوم البوابة عند الاسترداد، والأسوأ أنه يضيّع العميل.

## 2. الأهداف

1. إذا كانت شركة الطيران سترفض، نرفض **قبل** أن يتحرك أي مبلغ.
2. إذا تحرك المبلغ ثم رفضت الشركة، يختار العميل وجهة الاسترداد، والمحفظة هي الخيار الافتراضي.
3. نقصّر الزمن بين نجاح التسعير وإنشاء الطلب.

## 5. يختار العميل وجهة الاسترداد

| طريقة الدفع | العميل | النتيجة |
| --- | --- | --- |
| المحفظة | أي عميل | إلى المحفظة فورًا. |
| بطاقة أو بوابة | مسجّل | ينتظر الاسترداد اختيار العميل: المحفظة الآن مع حافز، أو البطاقة خلال أيام عمل. |
| بطاقة أو بوابة | زائر | إلى البطاقة فورًا، فالزائر لا محفظة له. |

إذا انتهت مهلة الاختيار دون رد، يُطبَّق \`defaultChoice\` وهو المحفظة افتراضيًا.
`,

  'docs/18-post-booking-services-admin.md': `# 18 — Post-booking services: staff path, cancel, re-buy (design)

Owner decisions of 2026-10-10. Customer-facing extras are out of scope here.

## 1. What exists and what is missing

Staff could add a bag on a live booking, but could not cancel, and a failed addition left the quote open.

## 2. Domain changes (flights)

### 2.1 Status CANCELLED

A booking can end as \`CANCELLED\`, separate from \`FAILED\`. The refund follows the customer's choice from [doc 21](./21-confirmation-safety.md).

### 2.3 Staff quote lifetime

A quote made by staff lives 30 minutes. A late payment on a dead quote is **refunded to the wallet** and raises an ops alert, because the original price can no longer be honoured.

### 2.5 Late payment on a dead quote

\`\`\`text
quote expired → payment arrives → refund to wallet → alert ops → audit row
\`\`\`

## 4. Payment kinds for an addition

| Kind | Who pays | Refund destination |
| --- | --- | --- |
| \`STAFF_CARD\` | customer, by link | original card |
| \`WALLET\` | customer | wallet |
| \`AGENCY_CREDIT\` | agency | agency balance |
`,

  'docs/15-admin-account-lifecycle-and-login-security.md': `# 15 — Admin account lifecycle and login security

Milestone M11, approved 2026-09-24.

## 1. Why

A rejected login left no trace at all, and there was no per-account brake. The request throttle caps calls by IP and email, which a slow attacker can walk around.

## 5. The lockout ladder

Failed attempts climb a ladder per account: 5 failures lock for 15 minutes, 10 for an hour, 15 until staff unlock it. It runs apart from the request throttle.

### TOTP

**TOTP is enforced for staff with finance rights.** The TOTP lock counts wrong codes separately from wrong passwords, so a stolen password alone cannot lock its owner out.

## 6. Staff lifecycle

- Invited staff set a password from a one-time link.
- Suspending a member ends every session at once.
- Geo-IP enrichment can never cost a login: it runs after the answer.
`,

  'docs/adr/0005-payments-tokenised-and-duffel-balance.md': `# ADR 0005 — Payments: gateway tokenisation and hosted checkout, Duffel paid from balance

**Status**: Accepted (2026-09-15).

## Context

Handling raw card data would put the backend in full PCI-DSS scope. The business sells in the Gulf and Egypt with several local gateways, and pays Duffel from a prepaid balance.

## Decision

Card data never reaches the backend. All gateways implement one \`PaymentProvider\` port. Duffel orders are created with payment type \`balance\`, so the **Duffel balance** must stay funded.

## Consequences

Minimal PCI scope. A confirmed customer payment can still be followed by a provider failure, so the confirmation saga compensates with automatic refunds and ops alerts.
`,

  'docs/api-integration/README.md': `# API Integration Plan: Goteav Dashboard

The dashboard talks to the backend through one organised layer in \`src/apiEndpoint/\`.

## ملخص عربي

الربط يكون عبر طبقة API واحدة داخل \`src/apiEndpoint/\`. التوكنات لا تصل إلى المتصفح أبدًا، بل تُحفظ في كوكي جلسة مشفّرة.

## Documents

1. [Architecture](./01-architecture.md)
2. [Auth and session](./03-auth-and-session.md)
3. [HTTP, errors, security](./04-http-errors-security.md)
4. [OpenAPI sync and scripts](./07-openapi-sync-and-scripts.md)

## Everyday commands

\`\`\`bash
pnpm api:sync    # regenerate types and Zod from OpenAPI
pnpm api:check   # fail when the generated files are behind
\`\`\`

A breaking handoff in Hub usually starts with \`pnpm api:sync\`.
`,

  'docs/05-mcp-and-claude-code.md': `# 05 — MCP and Claude Code

Reminder of D06: Hub makes **no model calls**. Everything AI-written is produced by a member's own Claude Code through the prompts and tools in this document and written back through MCP.

## 1. The loop

\`\`\`text
daily     /hub:start   → whats_new + today's brief + sessions without summary
          /hub:next    → claim a ready task, read what it links to
          /hub:done    → log_session, update_task
\`\`\`

## 2.6 Prompts

### ask

Answers a question using Hub as the only source: it searches the docs with one or two rephrasings, reads the best sections, and answers in my language with citations in the form (path § heading) or card keys. If the docs do not answer, it says so and offers to open a decision.

## 3. The team pack

Install it once. The command, with your own token, is in Settings › Tokens. Hub shows a token's prefix only; the value stays on your machine.
`,
};

// ── Cards ────────────────────────────────────────────────────────────────────────────────────────

/** Free key numbers: below the first catalogue key, and away from the redesign and release blocks. */
function* freeKeys() {
  for (let n = 100; n < 120; n++) yield `GTV-${n}`;
  for (let n = 134; n < 180; n++) yield `GTV-${n}`;
  for (let n = 210; n < 219; n++) yield `GTV-${n}`;
}

const keys = freeKeys();
const SHAS = ['3f9ac10', '676b609', 'a03de71', '91bc4f2', 'c7d0e18', '2ea77b4', '58f1a9c', 'b60d33e'];

interface Built {
  key: string;
  source: string;
  path: string;
  lang: 'en' | 'ar';
  content: string;
  card: DocCard;
}

const built: Built[] = entries.map((e, i) => {
  const key = e.key ?? keys.next().value!;
  const title: L = typeof e.title === 'string' ? { ar: e.title, en: e.title } : e.title;
  const lang = e.lang ?? 'en';
  const content = CONTENT[e.path] ?? `# ${title[lang]}\n\n${e.lede ?? ''}\n`;
  const at = e.at ?? T('10-20', '10:00');
  const source = docSources.find((s) => s.id === e.source)!;
  return {
    key,
    source: e.source,
    path: e.path,
    lang,
    content,
    // Docs carry no events here: a doc update is a commit event on the timeline, not on every row of this list.
    card: {
      key,
      type: 'doc',
      title,
      status: e.stale ? 'stale' : 'current',
      priority: 'P3',
      ownerRole: null,
      repo: source.repo,
      createdByKind: 'system',
      createdVia: 'adapter',
      createdAt: at,
      lastEventAt: at,
      tags: [],
      watchers: [],
      links: [],
      events: [],
      comments: [],
      attachments: [],
      doc: {
        sourceName: source.name,
        path: e.path,
        kind: e.kind ?? 'doc',
        lang,
        headings: [],
        wordCount: e.words ?? 1200,
        lastCommitSha: e.sha ?? SHAS[i % SHAS.length],
        lastIndexedAt: e.stale ? T('11-02', '09:00') : at,
        referencedBy: e.referencedBy ?? [],
      },
    } satisfies DocCard,
  };
});

/** Doc cards for the catalogue. GTV-180 already lives there. */
export const docCards: DocCard[] = built.filter((b) => b.key !== 'GTV-180').map((b) => b.card);

const byKey = new Map(built.map((b) => [b.key, b]));

/** `GET /docs/{key}` → `content`. */
export const docContent = (key: string) => byKey.get(key)?.content ?? '';

export interface DocRef {
  key: string;
  source: string;
  path: string;
  lang: 'en' | 'ar';
}

export const docRefs: DocRef[] = built.map(({ key, source, path, lang }) => ({ key, source, path, lang }));

const baseName = (path: string) => path.replace(/\.ar\.md$/, '.md');

/** 09 §11: `.ar.md` twins pair up when the path without the suffix matches. */
export function docTwin(key: string): DocRef | undefined {
  const me = byKey.get(key);
  if (!me) return undefined;
  return docRefs.find((d) => d.key !== key && d.source === me.source && baseName(d.path) === baseName(me.path));
}

/** A relative link in a doc resolves to Hub when the target is indexed (09 §11), else null: GitHub. */
export function resolveDocLink(fromKey: string, href: string): DocRef | null {
  const me = byKey.get(fromKey);
  if (!me || /^[a-z]+:/i.test(href) || href.startsWith('#')) return null;
  const parts = me.path.split('/').slice(0, -1);
  for (const seg of href.split('#')[0].split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  const target = parts.join('/');
  return docRefs.find((d) => d.source === me.source && d.path === target) ?? null;
}

export const githubUrl = (key: string) => {
  const me = byKey.get(key);
  const source = docSources.find((s) => s.id === me?.source);
  return me && source ? `${source.github}/${me.path}` : '#';
};

// ── Tree ─────────────────────────────────────────────────────────────────────────────────────────

export interface DocTreeFolder {
  /** Folder path relative to the source's `docs/`, empty for the root. */
  path: string;
  name: string;
  docs: DocRef[];
  folders: DocTreeFolder[];
}

export interface DocTreeSource {
  source: DocSource;
  root: DocTreeFolder;
}

/** `GET /docs/tree`. An `.ar.md` twin does not get its own row: the viewer's language toggle reaches it. */
export function docTree(): DocTreeSource[] {
  return docSources.map((source) => {
    const root: DocTreeFolder = { path: '', name: '', docs: [], folders: [] };
    const paths = new Set(docRefs.filter((d) => d.source === source.id).map((d) => d.path));
    for (const doc of docRefs) {
      if (doc.source !== source.id) continue;
      if (doc.path.endsWith('.ar.md') && paths.has(baseName(doc.path))) continue;
      const segs = doc.path.replace(/^docs\//, '').split('/').slice(0, -1);
      let at = root;
      for (const seg of segs) {
        let next = at.folders.find((f) => f.name === seg);
        if (!next) {
          next = { path: at.path ? `${at.path}/${seg}` : seg, name: seg, docs: [], folders: [] };
          at.folders.push(next);
        }
        at = next;
      }
      at.docs.push(doc);
    }
    return { source, root };
  });
}

/** Number of docs in a folder, nested ones included. */
export const folderSize = (f: DocTreeFolder): number => f.docs.length + f.folders.reduce((n, sub) => n + folderSize(sub), 0);
