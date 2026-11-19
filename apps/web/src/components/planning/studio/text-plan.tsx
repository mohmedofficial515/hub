'use client';

/**
 * @file text-plan.tsx
 * @description A plan a chat in Plan mode proposed as words only, with no structured plan: the Plan Studio shows it as written, with the same Save, Develop
 * and Run as a structured one. It took the place of Planning's old live draft page (`?draft=1`, owner decision 2026-11-19). Save makes a draft plan card
 * titled by the first line, through the same path as the chat's own plan card, so a save in one shows as saved in the other.
 */
import { CheckCircle2, FileText, Loader2, MessagesSquare, Play, Quote, Route, Save } from 'lucide-react';
import { useState } from 'react';

import {
  Bidi,
  Button,
  cn,
  fmt,
  kitMessages,
  MarkdownView,
  setQuery,
  showToast,
  Tip,
  useT,
} from '@/components/kit';
import { engineBlocks, fillComposer, type Wb } from '@/components/workbench/store';
import { usePlanWords } from '@/features/planning/plan-studio';
import {
  type PlanProposal,
  proposalTitle,
  saveProposal,
  useSavedProposal,
} from '@/features/planning/proposal';
import { isHubError } from '@/lib/api/errors';

import { Panel } from '../detail-parts';
import type { PlanningMessages } from '../messages';
import { STUDIO_ANCHOR } from './shared';

export function TextPlan({
  wb,
  proposal,
  asked,
  busy,
  onDevelop,
}: {
  wb: Wb;
  proposal: PlanProposal;
  asked: string;
  busy: boolean;
  onDevelop: () => void;
}) {
  const t = useT<PlanningMessages>('planning');
  const w = t.draft;
  const p = t.planStudio;
  const kit = useT(kitMessages);
  const saved = useSavedProposal(proposal.id);
  const planText = usePlanWords();
  const [saving, setSaving] = useState(false);
  const off = engineBlocks(wb.engine) ? (wb.engine as 'offline') : null;
  const title = proposalTitle(proposal, w.fallbackTitle);

  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const key = await saveProposal(proposal, w.fallbackTitle, planText);
      showToast({ tone: 'success', message: fmt(w.savedToast, { key }) });
    } catch (error) {
      showToast({ tone: 'error', message: isHubError(error) ? error.message : kit.actionFailed });
    } finally {
      setSaving(false);
    }
  };
  const open = (key: string) => setQuery({ plan: key, studio: null, chat: null }, { replace: false });

  return (
    <div data-studio-text-plan className="flex min-w-0 flex-col gap-4">
      <header
        id="studio-report-head"
        className={cn(
          'flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6',
          STUDIO_ANCHOR,
        )}
      >
        {asked && (
          <p className="flex min-w-0 items-start gap-2 text-caption text-muted-foreground">
            <Quote aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
            <span className="line-clamp-2">
              <span className="font-medium text-foreground">{p.yourTopic}: </span>
              <Bidi>{asked}</Bidi>
            </span>
          </p>
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <span className="inline-flex h-6 items-center gap-1.5 self-start rounded-full bg-type-plan-soft px-2.5 text-caption font-semibold text-type-plan-fg">
            <Route aria-hidden className="size-3.5" strokeWidth={1.75} />
            {p.draftLabel}
          </span>
          <h1 className="text-headline font-bold text-pretty text-foreground">
            <Bidi>{title}</Bidi>
          </h1>
          <p className="text-body-sm text-muted-foreground">{w.proposedHint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {saved ? (
            <>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success-soft px-3 text-body-sm font-medium text-success-soft-foreground">
                <CheckCircle2 aria-hidden className="size-4" strokeWidth={1.75} />
                {fmt(w.saved, { key: saved })}
              </span>
              <Button variant="primary" onClick={() => open(saved)}>
                {p.openPlan}
              </Button>
            </>
          ) : (
            <Button variant="primary" disabled={saving || busy} onClick={() => void save()} data-studio-save>
              {saving ? (
                <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" strokeWidth={1.75} />
              ) : (
                <Save aria-hidden className="size-4" strokeWidth={1.75} />
              )}
              {w.save}
            </Button>
          )}
          <Button variant="outline" onClick={onDevelop}>
            <MessagesSquare aria-hidden className="size-4" strokeWidth={1.75} />
            {p.develop}
          </Button>
          <Tip content={{ what: w.runTip }} off={off} vars={{ device: wb.deviceName }}>
            <Button
              variant="ghost"
              disabled={!!off || !proposal.text.trim()}
              onClick={() => fillComposer(proposal.text, 'execute', { show: true })}
            >
              <Play aria-hidden className="size-4" strokeWidth={2} />
              {w.run}
            </Button>
          </Tip>
        </div>
      </header>

      <Panel title={w.text} icon={FileText} id="studio-text-plan">
        <MarkdownView source={proposal.text} dir="auto" headingOffset={2} />
      </Panel>
    </div>
  );
}
