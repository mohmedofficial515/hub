import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Bot, Check, Compass, ExternalLink, PartyPopper } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { isStepDone, onboardingSteps, setStepDone, stepsFor, type OnboardingStep, type StepPhase } from '@lab/mocks/hub-app/onboarding';
import { docRefs } from '@lab/mocks/hub-app/docs';
import type { Role } from '@lab/mocks/hub-app';
import { AppLink, Button, ChipGroup, cn, CopyButton, EmptyState, ErrorState, firstName, fmt, focusRing, kitMessages, LoadingRegion, navigate, notifyCardStore, num, PageContainer, PageHeader, plural, RoleBadge, setQuery, showToast, Skeleton, useFilter, useKeyboardList, useSession, type ViewId } from '../../kit';
import { messages } from './i18n';

const PHASES: StepPhase[] = ['read', 'setup', 'work'];

export default function Page() {
  const { scenario } = useSession();
  return <Onboarding key={scenario} />;
}

/** Where a step leads: the doc viewer for a doc, otherwise the view named by the step. */
function stepTarget(step: OnboardingStep): { view: ViewId; query?: Record<string, string> } | null {
  if (step.kind === 'doc') {
    const key = docRefs.find((d) => d.path === step.ref)?.key;
    return key ? { view: 'docs', query: { doc: key } } : { view: 'docs' };
  }
  if (step.kind === 'card') return { view: step.ref as ViewId };
  if (step.view) return { view: step.view, query: step.query };
  return null;
}

/** One cell per step, in the steps' own order: a solid cell is that step done, even when an earlier one is not (review minor). */
function ProgressBar({ cells, label }: { cells: boolean[]; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={cells.length} aria-valuenow={cells.filter(Boolean).length} className="flex gap-1">
      {cells.map((done, i) => (
        <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none', done ? 'bg-foreground' : 'bg-muted')} />
      ))}
    </div>
  );
}

/** The one thing to do now: this page's focal point and its one filled button. */
function NextStep({ step, index, onDone, preview }: { step: OnboardingStep; index: number; onDone: () => void; preview: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const target = stepTarget(step);
  const openWord = step.kind === 'doc' ? t.open.doc : step.view === 'tasks' ? t.open.tasks : step.view === 'settings' ? t.open.settings : t.open.card;
  return (
    <section aria-labelledby="next-title" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:p-6">
      <p className="text-body-sm font-medium text-muted-foreground">
        {t.next}
        <span className="ms-2 font-normal">
          {fmt(t.step, { n: num(index + 1, locale) })}
        </span>
      </p>
      <h2 id="next-title" className="text-title font-semibold text-pretty text-foreground">
        {step.title[locale]}
      </h2>
      <p className="max-w-prose text-body-lg text-muted-foreground">{step.why[locale]}</p>
      {step.command && <CopyButton text={step.command} className="self-start" />}
      {step.auto && (
        <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
          <Bot aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          {step.auto[locale]}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {target && (
          <Button variant="primary" disabled={preview} onClick={() => navigate(target.view, { query: target.query })}>
            {step.kind === 'doc' ? <BookOpen aria-hidden className="size-4" strokeWidth={1.75} /> : <ExternalLink aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />}
            {openWord}
          </Button>
        )}
        {!step.auto && (
          <Button disabled={preview} variant={target ? 'outline' : 'primary'} onClick={onDone} aria-keyshortcuts="d">
            <Check aria-hidden className="size-4" strokeWidth={1.75} />
            {t.markDone}
          </Button>
        )}
        {step.minutes && <span className="text-body-sm text-muted-foreground">{plural(step.minutes, locale, t.minutes)}</span>}
      </div>
    </section>
  );
}

function StepRow({
  step,
  n,
  done,
  current,
  many,
  preview,
  rowProps,
  onToggle,
}: {
  step: OnboardingStep;
  n: number;
  done: boolean;
  current: boolean;
  many: boolean;
  preview: boolean;
  rowProps: object;
  onToggle: () => void;
}) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const target = stepTarget(step);
  const title = step.title[locale];
  return (
    <li {...rowProps} className="group relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      {/* The trail: a line through the markers, solid where the member has been. */}
      <span aria-hidden className={cn('absolute start-3.75 top-8 -bottom-1 w-0.5 group-last:hidden', done ? 'bg-foreground' : 'bg-border')} />
      {step.auto || preview ? (
        <span className={cn('relative z-10 mt-1 flex size-8 items-center justify-center rounded-full border text-caption font-semibold tabular-nums', done ? 'border-foreground bg-foreground text-background' : current ? 'border-foreground bg-card text-foreground' : 'border-border bg-card text-muted-foreground')}>
          {done ? <Check aria-hidden className="size-4" strokeWidth={2.5} /> : <span aria-hidden>{num(n, locale)}</span>}
          <span className="sr-only">{`${fmt(t.step, { n })}: ${done ? t.doneWord : t.todoWord}`}</span>
        </span>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`${title}: ${done ? t.undoDone : t.markDone}`}
          aria-keyshortcuts="d"
          onClick={onToggle}
          className={cn(
            'relative z-10 mt-1 flex size-8 items-center justify-center rounded-full border text-caption font-semibold tabular-nums transition-colors duration-120 hit-44',
            done ? 'border-foreground bg-foreground text-background' : current ? 'border-foreground bg-card text-foreground hover:bg-accent' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            focusRing,
          )}
        >
          {done ? <Check aria-hidden className="size-4" strokeWidth={2.5} /> : <span aria-hidden>{num(n, locale)}</span>}
        </button>
      )}
      <div className="flex min-w-0 flex-col gap-0.5 pt-1.5 pb-5">
        <p className={cn('text-body-lg', done ? 'text-muted-foreground' : 'font-semibold text-foreground')}>
          {target && !preview ? (
            <AppLink view={target.view} query={target.query} className={cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing)}>
              {title}
            </AppLink>
          ) : (
            title
          )}
        </p>
        {!done && <p className="text-body-sm text-muted-foreground">{step.why[locale]}</p>}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-muted-foreground">
          {step.kind === 'doc' && (
            <code dir="ltr" translate="no" className="key text-caption break-all">
              {step.ref}
            </code>
          )}
          {step.command && !done && <CopyButton text={step.command} compact />}
          {step.minutes && !done && <span>{plural(step.minutes, locale, t.minutes)}</span>}
          {step.auto && (
            <span className="inline-flex items-center gap-1" title={step.auto[locale]}>
              <Bot aria-hidden className="size-3.5" strokeWidth={1.75} />
              {done ? t.doneAuto : t.auto}
            </span>
          )}
          {many && step.roles.length < 7 && <span className="sr-only">{step.roles.map((r) => kit.roles[r]).join(', ')}</span>}
        </div>
      </div>
    </li>
  );
}

function Onboarding() {
  const t = useT(messages);
  const locale = useLocale();
  const { loading, error, scenario, me, roles, isManager } = useSession();
  const previewRole = useFilter('preview') as Role | null;
  const preview = isManager && previewRole ? previewRole : null;
  const heading = useRef<HTMLHeadingElement>(null);
  // Progress is kept in the mock, which sits outside React. This re-renders the page; the store's notice does the sidebar.
  const [, setTick] = useState(0);

  const activeRoles: Role[] = preview ? [preview] : roles;
  const steps = stepsFor(activeRoles);
  const doneOf = (s: OnboardingStep) => (preview ? false : isStepDone(me.id, s));
  const doneCount = steps.filter(doneOf).length;
  const nextStep = steps.find((s) => !doneOf(s));

  const toggle = (step: OnboardingStep) => {
    if (preview || step.auto) return;
    const was = isStepDone(me.id, step);
    setStepDone(me.id, step.id, !was);
    setTick((n) => n + 1);
    notifyCardStore();
    if (!was) {
      showToast({
        message: fmt(t.markedDone, { title: step.title[locale] }),
        onUndo: () => {
          setStepDone(me.id, step.id, false);
          setTick((n) => n + 1);
          notifyCardStore();
        },
      });
    }
  };

  const open = (id: string) => {
    const step = onboardingSteps.find((s) => s.id === id);
    const target = step && stepTarget(step);
    if (target) navigate(target.view, { query: target.query });
  };
  const list = useKeyboardList({
    ids: steps.map((s) => s.id),
    emptyFocusRef: heading,
    onOpen: open,
    actions: {
      d: (id) => {
        const step = onboardingSteps.find((s) => s.id === id);
        if (step) toggle(step);
      },
    },
  });

  const name = firstName(me.name[locale]);
  const allDone = !preview && steps.length > 0 && !nextStep;
  const header = (
    <PageHeader
      title={fmt(t.title, { name })}
      meta={
        loading || error || !steps.length ? undefined : (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{fmt(t.progress, { done: num(doneCount, locale), total: num(steps.length, locale) })}</span>
            <span className="inline-flex flex-wrap items-center gap-1.5 text-body-sm">
              <span className="sr-only">{t.roles}</span>
              {activeRoles.map((r) => (
                <RoleBadge key={r} role={r} />
              ))}
            </span>
          </span>
        )
      }
    />
  );

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState thing={t.errorThing} code="hub.onboarding.unavailable" requestId="req_7f3ac21" onRetry={() => setQuery({ scenario: null })} />
      </PageContainer>
    );
  }
  if (loading) {
    return (
      <PageContainer>
        {header}
        <LoadingRegion label={t.loading}>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-52 w-full rounded-lg" />
          <div className="flex flex-col gap-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2 pt-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </LoadingRegion>
      </PageContainer>
    );
  }
  if (scenario === 'empty') {
    return (
      <PageContainer>
        <PageHeader title={fmt(t.title, { name })} />
        <EmptyState
          size="page"
          icon={Compass}
          // Speak to the person who can act: a manager sets the path, in Settings › General (review M8).
          title={isManager ? t.emptyTitleManager : fmt(t.emptyTitle, { role: roles.map((r) => kitMessages[locale].roles[r]).join('، ') })}
          action={
            isManager ? (
              <AppLink view="settings" query={{ tab: 'general' }} className={cn('inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9', focusRing)}>
                {t.emptyActionManager}
              </AppLink>
            ) : (
              <AppLink view="docs" className={cn('inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9', focusRing)}>
                {t.emptyAction}
              </AppLink>
            )
          }
        >
          {isManager ? t.emptyBodyManager : t.emptyBody}
        </EmptyState>
      </PageContainer>
    );
  }

  const nextIndex = nextStep ? steps.indexOf(nextStep) : -1;
  const roleKeys: Role[] = ['frontend', 'backend', 'designer', 'qa', 'accountant', 'pm'];

  return (
    <PageContainer>
      {header}
      <ProgressBar cells={steps.map(doneOf)} label={t.progressLabel} />

      {isManager && (
        <ChipGroup
          label={t.preview.label}
          options={[{ value: 'mine', label: t.preview.mine }, ...roleKeys.map((r) => ({ value: r, label: kitMessages[locale].roles[r] }))]}
          isActive={(value) => (value === 'mine' ? !preview : preview === value)}
          onPick={(value) => setQuery({ preview: value === 'mine' ? null : value })}
        />
      )}
      {preview && (
        <p className="rounded-md bg-muted px-3 py-2 text-body-sm text-foreground">
          {fmt(t.preview.banner, { role: kitMessages[locale].roles[preview] })}{' '}
          <AppLink view="settings" query={{ tab: 'general' }} className={cn('font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
            {t.preview.settings}
          </AppLink>
        </p>
      )}

      {/* "You are here" stays in view beside the map of the whole path. On a phone it comes first. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="lg:sticky lg:top-18">
          {allDone ? (
            <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }} aria-labelledby="done-title" className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 md:p-6">
              <PartyPopper aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.75} />
              <h2 id="done-title" className="text-title font-semibold text-foreground">
                {t.doneTitle}
              </h2>
              <p className="text-body text-muted-foreground">{t.doneBody}</p>
              <AppLink view="today" className={cn('mt-2 inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9', focusRing)}>
                {t.goToday}
              </AppLink>
            </motion.section>
          ) : (
            nextStep && <NextStep step={nextStep} index={nextIndex} onDone={() => toggle(nextStep)} preview={!!preview} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {PHASES.filter((phase) => steps.some((s) => s.phase === phase)).map((phase) => (
            <section key={phase} aria-labelledby={`phase-${phase}`} className="flex flex-col gap-3">
              <h2 ref={phase === 'read' ? heading : undefined} id={`phase-${phase}`} tabIndex={-1} className="text-title-sm font-semibold text-foreground outline-none">
                {t.phases[phase]}
              </h2>
              <ol data-hub-list className="flex flex-col">
                {steps
                  .filter((s) => s.phase === phase)
                  .map((step) => (
                    <StepRow
                      key={step.id}
                      step={step}
                      n={steps.indexOf(step) + 1}
                      done={doneOf(step)}
                      current={step === nextStep}
                      many={activeRoles.length > 1}
                      preview={!!preview}
                      rowProps={list.rowProps(step.id)}
                      onToggle={() => toggle(step)}
                    />
                  ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
