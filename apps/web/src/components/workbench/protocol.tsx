'use client';

/**
 * @file protocol.tsx
 * @description What a turn ends in: the live checklist, a plan, a report with verified apart from claimed, a question, and a doc draft with its flags and duplicates (docs/16 §7.1, §7.2). Ported from the approved design, `apps/lab/hub/workbench/v6-edge-strip-port/core/protocol.tsx`.
 */
import type { CheckRun, DocDuplicate, ReportedCheck, WorkReport } from '@hub/contracts';
import { CARD_LIMITS, hasNoTimeLimit, openFlags, planToMarkdown, planToPrompt } from '@hub/contracts';
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleSlash,
  ClipboardList,
  FileText,
  GitMerge,
  ListChecks,
  Loader2,
  MessageSquareWarning,
  MoveRight,
  PenLine,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Bidi,
  Button,
  cn,
  createCard,
  fmt,
  focusRing,
  kitMessages,
  Ltr,
  MarkdownView,
  navigate,
  openCard,
  plural,
  type Role,
  RoleBadge,
  showToast,
  Tip,
  useLocale,
  useRoute,
  useRoving,
  useT,
} from '@/components/kit';
import { ScheduleDialog, useQueueWords } from '@/components/queue/run-bits';
import {
  claimsWith,
  conflictLines,
  draftLines,
  lastEditAt,
  type StageState,
} from '@/features/chat/thread-items';
import { useRestoreDocRevision } from '@/features/docs/queries';
import { isHubError } from '@/lib/api/errors';

import {
  answerQuestion,
  declineQuestion,
  discardDraft,
  engineBlocks,
  fillComposer,
  type Item,
  markRestored,
  redraft,
  revealStep,
  saveDraft,
  send,
  setClaimAnswer,
  setMode,
  setPlanAside,
  useMaybeWb,
  useWb,
} from './store';
import { clockOf, DiffView, duration } from './thread';
import type { ChatMessages, PanelWords } from './words';

type Report = WorkReport;
const CARD_TITLE_MAX = CARD_LIMITS.title;
const counted = (n: number, locale: 'ar' | 'en', forms: Parameters<typeof plural>[2]) =>
  fmt(plural(n, locale, forms), { n });
const stageName = (t: PanelWords, id: string) => (t.pro.stages as Record<string, string>)[id] ?? id;
/** The reason a control is off, while the engine cannot run anything. */
const offOf = (engine: Parameters<typeof engineBlocks>[0]) =>
  engineBlocks(engine) ? (engine as 'offline') : null;

const stageIcon: Record<StageState, typeof Circle> = {
  pending: Circle,
  running: Loader2,
  done: CheckCircle2,
  failed: AlertTriangle,
  skipped: CircleSlash,
};
const stageTone: Record<StageState, string> = {
  pending: 'text-muted-foreground',
  running: 'text-foreground motion-safe:animate-spin',
  done: 'text-success-soft-foreground',
  failed: 'text-destructive-soft-foreground',
  skipped: 'text-muted-foreground',
};

/**
 * The live checklist on a turn. While work runs it is one line per stage. Once every stage is done it folds to one line, "5 of 5 stages", which opens on a press, so a finished
 * protocol does not stand above the report it led to. The rows are one Tab stop with arrows between them, not five stops only there to carry a tooltip.
 */
export function ProtocolCard({ item }: { item: Extract<Item, { kind: 'protocol' }> }) {
  const t = useT<ChatMessages>('chat').panel;
  const p = t.pro.protocol;
  const failed = item.stages.find((g) => g.state === 'failed');
  const doneCount = item.stages.filter((g) => g.state === 'done').length;
  const allDone = doneCount === item.stages.length;
  const [open, setOpen] = useState(false);
  const shown = !allDone || open;
  const running = item.stages.findIndex((g) => g.state === 'running');
  const { root, groupProps, itemProps } = useRoving(Math.max(0, running));
  const label = item.protocol === 'work' ? p.task : p.doc;
  const Icon = item.protocol === 'work' ? ListChecks : FileText;
  return (
    <section
      aria-label={label}
      data-wb-protocol={item.protocol}
      data-wb-protocol-folded={!shown}
      className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2"
    >
      {allDone ? (
        <button
          type="button"
          data-wb-protocol-toggle
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn('flex min-w-0 items-center gap-2 rounded-sm text-start max-md:min-h-11', focusRing)}
        >
          <Icon aria-hidden className="size-4 shrink-0 text-success-soft-foreground" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 text-body-sm font-medium text-foreground">
            {fmt(p.finished, { n: doneCount, total: item.stages.length })}
          </span>
          <Ltr mono className="min-w-0 truncate text-body-sm text-muted-foreground">
            {item.target}
          </Ltr>
          <ChevronDown
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-120',
              open && 'rotate-180',
            )}
            strokeWidth={1.75}
          />
        </button>
      ) : (
        <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <h3 className="text-body font-semibold text-foreground">{label}</h3>
          <Ltr mono className="min-w-0 truncate text-body-sm text-muted-foreground">
            {item.target}
          </Ltr>
        </header>
      )}
      {shown && (
        <div ref={root} role="group" aria-label={label} {...groupProps}>
          <ol className="flex flex-col gap-0.5">
            {item.stages.map((g, i) => {
              const StageIcon = stageIcon[g.state];
              return (
                <li key={g.id} data-wb-stage={g.id} data-wb-stage-state={g.state}>
                  <Tip k="stage" facts={[[t.pro.factLabels.state, p.states[g.state]]]} align="start">
                    <div
                      {...itemProps(i)}
                      className={cn('flex min-w-0 items-start gap-2 rounded-sm px-1 py-0.5', focusRing)}
                    >
                      <StageIcon
                        aria-hidden
                        className={cn('mt-0.5 size-4 shrink-0', stageTone[g.state])}
                        strokeWidth={2}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-body-sm',
                            g.state === 'running' || g.state === 'failed'
                              ? 'font-semibold text-foreground'
                              : g.state === 'done'
                                ? 'text-foreground'
                                : 'text-muted-foreground',
                          )}
                        >
                          {stageName(t, g.id)}
                          <span className="sr-only"> ({p.states[g.state]})</span>
                        </p>
                        {g.note && (
                          <p
                            className={cn(
                              'text-body-sm',
                              g.state === 'failed'
                                ? 'text-destructive-soft-foreground'
                                : 'text-muted-foreground',
                            )}
                          >
                            <MarkInline text={g.note} />
                          </p>
                        )}
                      </div>
                    </div>
                  </Tip>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {failed && (
        <p role="status" data-wb-stopped-at className="text-body-sm font-medium text-foreground">
          {fmt(p.stoppedAt, { stage: stageName(t, failed.id) })}
        </p>
      )}
    </section>
  );
}

/** Backticks in a line read as code, LTR. */
export function MarkInline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('`') ? (
          <code key={i} dir="ltr" translate="no" className="key [overflow-wrap:anywhere]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/**
 * What a Plan turn ends in (`propose_plan`, §7.2). Its one strong action is running it. When the plan came only as reply text, it shows as text and can still be run.
 * The steps read as a numbered line, each with its reason and role; the checks and the risks sit in their own quiet blocks under it, and the actions in a footer.
 */
export function PlanCard({ item }: { item: Extract<Item, { kind: 'plan' }> }) {
  const t = useT<ChatMessages>('chat').panel;
  const locale = useLocale();
  const wb = useWb();
  const kit = useT(kitMessages);
  const p = t.pro.plan;
  const { structured } = item;
  const off = offOf(wb.engine);
  const device = wb.deviceName;
  const aside = !!wb.plansAside[item.id];
  const [scheduling, setScheduling] = useState(false);
  const q = useQueueWords();
  // `planToPrompt`: what Run this plan sends, visible in the composer until the owner sends it (D51).
  const prompt = structured ? planToPrompt(structured) : `${p.promptText}\n\n${item.text}`;
  const steps = structured?.steps.length ?? 0;
  /** The plan card this proposal became, once saved to Planning. */
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * Save to Planning: a draft plan card through the same create path as New plan. The steps keep their titles and a role Hub knows; the whole proposal, with each
   * step's reason, the checks and the risks, is the plan's text. A plan that came only as words is saved as its text, titled by its first line.
   */
  const saveToPlanning = async () => {
    if (saving || savedKey) return;
    setSaving(true);
    const cap = (text: string) => text.trim().slice(0, CARD_TITLE_MAX);
    const firstLine =
      item.text
        .split('\n')
        .find((line) => line.trim())
        ?.replace(/^#+\s*/, '') ?? '';
    try {
      const card = await createCard(
        structured
          ? {
              type: 'plan',
              title: cap(structured.title),
              body: planToMarkdown(structured),
              detail: {
                steps: structured.steps.map((s) => ({
                  title: cap(s.title),
                  ...(s.role && s.role in kit.roles ? { role: s.role as Role } : {}),
                })),
              },
            }
          : { type: 'plan', title: cap(firstLine) || p.title, body: item.text, detail: { steps: [] } },
      );
      setSavedKey(card.key);
      showToast({
        tone: 'success',
        message: fmt(p.savedToast, { key: card.key }),
        action: { label: p.openSaved, onSelect: () => openCard(card.key) },
      });
    } catch (error) {
      showToast({ tone: 'error', message: isHubError(error) ? error.message : kit.actionFailed });
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      aria-label={p.title}
      data-wb-plan={structured ? 'structured' : 'text'}
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm"
    >
      <header className="flex min-w-0 items-start gap-2.5 border-b border-border bg-muted/40 px-3 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ClipboardList aria-hidden className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-medium text-muted-foreground">{p.title}</p>
          {structured && (
            <h3 className="text-body-sm font-semibold text-foreground">
              <Bidi>{structured.title}</Bidi>
            </h3>
          )}
        </div>
        {structured && (
          <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-caption text-muted-foreground tabular-nums">
            {fmt(p.stepsCount, { n: steps })}
          </span>
        )}
      </header>

      <div className="flex min-w-0 flex-col gap-3 px-3 py-2.5">
        {structured && (
          <ol data-wb-plan-steps className="flex min-w-0 flex-col">
            {structured.steps.map((s, i) => (
              <li key={s.title} className="relative flex min-w-0 items-start gap-2.5 pb-2.5 last:pb-0">
                {i < steps - 1 && (
                  <span aria-hidden className="absolute start-3 top-6 bottom-0 w-px bg-border" />
                )}
                <span
                  aria-hidden
                  className="relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-caption font-semibold text-muted-foreground tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="block text-body-sm font-medium text-foreground">
                    <Bidi>{s.title}</Bidi>
                  </span>
                  {s.why && <span className="block text-caption text-muted-foreground">{s.why}</span>}
                </span>
                {s.role && s.role in kit.roles && (
                  <RoleBadge role={s.role as Role} iconOnly className="mt-0.5 shrink-0" />
                )}
              </li>
            ))}
          </ol>
        )}
        {!structured && (
          <div className="flex min-w-0 flex-col gap-1">
            <div className="wb-prose min-w-0 text-body-sm text-foreground">
              <MarkdownView source={item.text} dir="auto" headingOffset={2} />
            </div>
            <p className="text-caption text-muted-foreground">{p.asText}</p>
          </div>
        )}
        {structured?.checks && structured.checks.length > 0 && (
          <div className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-2">
            <p className="inline-flex items-center gap-1.5 text-caption font-semibold text-muted-foreground">
              <ListChecks aria-hidden className="size-3.5" strokeWidth={1.75} />
              {p.checks}
            </p>
            <ul className="flex min-w-0 flex-wrap gap-1">
              {structured.checks.map((c) => (
                <li key={c} className="min-w-0">
                  <code
                    dir="ltr"
                    translate="no"
                    className="key inline-block max-w-full truncate rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-caption text-foreground"
                  >
                    {c}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        )}
        {structured?.risks && structured.risks.length > 0 && (
          <div
            data-wb-plan-risks
            className="flex min-w-0 flex-col gap-1 rounded-md border border-warning/30 bg-warning-soft/40 px-2.5 py-2"
          >
            <p className="inline-flex items-center gap-1.5 text-caption font-semibold text-warning-soft-foreground">
              <AlertTriangle aria-hidden className="size-3.5" strokeWidth={1.75} />
              {p.risks}
            </p>
            <ul className="flex min-w-0 list-disc flex-col gap-0.5 ps-5 text-caption text-foreground marker:text-warning-strong">
              {structured.risks.map((r) => (
                <li key={r}>
                  <Bidi>{r}</Bidi>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <footer className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
        {!aside ? (
          <>
            <Tip
              k="plan:run"
              off={off}
              vars={{
                device,
                time: clockOf(wb.resetsAt ? new Date(wb.resetsAt).toISOString() : null, locale),
              }}
              label={p.run}
            >
              <Button
                variant="primary"
                size="sm"
                data-wb-plan-run
                disabled={!!off}
                onClick={() => fillComposer(prompt, 'execute')}
              >
                <Play aria-hidden className="size-3.5" strokeWidth={2} />
                {p.run}
              </Button>
            </Tip>
            {savedKey ? (
              <button
                type="button"
                data-wb-plan-saved={savedKey}
                onClick={() => openCard(savedKey)}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-caption font-medium text-success-soft-foreground hover:bg-accent max-md:min-h-11',
                  focusRing,
                )}
              >
                <CheckCircle2 aria-hidden className="size-3.5" strokeWidth={1.75} />
                {fmt(p.saved, { key: savedKey })}
                <ArrowUpRight aria-hidden className="size-3 rtl:-scale-x-100" strokeWidth={1.75} />
              </button>
            ) : (
              <Tip k="plan:save">
                <Button
                  variant="ghost"
                  size="sm"
                  data-wb-plan-save
                  disabled={saving}
                  onClick={() => void saveToPlanning()}
                >
                  {saving ? (
                    <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Save aria-hidden className="size-3.5" strokeWidth={1.75} />
                  )}
                  {p.save}
                </Button>
              </Tip>
            )}
            <Tip k="queue:schedule">
              <Button variant="ghost" size="sm" data-wb-plan-schedule onClick={() => setScheduling(true)}>
                <CalendarClock aria-hidden className="size-3.5" strokeWidth={1.75} />
                {q.schedule}
              </Button>
            </Tip>
            <span className="flex-1" />
            <Tip k="plan:aside">
              <Button variant="ghost" size="sm" data-wb-plan-aside onClick={() => setPlanAside(item.id)}>
                {p.aside}
              </Button>
            </Tip>
            <ScheduleDialog
              target={scheduling ? { source: 'prompt', prompt, title: structured?.title ?? p.title } : null}
              onClose={() => setScheduling(false)}
            />
          </>
        ) : (
          <p
            role="status"
            className="inline-flex items-center gap-1.5 text-caption font-medium text-foreground"
          >
            <Check aria-hidden className="size-3.5 text-muted-foreground" />
            {p.asided}
          </p>
        )}
      </footer>
    </section>
  );
}

// A call, not a copy: thread.tsx and this file import each other, so `clockOf` is not defined yet while this module first runs.
const clock = (...args: Parameters<typeof clockOf>) => clockOf(...args);

/** A check's standing, in the words the section asks for: verified against a real step, or only claimed. */
function checkStanding(c: ReportedCheck) {
  if (c.outcome === 'failed') return 'failed' as const;
  if (c.outcome === 'skipped') return 'skipped' as const;
  return c.verified ? ('verified' as const) : ('claimed' as const);
}

const standingIcon = {
  verified: ShieldCheck,
  claimed: MessageSquareWarning,
  failed: AlertTriangle,
  skipped: CircleSlash,
};
const standingTone = {
  verified: 'text-success-soft-foreground',
  claimed: 'text-warning-strong',
  failed: 'text-destructive-soft-foreground',
  skipped: 'text-muted-foreground',
};

/** One check. `runs` is the server's list of every real run, oldest first, so a failure that was fixed stays visible, and `basis` says why a claim could not be verified. */
function CheckRow({
  check,
  chatId,
  editedAt,
}: {
  check: ReportedCheck;
  chatId: string | null;
  editedAt: string | null;
}) {
  const t = useT<ChatMessages>('chat').panel;
  const locale = useLocale();
  const r = t.pro.report;
  const standing = checkStanding(check);
  const { runs } = check;
  const failedRuns = runs.filter((x) => x.status === 'failed').length;
  const recovered = standing === 'verified' && failedRuns > 0;
  // Hub has the order of steps: a check whose last run came before an edit has not seen that edit (review M3). Client-side, and not a server field.
  const lastRun: CheckRun | undefined = runs[runs.length - 1];
  const editedAfter = !!lastRun && !!editedAt && editedAt > lastRun.startedAt;
  const [open, setOpen] = useState(standing !== 'verified' && standing !== 'skipped');
  const Icon = standingIcon[standing];
  const word = standing === 'failed' ? r.failed : standing === 'skipped' ? r.skipped : r[standing];
  const bases = r.basis as Record<string, string | undefined>;
  return (
    <li data-wb-check={standing} data-wb-check-basis={check.basis} className="flex min-w-0 flex-col gap-1">
      <Tip k="evidence:check" align="start" side="bottom">
        <button
          type="button"
          aria-expanded={open}
          data-wb-check-toggle
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex min-h-11 w-full min-w-0 flex-wrap items-center gap-x-2 rounded-sm px-1 text-start text-body-sm hover:bg-accent md:min-h-7',
            focusRing,
          )}
        >
          <Icon aria-hidden className={cn('size-4 shrink-0', standingTone[standing])} strokeWidth={2} />
          <code dir="ltr" translate="no" className="key min-w-0 flex-1 truncate text-start text-foreground">
            {check.command ?? check.name}
          </code>
          <span
            className={cn(
              'shrink-0 font-medium',
              standing === 'verified' ? 'text-muted-foreground' : standingTone[standing],
            )}
          >
            {word}
          </span>
          <ChevronDown
            aria-hidden
            className={cn('size-3.5 shrink-0 text-muted-foreground', open && 'rotate-180')}
            strokeWidth={1.75}
          />
        </button>
      </Tip>
      {recovered && (
        <p data-wb-check-recovered className="ps-7 text-body-sm text-foreground">
          {failedRuns === 1
            ? fmt(r.failedOnce, { n: runs.length })
            : fmt(r.failedTimes, { failed: failedRuns, n: runs.length })}
        </p>
      )}
      {editedAfter && (
        <p data-wb-edits-after className="ps-7 text-body-sm text-foreground">
          {r.editsAfter}
        </p>
      )}
      {open && (
        <div data-wb-check-detail className="flex min-w-0 flex-col gap-1.5 ps-7">
          {bases[check.basis] && <p className="text-body-sm text-muted-foreground">{bases[check.basis]}</p>}
          {check.note && (
            <p className="text-body-sm text-muted-foreground">
              <Bidi>{check.note}</Bidi>
            </p>
          )}
          {runs.length > 0 && (
            <ul data-wb-check-runs aria-label={r.runs} className="flex min-w-0 flex-col gap-1">
              {runs.map((run, i) => (
                <li key={run.stepId} data-wb-check-run={run.status} className="flex min-w-0 flex-col gap-0.5">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {fmt(r.runAt, { n: i + 1, time: clock(run.startedAt, locale) })}
                    </span>
                    <span
                      className={
                        run.status === 'failed'
                          ? 'text-destructive-soft-foreground'
                          : run.status === 'passed'
                            ? undefined
                            : 'text-warning-strong'
                      }
                    >
                      {r.runStatus[run.status]}
                    </span>
                    {run.endedAt && (
                      <span className="tabular-nums">
                        {duration(Date.parse(run.endedAt) - Date.parse(run.startedAt), t)}
                      </span>
                    )}
                    {chatId && (
                      <button
                        type="button"
                        data-wb-go-step
                        onClick={() => revealStep(chatId, run.stepId)}
                        className={cn(
                          'inline-flex items-center gap-0.5 rounded-sm underline underline-offset-2 hover:text-foreground max-md:min-h-11',
                          focusRing,
                        )}
                      >
                        {t.pro.step.goTo}
                        <ArrowUpRight aria-hidden className="size-3 rtl:-scale-x-100" strokeWidth={1.75} />
                      </button>
                    )}
                  </p>
                  {run.excerpt && (
                    <pre
                      dir="ltr"
                      translate="no"
                      tabIndex={0}
                      className="key max-h-48 overflow-auto rounded-md bg-muted p-2 text-start text-body-sm whitespace-pre-wrap text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {run.excerpt}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function checksLine(report: Report, t: PanelWords) {
  const r = t.pro.report;
  const { total, verified, failed, passed } = report.counts;
  if (failed) return fmt(r.summary.failed, { failed, total });
  if (verified === total) return fmt(r.summary.verifiedAll, { n: verified, total });
  return fmt(r.summary.some, { verified, total, claimed: passed - verified });
}

/** What the reason for no move names: the checks that held it, from the report itself. */
export function moveText(report: Report, t: PanelWords) {
  const { reason } = report.move;
  const held =
    reason === 'check_dropped'
      ? report.droppedChecks
      : report.checks
          .filter((c) => (reason === 'check_not_passed' ? c.outcome !== 'passed' : !c.verified))
          .map((c) => c.command ?? c.name);
  return fmt((t.pro.report.stays as Record<string, string>)[reason] ?? '', {
    names: held.map((n) => `\`${n}\``).join(t.listSeparator),
  });
}

/** What the server did with the report (D52): the move in plain words, or the reason there was none. */
function MoveLine({ report }: { report: Report }) {
  const t = useT<ChatMessages>('chat').panel;
  const r = t.pro.report;
  if (report.move.moved) {
    return (
      <p data-wb-moved className="flex items-start gap-1.5 text-body-sm font-medium text-foreground">
        <MoveRight
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-success-soft-foreground rtl:-scale-x-100"
          strokeWidth={1.75}
        />
        <span>{r.moved}</span>
      </p>
    );
  }
  return (
    <p
      data-wb-stays={report.move.reason}
      className="flex items-start gap-1.5 text-body-sm font-medium text-foreground"
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" strokeWidth={1.75} />
      <span>
        <MarkInline text={moveText(report, t)} />
      </span>
    </p>
  );
}

/** `report.refused`: a report that said a failed step passed. The whole of it was refused, so nothing reached the card, and Claude has to correct it. */
export function RefusedNote({ item }: { item: Extract<Item, { kind: 'refused' }> }) {
  const t = useT<ChatMessages>('chat').panel;
  return (
    <section
      aria-label={t.pro.report.refusedLabel}
      data-wb-report-refused
      className="flex min-w-0 items-start gap-2 rounded-lg border border-border bg-card p-3 text-body-sm font-medium text-foreground"
    >
      <Ban
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-destructive-soft-foreground"
        strokeWidth={1.75}
      />
      <span className="min-w-0">
        <MarkInline
          text={fmt(t.pro.report.refused, {
            names: item.checks.map((c) => `\`${c.name}\``).join(t.listSeparator),
          })}
        />
      </span>
    </section>
  );
}

/** The report body, the same on the turn and on the card. Files and every passing check fold, so what is left to read is what is not settled. */
export function ReportBody({ report, withSummary = true }: { report: Report; withSummary?: boolean }) {
  const t = useT<ChatMessages>('chat').panel;
  const locale = useLocale();
  const r = t.pro.report;
  const [filesOpen, setFilesOpen] = useState(false);
  const files = report.changedFiles;
  // Every check verified on its first run: nothing to read, so they fold to the line that says so. A failure that was fixed stays open, because it is the part worth reading.
  const settled =
    report.counts.total > 0 &&
    report.counts.verified === report.counts.total &&
    report.counts.failedRuns === 0;
  const [checksOpen, setChecksOpen] = useState(false);
  const wb = useMaybeWb();
  const editedAt = wb?.chat && wb.chat.id === report.chatId ? lastEditAt(wb.chat.raw) : null;
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {withSummary && (
        <p data-wb-claude-says className="text-body text-foreground">
          <span className="text-muted-foreground">{r.claudeSays}: </span>
          <Bidi>{report.summary}</Bidi>
        </p>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        {settled ? (
          <button
            type="button"
            data-wb-checks-toggle
            data-wb-checks-line
            aria-expanded={checksOpen}
            onClick={() => setChecksOpen((v) => !v)}
            className={cn(
              'flex w-fit items-center gap-1.5 rounded-sm text-start text-body-sm font-medium text-foreground hover:bg-accent max-md:min-h-11',
              focusRing,
            )}
          >
            <ShieldCheck
              aria-hidden
              className="size-4 shrink-0 text-success-soft-foreground"
              strokeWidth={2}
            />
            {r.checks}: {checksLine(report, t)}
            <ChevronDown
              aria-hidden
              className={cn('size-3.5 shrink-0 text-muted-foreground', checksOpen && 'rotate-180')}
              strokeWidth={1.75}
            />
          </button>
        ) : (
          <h4 data-wb-checks-line className="text-body-sm font-medium text-muted-foreground">
            {r.checks}: {checksLine(report, t)}
          </h4>
        )}
        {report.counts.verified > 0 && (
          <p data-wb-limit className="text-body-sm text-muted-foreground">
            {r.limit}
          </p>
        )}
        {(!settled || checksOpen) && (
          <ul className="flex min-w-0 flex-col gap-0.5">
            {report.checks.map((c) => (
              <CheckRow key={c.name} check={c} chatId={report.chatId} editedAt={editedAt} />
            ))}
          </ul>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h4 className="text-body-sm font-medium text-muted-foreground">{r.notChecked}</h4>
        {report.notChecked.length ? (
          <ul className="flex list-inside list-disc flex-col gap-0.5 text-body-sm text-foreground">
            {report.notChecked.map((n) => (
              <li key={n}>
                <MarkInline text={n} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-muted-foreground">{r.nothingListed}</p>
        )}
      </div>
      {files.length > 0 && (
        <div className="flex min-w-0 flex-col gap-0.5">
          <button
            type="button"
            data-wb-report-files
            aria-expanded={filesOpen}
            onClick={() => setFilesOpen((v) => !v)}
            className={cn(
              'inline-flex w-fit items-center gap-1.5 rounded-sm text-body-sm font-medium text-muted-foreground hover:text-foreground max-md:min-h-11',
              focusRing,
            )}
          >
            {r.files}: {counted(files.length, locale, r.filesCount)}
            <ChevronDown
              aria-hidden
              className={cn('size-3.5 shrink-0', filesOpen && 'rotate-180')}
              strokeWidth={1.75}
            />
          </button>
          {filesOpen && report.filesFrom === 'claimed' && (
            <p data-wb-files-claimed className="text-body-sm text-muted-foreground">
              {r.filesClaimed}
            </p>
          )}
          {filesOpen && (
            <ul className="flex min-w-0 flex-col gap-0.5 text-body-sm">
              {files.map((f) => (
                <li key={f.path} className="flex min-w-0 items-center gap-2 px-1">
                  <code
                    dir="ltr"
                    translate="no"
                    className="key min-w-0 flex-1 text-start wrap-anywhere text-foreground"
                  >
                    {f.path}
                  </code>
                  {f.additions !== undefined && (
                    <span dir="ltr" className="shrink-0 text-success-soft-foreground tabular-nums">
                      +{f.additions}
                    </span>
                  )}
                  {f.deletions !== undefined && (
                    <span dir="ltr" className="shrink-0 text-destructive-soft-foreground tabular-nums">
                      −{f.deletions}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ReportCard({ report }: { report: Report }) {
  const t = useT<ChatMessages>('chat').panel;
  const { cardKey } = useRoute();
  const r = t.pro.report;
  const finished = report.move.moved;
  const unfinished = report.counts.failed > 0;
  return (
    <section
      aria-label={fmt(r.title, { key: report.cardKey })}
      data-wb-report={unfinished ? 'partial' : finished ? 'moved' : 'stays'}
      className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3"
    >
      <header className="flex min-w-0 flex-wrap items-center gap-2">
        <ListChecks
          aria-hidden
          className={cn('size-5 shrink-0', finished ? 'text-success-soft-foreground' : 'text-warning-strong')}
          strokeWidth={1.75}
        />
        <h3 className="min-w-0 text-body-lg font-semibold text-foreground">
          {fmt(unfinished ? r.partialTitle : r.title, { key: report.cardKey })}
        </h3>
      </header>
      <MoveLine report={report} />
      <ReportBody report={report} />
      {/* The card itself is open beside this one, so a link to it would do nothing visible (review's table). */}
      {cardKey !== report.cardKey && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          <Tip k="report:open">
            <Button size="sm" data-wb-report-open onClick={() => openCard(report.cardKey)}>
              <ArrowUpRight aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
              {fmt(r.open, { key: report.cardKey })}
            </Button>
          </Tip>
        </div>
      )}
    </section>
  );
}

/** Claude's own convention: a label says it is recommended. Hub fills nothing on its own opinion. */
const RECOMMENDED = /\((Recommended|موصى به)\)/i;

/** A doc the server's check found: a link that opens it, and one line of what it shares. */
function DuplicateList({ duplicates }: { duplicates: DocDuplicate[] }) {
  const t = useT<ChatMessages>('chat').panel;
  return (
    <ul data-wb-duplicates aria-label={t.pro.draft.duplicates} className="flex min-w-0 flex-col gap-1.5">
      {duplicates.map((d) => (
        <li key={d.path} className="flex min-w-0 flex-col gap-0.5 rounded-md bg-muted p-2">
          <button
            type="button"
            data-wb-duplicate-link
            onClick={() => navigate('docs', { query: { doc: d.key } })}
            className={cn(
              'inline-flex w-fit max-w-full items-center gap-1 rounded-sm text-start text-body-sm font-medium text-foreground underline underline-offset-2 hover:no-underline max-md:min-h-11',
              focusRing,
            )}
          >
            <FileText aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
            <span dir="ltr" translate="no" className="key min-w-0 [overflow-wrap:anywhere]">
              {d.path}
            </span>
          </button>
          {d.overlap && (
            <p className="text-body-sm text-muted-foreground">
              <Bidi>{d.overlap}</Bidi>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** What an option label says beyond its words: the "(Recommended)" mark shows as a badge, so the label reads without it. The answer still carries the full label. */
const bareLabel = (label: string) => label.replace(RECOMMENDED, '').trim();

/** A radio dot or a checkbox, as the question allows. */
function PickMark({ multi, on }: { multi: boolean; on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 flex size-4 shrink-0 items-center justify-center border transition-colors duration-120',
        multi ? 'rounded-sm' : 'rounded-full',
        on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
      )}
    >
      {on &&
        (multi ? (
          <Check className="size-3" strokeWidth={3} />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        ))}
    </span>
  );
}

/**
 * `question.asked`. While it waits it docks above the message box (`QuestionDock`), one question at a time: several questions are tabs, each tab marked once answered, with Back and Next, and the
 * send button counts what is answered. Each question takes its options, several where Claude allows more than one, and an answer of the owner's own words under "Other". A lone single-choice
 * question answers on the press. Answered through the approval route, keyed by the question's text, with several picks joined by commas. Closed, it folds to its answers, inline in the thread.
 */
export function QuestionCard({
  chatId,
  item,
}: {
  chatId: string;
  item: Extract<Item, { kind: 'question' }>;
}) {
  const t = useT<ChatMessages>('chat').panel;
  const locale = useLocale();
  const wb = useWb();
  const q = t.pro.question;
  const { question, stoppedBy } = item;
  const off = offOf(wb.engine);
  const device = wb.deviceName;
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  /** The owner's own answer per question. A key that is present means the box is open. */
  const [own, setOwn] = useState<Record<string, string>>({});
  const [tab, setTab] = useState(0);
  const all = question.questions;
  const first = all[0];
  if (!first) return null;
  const title = first.header ?? first.text;
  const joiner = locale === 'ar' ? '، ' : ', ';

  if (question.status !== 'pending') {
    const said = question.answers ?? {};
    const answered = question.status === 'answered' || question.status === 'auto_answered';
    const closedText =
      question.status === 'answered'
        ? fmt(t.pro.choice.chosen, { what: Object.values(said).join(joiner) })
        : question.status === 'auto_answered'
          ? fmt(q.autoAnswered, { what: Object.values(said).join(joiner) })
          : question.status === 'declined'
            ? q.declined
            : question.status === 'timed_out'
              ? q.timedOut
              : q.stopped[stoppedBy];
    return (
      <section
        aria-label={title}
        data-wb-question-answered
        data-wb-question-status={question.status}
        className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2"
      >
        <p className="flex items-start gap-2 text-caption text-muted-foreground">
          <MessageSquareWarning
            aria-hidden
            className={cn(
              'mt-px size-3.5 shrink-0',
              answered ? 'text-warning-strong' : 'text-muted-foreground',
            )}
            strokeWidth={1.75}
          />
          <span className="min-w-0">{all.length > 1 ? fmt(q.several, { n: all.length }) : title}</span>
        </p>
        {answered && all.length > 1 ? (
          <dl role="status" className="flex min-w-0 flex-col gap-1 text-body-sm">
            {all.map((x, i) => (
              <div key={x.text} className="flex min-w-0 items-start gap-1.5">
                <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-soft-foreground" />
                <dt className="shrink-0 text-muted-foreground">{x.header ?? fmt(q.nth, { n: i + 1 })}:</dt>
                <dd className="min-w-0 font-medium text-foreground">
                  <Bidi>{said[x.text] || q.noAnswer}</Bidi>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p
            role="status"
            className="inline-flex items-start gap-1.5 text-body-sm font-medium text-foreground"
          >
            {answered ? (
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-soft-foreground" />
            ) : (
              <Ban aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0">{closedText}</span>
          </p>
        )}
      </section>
    );
  }

  const total = all.length;
  const at = Math.min(tab, total - 1);
  const current = all[at] ?? first;
  const key = (x: (typeof all)[number]) => x.text;
  const answerOf = (x: (typeof all)[number]) => {
    const typed = (own[key(x)] ?? '').trim();
    return [...(picked[key(x)] ?? []), ...(typed ? [typed] : [])];
  };
  const isDone = (x: (typeof all)[number]) => answerOf(x).length > 0;
  const doneCount = all.filter(isDone).length;
  const complete = doneCount === total;
  /** A lone single-choice question: a press on an option is the answer. */
  const quick = total === 1 && !first.multiSelect;
  const submit = () => {
    if (!complete || off) return;
    answerQuestion(
      chatId,
      question.id,
      Object.fromEntries(all.map((x) => [key(x), answerOf(x).join(joiner)])),
    );
  };
  const next = () => setTab((n) => Math.min(n + 1, total - 1));
  const pick = (label: string) => {
    if (quick) return answerQuestion(chatId, question.id, { [key(current)]: label });
    const k = key(current);
    if (current.multiSelect) {
      setPicked((now) => {
        const had = now[k] ?? [];
        return { ...now, [k]: had.includes(label) ? had.filter((l) => l !== label) : [...had, label] };
      });
      return;
    }
    // One choice: an option replaces the owner's own words, and the next question opens.
    setPicked((now) => ({ ...now, [k]: [label] }));
    setOwn(({ [k]: _dropped, ...rest }) => rest);
    if (at < total - 1) window.setTimeout(next, 160);
  };
  const ownOpen = key(current) in own;
  const ownText = own[key(current)] ?? '';
  const toggleOwn = () => {
    const k = key(current);
    if (ownOpen) return setOwn(({ [k]: _dropped, ...rest }) => rest);
    setOwn((now) => ({ ...now, [k]: '' }));
    if (!current.multiSelect) setPicked(({ [k]: _dropped, ...rest }) => rest);
  };
  const sendOwn = () => {
    const typed = ownText.trim();
    if (!typed || off) return;
    if (quick) return answerQuestion(chatId, question.id, { [key(current)]: typed });
    if (at < total - 1) next();
    else submit();
  };

  return (
    <section
      aria-label={total > 1 ? fmt(q.several, { n: total }) : title}
      tabIndex={-1}
      data-wb-question
      data-wb-waiting
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-2.5 shadow-sm outline-none"
    >
      <header className="flex min-w-0 items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning-soft-foreground">
          <MessageSquareWarning aria-hidden className="size-3.5" strokeWidth={1.75} />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-body-sm font-semibold text-foreground">
          {total > 1 ? fmt(q.several, { n: total }) : (first.header ?? q.oneTitle)}
        </h3>
        {total > 1 && (
          <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
            {fmt(q.progress, { n: doneCount, total })}
          </span>
        )}
      </header>

      {total > 1 && (
        <div
          role="tablist"
          aria-label={q.tabs}
          className="-mx-0.5 flex min-w-0 gap-1 overflow-x-auto px-0.5 pb-0.5 scrollbar-thin"
        >
          {all.map((x, i) => {
            const selected = i === at;
            const done = isDone(x);
            return (
              <button
                key={x.text}
                type="button"
                role="tab"
                aria-selected={selected}
                data-wb-question-tab={i}
                onClick={() => setTab(i)}
                className={cn(
                  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-caption font-medium transition-colors duration-120 max-md:h-9',
                  selected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                  focusRing,
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full text-caption tabular-nums',
                    done ? 'bg-success-soft text-success-soft-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {done ? <Check className="size-2.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="max-w-36 truncate">{x.header ?? fmt(q.nth, { n: i + 1 })}</span>
                {done && <span className="sr-only">{q.tabDone}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div role={total > 1 ? 'tabpanel' : undefined} className="flex min-w-0 flex-col gap-1.5">
        <div className="min-w-0">
          <p className="text-body-sm text-foreground">
            <MarkInline text={current.text} />
          </p>
          <p className="text-caption text-muted-foreground">{current.multiSelect ? q.pickMany : q.pickOne}</p>
        </div>
        <div
          data-wb-answers
          data-wb-question-item={current.multiSelect ? 'multi' : 'single'}
          role={quick ? undefined : current.multiSelect ? 'group' : 'radiogroup'}
          aria-label={current.text}
          className="flex max-h-[min(38dvh,17rem)] min-w-0 flex-col gap-1 overflow-y-auto"
        >
          {current.options.map((o) => {
            const label = o.label;
            const on = (picked[key(current)] ?? []).includes(label);
            const recommended = RECOMMENDED.test(label);
            return (
              <button
                key={label}
                type="button"
                role={quick ? undefined : current.multiSelect ? 'checkbox' : 'radio'}
                aria-checked={quick ? undefined : on}
                data-wb-option={label}
                data-wb-recommended={recommended || undefined}
                disabled={!!off}
                onClick={() => pick(label)}
                className={cn(
                  'flex min-h-11 w-full min-w-0 items-start gap-2 rounded-md border px-2.5 py-1.5 text-start transition-colors duration-120 disabled:cursor-not-allowed disabled:opacity-60 md:min-h-0',
                  on ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent',
                  focusRing,
                )}
              >
                <PickMark multi={current.multiSelect} on={on} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-body-sm font-medium text-foreground">
                    <Bidi>{bareLabel(label)}</Bidi>
                    {recommended && (
                      <span className="rounded-sm bg-primary/10 px-1 text-caption font-medium text-primary">
                        {q.recommended}
                      </span>
                    )}
                  </span>
                  {o.description && (
                    <span className="block text-caption text-muted-foreground">{o.description}</span>
                  )}
                </span>
              </button>
            );
          })}
          <div
            className={cn(
              'flex min-w-0 flex-col rounded-md border transition-colors duration-120',
              ownOpen ? 'border-primary bg-primary/5' : 'border-dashed border-border',
            )}
          >
            <button
              type="button"
              data-wb-option-own
              aria-expanded={ownOpen}
              disabled={!!off}
              onClick={toggleOwn}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-start text-body-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 md:min-h-0',
                focusRing,
              )}
            >
              <PenLine aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
              {q.own}
            </button>
            {ownOpen && (
              <div className="flex min-w-0 items-end gap-1.5 px-2 pb-2">
                <textarea
                  // biome-ignore lint/a11y/noAutofocus: opened by the owner's own press, to type at once
                  autoFocus
                  rows={2}
                  dir="auto"
                  value={ownText}
                  aria-label={q.own}
                  placeholder={q.ownPlaceholder}
                  data-wb-own-input
                  onChange={(e) => setOwn((now) => ({ ...now, [key(current)]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      sendOwn();
                    }
                  }}
                  className="min-h-9 w-full min-w-0 resize-none rounded-md border border-input bg-background px-2 py-1.5 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
                {quick && (
                  <Button size="sm" disabled={!ownText.trim() || !!off} onClick={sendOwn}>
                    {q.sendOne}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-border pt-2">
        {total > 1 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              data-wb-question-back
              disabled={at === 0}
              onClick={() => setTab(at - 1)}
            >
              <ChevronRight aria-hidden className="size-4 ltr:-scale-x-100" strokeWidth={1.75} />
              {q.back}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              data-wb-question-next
              disabled={at === total - 1}
              onClick={next}
            >
              {q.next}
              <ChevronLeft aria-hidden className="size-4 ltr:-scale-x-100" strokeWidth={1.75} />
            </Button>
          </>
        )}
        <span className="flex-1" />
        <Tip content={{ what: q.declineTip }} off={off} vars={{ device }} label={q.decline}>
          <Button
            variant="ghost"
            size="sm"
            data-wb-question-decline
            disabled={!!off}
            onClick={() => declineQuestion(chatId, question.id)}
          >
            {q.decline}
          </Button>
        </Tip>
        {!quick && (
          <Tip
            content={{ what: q.sendTip }}
            off={off ?? (complete ? null : { why: q.incomplete, fix: q.incompleteFix })}
            vars={{ device }}
            label={q.send}
          >
            <Button size="sm" data-wb-question-send disabled={!complete || !!off} onClick={submit}>
              {total > 1 ? fmt(q.sendCount, { n: doneCount, total }) : q.send}
            </Button>
          </Tip>
        )}
      </footer>
      <p className="text-caption text-muted-foreground">
        {hasNoTimeLimit(question.expiresAt)
          ? q.noLimit
          : fmt(q.expires, { time: clockOf(question.expiresAt, locale) })}
      </p>
    </section>
  );
}

/** The question that waits on the owner, docked above the message box so it never scrolls away. Once answered it shows inline in the thread. */
export function QuestionDock({ chat }: { chat: { id: string; items: readonly Item[] } }) {
  const waiting = chat.items.find(
    (it): it is Extract<Item, { kind: 'question' }> =>
      it.kind === 'question' && it.question.status === 'pending',
  );
  if (!waiting) return null;
  return (
    <div data-wb-question-dock className="max-h-[min(70dvh,34rem)] min-w-0 overflow-y-auto">
      <QuestionCard key={waiting.id} chatId={chat.id} item={waiting} />
    </div>
  );
}

/**
 * The draft as a diff against the current text (`doc.draft`). A claim Claude could not verify is asked about here, never written as fact, and Allow on `save_doc` is refused until each is answered, so Save's label says
 * what is missing, or how many unverified marks the save will write. A duplicate the server found is the first thing on the card, with updating the existing doc as the filled answer. Sourced claims fold under one line.
 * What is flagged is only what Claude chose to flag, and the card says so, so a missing mark is not read as proof.
 */
export function DraftCard({ chatId, item }: { chatId: string; item: Extract<Item, { kind: 'draft' }> }) {
  const t = useT<ChatMessages>('chat').panel;
  const locale = useLocale();
  const wb = useWb();
  const d = t.pro.draft;
  const { draft, save } = item;
  const claims = claimsWith(draft, wb.answers[draft.id] ?? {});
  const answers = Object.fromEntries(claims.map((f) => [f.id, f.answer ?? 'open'] as const));
  const discarded = !!wb.discarded[draft.id];
  const open = draft.status === 'open' && !discarded;
  const status = discarded ? 'dropped' : draft.status;
  const lines = useMemo(() => draftLines(draft), [draft]);
  const moved = useMemo(() => conflictLines(draft), [draft]);
  const [diffOpen, setDiffOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const verified = claims.filter((c) => c.status === 'verified');
  const unverified = claims.filter((c) => c.status === 'unverified');
  const unanswered = openFlags(claims).length;
  const kept = claims.filter((c) => c.answer === 'keep_flagged').length;
  const off = offOf(wb.engine);
  const device = wb.deviceName;
  const hasDuplicates = draft.duplicates.length > 0;
  // A settled draft is history: it folds so the next thing can be read.
  const settled = status === 'saved' || status === 'dropped';
  const prevState = useRef(status);
  useEffect(() => {
    if (settled && prevState.current !== status) setDiffOpen(false);
    prevState.current = status;
  }, [status, settled]);
  // A duplicate warning is the first thing to read, and a tall draft pinned to the thread's end would leave it above the fold.
  const cardRef = useRef<HTMLElement>(null);
  const warnedOnMount = useRef(hasDuplicates && open);
  useEffect(() => {
    if (!warnedOnMount.current) return;
    const timer = window.setTimeout(() => cardRef.current?.scrollIntoView({ block: 'start' }), 40);
    return () => window.clearTimeout(timer);
  }, []);
  const StateIcon = status === 'refused' ? Ban : Check;
  const saveLabel = unanswered
    ? counted(unanswered, locale, d.saveFlags)
    : hasDuplicates
      ? d.saveNew
      : kept
        ? counted(kept, locale, d.saveKept)
        : d.save;
  const flagWord = (a: 'confirm' | 'remove' | 'keep_flagged' | null) =>
    !a ? d.flagOpen : a === 'confirm' ? d.flagConfirmed : a === 'remove' ? d.flagLeft : d.flagKept;
  return (
    <section
      ref={cardRef}
      aria-label={draft.title}
      data-wb-draft={status}
      className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3"
    >
      <header className="flex min-w-0 flex-col gap-0.5">
        <p className="text-body-sm text-muted-foreground">{d.label}</p>
        <h3 className="text-body-lg font-semibold text-foreground">
          <Bidi>{draft.title}</Bidi>
        </h3>
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
          {draft.path && (
            <Ltr mono className="min-w-0 text-body-sm [overflow-wrap:anywhere]">
              {draft.path}
            </Ltr>
          )}
          <span>{draft.baseVersion ? fmt(d.base, { rev: draft.baseVersion }) : d.newFile}</span>
        </p>
      </header>
      {hasDuplicates && (
        <div data-wb-duplicate-warning className="flex min-w-0 flex-col gap-1">
          <p className="flex items-start gap-1.5 text-body-sm font-medium text-foreground">
            <ShieldAlert
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-warning-strong"
              strokeWidth={1.75}
            />
            <span>
              {d.duplicates}. {d.duplicatesWhy}
            </span>
          </p>
          <DuplicateList duplicates={draft.duplicates} />
        </div>
      )}
      {open && (
        <p className="text-body-sm text-foreground">
          <MarkInline text={draft.reason} />
        </p>
      )}
      {settled && (
        <button
          type="button"
          data-wb-draft-diff-toggle
          aria-expanded={diffOpen}
          onClick={() => setDiffOpen((v) => !v)}
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-sm text-body-sm text-muted-foreground hover:text-foreground max-md:min-h-11',
            focusRing,
          )}
        >
          {diffOpen ? d.hideDiff : d.showDiff}
          <ChevronDown
            aria-hidden
            className={cn('size-3.5 shrink-0', diffOpen && 'rotate-180')}
            strokeWidth={1.75}
          />
        </button>
      )}
      {draft.conflict && (
        <div data-wb-conflict className="flex min-w-0 flex-col gap-1.5">
          <p className="flex items-start gap-1.5 text-body-sm font-medium text-foreground">
            <GitMerge aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" strokeWidth={1.75} />
            <span>
              {d.conflictTitle}
              {draft.conflict.version
                ? ` ${fmt(d.conflictVersion, { version: draft.conflict.version })}`
                : ''}
            </span>
          </p>
          <DiffView lines={moved} label={d.conflictDiffLabel} path={draft.path ?? undefined} />
          <p className="text-body-sm text-muted-foreground">{d.conflictNext}</p>
        </div>
      )}
      {diffOpen && (
        <DiffView
          lines={lines}
          label={draft.path ?? draft.title}
          path={draft.path ?? undefined}
          flags={answers}
        />
      )}
      {!settled &&
        unverified.map((f) => (
          <div
            key={f.id}
            data-wb-flag={f.answer ?? 'open'}
            className="flex min-w-0 flex-col gap-1.5 rounded-md bg-muted p-2.5"
          >
            <p className="flex items-start gap-1.5 text-body-sm font-medium text-foreground">
              <AlertTriangle
                aria-hidden
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  !f.answer ? 'text-warning-strong' : 'text-muted-foreground',
                )}
                strokeWidth={1.75}
              />
              <span>
                {flagWord(f.answer)}: <Bidi>{f.text}</Bidi>
              </span>
              {open && f.answer && (
                <button
                  type="button"
                  data-wb-flag-change
                  onClick={() => setClaimAnswer(draft.id, f.id, null)}
                  className={cn(
                    'ms-auto shrink-0 rounded-sm font-normal text-muted-foreground underline underline-offset-2 hover:text-foreground max-md:min-h-11',
                    focusRing,
                  )}
                >
                  {d.change}
                </button>
              )}
            </p>
            {open && !f.answer && (
              <div className="flex flex-wrap gap-1.5">
                <Tip k="flag:confirm">
                  <Button
                    size="sm"
                    data-wb-flag-confirm
                    onClick={() => setClaimAnswer(draft.id, f.id, 'confirm')}
                  >
                    {d.confirm}
                  </Button>
                </Tip>
                <Tip k="flag:leave">
                  <Button
                    size="sm"
                    data-wb-flag-leave
                    onClick={() => setClaimAnswer(draft.id, f.id, 'remove')}
                  >
                    {d.leave}
                  </Button>
                </Tip>
                <Tip k="flag:keep">
                  <Button
                    size="sm"
                    data-wb-flag-keep
                    onClick={() => setClaimAnswer(draft.id, f.id, 'keep_flagged')}
                  >
                    {d.keep}
                  </Button>
                </Tip>
              </div>
            )}
          </div>
        ))}
      {!settled && verified.length > 0 && (
        <div className="flex min-w-0 flex-col gap-1">
          <button
            type="button"
            data-wb-sources
            aria-expanded={sourcesOpen}
            onClick={() => setSourcesOpen((v) => !v)}
            className={cn(
              'inline-flex w-fit items-center gap-1.5 rounded-sm text-body-sm text-muted-foreground hover:text-foreground max-md:min-h-11',
              focusRing,
            )}
          >
            <ShieldCheck
              aria-hidden
              className="size-3.5 shrink-0 text-success-soft-foreground"
              strokeWidth={1.75}
            />
            {counted(verified.length, locale, d.checked)}
            <ChevronDown
              aria-hidden
              className={cn('size-3.5 shrink-0', sourcesOpen && 'rotate-180')}
              strokeWidth={1.75}
            />
          </button>
          {sourcesOpen && (
            <ul data-wb-sources-list className="flex min-w-0 flex-col gap-1 ps-5 text-body-sm">
              {verified.map((c) => (
                <li key={c.id} className="min-w-0">
                  <span className="text-foreground">
                    <Bidi>{c.text}</Bidi>
                  </span>
                  {c.source && (
                    <Ltr mono className="block text-body-sm [overflow-wrap:anywhere] text-muted-foreground">
                      {c.source}
                    </Ltr>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!settled && (
        <p data-wb-honest className="text-body-sm text-muted-foreground">
          {d.honest}
        </p>
      )}
      {open ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {hasDuplicates && (
              <Tip k="draft:update" off={off} vars={{ device }} label={d.updateExisting}>
                <Button
                  variant="primary"
                  data-wb-draft-update
                  disabled={!!off}
                  onClick={() =>
                    redraft(
                      chatId,
                      draft,
                      save,
                      fmt(d.redraftNote, { keys: draft.duplicates.map((x) => x.key).join(', ') }),
                    )
                  }
                >
                  {d.updateExisting}
                </Button>
              </Tip>
            )}
            <Tip
              k="draft:save"
              off={unanswered ? 'flagsOpen' : (off ?? (save ? null : 'noSave'))}
              vars={{ device }}
              label={saveLabel}
            >
              <Button
                variant={unanswered || hasDuplicates ? 'outline' : 'primary'}
                data-wb-draft-save
                data-wb-draft-flags={unanswered}
                disabled={!!unanswered || !!off || !save}
                onClick={() => save && saveDraft(chatId, draft, save)}
              >
                <Save aria-hidden className="size-4" strokeWidth={1.75} />
                {saveLabel}
              </Button>
            </Tip>
            <Tip k="draft:discard">
              <Button
                variant="ghost"
                data-wb-draft-discard
                onClick={() => discardDraft(chatId, draft, save, d.discardNote)}
              >
                {d.discard}
              </Button>
            </Tip>
          </div>
          <p className="text-body-sm text-muted-foreground">{d.window}</p>
        </>
      ) : (
        <p
          role="status"
          data-wb-draft-state={status}
          className={cn(
            'inline-flex flex-wrap items-center gap-1.5 text-body-sm font-medium',
            status === 'refused' ? 'text-destructive-soft-foreground' : 'text-foreground',
          )}
        >
          <StateIcon
            aria-hidden
            className={cn('size-4 shrink-0', status !== 'refused' && 'text-muted-foreground')}
          />
          {status === 'saved'
            ? draft.savedVersion
              ? fmt(d.savedAs, { rev: draft.savedVersion })
              : d.saved
            : status === 'refused'
              ? d.refused
              : d.discarded}
          {draft.refusedCode && (
            <code dir="ltr" translate="no" data-wb-refused-code className="key font-normal">
              {draft.refusedCode}
            </code>
          )}
        </p>
      )}
    </section>
  );
}

/** Saved: what happened to the earlier text, and the way back. Restore keeps the current text as a revision too. */
export function SavedCard({ item }: { item: Extract<Item, { kind: 'saved' }> }) {
  const t = useT<ChatMessages>('chat').panel;
  const wb = useWb();
  const s = t.pro.saved;
  const { draft } = item;
  const doc = draft.docKey ?? '';
  const restore = useRestoreDocRevision(doc);
  const restored = !!wb.restored[draft.id];
  return (
    <section
      aria-label={s.label}
      data-wb-saved
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3"
    >
      <p className="flex items-start gap-2 text-body text-foreground">
        <CheckCircle2
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-success-soft-foreground"
          strokeWidth={1.75}
        />
        <span>{s.text}</span>
      </p>
      <p className="text-body-sm text-muted-foreground">{s.git}</p>
      <div className="flex flex-wrap gap-1.5">
        <Tip k="saved:open">
          <Button size="sm" data-wb-saved-open onClick={() => navigate('docs', { query: { doc } })}>
            <FileText aria-hidden className="size-3.5" strokeWidth={1.75} />
            {s.open}
          </Button>
        </Tip>
        {restored ? (
          <p
            role="status"
            data-wb-restored
            className="inline-flex items-center gap-1.5 text-body-sm font-medium text-foreground"
          >
            <RotateCcw aria-hidden className="size-3.5 text-muted-foreground" />
            {s.restored}
          </p>
        ) : (
          draft.revisionId && (
            <Tip k="saved:restore">
              <Button
                size="sm"
                variant="ghost"
                data-wb-saved-restore
                busy={restore.isPending}
                onClick={() =>
                  restore.mutate(
                    { revision: draft.revisionId ?? '' },
                    {
                      onSuccess: () => markRestored(draft.id),
                      onError: (error) =>
                        showToast({
                          tone: 'error',
                          message: fmt(s.restoreFailed, { why: isHubError(error) ? error.message : '' }),
                        }),
                    },
                  )
                }
              >
                <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.75} />
                {s.restore}
              </Button>
            </Tip>
          )
        )}
      </div>
    </section>
  );
}

/** `tool.blocked` (§7.2): what Ask or Plan refused, why, and the one way forward. Switching restarts Claude, and the Starting line says so. */
export function Blocked({ chatId, item }: { chatId: string; item: Extract<Item, { kind: 'blocked' }> }) {
  const t = useT<ChatMessages>('chat').panel;
  const wb = useWb();
  const chat = wb.chat?.id === chatId ? wb.chat : undefined;
  const [used, setUsed] = useState(false);
  const b = t.pro.blocked;
  const last = chat
    ? [...chat.items].reverse().find((i): i is Extract<Item, { kind: 'user' }> => i.kind === 'user')
    : null;
  const off = offOf(wb.engine);
  const device = wb.deviceName;
  return (
    <section
      aria-label={fmt(b.title, { mode: t.pro.modes[item.mode] })}
      data-wb-blocked={item.mode}
      className="flex min-w-0 flex-col items-start gap-1.5 rounded-lg border border-border bg-card p-3"
    >
      <p className="flex items-start gap-2 text-body font-semibold text-foreground">
        <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" strokeWidth={1.75} />
        <span>{fmt(b.title, { mode: t.pro.modes[item.mode] })}</span>
      </p>
      <p className="text-body-sm text-muted-foreground">{b.why[item.mode]}</p>
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-body-sm text-foreground">
        <span>{fmt(b.refused, { tool: item.name })}</span>
        <code dir="ltr" translate="no" className="key [overflow-wrap:anywhere]">
          {item.command}
        </code>
      </p>
      {!used && (
        <Tip k="blocked:switch" off={off} vars={{ device }} label={b.switch}>
          <Button
            size="sm"
            data-wb-switch
            disabled={!!off}
            onClick={() => {
              setUsed(true);
              setMode('execute');
              if (last) void send({ text: last.text, context: last.context ?? undefined, mode: 'execute' });
            }}
          >
            {b.switch}
          </Button>
        </Tip>
      )}
    </section>
  );
}
