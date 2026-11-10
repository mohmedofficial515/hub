'use client';

/**
 * @file idea-note.tsx
 * @description `propose_idea`'s report as the thread shows it: its title, the verdict and how much already exists, and a way to the Idea Studio, where the
 * whole report and Accept live. In the studio itself the report is beside the thread, so the note only says it is there.
 */
import type { ProposedIdea } from '@hub/contracts';
import { ArrowUpRight, Lightbulb } from 'lucide-react';

import { Bidi, cn, fmt, focusRing, navigate, num, useLocale, useRoute, useT } from '@/components/kit';
import type { PlanningMessages } from '@/components/planning/messages';

export function IdeaNote({ chatId, idea }: { chatId: string; idea: ProposedIdea }) {
  const w = useT<PlanningMessages>('planning').studio;
  const locale = useLocale();
  const route = useRoute();
  const inStudio = route.view === 'planning' && route.query.get('studio') === 'idea';
  const tone =
    idea.verdict === 'new'
      ? 'bg-success-soft text-success-soft-foreground'
      : idea.verdict === 'partial'
        ? 'bg-warning-soft text-warning-soft-foreground'
        : 'bg-info-soft text-info-soft-foreground';

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-type-idea-soft text-type-idea-fg"
        >
          <Lightbulb className="size-3.5" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-caption font-medium text-muted-foreground">{w.note.title}</span>
          <span className="text-body-sm font-semibold text-pretty text-foreground">
            <Bidi>{idea.title}</Bidi>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-full px-2 text-caption font-semibold',
                tone,
              )}
            >
              {w.verdict[idea.verdict]}
            </span>
            <span className="text-caption text-muted-foreground tabular-nums">
              {fmt(w.overlapLine, { n: num(idea.overlap, locale) })}
            </span>
          </span>
        </div>
      </div>
      {inStudio ? (
        <p className="text-caption text-muted-foreground">{w.note.here}</p>
      ) : (
        <button
          type="button"
          onClick={() =>
            navigate('planning', { query: { studio: 'idea', chat: chatId, plan: null, draft: null } })
          }
          className={cn(
            'inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-lg border border-border px-3 text-caption font-medium text-foreground transition-colors hover:bg-accent max-md:h-10',
            focusRing,
          )}
        >
          {w.note.open}
          <ArrowUpRight aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
