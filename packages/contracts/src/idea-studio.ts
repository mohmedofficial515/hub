/**
 * @file The Idea Studio (docs/15 §4): an idea described in one prompt, which Claude checks against what already exists, researches, organises and returns
 * as one structured report through `propose_idea`. The report creates nothing; the owner's Accept saves it as an idea card.
 * @description `overlap` is how much of the idea already exists, in Hub or in the code, from 0 (nothing) to 100 (all of it). `verdict` says it in a word,
 * and `ideaVerdictOf` keeps the two in agreement when Claude sends only one. The diagram is data the page draws itself, so it reads right to left and in dark mode.
 */
import { z } from 'zod';

export const IDEA_LIMITS = {
  text: 2_000,
  long: 6_000,
  items: 12,
  steps: 30,
  sources: 20,
  nodes: 14,
  edges: 24,
} as const;

/** `new`: nothing like it exists. `partial`: part of it exists. `exists`: it is already there, and the report says where. */
export const IDEA_VERDICTS = ['new', 'partial', 'exists'] as const;
export type IdeaVerdict = (typeof IDEA_VERDICTS)[number];

/** Where an existing match lives: a Hub card, a document, a file in the code, or outside the project. */
export const IDEA_MATCH_KINDS = ['card', 'doc', 'code', 'external'] as const;
export type IdeaMatchKind = (typeof IDEA_MATCH_KINDS)[number];

export const IDEA_SUGGESTION_KINDS = ['improve', 'alternative', 'addition', 'simplify'] as const;
export type IdeaSuggestionKind = (typeof IDEA_SUGGESTION_KINDS)[number];

const text = z.string().trim().max(IDEA_LIMITS.text);

/**
 * An open question in a report, for the owner. Plain words, as reports wrote them before, or a question with the answers Claude sees: its `options`
 * (each a label, or `{label, detail}`), the one or ones it `recommended` (by index from 0, or by label) and `why`, and `multi` when more than one can be
 * true together. The page lets the owner pick, add a note to a pick, or answer in their own words.
 */
const questionOption = z.union([
  z.string().trim().min(1).max(200),
  z.object({ label: z.string().trim().min(1).max(200), detail: z.string().trim().max(500).optional() }),
]);
const optionRef = z.union([z.number().int().min(0).max(5), z.string().trim().min(1).max(200)]);
export const reportQuestionSchema = z.union([
  text,
  z.object({
    text: z.string().trim().min(1).max(IDEA_LIMITS.text),
    options: z.array(questionOption).max(6).default([]),
    recommended: z.union([optionRef, z.array(optionRef).max(6)]).optional(),
    why: z.string().trim().max(500).optional(),
    multi: z.boolean().optional(),
  }),
]);
export type ReportQuestionInput = z.input<typeof reportQuestionSchema>;
export interface ReportQuestion {
  text: string;
  options: { label: string; detail?: string | undefined }[];
  /** The recommended options, by index: one at most unless `multi`. */
  recommended: number[];
  why?: string | undefined;
  multi?: boolean | undefined;
}

/**
 * A question in one shape: plain words become a question with no options, each option an object, and the recommendation the indexes of options that
 * exist (a label is matched to its option). A single-answer question keeps its first recommendation.
 */
export function questionOf(q: ReportQuestionInput): ReportQuestion {
  if (typeof q === 'string') return { text: q, options: [], recommended: [] };
  const options = (q.options ?? []).map((o) => (typeof o === 'string' ? { label: o } : o));
  const refs =
    q.recommended === undefined ? [] : Array.isArray(q.recommended) ? q.recommended : [q.recommended];
  const indexes = refs
    .map((r) => (typeof r === 'number' ? r : options.findIndex((o) => o.label === r.trim())))
    .filter((i, at, all) => i >= 0 && i < options.length && all.indexOf(i) === at);
  return {
    text: q.text,
    options,
    recommended: q.multi ? indexes : indexes.slice(0, 1),
    ...(q.why ? { why: q.why } : {}),
    ...(q.multi !== undefined ? { multi: q.multi } : {}),
  };
}

/** A question as one line of text: its words, its options, and the recommended one marked. */
export function questionLine(q: ReportQuestionInput, recommendedWord = 'recommended'): string {
  const { text: words, options, recommended } = questionOf(q);
  if (!options.length) return words;
  const picks = options.map((o, i) =>
    recommended.includes(i) ? `${o.label} (${recommendedWord})` : o.label,
  );
  return `${words} (${picks.join(' / ')})`;
}

/** A small flow the page draws itself: people and systems, steps, data and forks, and the arrows between them. Both studios share it. */
export const flowDiagramSchema = z.object({
  title: z.string().trim().max(200).optional(),
  nodes: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(120),
        note: z.string().trim().max(300).optional(),
        /** `actor`: a person or system outside. `step`: something that happens. `data`: something stored. `decision`: a fork. */
        shape: z.enum(['actor', 'step', 'data', 'decision']).optional(),
      }),
    )
    .min(2)
    .max(IDEA_LIMITS.nodes),
  edges: z
    .array(
      z.object({
        from: z.string().trim().min(1).max(40),
        to: z.string().trim().min(1).max(40),
        label: z.string().trim().max(80).optional(),
      }),
    )
    .max(IDEA_LIMITS.edges),
});
export type FlowDiagramData = z.infer<typeof flowDiagramSchema>;
const percent = z.number().int().min(0).max(100);

export const proposedIdeaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  /** The idea as Claude now understands it, in two to four sentences. */
  summary: z.string().trim().min(1).max(IDEA_LIMITS.long),
  problem: z.string().trim().max(IDEA_LIMITS.long).optional(),
  /** Why it is worth doing, and for whom. */
  value: z.string().trim().max(IDEA_LIMITS.long).optional(),
  verdict: z.enum(IDEA_VERDICTS),
  overlap: percent,
  /** One sentence on how the verdict was reached: what was searched. */
  basis: text.optional(),
  matches: z
    .array(
      z.object({
        kind: z.enum(IDEA_MATCH_KINDS),
        /** A card key, a doc path, a file path, or a URL. */
        ref: z.string().trim().min(1).max(500),
        title: z.string().trim().min(1).max(300),
        overlap: percent,
        note: text.optional(),
      }),
    )
    .max(IDEA_LIMITS.items)
    .default([]),
  findings: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        detail: text,
        source: z.number().int().min(1).optional(),
      }),
    )
    .max(IDEA_LIMITS.items)
    .default([]),
  suggestions: z
    .array(
      z.object({
        kind: z.enum(IDEA_SUGGESTION_KINDS),
        title: z.string().trim().min(1).max(300),
        detail: text,
      }),
    )
    .max(IDEA_LIMITS.items)
    .default([]),
  diagram: flowDiagramSchema.optional(),
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(500),
        role: z.string().max(40).optional(),
        why: text.optional(),
      }),
    )
    .max(IDEA_LIMITS.steps)
    .default([]),
  risks: z.array(text).max(IDEA_LIMITS.items).default([]),
  questions: z.array(reportQuestionSchema).max(IDEA_LIMITS.items).default([]),
  sources: z
    .array(z.object({ title: z.string().trim().min(1).max(300), url: z.url().max(2_000) }))
    .max(IDEA_LIMITS.sources)
    .default([]),
});
export type ProposedIdea = z.infer<typeof proposedIdeaSchema>;
export type ProposedIdeaInput = z.input<typeof proposedIdeaSchema>;

/** The verdict the overlap supports: a report that says `new` at 80% is corrected to what its own number says. */
export function ideaVerdictOf(overlap: number, said: IdeaVerdict): IdeaVerdict {
  if (overlap >= 85) return 'exists';
  if (overlap >= 20) return said === 'new' ? 'partial' : said === 'exists' && overlap < 60 ? 'partial' : said;
  return said === 'exists' ? 'partial' : 'new';
}

/** The diagram, kept to edges whose two ends exist, so the page never draws a line to nowhere. */
export function cleanIdea(idea: ProposedIdea): ProposedIdea {
  const diagram = idea.diagram
    ? (() => {
        const ids = new Set(idea.diagram.nodes.map((n) => n.id));
        return { ...idea.diagram, edges: idea.diagram.edges.filter((e) => ids.has(e.from) && ids.has(e.to)) };
      })()
    : undefined;
  return {
    ...idea,
    verdict: ideaVerdictOf(idea.overlap, idea.verdict),
    matches: [...idea.matches].sort((a, b) => b.overlap - a.overlap),
    findings: idea.findings.map((f) =>
      f.source !== undefined && f.source > idea.sources.length ? { title: f.title, detail: f.detail } : f,
    ),
    ...(diagram ? { diagram } : {}),
  };
}

/** The words an idea's text is written in: English by default, and the page passes its own language's. */
export interface IdeaWords {
  verdict: Record<IdeaVerdict, string>;
  /** "{n}% already exists". */
  overlap: string;
  value: string;
  exists: string;
  research: string;
  suggestions: string;
  flow: string;
  draftPlan: string;
  risks: string;
  questions: string;
  sources: string;
  /** After the option Claude recommends, in an open question. */
  recommended?: string;
  /** Suggestion kinds and Hub's role names, as the reader says them. One not here is written as it came. */
  kinds?: Readonly<Record<string, string>>;
  roles?: Readonly<Record<string, string>>;
}

export const IDEA_WORDS_EN: IdeaWords = {
  verdict: { new: 'New', partial: 'Partly exists', exists: 'Already exists' },
  overlap: '{n}% already exists',
  value: 'Value',
  exists: 'What already exists',
  research: 'Research',
  suggestions: 'Suggestions',
  flow: 'Flow',
  draftPlan: 'Draft plan',
  risks: 'Risks',
  questions: 'Open questions',
  sources: 'Sources',
};

/** The report as Markdown: the idea card's text when the owner accepts it, and what Claude shows outside the panel. */
export function ideaToMarkdown(idea: ProposedIdea, words: IdeaWords = IDEA_WORDS_EN): string {
  const out: string[] = [idea.summary, ''];
  out.push(
    `**${words.verdict[idea.verdict]}** · ${words.overlap.replace('{n}', String(idea.overlap))}${idea.basis ? `: ${idea.basis}` : ''}`,
  );
  const section = (title: string, lines: string[]) => {
    if (lines.length) out.push('', `## ${title}`, '', ...lines);
  };
  if (idea.value) section(words.value, [idea.value]);
  section(
    words.exists,
    idea.matches.map(
      (m) =>
        `- ${m.kind === 'external' ? `[${m.title}](${m.ref})` : `\`${m.ref}\` ${m.title}`} · ${m.overlap}%${m.note ? `: ${m.note}` : ''}`,
    ),
  );
  section(
    words.research,
    idea.findings.map((f) => `- **${f.title}**: ${f.detail}${f.source ? ` [${f.source}]` : ''}`),
  );
  section(
    words.suggestions,
    idea.suggestions.map((s) => `- **${s.title}** (${words.kinds?.[s.kind] ?? s.kind}): ${s.detail}`),
  );
  if (idea.diagram && idea.diagram.edges.length) {
    const label = new Map(idea.diagram.nodes.map((n) => [n.id, n.label]));
    section(
      idea.diagram.title || words.flow,
      idea.diagram.edges.map(
        (e) => `- ${label.get(e.from)} → ${label.get(e.to)}${e.label ? ` (${e.label})` : ''}`,
      ),
    );
  }
  section(
    words.draftPlan,
    idea.steps.map(
      (s, i) =>
        `${i + 1}. ${s.title}${s.role ? ` (${words.roles?.[s.role] ?? s.role})` : ''}${s.why ? `: ${s.why}` : ''}`,
    ),
  );
  section(
    words.risks,
    idea.risks.map((r) => `- ${r}`),
  );
  section(
    words.questions,
    idea.questions.map((q) => `- ${questionLine(q, words.recommended)}`),
  );
  section(
    words.sources,
    idea.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`),
  );
  return out.join('\n').trim();
}

/** The keys of the Hub cards a report matched, for the accepted idea's `relates` links. */
export function ideaCardKeys(idea: ProposedIdea, pattern: RegExp): string[] {
  return [
    ...new Set(idea.matches.filter((m) => m.kind === 'card' && pattern.test(m.ref)).map((m) => m.ref)),
  ].slice(0, 10);
}
