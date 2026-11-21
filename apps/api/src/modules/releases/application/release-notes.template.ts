/**
 * @file The release notes skeleton per audience (docs/07 §6.3). Plain data in, Markdown out, nothing invented.
 * @description Empty sections are omitted. An audience with nothing renders the "nothing here" line.
 */
import type { ReleaseAudience } from '@hub/contracts';

export type TemplateLocale = 'en' | 'ar';

export interface ReleaseNoteCard {
  readonly key: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly priority: string;
  readonly ownerRole: string | null;
  readonly module: string | null;
  readonly tags: readonly string[];
  /** A task's PR, a change's PR. */
  readonly prUrl?: string | null;
  /** A decision's kind, a need's kind, a change's kind. */
  readonly kind?: string | null;
  /** A decided decision's chosen option. */
  readonly chosenOption?: string | null;
}

const FINANCE_MODULES: readonly string[] = ['payments', 'wallet', 'invoicing', 'pricing', 'loyalty'];

const TEXT = {
  en: {
    tasks: 'Tasks done',
    handoffs: 'Handoffs applied',
    decisions: 'Decisions',
    redesigns: 'Redesigns ported',
    prs: 'Pull requests merged',
    needs: 'Needs verified',
    whatIsNew: 'What is new',
    decisionsTaken: 'Decisions taken',
    stillNeedsYou: 'What still needs you',
    financial: 'Financial decisions',
    values: 'Values verified',
    money: 'Payment / wallet / invoicing changes',
    pending: 'Pending verification',
    nothing: 'Nothing in this release concerns this audience.',
  },
  ar: {
    tasks: 'المهام المنجزة',
    handoffs: 'الإحالات المطبَّقة',
    decisions: 'القرارات',
    redesigns: 'التصاميم المنقولة',
    prs: 'طلبات الدمج المدموجة',
    needs: 'الاحتياجات المتحقَّق منها',
    whatIsNew: 'ما الجديد',
    decisionsTaken: 'القرارات المتخذة',
    stillNeedsYou: 'ما زال ينتظرك',
    financial: 'القرارات المالية',
    values: 'القيم المتحقَّق منها',
    money: 'تغييرات الدفع والمحفظة والفوترة',
    pending: 'بانتظار التحقق',
    nothing: 'لا شيء في هذا الإصدار يخص هذه الفئة.',
  },
} as const;

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : [`### ${title}`, ...lines, ''];
}

const keyed = (card: ReleaseNoteCard) =>
  `- ${card.key} · ${card.title}${card.prUrl ? ` (${card.prUrl})` : ''}`;
const titled = (card: ReleaseNoteCard) => `- ${card.title}`;
const decided = (card: ReleaseNoteCard) =>
  `- ${card.title}${card.chosenOption ? ` → ${card.chosenOption}` : ''}`;

function isFinance(card: ReleaseNoteCard): boolean {
  return (card.module !== null && FINANCE_MODULES.includes(card.module)) || card.tags.includes('finance');
}

export function renderReleaseNotes(
  audience: ReleaseAudience,
  included: readonly ReleaseNoteCard[],
  open: readonly ReleaseNoteCard[],
  locale: TemplateLocale,
): string {
  const t = TEXT[locale];
  const of = (type: string, status: string) =>
    included.filter((card) => card.type === type && card.status === status);
  const tasksDone = of('task', 'done');
  const handoffsApplied = of('handoff', 'applied');
  const decisions = of('decision', 'decided');
  const needsVerified = of('need', 'verified');

  const lines =
    audience === 'team'
      ? [
          ...section(t.tasks, tasksDone.map(keyed)),
          ...section(t.handoffs, handoffsApplied.map(keyed)),
          ...section(t.decisions, decisions.map(keyed)),
          ...section(t.redesigns, of('redesign', 'ported').map(keyed)),
          ...section(
            t.prs,
            included.filter((card) => card.type === 'change' && card.status === 'merged').map(keyed),
          ),
          ...section(t.needs, needsVerified.map(keyed)),
        ]
      : audience === 'owner'
        ? [
            ...section(
              t.whatIsNew,
              [
                ...tasksDone.filter((card) => card.priority === 'P0' || card.priority === 'P1'),
                ...of('redesign', 'ported'),
              ].map(titled),
            ),
            ...section(t.decisionsTaken, decisions.map(decided)),
            ...section(t.stillNeedsYou, open.filter((card) => card.ownerRole === 'owner').map(titled)),
          ]
        : [
            ...section(t.financial, decisions.filter((card) => card.kind === 'financial').map(decided)),
            ...section(t.values, needsVerified.filter((card) => card.kind === 'value_check').map(titled)),
            ...section(t.money, [...tasksDone, ...handoffsApplied].filter(isFinance).map(titled)),
            ...section(
              t.pending,
              open
                .filter(
                  (card) =>
                    card.type === 'need' && card.status === 'delivered' && card.ownerRole === 'accountant',
                )
                .map(titled),
            ),
          ];
  return lines.length === 0 ? `${t.nothing}\n` : lines.join('\n');
}
