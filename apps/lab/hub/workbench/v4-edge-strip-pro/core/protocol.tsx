import { useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, ChevronDown, Circle, CircleDashed, CircleSlash, ClipboardList, FileSearch, FileText, GitMerge, Link2, ListChecks, Loader2, Play, RotateCcw, Save, ShieldAlert } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { Bidi, Button, cn, counted, createCard, fmt, focusRing, Ltr, navigate, openCard, showToast, useCard, useSession } from './kit';
import { answerChoice, discardDraft, linkDoc, markRestored, restoreRevision, runPlan, saveDraft, schedule, send, setFlag, setMode, setPlanState, startDoc, useWb } from './store';
import type { Choice, Item, Report, StageState } from './mock';
import { wbMessages } from './strings';
import { DiffView, KeyLink } from './thread';
import { Tip } from './tips';

const stageIcon: Record<StageState, typeof Circle> = { pending: Circle, running: Loader2, done: CheckCircle2, failed: AlertTriangle, skipped: CircleSlash };
const stageTone: Record<StageState, string> = {
  pending: 'text-muted-foreground',
  running: 'text-foreground motion-safe:animate-spin',
  done: 'text-success-soft-foreground',
  failed: 'text-destructive-soft-foreground',
  skipped: 'text-muted-foreground',
};

/** The live checklist on a turn. One line per stage, the current one in full weight, and each says in words what state it is in. */
export function ProtocolCard({ item }: { item: Extract<Item, { kind: 'protocol' }> }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const p = t.pro.protocol;
  const failed = item.stages.find((g) => g.state === 'failed');
  return (
    <section aria-label={item.protocol === 'task' ? p.task : p.doc} data-wb-protocol={item.protocol} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        {item.protocol === 'task' ? <ListChecks aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} /> : <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
        <h3 className="text-body font-semibold text-foreground">{item.protocol === 'task' ? p.task : p.doc}</h3>
        <Ltr mono className="min-w-0 truncate text-body-sm text-muted-foreground">
          {item.target}
        </Ltr>
      </header>
      <ol className="flex flex-col gap-0.5">
        {item.stages.map((g) => {
          const Icon = stageIcon[g.state];
          return (
            <li key={g.id} data-wb-stage={g.id} data-wb-stage-state={g.state}>
              <Tip k="stage" facts={[[t.pro.factLabels.state, p.states[g.state]]]} align="start">
                <div tabIndex={0} className={cn('flex min-w-0 items-start gap-2 rounded-sm px-1 py-0.5', focusRing)}>
                  <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', stageTone[g.state])} strokeWidth={2} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-body-sm', g.state === 'running' || g.state === 'failed' ? 'font-semibold text-foreground' : g.state === 'done' ? 'text-foreground' : 'text-muted-foreground')}>
                      {t.pro.stages[g.id]}
                      <span className="sr-only"> ({p.states[g.state]})</span>
                    </p>
                    {g.note && (
                      <p className={cn('text-body-sm', g.state === 'failed' ? 'text-destructive-soft-foreground' : 'text-muted-foreground')}>
                        <MarkInline text={g.note[locale]} />
                      </p>
                    )}
                  </div>
                </div>
              </Tip>
            </li>
          );
        })}
      </ol>
      {failed && (
        <p role="status" data-wb-stopped-at className="text-body-sm font-medium text-foreground">
          {fmt(p.stoppedAt, { stage: t.pro.stages[failed.id] })}
        </p>
      )}
    </section>
  );
}

/** Backticks in a line read as code, LTR. */
function MarkInline({ text }: { text: string }) {
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

/** What a Plan turn ends in. Its one strong action is running it. */
export function PlanCard({ chatId, item }: { chatId: string; item: Extract<Item, { kind: 'plan' }> }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const p = t.pro.plan;
  const { plan } = item;
  const chat = wb.chats.find((c) => c.id === chatId);
  const off = wb.engine !== 'ok' ? wb.engine : null;
  return (
    <section aria-label={p.title} data-wb-plan className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
      <header className="flex items-start gap-2">
        <ClipboardList aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-body-sm text-muted-foreground">{p.title}</p>
          <h3 className="text-body-lg font-semibold text-foreground">{plan.title[locale]}</h3>
        </div>
      </header>
      <ol className="flex list-inside list-decimal flex-col gap-1 text-body text-foreground">
        {plan.steps.map((s) => (
          <li key={s.en}>{s[locale]}</li>
        ))}
      </ol>
      <div className="flex flex-col gap-0.5 text-body-sm">
        <p className="font-medium text-muted-foreground">{p.checks}</p>
        <ul className="flex flex-wrap gap-1">
          {plan.checks.map((c) => (
            <li key={c}>
              <code dir="ltr" translate="no" className="key inline-block rounded-sm bg-muted px-1.5 py-0.5 text-foreground">
                {c}
              </code>
            </li>
          ))}
        </ul>
      </div>
      {plan.state === 'proposed' ? (
        <div className="flex flex-wrap gap-1.5">
          <Tip k="plan.run" off={off} vars={{ device: wb.device }} label={p.run}>
            <Button variant="primary" data-wb-plan-run disabled={!!off} onClick={() => runPlan(chatId, item.id)}>
              <Play aria-hidden className="size-4" strokeWidth={2} />
              {p.run}
            </Button>
          </Tip>
          <Tip k="plan.schedule">
            <Button
              variant="ghost"
              data-wb-plan-schedule
              onClick={() => {
                schedule({ title: plan.title, folder: chat?.folder ?? 'F:/Goteav/backend', when: { ar: 'اليوم 22:00', en: 'Today 22:00' }, repeat: false });
                setPlanState(chatId, item.id, 'scheduled');
                showToast({ message: fmt(t.runsPanel.scheduledToast, { when: locale === 'ar' ? 'اليوم 22:00' : 'Today 22:00' }) });
              }}
            >
              {p.schedule}
            </Button>
          </Tip>
          <Tip k="plan.aside">
            <Button variant="ghost" onClick={() => setPlanState(chatId, item.id, 'set_aside')}>
              {p.aside}
            </Button>
          </Tip>
        </div>
      ) : (
        <p role="status" className="inline-flex items-center gap-1.5 text-body-sm font-medium text-foreground">
          <Check aria-hidden className="size-4 text-muted-foreground" />
          {plan.state === 'running' ? p.running : plan.state === 'scheduled' ? p.scheduled : p.asided}
        </p>
      )}
    </section>
  );
}

function CheckRow({ command, passed, output }: Report['checks'][number]) {
  const t = useT(wbMessages);
  const [open, setOpen] = useState(!passed);
  return (
    <li className="flex min-w-0 flex-col gap-1">
      <Tip k="evidence.check" align="start">
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={cn('flex min-h-11 w-full min-w-0 items-center gap-2 rounded-sm px-1 text-start text-body-sm hover:bg-accent md:min-h-7', focusRing)}>
          {passed ? <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success-soft-foreground" strokeWidth={2} /> : <AlertTriangle aria-hidden className="size-4 shrink-0 text-destructive-soft-foreground" strokeWidth={2} />}
          <code dir="ltr" translate="no" className="key min-w-0 flex-1 truncate text-start text-foreground">
            {command}
          </code>
          <span className={cn('shrink-0 font-medium', passed ? 'text-muted-foreground' : 'text-destructive-soft-foreground')}>{passed ? t.pro.report.passed : t.pro.report.failed}</span>
          <ChevronDown aria-hidden className={cn('size-3.5 shrink-0 text-muted-foreground', open && 'rotate-180')} strokeWidth={1.75} />
        </button>
      </Tip>
      {open && (
        <pre dir="ltr" translate="no" tabIndex={0} className="key max-h-48 overflow-auto rounded-md bg-muted p-2 text-start text-body-sm whitespace-pre-wrap text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {output}
        </pre>
      )}
    </li>
  );
}

/** The report body, the same on the turn and on the card. */
export function ReportBody({ report }: { report: Report }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const r = t.pro.report;
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <p className="text-body text-foreground">{report.summary[locale]}</p>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h4 className="text-body-sm font-medium text-muted-foreground">{r.files}</h4>
        <ul className="flex min-w-0 flex-col gap-0.5 text-body-sm">
          {report.files.map((f) => (
            <li key={f.path} className="flex min-w-0 items-center gap-2 px-1">
              <code dir="ltr" translate="no" className="key min-w-0 flex-1 text-start wrap-anywhere text-foreground">
                {f.path}
              </code>
              <span dir="ltr" className="shrink-0 text-success-soft-foreground tabular-nums">
                +{f.added}
              </span>
              <span dir="ltr" className="shrink-0 text-destructive-soft-foreground tabular-nums">
                −{f.removed}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h4 className="text-body-sm font-medium text-muted-foreground">{r.checks}</h4>
        <ul className="flex min-w-0 flex-col gap-0.5">
          {report.checks.map((c) => (
            <CheckRow key={c.command} {...c} />
          ))}
        </ul>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h4 className="text-body-sm font-medium text-muted-foreground">{r.notChecked}</h4>
        <ul className="flex list-inside list-disc flex-col gap-0.5 text-body-sm text-foreground">
          {report.notChecked.map((n) => (
            <li key={n.en}>
              <MarkInline text={n[locale]} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ReportCard({ report }: { report: Report }) {
  const t = useT(wbMessages);
  const r = t.pro.report;
  return (
    <section aria-label={fmt(r.title, { key: report.cardKey })} data-wb-report={report.partial ? 'partial' : 'full'} className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
      <header className="flex min-w-0 flex-wrap items-center gap-2">
        <ListChecks aria-hidden className={cn('size-5 shrink-0', report.partial ? 'text-warning-strong' : 'text-success-soft-foreground')} strokeWidth={1.75} />
        <h3 className="min-w-0 text-body-lg font-semibold text-foreground">{fmt(report.partial ? r.partialTitle : r.title, { key: report.cardKey })}</h3>
      </header>
      <ReportBody report={report} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2.5">
        <p className="min-w-0 flex-1 text-body-sm text-muted-foreground">{r.stayOpen}</p>
        <Tip k="report.open">
          <Button size="sm" data-wb-report-open onClick={() => openCard(report.cardKey)}>
            <ArrowUpRight aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
            {fmt(r.open, { key: report.cardKey })}
          </Button>
        </Tip>
      </div>
    </section>
  );
}

const choiceIcon: Record<Choice['variant'], typeof Circle> = { proposal: FileSearch, verify: AlertTriangle, conflict: GitMerge, duplicate: ShieldAlert };
const choiceTone: Record<Choice['variant'], string> = { proposal: 'text-muted-foreground', verify: 'text-destructive-soft-foreground', conflict: 'text-warning-strong', duplicate: 'text-warning-strong' };

/** A question Claude cannot settle alone: propose, duplicate warning, failed check, conflict. */
export function ChoiceCard({ chatId, item }: { chatId: string; item: Extract<Item, { kind: 'choice' }> }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const { choice } = item;
  const Icon = choiceIcon[choice.variant];
  const chosen = choice.options.find((o) => o.id === choice.chosen);
  return (
    <section aria-label={choice.title[locale]} data-wb-choice={choice.variant} className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
      <header className="flex items-start gap-2">
        <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', choiceTone[choice.variant])} strokeWidth={1.75} />
        <h3 className="min-w-0 text-body-lg font-semibold text-foreground">{choice.title[locale]}</h3>
      </header>
      <p className="text-body-sm text-foreground">
        <MarkInline text={choice.body[locale]} />
      </p>
      {choice.diff && <DiffView lines={choice.diff} label={choice.path ?? choice.title[locale]} />}
      {chosen ? (
        <p role="status" className="inline-flex items-center gap-1.5 text-body-sm font-medium text-foreground">
          <Check aria-hidden className="size-4 text-muted-foreground" />
          {fmt(t.pro.choice.chosen, { what: chosen.label[locale] })}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {choice.options.map((o) => (
            <Tip key={o.id} content={{ what: o.tip[locale] }}>
              <Button variant={o.primary ? 'primary' : 'outline'} data-wb-option={o.id} onClick={() => answerChoice(chatId, item.id, o.id)}>
                {o.label[locale]}
              </Button>
            </Tip>
          ))}
        </div>
      )}
    </section>
  );
}

/** The draft as a diff against the current text. A claim Claude could not verify is asked about here, never written as fact. */
export function DraftCard({ chatId, item }: { chatId: string; item: Extract<Item, { kind: 'draft' }> }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const d = t.pro.draft;
  const { draft } = item;
  const flags = Object.fromEntries(draft.flags.map((f) => [f.id, f.state]));
  const open = draft.state === 'open';
  return (
    <section aria-label={d.title} data-wb-draft={draft.state} className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
      <header className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-body-lg font-semibold text-foreground">{d.title}</h3>
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
          <Ltr mono className="min-w-0 text-body-sm [overflow-wrap:anywhere]">
            {draft.path}
          </Ltr>
          <span>{draft.base === 'new' ? d.newFile : fmt(d.base, { rev: draft.base })}</span>
        </p>
      </header>
      <DiffView lines={draft.lines} label={draft.path} flags={flags} />
      {draft.flags.map((f) => (
        <div key={f.id} data-wb-flag={f.state} className="flex min-w-0 flex-col gap-1.5 rounded-md bg-muted p-2.5">
          <p className="flex items-start gap-1.5 text-body-sm font-medium text-foreground">
            <AlertTriangle aria-hidden className={cn('mt-0.5 size-4 shrink-0', f.state === 'open' ? 'text-warning-strong' : 'text-muted-foreground')} strokeWidth={1.75} />
            <span>
              {f.state === 'open' ? d.flagOpen : f.state === 'confirmed' ? d.flagConfirmed : d.flagLeft}: {f.claim[locale]}
            </span>
          </p>
          <p className="text-body-sm text-muted-foreground">
            <MarkInline text={f.why[locale]} />
          </p>
          {open && f.state === 'open' && (
            <div className="flex flex-wrap gap-1.5">
              <Tip k="flag.confirm">
                <Button size="sm" data-wb-flag-confirm onClick={() => setFlag(chatId, item.id, f.id, 'confirmed')}>
                  {d.confirm}
                </Button>
              </Tip>
              <Tip k="flag.leave">
                <Button size="sm" data-wb-flag-leave onClick={() => setFlag(chatId, item.id, f.id, 'left_out')}>
                  {d.leave}
                </Button>
              </Tip>
            </div>
          )}
        </div>
      ))}
      {open ? (
        <div className="flex flex-wrap gap-1.5">
          <Tip k="draft.save">
            <Button variant="primary" data-wb-draft-save onClick={() => saveDraft(chatId, item.id)}>
              <Save aria-hidden className="size-4" strokeWidth={1.75} />
              {d.save}
            </Button>
          </Tip>
          <Tip k="draft.discard">
            <Button variant="ghost" data-wb-draft-discard onClick={() => discardDraft(chatId, item.id)}>
              {d.discard}
            </Button>
          </Tip>
        </div>
      ) : (
        <p role="status" className="inline-flex items-center gap-1.5 text-body-sm font-medium text-foreground">
          <Check aria-hidden className="size-4 text-muted-foreground" />
          {draft.state === 'saved' ? d.sent : d.discarded}
        </p>
      )}
    </section>
  );
}

export function SavedCard({ chatId, item }: { chatId: string; item: Extract<Item, { kind: 'saved' }> }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const s = t.pro.saved;
  return (
    <section aria-label={s.label} data-wb-saved className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <p className="flex items-start gap-2 text-body text-foreground">
        <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success-soft-foreground" strokeWidth={1.75} />
        <span>{fmt(s.text, { rev: item.revision, prev: item.previous })}</span>
      </p>
      <p className="text-body-sm text-muted-foreground">{s.git}</p>
      <div className="flex flex-wrap gap-1.5">
        {item.docKey && (
          <Tip k="saved.open">
            <Button size="sm" data-wb-saved-open onClick={() => navigate('docs', { query: { doc: item.docKey } })}>
              <FileText aria-hidden className="size-3.5" strokeWidth={1.75} />
              {s.open}
            </Button>
          </Tip>
        )}
        {item.restored ? (
          <p role="status" className="inline-flex items-center gap-1.5 text-body-sm font-medium text-foreground">
            <RotateCcw aria-hidden className="size-3.5 text-muted-foreground" />
            {fmt(s.restored, { rev: item.previous })}
          </p>
        ) : (
          item.docKey && (
            <Tip k="saved.restore">
              <Button size="sm" variant="ghost" data-wb-saved-restore onClick={() => restoreRevision(item.docKey, item.previous, locale, () => markRestored(chatId, item.id))}>
                <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.75} />
                {fmt(s.restore, { rev: item.previous })}
              </Button>
            </Tip>
          )
        )}
      </div>
    </section>
  );
}

function LinkOption({ k, on, onToggle }: { k: string; on: boolean; onToggle: () => void }) {
  const locale = useLocale();
  const card = useCard(k);
  return (
    <li>
      <Tip k="links.toggle" align="start">
        <label className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-1 text-body-sm hover:bg-accent md:min-h-8', focusRing)}>
          <input type="checkbox" checked={on} onChange={onToggle} className="size-5 shrink-0 accent-primary md:size-4" />
          <Ltr mono className="shrink-0 text-body-sm font-medium text-foreground">
            {k}
          </Ltr>
          {card && (
            <span className="min-w-0 truncate text-muted-foreground">
              <Bidi>{card.title[locale]}</Bidi>
            </span>
          )}
        </label>
      </Tip>
    </li>
  );
}

export function LinksCard({ chatId, item }: { chatId: string; item: Extract<Item, { kind: 'links' }> }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const l = t.pro.links;
  const [keys, setKeys] = useState(item.keys);
  if (item.done) {
    return (
      <p role="status" data-wb-linked className="flex flex-wrap items-center gap-1.5 text-body-sm font-medium text-foreground">
        <Link2 aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
        {counted(item.keys.length, locale, l.done)}
        {item.keys.map((k) => (
          <KeyLink key={k} k={k} />
        ))}
      </p>
    );
  }
  return (
    <section aria-label={l.title} data-wb-links className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <h3 className="text-body font-semibold text-foreground">{l.title}</h3>
      <ul className="flex min-w-0 flex-col">
        {item.keys.map((k) => (
          <LinkOption key={k} k={k} on={keys.includes(k)} onToggle={() => setKeys((now) => (now.includes(k) ? now.filter((x) => x !== k) : [...now, k]))} />
        ))}
      </ul>
      <div>
        <Tip k="links.save" off={keys.length ? null : 'noneSelected'} label={l.save}>
          <Button data-wb-links-save disabled={!keys.length} onClick={() => linkDoc(chatId, item.id, item.docKey, keys)}>
            <Link2 aria-hidden className="size-4" strokeWidth={1.75} />
            {l.save}
          </Button>
        </Tip>
      </div>
    </section>
  );
}

export function GapsCard({ item }: { item: Extract<Item, { kind: 'gaps' }> }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const { me } = useSession();
  const [made, setMade] = useState<string[]>([]);
  const g = t.pro.gaps;
  const { report } = item;
  return (
    <section aria-label={g.title} data-wb-gaps className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
      <header className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-body-lg font-semibold text-foreground">{counted(report.gaps.length, locale, g.title2)}</h3>
        <p className="text-body-sm text-muted-foreground">
          <MarkInline text={report.scope[locale]} />
        </p>
      </header>
      <ul className="flex min-w-0 flex-col divide-y divide-border">
        {report.gaps.map((gap) => (
          <li key={gap.id} data-wb-gap={gap.kind} className="flex min-w-0 flex-col gap-1 py-2">
            <p className="flex items-start gap-1.5 text-body font-medium text-foreground">
              {gap.kind === 'missing' ? <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" strokeWidth={1.75} /> : <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" strokeWidth={1.75} />}
              <span className="min-w-0">
                <span className="sr-only">{g.kinds[gap.kind]}: </span>
                {gap.topic[locale]}
              </span>
            </p>
            <p className="text-body-sm text-muted-foreground">{gap.why[locale]}</p>
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-body-sm text-muted-foreground">
              <span>{g.foundIn}</span>
              {gap.cards.map((k) => (
                <KeyLink key={k} k={k} />
              ))}
              {gap.paths.map((p) => (
                <Ltr key={p} mono className="min-w-0 text-body-sm [overflow-wrap:anywhere]">
                  {p}
                </Ltr>
              ))}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <Tip k="gaps.draft">
                <Button size="sm" data-wb-gap-draft onClick={() => startDoc('improve', { key: 'GTV-180', path: 'docs/21-confirmation-safety.md' })}>
                  {g.draft}
                </Button>
              </Tip>
              {made.includes(gap.id) ? (
                <p role="status" className="inline-flex items-center gap-1 text-body-sm text-muted-foreground">
                  <Check aria-hidden className="size-3.5" />
                  {g.made}
                </p>
              ) : (
                <Tip k="gaps.task">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      createCard({ type: 'task', title: gap.topic[locale], ownerRole: 'backend', priority: 'P2', body: gap.why[locale], memberId: me.id });
                      setMade((m) => [...m, gap.id]);
                    }}
                  >
                    {g.task}
                  </Button>
                </Tip>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-border pt-2 text-body-sm text-muted-foreground">
        <MarkInline text={report.notChecked[locale]} />
      </p>
    </section>
  );
}

/** Ask or Plan refused a change: it says so and offers the one way forward, instead of failing quietly. */
export function Blocked({ chatId, item }: { chatId: string; item: Extract<Item, { kind: 'blocked' }> }) {
  const t = useT(wbMessages);
  const locale = useLocale();
  const wb = useWb();
  const chat = wb.chats.find((c) => c.id === chatId);
  const [used, setUsed] = useState(false);
  const last = chat ? [...chat.items].reverse().find((i): i is Extract<Item, { kind: 'user' }> => i.kind === 'user') : null;
  return (
    <div data-wb-blocked className="flex min-w-0 flex-col items-start gap-2">
      <p className="text-body text-foreground">{item.text[locale]}</p>
      {!used && (
        <Tip k="blocked.switch">
          <Button
            size="sm"
            data-wb-switch
            onClick={() => {
              setUsed(true);
              setMode(item.wanted);
              if (last) send({ text: last.text, context: last.context, mode: item.wanted });
            }}
          >
            {t.pro.blocked.switch}
          </Button>
        </Tip>
      )}
    </div>
  );
}

