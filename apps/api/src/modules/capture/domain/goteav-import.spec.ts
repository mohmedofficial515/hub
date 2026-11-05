/**
 * @file Importer parsers with fixtures in the real files' shapes (docs/06 §7).
 */
import {
  parseContractChanges,
  parseDecisions,
  parseStatusFiles,
  parseSuggestions,
  severityOf,
  statusFileDate,
} from './goteav-import';

const NOW = new Date('2026-11-05T00:00:00.000Z');

const DECISIONS = `
decisions:
  - id: payments.gateway
    titleAr: بوابة الدفع
    status: proposed
    modules: [payments, wallet]
    lastVerifiedAt: "2026-10-18"
    reviewBy: "2027-01-18"
    questionAr: ما البوابة؟
    contextAr: [سياق أول]
    summaryAr: ملخص
    recommendationAr: نوصي بهذه. وبعدها تلك.
    planAr: [خطوة]
    rules:
      - titleAr: قاعدة
        bodyAr: نص
        impactAr: أثر
        confidence: confirmed
    options:
      - id: iyzico
        name: iyzico (PayU)
        verdict: viable
        prosAr: [جيد]
        consAr: [غال]
        pricingAr: 4%
      - id: stripe
        name: Stripe
        verdict: recommended
  - id: other.approved
    titleAr: قرار معتمد
    status: approved
    modules: [flights]
    lastVerifiedAt: "2026-09-01"
    questionAr: سؤال؟
    summaryAr: لأن
    recommendationAr: افعل هذا. ثم ذاك.
  - id: other.rejected
    titleAr: مرفوض
    status: rejected
    questionAr: سؤال؟
  - id: other.deferred
    titleAr: مؤجل
    status: deferred
    reviewBy: "2027-02-01"
    questionAr: سؤال؟
  - id: bad.status
    titleAr: غريب
    status: odd
    questionAr: سؤال؟
  - id: no.question
    titleAr: بلا سؤال
`;

const SUGGESTIONS = `
suggestions:
  - { id: a, titleAr: أ, summaryAr: ملخص, target: both, modules: [payments], category: fraud, priority: P0, effort: L, status: done, evidence: [src/a.ts], acceptanceAr: [يعمل] }
  - { id: b, titleAr: ب, target: dashboard, status: in_progress, priority: P1, effort: S, category: ux }
  - { id: c, titleAr: ج, target: mobile, status: deferred, category: Business Risk }
  - { id: d, titleAr: د, target: backend, status: rejected, prompt: افعلها }
`;

describe('decisions', () => {
  const { cards, problems } = parseDecisions(DECISIONS, NOW);
  const byId = (id: string) => cards.find((card) => card.externalKey === `import:decision:${id}`);

  it('keeps real options, and is financial by module', () => {
    const card = byId('payments.gateway');
    expect(card).toMatchObject({
      status: 'open',
      title: 'بوابة الدفع',
      ownerRole: 'owner',
      module: 'payments',
    });
    expect(card?.createdAt.toISOString()).toBe('2026-10-18T00:00:00.000Z');
    expect(card?.detail['kind']).toBe('financial');
    expect(card?.detail['options']).toEqual([
      { id: 'iyzico', title: 'iyzico (PayU)', pros: ['جيد'], cons: ['غال'], cost: '4%', recommended: false },
      { id: 'stripe', title: 'Stripe', pros: [], cons: [], cost: null, recommended: true },
    ]);
    expect(card?.body).toContain('## القواعد');
    expect(card?.tags).toEqual(['payments', 'wallet', 'imported', 'research']);
  });

  it('synthesises two options when there are none, and backdates a decided one', () => {
    const card = byId('other.approved');
    expect(card).toMatchObject({ status: 'decided', dueAt: null });
    expect(card?.detail).toMatchObject({ chosenOptionId: 'recommended', rationale: 'لأن', kind: 'product' });
    expect((card?.detail['options'] as { id: string }[]).map((option) => option.id)).toEqual([
      'recommended',
      'defer',
    ]);
    expect(card?.events).toEqual([
      { kind: 'decided', at: new Date('2026-09-01'), data: { optionId: 'recommended' } },
    ]);
  });

  it('maps the other statuses, and reports what it does not understand', () => {
    expect(byId('other.rejected')?.status).toBe('withdrawn');
    expect(byId('other.deferred')?.dueAt?.toISOString()).toBe('2027-02-01T00:00:00.000Z');
    expect(byId('bad.status')?.status).toBe('open');
    expect(byId('no.question')).toBeUndefined();
    expect(problems).toEqual([
      'decision bad.status has the unknown status "odd"; imported as open',
      'decision no.question has no title or question',
    ]);
  });
});

describe('suggestions', () => {
  const { cards, problems } = parseSuggestions(SUGGESTIONS, NOW);
  const byId = (id: string) => cards.find((card) => card.externalKey === `import:suggestion:${id}`);

  it('maps status, specialty, effort and tags', () => {
    expect(problems).toEqual([]);
    expect(byId('a')).toMatchObject({ status: 'done', priority: 'P0', ownerRole: 'backend', closedAt: NOW });
    expect(byId('a')?.tags).toEqual(['payments', 'fraud', 'imported', 'needs-frontend']);
    expect(byId('a')?.detail).toMatchObject({
      specialty: 'backend',
      effort: 'L',
      origin: 'import_suggestion',
      acceptance: '- يعمل',
      doneAt: NOW,
    });
    expect(byId('a')?.body).toContain('`src/a.ts`');
    expect(byId('b')).toMatchObject({ status: 'ready', ownerRole: 'frontend' });
    expect(byId('b')?.tags).toContain('was-in-progress');
    expect(byId('c')).toMatchObject({ status: 'backlog', priority: 'P3' });
    expect(byId('c')?.tags).toEqual(['business-risk', 'imported', 'mobile', 'deferred']);
    expect(byId('d')).toMatchObject({ status: 'cancelled' });
    expect(byId('d')?.detail['prompt']).toBe('افعلها');
  });
});

describe('contract changes', () => {
  const text = `# Backend contract changes

One line per commit.

- 2026-09-28 \`feat/x\` \`631e423\` (backend-dev): **breaking** Route moved. More text (IR-020).
- 2026-09-29 \`feat/y\` \`abd3c3f\`, \`b40c3c6\` (dev): Not breaking at all.
- not a real line
`;
  const { cards, problems } = parseContractChanges(text);

  it('parses shas, branch, severity and references', () => {
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      title: 'Contract change 2026-09-28: **breaking** Route moved.',
      status: 'applied',
      branch: 'feat/x',
      commitSha: '631e423',
      ownerRole: 'frontend',
    });
    expect(cards[0]?.createdAt.toISOString()).toBe('2026-09-28T12:00:00.000Z');
    expect(cards[0]?.detail).toMatchObject({
      severity: 'breaking',
      payload: { shas: ['631e423'], actorLabel: 'backend-dev', issueRefs: ['IR-020'] },
    });
    expect(cards[1]?.detail).toMatchObject({ severity: 'info', payload: { shas: ['abd3c3f', 'b40c3c6'] } });
    expect(problems).toEqual(['contract change line not understood: - not a real line']);
  });

  it('gives each line a stable key', () => {
    expect(parseContractChanges(text).cards[0]?.externalKey).toBe(cards[0]?.externalKey);
    expect(cards[0]?.externalKey).toMatch(/^import:contract:[0-9a-f]{16}$/);
  });

  it('reads severity', () => {
    expect(severityOf('plain')).toBe('notable');
    expect(severityOf('not breaking')).toBe('info');
  });
});

describe('status files', () => {
  it('dates from the name, else the first commit, and keeps the indexer’s key', () => {
    expect(
      statusFileDate({ name: '2026-09-20-m7-progress-ar.md', content: '' }, NOW).toISOString(),
    ).toContain('2026-09-20');
    expect(
      statusFileDate(
        { name: 'integration-gaps.md', content: '', firstCommitAt: '2026-09-22T10:00:00+03:00' },
        NOW,
      ).toISOString(),
    ).toContain('2026-09-22');
    const { cards } = parseStatusFiles(
      [{ name: '2026-09-20-progress-ar.md', content: '# تقرير\nنص' }],
      'backend-docs',
      'source-id',
      NOW,
    );
    expect(cards[0]).toMatchObject({
      externalKey: 'doc:backend-docs:docs/status/2026-09-20-progress-ar.md',
      title: 'تقرير',
      detail: { kind: 'status', lang: 'ar', sourceId: 'source-id' },
    });
  });

  it('makes the release, related to its doc', () => {
    const { cards } = parseStatusFiles(
      [{ name: 'release-2026-09-30.ar.md', content: '# إصدار' }],
      'backend-docs',
      'source-id',
      NOW,
    );
    expect(cards.map((card) => card.type)).toEqual(['doc', 'release']);
    expect(cards[1]).toMatchObject({
      externalKey: 'import:release:2026-09-30',
      status: 'released',
      relates: ['doc:backend-docs:docs/status/release-2026-09-30.ar.md'],
      detail: { version: '2026-09-30', notes: { team: '# إصدار' } },
    });
  });
});
