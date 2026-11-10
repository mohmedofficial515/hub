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
  questions: z.array(text).max(IDEA_LIMITS.items).default([]),
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

const VERDICT_WORDS: Record<IdeaVerdict, string> = {
  new: 'New',
  partial: 'Partly exists',
  exists: 'Already exists',
};

/** The report as Markdown: the idea card's text when the owner accepts it, and what Claude shows outside the panel. */
export function ideaToMarkdown(idea: ProposedIdea): string {
  const out: string[] = [idea.summary, ''];
  out.push(
    `**${VERDICT_WORDS[idea.verdict]}** · ${idea.overlap}% already exists${idea.basis ? `: ${idea.basis}` : ''}`,
  );
  const section = (title: string, lines: string[]) => {
    if (lines.length) out.push('', `## ${title}`, '', ...lines);
  };
  if (idea.value) section('Value', [idea.value]);
  section(
    'What already exists',
    idea.matches.map(
      (m) =>
        `- ${m.kind === 'external' ? `[${m.title}](${m.ref})` : `\`${m.ref}\` ${m.title}`} · ${m.overlap}%${m.note ? `: ${m.note}` : ''}`,
    ),
  );
  section(
    'Research',
    idea.findings.map((f) => `- **${f.title}**: ${f.detail}${f.source ? ` [${f.source}]` : ''}`),
  );
  section(
    'Suggestions',
    idea.suggestions.map((s) => `- **${s.title}** (${s.kind}): ${s.detail}`),
  );
  if (idea.diagram && idea.diagram.edges.length) {
    const label = new Map(idea.diagram.nodes.map((n) => [n.id, n.label]));
    section(
      idea.diagram.title || 'Flow',
      idea.diagram.edges.map(
        (e) => `- ${label.get(e.from)} → ${label.get(e.to)}${e.label ? ` (${e.label})` : ''}`,
      ),
    );
  }
  section(
    'Draft plan',
    idea.steps.map(
      (s, i) => `${i + 1}. ${s.title}${s.role ? ` (${s.role})` : ''}${s.why ? `: ${s.why}` : ''}`,
    ),
  );
  section(
    'Risks',
    idea.risks.map((r) => `- ${r}`),
  );
  section(
    'Open questions',
    idea.questions.map((q) => `- ${q}`),
  );
  section(
    'Sources',
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
