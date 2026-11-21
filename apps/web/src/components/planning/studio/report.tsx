'use client';

/**
 * @file report.tsx
 * @description The Idea Studio's report, as `propose_idea` sent it: the verdict and how new the idea is, what already exists with how much of it each match
 * covers, the problem and the value, the flow, the research with numbered sources, the suggestions, a draft plan, risks and open questions. Every section
 * shows only when Claude sent it; nothing is filled in here.
 */
import type { IdeaMatchKind, IdeaSuggestionKind, IdeaVerdict, ProposedIdea } from '@hub/contracts';
import { useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  CircleHelp,
  Code2,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Lightbulb,
  ListOrdered,
  type LucideIcon,
  Minimize2,
  Network,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { Bidi, CardChip, cn, fmt, focusRing, num, plural, useLocale, useT } from '@/components/kit';
import { hostOf, projectPath } from '@/features/planning/studio-acts';

import type { PlanningMessages } from '../messages';
import { FlowDiagram } from './diagram';
import { ProposedSteps } from './plan-report';
import { Questions } from './questions';
import { STUDIO_ANCHOR } from './shared';

export { Questions };

type Words = PlanningMessages['studio'];

export function Section({
  id,
  title,
  icon: Icon,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs md:p-5',
        STUDIO_ANCHOR,
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <h2 id={`${id}-h`} className="min-w-0 flex-1 text-title-sm font-semibold text-foreground">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ── The verdict ─────────────────────────────────────────────────────────────────────────────────────

const VERDICT_TONE: Record<IdeaVerdict, { ring: string; chip: string }> = {
  new: { ring: 'stroke-success', chip: 'bg-success-soft text-success-soft-foreground' },
  partial: { ring: 'stroke-warning-strong', chip: 'bg-warning-soft text-warning-soft-foreground' },
  exists: { ring: 'stroke-info', chip: 'bg-info-soft text-info-soft-foreground' },
};

/** How new the idea is, as a ring: the number is written inside, so the colour is never the only signal. */
export function NoveltyRing({ idea, size = 112 }: { idea: ProposedIdea; size?: number }) {
  const w = useT<PlanningMessages>('planning').studio;
  const locale = useLocale();
  const fresh = 100 - idea.overlap;
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${(fresh / 100) * c} ${c}`}
          className={cn(
            VERDICT_TONE[idea.verdict].ring,
            'transition-[stroke-dasharray] duration-700 ease-out',
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-headline font-bold text-foreground tabular-nums">
          {fmt(w.percent, { n: num(fresh, locale) })}
        </span>
        <span className="text-caption text-muted-foreground">{w.novelty}</span>
      </div>
    </div>
  );
}

export function VerdictChip({ verdict }: { verdict: IdeaVerdict }) {
  const w = useT<PlanningMessages>('planning').studio;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-caption font-semibold',
        VERDICT_TONE[verdict].chip,
      )}
    >
      {w.verdict[verdict]}
    </span>
  );
}

// ── Matches ──────────────────────────────────────────────────────────────────────────────────────────

const MATCH_ICON: Record<IdeaMatchKind, LucideIcon> = {
  card: Layers,
  doc: BookOpen,
  code: Code2,
  external: Globe,
};

function MatchRef({ kind, refText }: { kind: IdeaMatchKind; refText: string }) {
  if (kind === 'card' && /^[A-Z]{2,6}-\d{1,7}$/.test(refText)) return <CardChip k={refText} />;
  if (kind === 'external' && /^https?:\/\//.test(refText)) {
    return (
      <a
        href={refText}
        target="_blank"
        rel="noopener noreferrer"
        dir="ltr"
        className={cn(
          'inline-flex max-w-full items-center gap-1 truncate text-caption text-primary hover:underline',
          focusRing,
        )}
      >
        <span className="truncate">{hostOf(refText)}</span>
        <ExternalLink aria-hidden className="size-3 shrink-0" />
      </a>
    );
  }
  const shown = kind === 'code' ? projectPath(refText) : refText;
  return (
    <code
      dir="ltr"
      translate="no"
      title={refText}
      className="inline-block max-w-full truncate rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-caption text-foreground"
    >
      {shown}
    </code>
  );
}

function Matches({ idea, w }: { idea: ProposedIdea; w: Words }) {
  const locale = useLocale();
  if (idea.matches.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success-soft/50 px-3 py-2.5 text-body-sm text-success-soft-foreground">
        <Sparkles aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        {w.noMatches}
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {idea.matches.map((m, i) => {
        const Icon = MATCH_ICON[m.kind];
        return (
          <li key={`${m.ref}-${i}`} className="flex min-w-0 gap-3 py-3 first:pt-0 last:pb-0">
            <span
              aria-hidden
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground"
            >
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-body-sm font-medium text-foreground">
                  <Bidi>{m.title}</Bidi>
                </span>
                <span className="text-caption text-muted-foreground">{w.matchKinds[m.kind]}</span>
              </div>
              <div className="min-w-0">
                <MatchRef kind={m.kind} refText={m.ref} />
              </div>
              {m.note && (
                <p className="text-caption text-pretty text-muted-foreground">
                  <Bidi>{m.note}</Bidi>
                </p>
              )}
            </div>
            <div className="flex w-20 shrink-0 flex-col items-end gap-1.5 pt-0.5">
              <span className="text-body-sm font-semibold text-foreground tabular-nums">
                {fmt(w.percent, { n: num(m.overlap, locale) })}
              </span>
              <span aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    'block h-full rounded-full',
                    m.overlap >= 85 ? 'bg-info' : m.overlap >= 20 ? 'bg-warning-strong' : 'bg-success',
                  )}
                  style={{ width: `${m.overlap}%` }}
                />
              </span>
              <span className="sr-only">{fmt(w.overlapLine, { n: num(m.overlap, locale) })}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Suggestions ─────────────────────────────────────────────────────────────────────────────────────

const SUGGESTION: Record<IdeaSuggestionKind, { icon: LucideIcon; tone: string }> = {
  improve: { icon: TrendingUp, tone: 'bg-primary/10 text-primary' },
  alternative: { icon: Repeat, tone: 'bg-info-soft text-info-soft-foreground' },
  addition: { icon: Plus, tone: 'bg-success-soft text-success-soft-foreground' },
  simplify: { icon: Minimize2, tone: 'bg-warning-soft text-warning-soft-foreground' },
};

// ── The report ──────────────────────────────────────────────────────────────────────────────────────

export function reportSections(idea: ProposedIdea) {
  return [
    { id: 'idea-matches', show: true },
    { id: 'idea-problem', show: !!(idea.problem || idea.value) },
    { id: 'idea-diagram', show: !!idea.diagram },
    { id: 'idea-findings', show: idea.findings.length > 0 },
    { id: 'idea-suggestions', show: idea.suggestions.length > 0 },
    { id: 'idea-steps', show: idea.steps.length > 0 },
    { id: 'idea-risks', show: idea.risks.length > 0 },
    { id: 'idea-questions', show: idea.questions.length > 0 },
    { id: 'idea-sources', show: idea.sources.length > 0 },
  ].filter((s) => s.show);
}

/** The report's contents, kept in view while it scrolls, with the section being read marked. */
export function ReportToc({ sections, label }: { sections: { id: string; label: string }[]; label: string }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  const reduce = useReducedMotion();
  const ids = sections.map((s) => s.id).join(' ');
  useEffect(() => {
    const els = ids
      .split(' ')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = els.find((el) => seen.get(el.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '-120px 0px -55% 0px' },
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [ids]);

  return (
    <nav
      aria-label={label}
      className="sticky top-16 z-[5] flex min-w-0 gap-1.5 overflow-x-auto rounded-2xl border border-border/70 bg-background/85 p-1.5 backdrop-blur [scrollbar-width:none] @max-page-xl:top-30"
    >
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-current={active === s.id ? 'location' : undefined}
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById(s.id)
              ?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
            setActive(s.id);
          }}
          className={cn(
            'inline-flex h-7 shrink-0 items-center rounded-full px-3 text-caption font-medium transition-colors max-md:h-9',
            active === s.id
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            focusRing,
          )}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

export function IdeaReport({
  idea,
  onAsk,
  busy = false,
  blocked = false,
}: {
  idea: ProposedIdea;
  /** Sends a request about the report to Claude: a suggestion to apply, answers to its questions. False when it was not taken. */
  onAsk?: ((text: string) => boolean | Promise<boolean>) | undefined;
  busy?: boolean;
  /** A request already waits for Claude: Apply and Send hold back, and say why. */
  blocked?: boolean;
}) {
  const w = useT<PlanningMessages>('planning').studio;
  const locale = useLocale();
  const label: Record<string, string> = {
    'idea-matches': w.sections.matches,
    'idea-problem': w.sections.problem,
    'idea-diagram': w.sections.diagram,
    'idea-findings': w.sections.findings,
    'idea-suggestions': w.sections.suggestions,
    'idea-steps': w.sections.steps,
    'idea-risks': w.sections.risks,
    'idea-questions': w.sections.questions,
    'idea-sources': w.sections.sources,
  };
  const sections = reportSections(idea);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ReportToc sections={sections.map((s) => ({ id: s.id, label: label[s.id] ?? s.id }))} label={w.toc} />

      <Section
        id="idea-matches"
        title={w.sections.matches}
        icon={Search}
        aside={
          <span className="text-caption text-muted-foreground tabular-nums">
            {fmt(w.overlapLine, { n: num(idea.overlap, locale) })}
          </span>
        }
      >
        {idea.basis && (
          <p className="text-caption text-muted-foreground">
            <span className="font-medium text-foreground">{w.basis}: </span>
            <Bidi>{idea.basis}</Bidi>
          </p>
        )}
        <Matches idea={idea} w={w} />
      </Section>

      {(idea.problem || idea.value) && (
        <div id="idea-problem" className={cn('grid gap-4 @page-lg:grid-cols-2', STUDIO_ANCHOR)}>
          {idea.problem && (
            <Section id="idea-problem-p" title={w.sections.problem} icon={Target}>
              <p className="text-body text-pretty text-foreground">
                <Bidi>{idea.problem}</Bidi>
              </p>
            </Section>
          )}
          {idea.value && (
            <Section id="idea-value" title={w.sections.value} icon={Lightbulb}>
              <p className="text-body text-pretty text-foreground">
                <Bidi>{idea.value}</Bidi>
              </p>
            </Section>
          )}
        </div>
      )}

      {idea.diagram && (
        <Section id="idea-diagram" title={idea.diagram.title || w.sections.diagram} icon={Network}>
          <FlowDiagram
            diagram={idea.diagram}
            words={{ shapes: w.shapes, listLabel: w.diagramList, to: w.to, sep: w.listSep }}
          />
        </Section>
      )}

      {idea.findings.length > 0 && (
        <Section id="idea-findings" title={w.sections.findings} icon={Globe}>
          <ul className="grid gap-3 @page-lg:grid-cols-2">
            {idea.findings.map((f, i) => (
              <li
                key={`${f.title}-${i}`}
                className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-background p-3.5"
              >
                <span className="text-body-sm font-semibold text-foreground">
                  <Bidi>{f.title}</Bidi>
                  {f.source && (
                    <a
                      href={`#idea-source-${f.source}`}
                      aria-label={fmt(w.source, { n: num(f.source, locale) })}
                      className={cn(
                        'ms-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary/10 px-1 align-middle text-caption font-bold text-primary tabular-nums hover:bg-primary/20',
                        focusRing,
                      )}
                    >
                      {num(f.source, locale)}
                    </a>
                  )}
                </span>
                <p className="text-caption text-pretty text-muted-foreground">
                  <Bidi>{f.detail}</Bidi>
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {idea.suggestions.length > 0 && (
        <Section id="idea-suggestions" title={w.sections.suggestions} icon={Sparkles}>
          <ul className="grid gap-3 @page-lg:grid-cols-2">
            {idea.suggestions.map((s, i) => {
              const { icon: Icon, tone } = SUGGESTION[s.kind];
              return (
                <li
                  key={`${s.title}-${i}`}
                  className="flex min-w-0 gap-3 rounded-xl border border-border bg-background p-3.5"
                >
                  <span
                    aria-hidden
                    className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tone)}
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-caption font-medium text-muted-foreground">
                      {w.suggestionKinds[s.kind]}
                    </span>
                    <span className="text-body-sm font-semibold text-pretty text-foreground">
                      <Bidi>{s.title}</Bidi>
                    </span>
                    <p className="text-caption text-pretty text-muted-foreground">
                      <Bidi>{s.detail}</Bidi>
                    </p>
                    {onAsk && (
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <button
                          type="button"
                          disabled={blocked}
                          onClick={() => void onAsk(fmt(w.applyPrompt, { title: s.title }))}
                          className={cn(
                            'inline-flex h-7 items-center gap-1 self-start rounded-lg px-2 text-caption font-medium text-primary transition-colors hover:bg-primary/10 disabled:pointer-events-none disabled:text-muted-foreground max-md:h-11',
                            focusRing,
                          )}
                        >
                          <Wand2 aria-hidden className="size-3.5" strokeWidth={1.75} />
                          {busy ? w.applyLater : w.apply}
                        </button>
                        {blocked && <span className="text-caption text-muted-foreground">{w.queueFull}</span>}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {idea.steps.length > 0 && (
        <Section
          id="idea-steps"
          title={w.sections.steps}
          icon={ListOrdered}
          aside={
            <span className="text-caption text-muted-foreground">
              {plural(idea.steps.length, locale, w.stepCount)}
            </span>
          }
        >
          <ProposedSteps steps={idea.steps} />
          <p className="text-caption text-muted-foreground">{w.stepsHint}</p>
        </Section>
      )}

      {idea.risks.length > 0 && (
        <Section id="idea-risks" title={w.sections.risks} icon={AlertTriangle}>
          <ul className="grid min-w-0 list-disc gap-x-8 gap-y-1.5 ps-4 text-body-sm text-foreground marker:text-warning-strong @page-lg:grid-cols-2">
            {idea.risks.map((r) => (
              <li key={r}>
                <Bidi>{r}</Bidi>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {idea.questions.length > 0 && (
        <Section id="idea-questions" title={w.sections.questions} icon={CircleHelp}>
          <Questions
            questions={idea.questions}
            onAsk={onAsk}
            busy={busy}
            blocked={blocked}
            label={w.sections.questions}
          />
        </Section>
      )}

      {idea.sources.length > 0 && (
        <Section id="idea-sources" title={w.sections.sources} icon={FileText}>
          <ol className="flex min-w-0 flex-col gap-2">
            {idea.sources.map((s, i) => (
              <li
                key={`${s.url}-${i}`}
                id={`idea-source-${i + 1}`}
                className={cn('flex min-w-0 items-start gap-2.5', STUDIO_ANCHOR)}
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-bold text-muted-foreground tabular-nums">
                  {num(i + 1, locale)}
                </span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('group flex min-w-0 flex-col rounded-md', focusRing)}
                >
                  <span className="text-body-sm font-medium text-foreground group-hover:text-primary group-hover:underline">
                    <Bidi>{s.title}</Bidi>
                  </span>
                  <span dir="ltr" className="truncate text-start text-caption text-muted-foreground">
                    {hostOf(s.url)}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}
