'use client';

/**
 * @file protocol.tsx
 * @description What a turn ends in: the live checklist, a plan, a report with verified apart from claimed, a question, and a doc draft with its flags and duplicates (docs/16 §7.1, §7.2). Ported from the approved design, `apps/lab/hub/workbench/v6-edge-strip-port/core/protocol.tsx`.
 */
import type { CheckRun, DocDuplicate, ReportedCheck, WorkReport } from '@hub/contracts';
import { openFlags, planToPrompt } from '@hub/contracts';
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleSlash,
  ClipboardList,
  FileText,
  GitMerge,
  ListChecks,
  Loader2,
  MessageSquareWarning,
  MoveRight,
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

/** What a Plan turn ends in (`propose_plan`, §7.2). Its one strong action is running it. When the plan came only as reply text, it shows as text and can still be run. */
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
  // `planToPrompt`: what Run this plan sends, visible in the composer until the owner sends it (D51).
  const prompt = structured ? planToPrompt(structured) : `${p.promptText}\n\n${item.text}`;
  return (
    <section
      aria-label={p.title}
      data-wb-plan={structured ? 'structured' : 'text'}
      className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3"
    >
      <header className="flex items-start gap-2">
        <ClipboardList aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-body-sm text-muted-foreground">{p.title}</p>
          {structured && (
            <h3 className="text-body-lg font-semibold text-foreground">
              <Bidi>{structured.title}</Bidi>
            </h3>
          )}
        </div>
      </header>
      {structured && (
        <ol data-wb-plan-steps className="flex flex-col gap-1.5">
          {structured.steps.map((s, i) => (
            <li key={s.title} className="flex min-w-0 items-start gap-2 text-body text-foreground">
              <span
                aria-hidden
                className="mt-0.5 w-4 shrink-0 text-center text-body-sm text-muted-foreground tabular-nums"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block">{s.title}</span>
                {s.why && <span className="block text-body-sm text-muted-foreground">{s.why}</span>}
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
          <div className="wb-prose min-w-0 text-body text-foreground">
            <MarkdownView source={item.text} dir="auto" headingOffset={2} />
          </div>
          <p className="text-body-sm text-muted-foreground">{p.asText}</p>
        </div>
      )}
      {structured?.checks && structured.checks.length > 0 && (
        <div className="flex flex-col gap-0.5 text-body-sm">
          <p className="font-medium text-muted-foreground">{p.checks}</p>
          <ul className="flex flex-wrap gap-1">
            {structured.checks.map((c) => (
              <li key={c}>
                <code
                  dir="ltr"
                  translate="no"
                  className="key inline-block rounded-sm bg-muted px-1.5 py-0.5 text-foreground"
                >
                  {c}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}
      {structured?.risks && structured.risks.length > 0 && (
        <div data-wb-plan-risks className="flex flex-col gap-0.5 text-body-sm">
          <p className="font-medium text-muted-foreground">{p.risks}</p>
          <ul className="flex flex-col gap-0.5 text-foreground">
            {structured.risks.map((r) => (
              <li key={r} className="flex items-start gap-1.5">
                <AlertTriangle
                  aria-hidden
                  className="mt-0.5 size-3.5 shrink-0 text-warning-strong"
                  strokeWidth={1.75}
                />
                <span>
                  <Bidi>{r}</Bidi>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!aside ? (
        <div className="flex flex-wrap gap-1.5">
          <Tip
            k="plan.run"
            off={off}
            vars={{ device, time: clockOf(wb.resetsAt ? new Date(wb.resetsAt).toISOString() : null, locale) }}
            label={p.run}
          >
            <Button
              variant="primary"
              data-wb-plan-run
              disabled={!!off}
              onClick={() => fillComposer(prompt, 'execute')}
            >
              <Play aria-hidden className="size-4" strokeWidth={2} />
              {p.run}
            </Button>
          </Tip>
          <Tip k="plan.aside">
            <Button variant="ghost" data-wb-plan-aside onClick={() => setPlanAside(item.id)}>
              {p.aside}
            </Button>
          </Tip>
        </div>
      ) : (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-foreground"
        >
          <Check aria-hidden className="size-4 text-muted-foreground" />
          {p.asided}
        </p>
      )}
    </section>
  );
}

const clock = clockOf;

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
      <Tip k="evidence.check" align="start" side="bottom">
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
                        {duration(Date.parse(run.endedAt) - Date.parse(run.startedAt), locale)}
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
          <Tip k="report.open">
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

/**
 * `question.asked`: every question in the call, each option's label and description both visible, a checkbox for a multi-select, and the expiry line approvals have. It pauses a running turn, so Stop stays. Answered through
 * the approval route, keyed by the question's text, with a multi-select's labels joined by commas. A single single-select question answers on the press. Closed, it folds to its answer or to what ended it.
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
  const Icon = MessageSquareWarning;
  const tone = 'text-warning-strong';
  const off = offOf(wb.engine);
  const device = wb.deviceName;
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const first = question.questions[0];
  if (!first) return null;
  const title = first.header ?? first.text;
  if (question.status !== 'pending') {
    const said = Object.values(question.answers ?? {});
    const closedText =
      question.status === 'answered'
        ? fmt(t.pro.choice.chosen, { what: said.join('، ') })
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
        className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2"
      >
        <p className="flex items-start gap-2 text-body-sm text-muted-foreground">
          <Icon
            aria-hidden
            className={cn(
              'mt-0.5 size-4 shrink-0',
              question.status === 'answered' ? tone : 'text-muted-foreground',
            )}
            strokeWidth={1.75}
          />
          <span className="min-w-0">{title}</span>
        </p>
        <p role="status" className="inline-flex items-start gap-1.5 text-body-sm font-medium text-foreground">
          {question.status === 'answered' ? (
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0">{closedText}</span>
        </p>
      </section>
    );
  }
  const single = question.questions.length === 1 && !first.multiSelect;
  const key = (x: (typeof question.questions)[number]) => x.text;
  const complete = question.questions.every((x) => (picked[key(x)]?.length ?? 0) > 0);
  const answersOf = () =>
    Object.fromEntries(
      question.questions.map((x) => [key(x), (picked[key(x)] ?? []).join(locale === 'ar' ? '، ' : ', ')]),
    );
  return (
    <section
      aria-label={title}
      tabIndex={-1}
      data-wb-question
      data-wb-waiting
      className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3 outline-none"
    >
      <header className="flex items-start gap-2">
        <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', tone)} strokeWidth={1.75} />
        <h3 className="min-w-0 text-body-lg font-semibold text-foreground">
          {question.questions.length > 1 ? fmt(q.several, { n: question.questions.length }) : title}
        </h3>
      </header>
      <div data-wb-answers className="flex min-w-0 flex-col gap-3">
        {question.questions.map((x) => (
          <fieldset
            key={x.text}
            data-wb-question-item={x.multiSelect ? 'multi' : 'single'}
            className="flex min-w-0 flex-col gap-1.5"
          >
            <legend className="mb-1 text-body-sm text-foreground">
              {question.questions.length > 1 && x.header && (
                <span className="font-semibold">{x.header}: </span>
              )}
              <MarkInline text={x.text} />
              {x.multiSelect && <span className="text-muted-foreground"> {q.pickAny}</span>}
            </legend>
            <div className="flex max-h-72 min-w-0 flex-col gap-1 overflow-y-auto">
              {x.options.map((o) => {
                const label = o.label;
                const on = (picked[key(x)] ?? []).includes(label);
                const recommended = RECOMMENDED.test(label);
                const press = () => {
                  if (single) return answerQuestion(chatId, question.id, { [key(x)]: label });
                  setPicked((now) => {
                    const had = now[key(x)] ?? [];
                    return {
                      ...now,
                      [key(x)]: x.multiSelect
                        ? had.includes(label)
                          ? had.filter((l) => l !== label)
                          : [...had, label]
                        : [label],
                    };
                  });
                };
                return (
                  <button
                    key={label}
                    type="button"
                    role={single ? undefined : x.multiSelect ? 'checkbox' : 'radio'}
                    aria-checked={single ? undefined : on}
                    data-wb-option={label}
                    data-wb-recommended={recommended || undefined}
                    disabled={!!off}
                    onClick={press}
                    className={cn(
                      'flex min-h-11 w-full min-w-0 items-start gap-2 rounded-md border border-border px-2.5 py-1.5 text-start text-body-sm transition-colors duration-120 disabled:cursor-not-allowed disabled:opacity-60 md:min-h-9',
                      recommended && single
                        ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
                        : 'bg-card text-foreground hover:bg-accent',
                      on && 'bg-accent',
                      focusRing,
                    )}
                  >
                    {!single && (
                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 flex size-4 shrink-0 items-center justify-center border border-input',
                          x.multiSelect ? 'rounded-sm' : 'rounded-full',
                        )}
                      >
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        <Bidi>{label}</Bidi>
                      </span>
                      {o.description && (
                        <span
                          className={cn(
                            'block',
                            recommended && single ? 'text-primary-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {o.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {!single && (
          <Tip
            content={{ what: q.sendTip }}
            off={off ?? (complete ? null : { why: q.incomplete, fix: q.incompleteFix })}
            vars={{ device }}
            label={q.send}
          >
            <Button
              data-wb-question-send
              disabled={!complete || !!off}
              onClick={() => answerQuestion(chatId, question.id, answersOf())}
            >
              {q.send}
            </Button>
          </Tip>
        )}
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
      </div>
      <p className="text-body-sm text-muted-foreground">
        {fmt(q.expires, { time: clockOf(question.expiresAt, locale) })}
      </p>
    </section>
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
                <Tip k="flag.confirm">
                  <Button
                    size="sm"
                    data-wb-flag-confirm
                    onClick={() => setClaimAnswer(draft.id, f.id, 'confirm')}
                  >
                    {d.confirm}
                  </Button>
                </Tip>
                <Tip k="flag.leave">
                  <Button
                    size="sm"
                    data-wb-flag-leave
                    onClick={() => setClaimAnswer(draft.id, f.id, 'remove')}
                  >
                    {d.leave}
                  </Button>
                </Tip>
                <Tip k="flag.keep">
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
              <Tip k="draft.update" off={off} vars={{ device }} label={d.updateExisting}>
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
              k="draft.save"
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
            <Tip k="draft.discard">
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
        <Tip k="saved.open">
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
            <Tip k="saved.restore">
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
        <Tip k="blocked.switch" off={off} vars={{ device }} label={b.switch}>
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
