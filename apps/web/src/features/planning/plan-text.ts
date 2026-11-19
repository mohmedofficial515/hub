/**
 * @file plan-text.ts
 * @description A saved plan's text and its steps, read together. A plan saved from the Plan Studio or the chat holds its steps twice: in `plan.steps`, and
 * as the numbered list under «Steps» in its text (`planToMarkdown` in `@hub/contracts`), where each line also carries the step's reason, size and the
 * steps before it. When that list matches the plan's steps exactly, the page shows the steps once, with those details, and the rest of the text apart.
 * Anything else (a text written by hand, steps changed since) is left exactly as it is: nothing is guessed. Since owner decision 9a (2026-11-19) a saved
 * step carries its why, size, after and acceptance as data, which `readPlanText` prefers; the text is read for them only on an older plan.
 */

/** The «Steps» heading, in every language a plan's text is written in (the catalogs' `planText.steps`). */
export const STEPS_HEADINGS = ['Steps', 'الخطوات'] as const;
/** The word before the numbers of the steps that come first (the catalogs' `planText.after`). */
export const AFTER_WORDS = ['after', 'بعد'] as const;

export type StepSize = 'S' | 'M' | 'L';

export interface StepExtra {
  why?: string;
  size?: StepSize;
  /** The steps that come first, by number from 1. */
  after?: number[];
  /** When the step is done: one line, drawn as a checklist item. */
  acceptance?: string;
}

interface StepData {
  id: string;
  why?: string | undefined;
  size?: StepSize | undefined;
  after?: readonly string[] | undefined;
  acceptance?: string | undefined;
}

/** Each step's details from the steps themselves, with `after` turned from ids into step numbers. Null when no step has any: an older plan. */
export function stepExtras(steps: readonly StepData[]): StepExtra[] | null {
  if (!steps.some((s) => s.why || s.size || s.after?.length || s.acceptance)) return null;
  const position = new Map(steps.map((s, i) => [s.id, i + 1]));
  return steps.map((s) => {
    const after = (s.after ?? []).flatMap((id) => {
      const n = position.get(id);
      return n === undefined ? [] : [n];
    });
    return {
      ...(s.why ? { why: s.why } : {}),
      ...(s.size ? { size: s.size } : {}),
      ...(after.length ? { after } : {}),
      ...(s.acceptance ? { acceptance: s.acceptance } : {}),
    };
  });
}

/** The plan's text without its steps' list, and each step's details: from the data first, from the text for an older plan. */
export function readPlanText(body: string, steps: readonly (StepData & { title: string })[]): PlanText {
  const split = splitPlanText(body, steps);
  return { rest: split.rest, extras: stepExtras(steps) ?? split.extras };
}

export interface PlanText {
  /** The text without the steps' list, or the whole text when it did not match. */
  rest: string;
  /** Each step's details, in order, or null when the list did not match the steps. */
  extras: StepExtra[] | null;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ITEM = /^(\d+)\. (.*)$/;

/** The numbered items of a list, each with its own continuation lines. */
function itemsOf(lines: readonly string[]): { n: number; text: string }[] | null {
  const items: { n: number; text: string }[] = [];
  for (const line of lines) {
    const m = ITEM.exec(line);
    if (m) items.push({ n: Number(m[1]), text: m[2] ?? '' });
    else if (line.trim() === '') continue;
    else if (items.length) items[items.length - 1]!.text += `\n${line}`;
    else return null;
  }
  return items;
}

export function splitPlanText(
  body: string,
  steps: readonly { title: string }[],
  stepsHeadings: readonly string[] = STEPS_HEADINGS,
  afterWords: readonly string[] = AFTER_WORDS,
): PlanText {
  const whole: PlanText = { rest: body, extras: null };
  if (!body.trim() || steps.length === 0) return whole;
  const lines = body.split('\n');
  const heading = new Set(stepsHeadings.map((h) => `## ${h}`));
  let start = lines.findIndex((line) => heading.has(line.trim()));
  let from: number;
  if (start >= 0) from = start + 1;
  else {
    // A plan with no goal and no approach has no heading: its text starts with the list.
    const first = lines.findIndex((line) => line.trim() !== '');
    if (first < 0 || !/^1\. /.test(lines[first]!)) return whole;
    start = first;
    from = first;
  }
  let end = lines.findIndex((line, i) => i >= from && /^#{1,6} /.test(line));
  if (end < 0) end = lines.length;

  const items = itemsOf(lines.slice(from, end));
  if (!items || items.length !== steps.length) return whole;

  const after = afterWords.map(escape).join('|');
  const tail = new RegExp(
    `^(?<more>.*?)(?: \\((?!(?:${after}) )[^()\\n]+\\))?(?: \\[(?<size>[SML])\\])?(?: \\((?:${after}) (?<after>\\d+(?:, \\d+)*)\\))?(?:: (?<why>[\\s\\S]*))?$`,
    's',
  );
  const extras: StepExtra[] = [];
  for (const [i, item] of items.entries()) {
    const step = steps[i]!;
    if (item.n !== i + 1) return whole;
    const title = step.title.trim();
    // A step's title is cut to fit a card (`fitStepTitle`), with an ellipsis; the text keeps it whole.
    const short = title.endsWith('…') ? title.slice(0, -1).trimEnd() : null;
    const own = item.text.startsWith(title) ? title : short && item.text.startsWith(short) ? short : null;
    if (own === null) return whole;
    const m = tail.exec(item.text.slice(own.length));
    if (!m?.groups) return whole;
    // Whole titles leave nothing between the title and its details: anything there means this is another line.
    if (own === title && m.groups.more) return whole;
    const why = m.groups.why?.trim();
    const size = m.groups.size as StepSize | undefined;
    const before = m.groups.after?.split(', ').map(Number);
    extras.push({
      ...(why ? { why } : {}),
      ...(size ? { size } : {}),
      ...(before?.length ? { after: before } : {}),
    });
  }

  const rest = [...lines.slice(0, start), ...lines.slice(end)]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { rest, extras };
}

/** How many `##` sections a text has: two or more is a whole plan's text, not only its approach. */
export const sectionCount = (markdown: string | undefined) =>
  (markdown ?? '').split('\n').filter((line) => /^## /.test(line)).length;
