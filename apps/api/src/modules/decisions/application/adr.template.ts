/**
 * @file The ADR skeleton rendered on decide (docs/07 §6.5), in the format of `backend/docs/adr`.
 * @description The number is computed when the PR opens (H3-06), so the draft reads `ADR-XXXX` until then.
 */
export type TemplateLocale = 'en' | 'ar';

export interface AdrData {
  readonly key: string;
  readonly title: string;
  readonly decidedDate: string;
  readonly deciderRole: string;
  readonly decidedBy: string;
  readonly hubUrl: string;
  readonly question: string;
  readonly body: string | null;
  readonly options: readonly {
    readonly title: string;
    readonly pros: readonly string[];
    readonly cons: readonly string[];
    readonly chosen: boolean;
  }[];
  readonly rationale: string;
  readonly unblocked: readonly { readonly key: string; readonly title: string }[];
}

const TEXT = {
  en: {
    statusProposed: (key: string) => `Proposed (opened from Hub ${key})`,
    status: 'Status',
    date: 'Date',
    deciders: 'Deciders',
    hubCard: 'Hub card',
    context: 'Context',
    optionsConsidered: 'Options considered',
    option: 'Option',
    pros: 'Pros',
    cons: 'Cons',
    chosen: 'chosen',
    decision: 'Decision',
    consequences: 'Consequences',
    todo: (key: string) =>
      `To be completed by the decider's agent (/hub:adr ${key}) before the PR is opened.`,
    unblocks: 'Unblocks',
  },
  ar: {
    statusProposed: (key: string) => `مقترح (فُتح من Hub ${key})`,
    status: 'الحالة',
    date: 'التاريخ',
    deciders: 'أصحاب القرار',
    hubCard: 'بطاقة Hub',
    context: 'السياق',
    optionsConsidered: 'الخيارات المدروسة',
    option: 'الخيار',
    pros: 'المزايا',
    cons: 'العيوب',
    chosen: 'المختار',
    decision: 'القرار',
    consequences: 'النتائج',
    todo: (key: string) => `يكملها وكيل صاحب القرار (/hub:adr ${key}) قبل فتح طلب الدمج.`,
    unblocks: 'يفك الحجب عن',
  },
} as const;

const BODY_EXCERPT_LENGTH = 800;

export function renderAdr(data: AdrData, locale: TemplateLocale): string {
  const t = TEXT[locale];
  const chosen = data.options.find((option) => option.chosen);
  const excerpt =
    data.body && data.body.length > BODY_EXCERPT_LENGTH
      ? `${data.body.slice(0, BODY_EXCERPT_LENGTH)}…`
      : data.body;
  return [
    `# ADR-XXXX: ${data.title}`,
    '',
    `- **${t.status}:** ${t.statusProposed(data.key)}`,
    `- **${t.date}:** ${data.decidedDate}`,
    `- **${t.deciders}:** ${data.deciderRole} (${data.decidedBy})`,
    `- **${t.hubCard}:** ${data.hubUrl}`,
    '',
    `## ${t.context}`,
    '',
    data.question,
    '',
    ...(excerpt ? [excerpt, ''] : []),
    `## ${t.optionsConsidered}`,
    '',
    `| ${t.option} | ${t.pros} | ${t.cons} |`,
    '| --- | --- | --- |',
    ...data.options.map((option) => {
      const title = option.chosen ? `**${option.title}** (${t.chosen})` : option.title;
      return `| ${title} | ${option.pros.join('; ')} | ${option.cons.join('; ')} |`;
    }),
    '',
    `## ${t.decision}`,
    '',
    `${chosen?.title ?? ''}.`,
    '',
    data.rationale,
    '',
    `## ${t.consequences}`,
    '',
    `- ${t.todo(data.key)}`,
    ...data.unblocked.map((card) => `- ${t.unblocks} ${card.key} · ${card.title}`),
    '',
  ].join('\n');
}
