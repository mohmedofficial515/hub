// Group page: guided. Subsections become numbered steps in a vertical stepper (one open at a time) with progress;
// the aside keeps the group's readiness checks, recent versions and related groups in view; one sticky save bar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check as CheckIcon, ChevronDown, ChevronLeft, ChevronRight, History, Link as LinkIcon, RotateCcw, ServerCog, Sparkles } from 'lucide-react';
import type { SettingsGroup, Subsection } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { canOpenGroup, canSeeField, formatRelative, groupOf, L, RELATED, sameValue, sectionOf } from './data';
import { FieldRow } from './field-row';
import { CheckCard } from './journey';
import { useNav } from './nav';
import type { Check } from './readiness';
import { HistorySheet, ReviewSheet } from './sheets';
import { GatewaysPage, WhatsAppPage } from './special';
import { PageHidden } from './states';
import { displayAuthor, draftCount, effectiveValue, useSettings } from './store';
import { Btn, Card, IconTile, Pill } from './ui';

type StepState = 'todo' | 'blocked' | 'ready';

const SHOW_ALL_KEY = 'goteav-lab-v7:show-all-steps';
function readShowAll(): boolean {
  try {
    return window.localStorage.getItem(SHOW_ALL_KEY) === '1';
  } catch {
    return false;
  }
}
function writeShowAll(v: boolean) {
  try {
    window.localStorage.setItem(SHOW_ALL_KEY, v ? '1' : '0');
  } catch {
    /* storage blocked */
  }
}

function stepChecks(sub: Subsection, groupKey: string, checks: Check[]): Check[] {
  const keys = new Set(sub.fields.map((f) => f.key));
  return checks.filter(
    (c) =>
      c.status !== 'done' &&
      ((c.group === groupKey && keys.has(c.field)) || c.recommend?.some((r) => r.group === groupKey && keys.has(r.field))),
  );
}

function stateOf(list: Check[]): StepState {
  if (list.some((c) => c.status === 'todo')) return 'todo';
  if (list.some((c) => c.status === 'blocked')) return 'blocked';
  return 'ready';
}

export function GroupPage({ groupKey }: { groupKey: string }) {
  const { state } = useSettings();
  const group = groupOf(groupKey);
  if (!group || !canOpenGroup(groupKey, state.role)) return <PageHidden />;
  return (
    <>
      <GroupHeader group={group} />
      {group.key === 'payment_gateways' ? <GatewaysPage group={group} /> : group.key === 'whatsapp_provider' ? <WhatsAppPage group={group} /> : <Guided group={group} />}
      <HistorySheet group={group} />
      <ReviewSheet group={group} />
    </>
  );
}

function GroupHeader({ group }: { group: SettingsGroup }) {
  const { state, dispatch, t, lang } = useSettings();
  const nav = useNav();
  const section = sectionOf(group.section);
  const meta = state.meta[group.key];
  const related = (RELATED[group.key] ?? []).filter((k) => canOpenGroup(k, state.role));
  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!state.focus) headingRef.current?.focus({ preventScroll: true });
  }, [group.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <header className="mb-6">
      <nav aria-label={t.group.crumbRoot} className="flex flex-wrap items-center gap-1 text-13 text-muted-foreground">
        <button
          type="button"
          onClick={nav.overview}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg pe-2 font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Back className="size-4" aria-hidden />
          {t.group.crumbRoot}
        </button>
        <span aria-hidden>/</span>
        <span className="px-1">{L(section.title, lang)}</span>
      </nav>

      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <IconTile name={group.icon} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 ref={headingRef} tabIndex={-1} className="text-26 font-extrabold leading-tight tracking-tight outline-none">
                {L(group.title, lang)}
              </h1>
              {!group.inDashboard ? <Pill tone="violet">{t.badge.new}</Pill> : null}
              {group.key === 'payment_gateways' ? <Pill>{t.badge.ownerOnly}</Pill> : null}
              {group.approval === 'second-approver' ? <Pill>{t.badge.secondApprover}</Pill> : null}
              {group.approval === 'controls' ? <Pill>{t.badge.controls}</Pill> : null}
            </div>
            <p className="mt-1.5 max-w-[72ch] text-14 leading-relaxed text-muted-foreground">{L(group.description, lang)}</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-12 text-muted-foreground">
              <span className="font-semibold text-foreground">{t.group.version(meta.version)}</span>
              <span>{t.group.savedBy(displayAuthor(meta.updatedBy, t), formatRelative(meta.updatedAt, lang))}</span>
            </p>
          </div>
        </div>
        {group.kind === 'server' ? (
          <Btn variant="outline" onClick={() => dispatch({ type: 'sheet', sheet: 'history' })} className="self-start">
            <History aria-hidden />
            {t.group.history}
          </Btn>
        ) : null}
      </div>

      {!group.inDashboard ? (
        <p className="mt-4 flex max-w-[80ch] gap-2 rounded-xl bg-accent-violet/10 px-4 py-3 text-13 leading-relaxed">
          <ServerCog className="mt-0.5 size-4 shrink-0 text-accent-violet-on-soft" aria-hidden />
          <span>
            {t.group.newGroupNote}
            {group.attention ? <span className="mt-1 block text-muted-foreground">{L(group.attention, lang)}</span> : null}
          </span>
        </p>
      ) : null}

      {group.notes || related.length ? (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          {group.notes ? <p className="min-w-0 flex-1 text-13 leading-relaxed">{L(group.notes, lang)}</p> : null}
          {related.length ? (
            <div className={cn('flex flex-wrap items-center gap-1', !group.notes && 'flex-1')}>
              <span className="me-1 inline-flex items-center gap-1 text-12 font-semibold text-muted-foreground">
                <LinkIcon className="size-3.5" aria-hidden />
                {t.group.related}
              </span>
              {related.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => nav.group(k)}
                  className="inline-flex min-h-11 items-center rounded-lg bg-muted px-3 text-13 font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {L(groupOf(k)?.title, lang)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

function Guided({ group }: { group: SettingsGroup }) {
  const { state, checks, t, lang } = useSettings();
  const reduce = useReducedMotion();
  const steps = useMemo(
    () =>
      group.subsections.map((sub) => {
        const list = stepChecks(sub, group.key, checks);
        const edited = sub.fields.filter((f) => state.drafts[group.key] && f.key in state.drafts[group.key]).length;
        return { sub, checks: list, state: stateOf(list), edited };
      }),
    [group, checks, state.drafts],
  );
  const focusStep = state.focus ? steps.findIndex((s) => s.sub.fields.some((f) => f.key === state.focus)) : -1;
  const initial = focusStep >= 0 ? focusStep : Math.max(0, steps.findIndex((s) => s.state === 'todo'));
  const [openSet, setOpenSet] = useState<Set<number>>(() => (readShowAll() ? new Set(steps.map((_, i) => i)) : new Set([initial])));
  const allOpen = openSet.size === steps.length;
  useEffect(() => {
    if (focusStep >= 0) setOpenSet((s) => new Set(s).add(focusStep));
  }, [state.focusTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const fieldCount = group.subsections.reduce((n, s) => n + s.fields.length, 0);
  const toggleAll = () => {
    const next = !allOpen;
    writeShowAll(next);
    setOpenSet(next ? new Set(steps.map((_, i) => i)) : new Set([Math.max(0, steps.findIndex((s) => s.state === 'todo'))]));
  };

  const ready = steps.filter((s) => s.state === 'ready').length;
  const groupChecks = checks.filter((c) => c.group === group.key);

  const goStep = (i: number) => {
    setOpenSet((s) => (allOpen ? s : new Set([i])));
    window.setTimeout(() => document.getElementById(`step-${group.key}-${i}`)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }), 60);
  };

  return (
    <div className="grid grid-cols-1 gap-6 pb-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <motion.div
              className="h-full rounded-full bg-success"
              initial={false}
              animate={{ width: `${(ready / Math.max(steps.length, 1)) * 100}%` }}
              transition={{ duration: reduce ? 0 : 0.4 }}
            />
          </div>
          <p className="shrink-0 text-13 font-semibold text-muted-foreground" aria-live="polite">
            {t.group.stepsReady(ready, steps.length)}
          </p>
          {steps.length > 1 && fieldCount >= 15 ? (
            <Btn variant="outline" aria-pressed={allOpen} onClick={toggleAll} className="shrink-0 px-3 text-13">
              {allOpen ? t.group.collapseAll : t.group.showAll}
            </Btn>
          ) : null}
        </div>

        <ol className="relative">
          {steps.map((step, i) => (
            <Step
              key={step.sub.id}
              index={i}
              total={steps.length}
              group={group}
              step={step}
              open={openSet.has(i)}
              onToggle={() =>
                setOpenSet((s) => {
                  const n = new Set(s);
                  if (n.has(i)) n.delete(i);
                  else n.add(i);
                  return n;
                })
              }
              onNext={() => goStep(i + 1)}
              onPrev={() => goStep(i - 1)}
              last={i === steps.length - 1}
            />
          ))}
        </ol>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <Card className="p-4">
          <h2 className="text-14 font-bold">{t.group.checksHere}</h2>
          {groupChecks.length ? (
            <ul className="mt-3 space-y-2">
              {groupChecks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-13">
                  <span
                    className={cn(
                      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                      c.status === 'done' && 'bg-success/12 text-success-soft-foreground',
                      c.status === 'todo' && 'bg-warning/20 text-warning-soft-foreground',
                      c.status === 'blocked' && 'bg-accent-violet/12 text-accent-violet-on-soft',
                    )}
                    aria-hidden
                  >
                    {c.status === 'done' ? <CheckIcon className="size-3" /> : c.status === 'todo' ? <span className="size-1.5 rounded-full bg-current" /> : <ServerCog className="size-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold">{t.checks[c.id]?.title}</span>
                    <span className="block text-12 text-muted-foreground">{t.readiness[c.status]}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-13 text-muted-foreground">{t.group.noChecksHere}</p>
          )}
        </Card>
        <RecentVersions group={group} />
      </aside>
      <SaveBar group={group} />
    </div>
  );
}

function Step({
  index,
  total,
  group,
  step,
  open,
  onToggle,
  onNext,
  onPrev,
  last,
}: {
  index: number;
  total: number;
  group: SettingsGroup;
  step: { sub: Subsection; checks: Check[]; state: StepState; edited: number };
  open: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  last: boolean;
}) {
  const { state, dispatch, t, lang } = useSettings();
  const reduce = useReducedMotion();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const fields = step.sub.fields.filter((f) => canSeeField(group.key, f.key, state.role));
  const main = fields.filter((f) => !f.advanced);
  const advanced = fields.filter((f) => f.advanced);
  const focusInAdvanced = !!state.focus && advanced.some((f) => f.key === state.focus);
  useEffect(() => {
    if (focusInAdvanced) setAdvancedOpen(true);
  }, [state.focusTick, focusInAdvanced]);
  const resettable = fields.filter((f) => !f.readOnly && !f.structured && !sameValue(effectiveValue(state, group.key, f.key), f.default));
  const panelId = `step-panel-${group.key}-${index}`;
  const buttonId = `step-btn-${group.key}-${index}`;

  const marker =
    step.state === 'ready' ? (
      <span className="grid size-9 place-items-center rounded-full bg-success text-success-foreground">
        <CheckIcon className="size-4" aria-hidden />
      </span>
    ) : step.state === 'todo' ? (
      <span className="grid size-9 place-items-center rounded-full border-2 border-warning-strong bg-card text-14 font-bold">{index + 1}</span>
    ) : (
      <span className="grid size-9 place-items-center rounded-full border-2 border-dashed border-accent-violet bg-card text-14 font-bold">{index + 1}</span>
    );

  return (
    <li id={`step-${group.key}-${index}`} className="relative scroll-mt-6 pb-3 sm:ps-12">
      {!last ? <span aria-hidden className="absolute start-[17px] top-11 bottom-0 hidden w-0.5 rounded-full bg-border sm:block" /> : null}
      <div className={cn('absolute start-0 top-3 hidden sm:block', open && 'ring-4 ring-primary/15 rounded-full')}>{marker}</div>
      <div className={cn('rounded-2xl border bg-card transition-shadow', open ? 'border-border shadow-sm' : 'border-transparent bg-transparent')}>
        <h2>
          <button
            id={buttonId}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={onToggle}
            className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-start hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-12 font-semibold text-muted-foreground">{t.group.stepOf(index + 1, total)}</span>
              <span className="block text-16 font-bold leading-snug">{L(step.sub.title, lang)}</span>
              {!open ? <span className="mt-0.5 line-clamp-2 text-13 text-muted-foreground">{L(step.sub.description, lang)}</span> : null}
            </span>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {step.edited ? <Pill tone="info">{t.group.stepEdited(step.edited)}</Pill> : null}
              <Pill tone={step.state === 'ready' ? 'success' : step.state === 'todo' ? 'warning' : 'violet'}>
                {step.state === 'ready' ? t.group.stepReady : step.state === 'todo' ? t.group.stepTodo : t.group.stepBlocked}
              </Pill>
              <ChevronDown className={cn('size-5 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
            </span>
          </button>
        </h2>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="px-1 pb-4 sm:px-2">
                <p className="px-3 pb-2 text-13 leading-relaxed text-muted-foreground sm:px-4">{L(step.sub.description, lang)}</p>
                <div className="divide-y divide-border">
                  {main.map((f) => (
                    <FieldRow key={f.key} groupKey={group.key} field={f} focusTick={state.focus === f.key ? state.focusTick : undefined} />
                  ))}
                </div>
                {advanced.length ? (
                  <div className="mx-2 mt-2 rounded-xl border border-border sm:mx-3">
                    <button
                      type="button"
                      aria-expanded={advancedOpen}
                      onClick={() => setAdvancedOpen((v) => !v)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-start focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span>
                        <span className="block text-13 font-bold">{t.group.advanced(advanced.length)}</span>
                        <span className="block text-12 text-muted-foreground">{t.group.advancedHint}</span>
                      </span>
                      <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', advancedOpen && 'rotate-180')} aria-hidden />
                    </button>
                    {advancedOpen ? (
                      <div className="divide-y divide-border border-t border-border">
                        {advanced.map((f) => (
                          <FieldRow key={f.key} groupKey={group.key} field={f} focusTick={state.focus === f.key ? state.focusTick : undefined} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 pt-3 sm:px-4">
                  {resettable.length ? (
                    <Btn
                      variant="ghost"
                      onClick={() =>
                        dispatch({ type: 'stage', group: group.key, values: Object.fromEntries(resettable.map((f) => [f.key, f.default])) })
                      }
                    >
                      <RotateCcw aria-hidden />
                      {t.group.resetStep}
                    </Btn>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2">
                    {index > 0 ? (
                      <Btn variant="outline" onClick={onPrev}>
                        {t.group.prev}
                      </Btn>
                    ) : null}
                    {!last ? (
                      <Btn onClick={onNext}>{t.group.next}</Btn>
                    ) : draftCount(state, group.key) ? (
                      <Btn onClick={() => dispatch({ type: 'sheet', sheet: 'review' })}>{t.group.finish}</Btn>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </li>
  );
}

function RecentVersions({ group }: { group: SettingsGroup }) {
  const { state, dispatch, t, lang } = useSettings();
  const entries = (state.history[group.key] ?? []).slice(0, 3);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-14 font-bold">{t.group.history}</h2>
        <Btn variant="ghost" className="h-11 px-3 text-13" onClick={() => dispatch({ type: 'sheet', sheet: 'history' })}>
          <History aria-hidden />
          {t.group.history}
        </Btn>
      </div>
      {entries.length ? (
        <ol className="mt-2 space-y-3">
          {entries.map((e) => (
            <li key={e.version} className="text-13">
              <p className="font-semibold">
                {t.group.version(e.version)}
                {e.version === state.meta[group.key].version ? <span className="ms-2 text-12 font-medium text-success-soft-foreground">{t.history.current}</span> : null}
              </p>
              <p className="text-12 text-muted-foreground">
                {displayAuthor(e.by, t)}, {formatRelative(e.at, lang)}
              </p>
              {e.note ? <p className="mt-0.5 text-12">{L(e.note, lang)}</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-13 text-muted-foreground">{t.history.empty}</p>
      )}
    </Card>
  );
}

export function SaveBar({ group }: { group: SettingsGroup }) {
  const { state, dispatch, t, lang } = useSettings();
  const n = draftCount(state, group.key);
  const meta = state.meta[group.key];
  const [nudge, setNudge] = useState(false);
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:-mx-6 sm:px-6 lg:col-span-2 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0" aria-live="polite">
          {n ? (
            <p className="flex items-center gap-2 text-14 font-bold">
              <span className="size-2 rounded-full bg-info" aria-hidden />
              {t.save.unsaved(n)}
            </p>
          ) : (
            <p className="text-13 text-muted-foreground">
              <span className="font-semibold text-foreground">{t.save.upToDate}</span>
              <span className="mx-2" aria-hidden>
                <CheckIcon className="inline size-3.5 text-success" />
              </span>
              {t.save.lastSaved(meta.version, displayAuthor(meta.updatedBy, t), formatRelative(meta.updatedAt, lang))}
            </p>
          )}
          {nudge && !n ? <p className="text-12 text-muted-foreground">{t.save.nothing}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {n ? (
            <Btn
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => {
                dispatch({ type: 'discard', group: group.key });
                dispatch({ type: 'toast', text: t.save.discarded });
              }}
            >
              {t.save.discard}
            </Btn>
          ) : null}
          <Btn
            className="flex-1 sm:flex-none"
            onClick={() => {
              if (!n) {
                setNudge(true);
                return;
              }
              dispatch({ type: 'sheet', sheet: 'review' });
            }}
          >
            <Sparkles aria-hidden className={cn(!n && 'hidden')} />
            {t.save.review}
          </Btn>
        </div>
      </div>
    </div>
  );
}
