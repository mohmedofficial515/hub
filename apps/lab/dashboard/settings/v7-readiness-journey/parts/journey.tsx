// Setup mode: the journey through the 8 sections. Each stop lists its open checks as "needs setup" cards; done
// checks fold into a disclosure so the route stays short.
import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check as CheckIcon, ChevronDown, CircleDot, Construction, Lock, ServerCog, Sparkles } from 'lucide-react';
import { SETTINGS_SECTIONS, type FieldValue, type SectionId } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { canOpenGroup, findField, groupOf, L, sectionOf } from './data';
import { MiniRing } from './dial';
import { useFmt, useNav } from './nav';
import { byUrgency, bySection, type Check, type CheckStatus } from './readiness';
import { useSettings } from './store';
import { Btn, Pill, Segmented, Tip } from './ui';

type Filter = 'todo' | 'blocked' | 'done' | 'all';

const matches = (f: Filter, c: Check) => {
  if (f === 'all') return true;
  if (f === 'todo') return c.status === 'todo';
  return c.status === f;
};

export function Journey() {
  const { t, checks, lang } = useSettings();
  const [filter, setFilter] = useState<Filter>('todo');
  const [showAll, setShowAll] = useState(false);
  const sections = useMemo(() => bySection(checks), [checks]);
  const count = (f: Filter) => checks.filter((c) => matches(f, c)).length;
  const withItems = sections.filter((s) => s.checks.some((c) => matches(filter, c)));
  const visible = showAll || filter === 'all' ? sections : withItems;
  const hidden = sections.length - withItems.length;
  const ownTodo = count('todo');

  return (
    <section aria-labelledby="journey-title" className="mt-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[60ch]">
          <h2 id="journey-title" className="text-20 font-bold">
            {t.readiness.journeyTitle}
          </h2>
          <p className="mt-1 text-14 leading-relaxed text-muted-foreground">{t.readiness.journeyHint}</p>
        </div>
        <Segmented<Filter>
          label={t.readiness.filterLabel}
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setShowAll(false);
          }}
          className="self-start lg:self-auto"
          options={(
            [
              ['todo', t.readiness.filterTodo],
              ['blocked', t.readiness.filterBlocked],
              ['done', t.readiness.filterDone],
              ['all', t.readiness.filterAll],
            ] as const
          ).map(([value, label]) => ({
            value,
            label,
            badge: <span className="text-12 font-medium text-muted-foreground tabular-nums">{count(value)}</span>,
          }))}
        />
      </div>

      {filter === 'todo' && ownTodo === 0 ? (
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background text-success" aria-hidden>
            <CheckIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-16 font-bold">{t.readiness.launchReady}</p>
            <p className="text-13 text-muted-foreground">{t.readiness.launchReadyHint}</p>
          </div>
        </div>
      ) : (
        <ol className="mt-8">
          {visible.map(({ id, checks: list, tally }, i) => {
            const section = sectionOf(id);
            const number = sections.findIndex((s) => s.id === id) + 1;
            const shown = list.filter((c) => matches(filter, c)).sort(byUrgency);
            const openCards = shown.filter((c) => c.status !== 'done');
            const doneRows = shown.filter((c) => c.status === 'done');
            const last = i === visible.length - 1;
            return (
              <li key={id} id={`stop-${id}`} className="relative scroll-mt-6 pb-8 ps-14 last:pb-0">
                {!last ? <span aria-hidden className="absolute start-[21px] top-12 bottom-1 w-0.5 rounded-full bg-border" /> : null}
                <div className="absolute start-0 top-0">
                  <MiniRing tally={tally} label={String(number)} />
                </div>
                <header className="flex min-h-11 flex-col justify-center gap-0.5">
                  <h3 className="text-17 font-bold leading-snug">{L(section.title, lang)}</h3>
                  <p className="text-13 text-muted-foreground">{L(section.description, lang)}</p>
                  <p className="text-12 font-semibold text-muted-foreground tabular-nums">{t.readiness.stopCounts(tally.todo, tally.blocked, tally.done)}</p>
                </header>
                <div className="mt-4 space-y-3">
                  <AnimatePresence initial={false}>
                    {openCards.map((check) => (
                      <CheckCard key={check.id} check={check} />
                    ))}
                  </AnimatePresence>
                  {shown.length === 0 ? (
                    <p className="flex items-center gap-2 text-13 font-semibold text-success-soft-foreground">
                      <CheckIcon className="size-4" aria-hidden />
                      {tally.todo === 0 ? t.readiness.sectionDone : t.readiness.stopClear}
                    </p>
                  ) : null}
                  {filter === 'done' || filter === 'all' ? (doneRows.length ? <DoneList checks={doneRows} /> : null) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {filter !== 'all' && hidden > 0 && !(filter === 'todo' && ownTodo === 0) ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 ps-14">
          {!showAll ? <p className="text-13 text-muted-foreground">{t.readiness.othersQuiet(hidden)}</p> : null}
          <Btn variant="outline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t.readiness.hideOthers : t.readiness.showOthers}
          </Btn>
        </div>
      ) : null}
    </section>
  );
}

function DoneDisclosure({ checks, sectionId }: { checks: Check[]; sectionId: SectionId }) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  if (!checks.length) return null;
  const panel = `done-${sectionId}`;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-13 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 -ms-2"
      >
        <CheckIcon className="size-4 text-success" aria-hidden />
        {t.readiness.doneToggle(checks.length)}
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panel}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <DoneList checks={checks} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function DoneList({ checks }: { checks: Check[] }) {
  const { t, state, lang } = useSettings();
  const nav = useNav();
  const fmt = useFmt();
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {checks.map((check) => {
        const text = t.checks[check.id];
        const target = findField(check.group, check.field);
        const value = target ? fmt(target.field, state.saved[check.group]?.[check.field]) : '';
        const can = canOpenGroup(check.group, state.role);
        return (
          <li key={check.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success/12 text-success-soft-foreground" aria-hidden>
              <CheckIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-14 font-semibold">{text?.title ?? L(check.fallbackText, lang)}</p>
              <p className="truncate text-12 text-muted-foreground">
                {L(groupOf(check.group)?.title, lang)}
                {value ? <span className="mx-1.5">|</span> : null}
                {value ? <bdi>{value}</bdi> : null}
              </p>
            </div>
            {can ? (
              <Btn variant="ghost" className="h-11 px-3 text-13" onClick={() => nav.group(check.group, check.field)}>
                {t.check.open}
              </Btn>
            ) : (
              <Pill icon={<Lock />}>{t.check.ownerOnly}</Pill>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const STATUS_ICON: Record<CheckStatus, { icon: typeof CircleDot; cls: string }> = {
  todo: { icon: CircleDot, cls: 'text-warning-strong' },
  blocked: { icon: ServerCog, cls: 'text-accent-violet-on-soft' },
  done: { icon: CheckIcon, cls: 'text-success' },
};

export function CheckCard({ check, compact }: { check: Check; compact?: boolean }) {
  const { t, state, lang } = useSettings();
  const nav = useNav();
  const fmt = useFmt();
  const reduce = useReducedMotion();
  const text = t.checks[check.id];
  const group = groupOf(check.group);
  const target = findField(check.group, check.field);
  const now = target ? fmt(target.field, state.saved[check.group]?.[check.field]) : '';
  const recommended = check.recommend?.find((r) => r.field === check.field) ?? check.recommend?.[0];
  const recField = recommended ? findField(recommended.group, recommended.field)?.field : undefined;
  const recText = recommended && recField ? fmt(recField, recommended.value as FieldValue) : '';
  const can = canOpenGroup(check.group, state.role);
  const { icon: StatusIcon, cls } = STATUS_ICON[check.status];
  const path = [L(sectionOf(check.section).title, lang), L(group?.title, lang), L(target?.subsection.title, lang)].filter(Boolean);
  const canApply = check.status === 'todo' && !!recommended && can;

  return (
    <motion.article
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={cn('rounded-xl border border-border bg-card p-4', !compact && 'sm:p-5')}
      aria-labelledby={`check-${check.id}`}
    >
      <div className={cn('flex flex-col gap-4', !compact && 'lg:flex-row lg:items-center')}>
        <div className="flex min-w-0 flex-1 gap-3">
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background', cls)} aria-hidden>
            <StatusIcon className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h4 id={`check-${check.id}`} className="text-15 font-bold leading-snug">
                {text?.title ?? L(group?.title, lang)}
              </h4>
              <span className="sr-only">{t.readiness[check.status]}</span>
              {check.priority && check.status === 'todo' ? <Pill tone={check.priority === 'P0' ? 'danger' : 'neutral'}>{check.priority}</Pill> : null}
              {check.priority && check.status === 'blocked' ? (
                <span className="text-12 font-medium text-muted-foreground">
                  {check.priority} {t.check.forBackend}
                </span>
              ) : null}
              <KindBadge check={check} />
            </div>
            <p className="mt-1 text-14 leading-relaxed">{text?.missing || L(check.fallbackText, lang)}</p>
            {text?.why ? (
              <p className="mt-1 text-13 leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground/80">{t.group.whyMatters}: </span>
                {text.why}
              </p>
            ) : null}
            <p className="mt-2 text-12 text-muted-foreground">
              <span className="sr-only">{t.check.path}: </span>
              {path.join(' › ')}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {target ? (
                <span className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md bg-muted px-2 text-12">
                  <span className="text-muted-foreground">{t.check.now}</span>
                  <bdi className="truncate font-semibold">{now}</bdi>
                </span>
              ) : null}
              {recText ? (
                <span className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md bg-success/12 px-2 text-12 text-success-soft-foreground">
                  <Sparkles className="size-3.5" aria-hidden />
                  <span>{t.check.recommended}</span>
                  <bdi className="truncate font-bold">{recText}</bdi>
                </span>
              ) : text?.fix ? (
                <span className="text-12 font-medium text-foreground/80">{text.fix}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className={cn('flex flex-wrap gap-2 ps-12', !compact && 'lg:w-auto lg:shrink-0 lg:flex-col lg:items-stretch lg:ps-0')}>
          {canApply ? (
            <Btn onClick={() => nav.apply(check)} className="flex-1 sm:flex-none">
              <Sparkles aria-hidden />
              {t.check.apply}
            </Btn>
          ) : null}
          {can ? (
            <Btn
              variant={canApply ? 'outline' : check.status === 'todo' ? 'default' : 'outline'}
              onClick={() => nav.group(check.group, check.field)}
              className="flex-1 sm:flex-none"
            >
              {check.status === 'todo' && !recommended ? t.check.fill : t.check.open}
            </Btn>
          ) : (
            <Pill icon={<Lock />}>{t.check.ownerOnly}</Pill>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function KindBadge({ check }: { check: Check }) {
  const { t } = useSettings();
  if (check.kind === 'proposed') {
    return (
      <Tip content={t.check.proposalTip(check.proposalId ?? '', check.priority ?? '')}>
        <button type="button" className="-my-2.5 inline-flex min-h-11 items-center rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Pill tone="violet" icon={<ServerCog />}>
            {t.badge.proposed} {check.proposalId}
          </Pill>
        </button>
      </Tip>
    );
  }
  if (check.kind === 'env') {
    return (
      <Tip content={t.check.envTip(check.env ?? '')}>
        <button type="button" className="-my-2.5 inline-flex min-h-11 items-center rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Pill tone="violet" icon={<ServerCog />}>
            <span dir="ltr">{check.env}</span>
          </Pill>
        </button>
      </Tip>
    );
  }
  if (check.kind === 'dashboard') {
    return (
      <Tip content={t.check.dashboardTip}>
        <button type="button" className="-my-2.5 inline-flex min-h-11 items-center rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Pill tone="violet" icon={<Construction />}>
            {t.badge.new} {check.proposalId}
          </Pill>
        </button>
      </Tip>
    );
  }
  return null;
}
