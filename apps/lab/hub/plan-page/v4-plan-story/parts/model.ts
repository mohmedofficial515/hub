/**
 * Derived facts of a plan page. Nothing here is stored: each is computed from the card, so the port can put them in
 * `features/planning/model.ts` beside `nextStepOf` and `progressOf`.
 */
import type { Priority, Role } from '@lab/mocks/hub-today';
import type { PlanAttachment, PlanLink, PlanPageCard, PlanPhase, PlanStep } from '@lab/mocks/hub-plan-page';

export interface NumberedStep extends PlanStep {
  /** 1-based position in the whole plan: steps keep their plan number inside a phase. */
  n: number;
}

export interface PhaseGroup {
  /** null: the plan has no phases, or a step names a phase that does not exist. */
  phase: PlanPhase | null;
  /** 0-based phase number, as the owner writes "Phase 0". */
  index: number;
  steps: NumberedStep[];
  done: number;
  total: number;
  roles: { role: Role; n: number }[];
  hasNext: boolean;
}

export function nextStepOf(card: PlanPageCard): NumberedStep | null {
  const i = card.steps.findIndex((s) => !s.done);
  return i === -1 ? null : { ...card.steps[i]!, n: i + 1 };
}

export function progressOf(card: PlanPageCard) {
  const done = card.steps.filter((s) => s.done).length;
  return { done, total: card.steps.length };
}

const roleMix = (steps: PlanStep[]) => {
  const counts = new Map<Role, number>();
  for (const s of steps) if (s.role) counts.set(s.role, (counts.get(s.role) ?? 0) + 1);
  return [...counts.entries()].map(([role, n]) => ({ role, n })).sort((a, b) => b.n - a.n);
};

/** Steps grouped under their phase, in phase order. Steps without a known phase go last in one unnamed group. */
export function phaseGroups(card: PlanPageCard): PhaseGroup[] {
  const next = nextStepOf(card);
  const numbered: NumberedStep[] = card.steps.map((s, i) => ({ ...s, n: i + 1 }));
  const known = new Set(card.phases.map((p) => p.id));
  const build = (phase: PlanPhase | null, index: number, steps: NumberedStep[]): PhaseGroup => ({
    phase,
    index,
    steps,
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    roles: roleMix(steps),
    hasNext: !!next && steps.some((s) => s.id === next.id),
  });
  const groups = card.phases.map((p, i) => build(p, i, numbered.filter((s) => s.phaseId === p.id)));
  const loose = numbered.filter((s) => !s.phaseId || !known.has(s.phaseId));
  if (loose.length) groups.push(build(null, groups.length, loose));
  return groups;
}

export type Bucket = 'now' | 'next' | 'later';

/** Now / Next / Later is read from the idea's priority, a field ideas already have. No new field. */
export const bucketOf = (p: Priority): Bucket => (p === 'P0' || p === 'P1' ? 'now' : p === 'P2' ? 'next' : 'later');

export function ideaBuckets(links: PlanLink[]) {
  const ideas = links.filter((l) => l.card.type === 'idea');
  const order: Bucket[] = ['now', 'next', 'later'];
  return order
    .map((bucket) => ({ bucket, ideas: ideas.filter((l) => bucketOf(l.card.priority) === bucket).sort((a, b) => a.card.key.localeCompare(b.card.key)) }))
    .filter((b) => b.ideas.length > 0);
}

export const relatedPlans = (links: PlanLink[]) => links.filter((l) => l.card.type === 'plan');

/** A block of the plan text: Markdown, or a run of images that sit together. */
export type TextBlock = { kind: 'md'; source: string } | { kind: 'figures'; figures: Figure[] };

export interface Figure {
  attachment: PlanAttachment | null;
  /** The attachment id or URL the Markdown named. */
  ref: string;
  alt: string;
  caption: string;
}

const IMAGE_LINE = /^!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+"([^"]*)")?\s*\)\s*$/;

/**
 * Splits the body at lines that hold only an image, so a run of images becomes one figure row. Only `attachment:ID` images are
 * resolved: an outside URL stays alt text, as 09 §11 asks (no images from the internet).
 */
export function splitBody(body: string, attachments: PlanAttachment[]): TextBlock[] {
  const blocks: TextBlock[] = [];
  let md: string[] = [];
  let figures: Figure[] = [];
  const flushMd = () => {
    const source = md.join('\n').trim();
    if (source) blocks.push({ kind: 'md', source });
    md = [];
  };
  const flushFigures = () => {
    if (figures.length) blocks.push({ kind: 'figures', figures });
    figures = [];
  };
  for (const line of body.split('\n')) {
    const m = IMAGE_LINE.exec(line.trim());
    if (m) {
      const [, alt = '', ref = '', caption] = m;
      if (!ref.startsWith('attachment:')) {
        md.push(line);
        continue;
      }
      flushMd();
      const id = ref.slice('attachment:'.length);
      figures.push({ attachment: attachments.find((a) => a.id === id) ?? null, ref: id, alt, caption: caption ?? alt });
      continue;
    }
    if (line.trim() === '' && figures.length) continue;
    flushFigures();
    md.push(line);
  }
  flushFigures();
  flushMd();
  return blocks;
}
