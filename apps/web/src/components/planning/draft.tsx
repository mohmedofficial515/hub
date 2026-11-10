'use client';

/**
 * @file draft.tsx
 * @description Planning's live draft, at `?draft=1`: the plan a chat in Plan mode is writing, shown as a page while it is written, and the plan its reply
 * proposed once it has. Plan mode cannot write to Hub, so nothing here is a card until the owner saves it. Save lands on the new plan's own page; Develop and
 * Run fill the chat and wait for the owner to send (D51).
 */
import { planToPrompt } from '@hub/contracts';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  ListChecks,
  ListOrdered,
  Loader2,
  Play,
  Save,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

import {
  AppLink,
  Bidi,
  Button,
  cn,
  EmptyState,
  fmt,
  focusRing,
  kitMessages,
  MarkdownView,
  num,
  PageContainer,
  type Role,
  RoleBadge,
  showToast,
  Tip,
  useLocale,
  useT,
} from '@/components/kit';
import { openCardPage } from '@/components/shell/router';
import { engineBlocks, fillComposer, useMaybeWb } from '@/components/workbench/store';
import { proposalTitle, saveProposal, useSavedProposal } from '@/features/planning/proposal';
import { isHubError } from '@/lib/api/errors';

import { LivePill, Panel } from './detail-parts';
import { useLiveDraft } from './live';
import type { PlanningMessages } from './messages';

const ROLES = new Set<string>(['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa']);
const EASE = [0.2, 0.8, 0.2, 1] as const;

function Back() {
  const w = useT<PlanningMessages>('planning').draft;
  const locale = useLocale();
  const Arrow = locale === 'ar' ? ArrowRight : ArrowLeft;
  return (
    <AppLink
      view="planning"
      query={{ draft: null }}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 self-start rounded-lg px-2 text-body-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground max-md:h-11',
        focusRing,
      )}
    >
      <Arrow aria-hidden className="size-4" strokeWidth={1.75} />
      {w.back}
    </AppLink>
  );
}

export function PlanningDraft() {
  const w = useT<PlanningMessages>('planning').draft;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const wb = useMaybeWb();
  const draft = useLiveDraft();
  const reduce = useReducedMotion();
  const savedKey = useSavedProposal(draft?.proposal?.id);
  const [saving, setSaving] = useState(false);
  const off = wb && engineBlocks(wb.engine) ? (wb.engine as 'offline') : null;
  const device = wb?.deviceName ?? '';

  if (!draft) {
    return (
      <PageContainer className="gap-5">
        <Back />
        <EmptyState
          icon={Sparkles}
          title={w.none}
          action={
            wb && (
              <Button
                variant="primary"
                disabled={!!off}
                onClick={() => fillComposer(w.startPrompt, 'plan', { show: true })}
              >
                <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
                {w.start}
              </Button>
            )
          }
        >
          {w.noneBody}
        </EmptyState>
      </PageContainer>
    );
  }

  const { proposal, writing } = draft;
  const structured = proposal?.structured ?? null;
  const title = proposal ? proposalTitle(proposal, w.fallbackTitle) : w.fallbackTitle;

  const save = async () => {
    if (!proposal || saving || savedKey) return;
    setSaving(true);
    try {
      const key = await saveProposal(proposal, w.fallbackTitle);
      showToast({ tone: 'success', message: fmt(w.savedToast, { key }) });
      openCardPage(key);
    } catch (error) {
      showToast({ tone: 'error', message: isHubError(error) ? error.message : kit.actionFailed });
    } finally {
      setSaving(false);
    }
  };
  const runText = structured ? planToPrompt(structured) : (proposal?.text ?? '');

  return (
    <PageContainer className="gap-4 md:gap-5">
      <Back />

      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <Sparkles className="size-5" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex h-5.5 items-center rounded-full bg-muted px-2 text-caption font-medium text-muted-foreground">
                {w.label}
              </span>
              {writing && (
                <span className="ms-auto">
                  <LivePill label={w.writing} hint={w.writingHint} />
                </span>
              )}
            </div>
            <h1 className="text-title font-semibold text-pretty text-foreground">
              <Bidi>{title}</Bidi>
            </h1>
            <p className="text-caption text-muted-foreground">
              {writing ? w.writingHint : proposal ? w.proposedHint : ''}
            </p>
          </div>
        </div>

        {proposal && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {savedKey ? (
              <Button variant="outline" onClick={() => openCardPage(savedKey)}>
                <CheckCircle2
                  aria-hidden
                  className="size-4 text-success-soft-foreground"
                  strokeWidth={1.75}
                />
                {fmt(w.saved, { key: savedKey })}
              </Button>
            ) : (
              <Button variant="primary" disabled={saving} data-draft-save onClick={() => void save()}>
                {saving ? (
                  <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" strokeWidth={1.75} />
                ) : (
                  <Save aria-hidden className="size-4" strokeWidth={1.75} />
                )}
                {w.save}
              </Button>
            )}
            {wb && (
              <>
                <Button
                  variant="outline"
                  disabled={!!off}
                  onClick={() => fillComposer(w.developPrompt, 'plan', { show: true })}
                >
                  <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
                  {w.develop}
                </Button>
                <Tip content={{ what: w.runTip }} off={off} vars={{ device }}>
                  <Button
                    variant="ghost"
                    disabled={!!off || !runText}
                    onClick={() => fillComposer(runText, 'execute', { show: true })}
                  >
                    <Play aria-hidden className="size-4" strokeWidth={2} />
                    {w.run}
                  </Button>
                </Tip>
              </>
            )}
          </div>
        )}
      </header>

      {structured ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } }}
          className="grid items-start gap-5 @page-xl:grid-cols-[minmax(0,1fr)_16.5rem]"
        >
          <Panel title={w.steps} icon={ListOrdered} id="draft-steps">
            <ol className="flex min-w-0 flex-col">
              {structured.steps.map((s, i) => (
                <li key={`${i}-${s.title}`} className="relative flex min-w-0 gap-3 pb-4 last:pb-0">
                  {i < structured.steps.length - 1 && (
                    <span aria-hidden className="absolute start-3.5 top-8 bottom-1 w-px bg-border" />
                  )}
                  <span
                    aria-hidden
                    className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-caption font-semibold text-muted-foreground tabular-nums"
                  >
                    {num(i + 1, locale)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 px-1 pt-0.5">
                    <span className="text-body-sm font-medium text-pretty text-foreground">
                      <Bidi>{s.title}</Bidi>
                    </span>
                    {s.why && (
                      <span className="text-caption text-muted-foreground">
                        <Bidi>{s.why}</Bidi>
                      </span>
                    )}
                    {s.role && ROLES.has(s.role) && (
                      <RoleBadge role={s.role as Role} outline={false} className="self-start text-caption" />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
          <div className="flex min-w-0 flex-col gap-4 @page-xl:sticky @page-xl:top-4">
            {structured.checks && structured.checks.length > 0 && (
              <Panel title={w.checks} icon={ListChecks} id="draft-checks">
                <ul className="flex min-w-0 flex-wrap gap-1.5">
                  {structured.checks.map((c) => (
                    <li key={c} className="min-w-0">
                      <code
                        dir="ltr"
                        translate="no"
                        className="key inline-block max-w-full truncate rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-caption text-foreground"
                      >
                        {c}
                      </code>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            {structured.risks && structured.risks.length > 0 && (
              <Panel title={w.risks} icon={AlertTriangle} id="draft-risks">
                <ul className="flex min-w-0 list-disc flex-col gap-1 ps-4 text-caption text-foreground marker:text-warning-strong">
                  {structured.risks.map((r) => (
                    <li key={r}>
                      <Bidi>{r}</Bidi>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </motion.div>
      ) : (
        <Panel
          title={proposal ? w.text : w.reply}
          icon={FileText}
          id="draft-text"
          aside={writing && <Loader2 aria-hidden className="size-4 text-primary motion-safe:animate-spin" />}
        >
          {proposal?.text || draft.text ? (
            <div aria-busy={writing}>
              <MarkdownView source={proposal?.text ?? draft.text} dir="auto" headingOffset={2} />
            </div>
          ) : (
            <div className="flex flex-col gap-2" aria-hidden>
              <span className="h-3 w-3/4 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
              <span className="h-3 w-2/3 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
              <span className="h-3 w-1/2 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            </div>
          )}
        </Panel>
      )}
    </PageContainer>
  );
}
