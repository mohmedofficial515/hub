/**
 * @file The pure parts of structured results (docs/16 §7.2): a plan as words, an owner's answers applied to a draft, and a draft's line diff against its base.
 * @description The API saves with `applyClaimAnswers`, and the panel previews with the same function, so what the owner sees is what is saved. An answer acts on the claim's exact words, and if the owner's own edit already removed them, it changes nothing.
 */
import type { ClaimAnswer, DocClaim, ProposedPlan } from './chat';
import { UNVERIFIED_MARK } from './chat';

/** The plan as Markdown: the text fallback, and what Run this plan sends. */
export function planToMarkdown(plan: ProposedPlan): string {
  const steps = plan.steps.map((step, index) => {
    const role = step.role ? ` (${step.role})` : '';
    const why = step.why ? `: ${step.why}` : '';
    return `${index + 1}. ${step.title}${role}${why}`;
  });
  const list = (title: string, items?: readonly string[]) =>
    items?.length ? ['', `## ${title}`, '', ...items.map((item) => `- ${item}`)] : [];
  return [`# ${plan.title}`, '', ...steps, ...list('Checks', plan.checks), ...list('Risks', plan.risks)].join(
    '\n',
  );
}

/** What pressing Run this plan sends. It stays visible in the composer until the owner sends it (D51). */
export function planToPrompt(plan: ProposedPlan): string {
  return `Carry out this plan, step by step, and run its checks.\n\n${planToMarkdown(plan)}`;
}

/** Flags still waiting for the owner. `save_doc` refuses while there is one. */
export function openFlags(claims: readonly DocClaim[]): DocClaim[] {
  return claims.filter((claim) => claim.status === 'unverified' && claim.answer === null);
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyOne(text: string, claim: string, answer: ClaimAnswer): string {
  const escaped = escapeForRegExp(claim);
  const marked = new RegExp(`^${escapeForRegExp(UNVERIFIED_MARK)}${escaped}[^\\n]*\\n?`, 'm');
  if (answer === 'remove') {
    if (marked.test(text)) return text.replace(marked, '');
    return text
      .replace(new RegExp(`^${escaped}\\s*\\n?`, 'm'), '')
      .split(claim)
      .join('')
      .replace(/[ \t]+$/gm, '');
  }
  if (answer === 'confirm') {
    return text.replace(new RegExp(`^${escapeForRegExp(UNVERIFIED_MARK)}(${escaped})`, 'm'), '$1');
  }
  if (marked.test(text) || !text.includes(claim)) return text;
  // Kept but not verified: it must read that way in the document, on its own line.
  const at = text.indexOf(claim);
  const before = text.slice(0, at).replace(/[ \t]+$/, '');
  const rest = text.slice(at + claim.length).replace(/^[ \t]+/, '');
  const opening = before === '' || before.endsWith('\n') ? '' : '\n';
  const closing = rest === '' || rest.startsWith('\n') ? '' : '\n';
  return `${before}${opening}${UNVERIFIED_MARK}${claim}${closing}${rest}`;
}

/** The text that gets saved: the draft, or the owner's edit of it, with each flag's answer applied. */
export function applyClaimAnswers(text: string, claims: readonly DocClaim[]): string {
  return claims.reduce(
    (current, claim) =>
      claim.status === 'unverified' && claim.answer ? applyOne(current, claim.text, claim.answer) : current,
    text,
  );
}

export interface DiffLine {
  readonly kind: 'same' | 'added' | 'removed';
  readonly text: string;
}

/** Past this many changed lines, a line-by-line search costs more than it tells: everything between shows as replaced. */
const DIFF_LINE_LIMIT = 4_000;

/** A line diff against the base. Null base means a new document, which is all added. */
export function lineDiff(base: string | null, draft: string): DiffLine[] {
  const after = draft.split('\n');
  if (base === null) return after.map((text) => ({ kind: 'added', text }));
  const before = base.split('\n');
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore -= 1;
    endAfter -= 1;
  }
  const head = before.slice(0, start).map((text): DiffLine => ({ kind: 'same', text }));
  const tail = before.slice(endBefore).map((text): DiffLine => ({ kind: 'same', text }));
  const midBefore = before.slice(start, endBefore);
  const midAfter = after.slice(start, endAfter);
  if (midBefore.length + midAfter.length > DIFF_LINE_LIMIT) {
    return [
      ...head,
      ...midBefore.map((text): DiffLine => ({ kind: 'removed', text })),
      ...midAfter.map((text): DiffLine => ({ kind: 'added', text })),
      ...tail,
    ];
  }
  const lengths: number[][] = Array.from({ length: midBefore.length + 1 }, () =>
    new Array<number>(midAfter.length + 1).fill(0),
  );
  for (let i = midBefore.length - 1; i >= 0; i -= 1) {
    for (let j = midAfter.length - 1; j >= 0; j -= 1) {
      const row = lengths[i] as number[];
      const below = lengths[i + 1] as number[];
      row[j] =
        midBefore[i] === midAfter[j]
          ? (below[j + 1] as number) + 1
          : Math.max(below[j] as number, row[j + 1] as number);
    }
  }
  const middle: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < midBefore.length || j < midAfter.length) {
    if (i < midBefore.length && j < midAfter.length && midBefore[i] === midAfter[j]) {
      middle.push({ kind: 'same', text: midBefore[i] as string });
      i += 1;
      j += 1;
    } else if (
      i < midBefore.length &&
      (j === midAfter.length ||
        ((lengths[i + 1] as number[])[j] as number) >= ((lengths[i] as number[])[j + 1] as number))
    ) {
      middle.push({ kind: 'removed', text: midBefore[i] as string });
      i += 1;
    } else {
      middle.push({ kind: 'added', text: midAfter[j] as string });
      j += 1;
    }
  }
  return [...head, ...middle, ...tail];
}
