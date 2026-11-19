'use client';

/**
 * @file onboarding-page.tsx
 * @description A numbered trail with the next step beside it. Ported from the design's `pages/onboarding/page.tsx`, including "Preview a role's path" for
 * owner and PM, which saves nothing.
 */
import { motion } from 'framer-motion';
import { BookOpen, Bot, Check, Compass, ExternalLink, PartyPopper } from 'lucide-react';
import { useRef } from 'react';

import {
  AppLink,
  Button,
  ChipGroup,
  cn,
  CopyButton,
  EmptyState,
  ErrorState,
  firstName,
  fmt,
  focusRing,
  kitMessages,
  LoadingRegion,
  navigate,
  num,
  openCard,
  PageContainer,
  PageHeader,
  plural,
  type PluralForms,
  type Role,
  RoleBadge,
  setQuery,
  showToast,
  Skeleton,
  useFilter,
  useKeyboardList,
  useLocale,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import type { DocCard } from '@/features/cards/types';
import { useDocTree } from '@/features/docs/queries';
import { setStepDone, useOnboarding, useRolePath } from '@/features/onboarding/queries';
import {
  docKeyOfStep,
  nextStepOf,
  type OnboardingStep,
  type StepPhase,
  type StepTarget,
  stepTarget,
} from '@/features/onboarding/steps';
import { isHubError } from '@/lib/api/errors';

import type catalog from '../../../messages/en/onboarding.json';

type Messages = Omit<typeof catalog, 'minutes'> & { minutes: PluralForms };

const PHASES: StepPhase[] = ['read', 'setup', 'work'];
const PREVIEW_ROLES: Role[] = ['frontend', 'backend', 'designer', 'qa', 'accountant', 'pm'];

function follow(target: StepTarget) {
  if (target.kind === 'card') openCard(target.card);
  else if (target.kind === 'external') window.open(target.href, '_blank', 'noreferrer');
  else navigate(target.view, { query: target.query });
}

/** One cell per step, in the steps' own order: a solid cell is that step done, even when an earlier one is not (review minor). */
function ProgressBar({ cells, label }: { cells: boolean[]; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={cells.length}
      aria-valuenow={cells.filter(Boolean).length}
      className="flex gap-1"
    >
      {cells.map((done, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none',
            done ? 'bg-foreground' : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
}

function openWord(t: Messages, step: OnboardingStep, target: StepTarget | null) {
  if (step.kind === 'doc') return t.open.doc;
  if (target?.kind === 'view' && target.view === 'tasks') return t.open.tasks;
  if (target?.kind === 'view' && target.view === 'settings') return t.open.settings;
  return t.open.card;
}

/** The one thing to do now: this page's focal point and its one filled button. */
function NextStep({
  step,
  index,
  target,
  onDone,
  preview,
}: {
  step: OnboardingStep;
  index: number;
  target: StepTarget | null;
  onDone: () => void;
  preview: boolean;
}) {
  const t = useT<Messages>('onboarding');
  const locale = useLocale();
  return (
    <section
      aria-labelledby="next-title"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:p-6"
    >
      <p className="text-body-sm font-medium text-muted-foreground">
        {t.next}
        <span className="ms-2 font-normal">{fmt(t.step, { n: num(index + 1, locale) })}</span>
      </p>
      <h2 id="next-title" className="text-title font-semibold text-pretty text-foreground">
        {step.title}
      </h2>
      {step.why && <p className="max-w-prose text-body-lg text-muted-foreground">{step.why}</p>}
      {step.command && <CopyButton text={step.command} className="self-start" />}
      {step.auto && (
        <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
          <Bot aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          {t.autoHint}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {target && (
          <Button variant="primary" disabled={preview} onClick={() => follow(target)}>
            {step.kind === 'doc' ? (
              <BookOpen aria-hidden className="size-4" strokeWidth={1.75} />
            ) : (
              <ExternalLink aria-hidden className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
            )}
            {openWord(t, step, target)}
          </Button>
        )}
        {!step.auto && (
          <Button
            disabled={preview}
            variant={target ? 'outline' : 'primary'}
            onClick={onDone}
            aria-keyshortcuts="d"
          >
            <Check aria-hidden className="size-4" strokeWidth={1.75} />
            {t.markDone}
          </Button>
        )}
        {step.minutes && (
          <span className="text-body-sm text-muted-foreground">
            {plural(step.minutes, locale, t.minutes)}
          </span>
        )}
      </div>
    </section>
  );
}

function StepTitle({ target, title }: { target: StepTarget | null; title: string }) {
  const className = cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing);
  if (!target) return <>{title}</>;
  if (target.kind === 'card') {
    return (
      <AppLink card={target.card} className={className}>
        {title}
      </AppLink>
    );
  }
  if (target.kind === 'external') {
    return (
      <a href={target.href} target="_blank" rel="noreferrer" className={className}>
        {title}
      </a>
    );
  }
  return (
    <AppLink view={target.view} query={target.query} className={className}>
      {title}
    </AppLink>
  );
}

function StepRow({
  step,
  n,
  current,
  many,
  preview,
  target,
  rowProps,
  onToggle,
}: {
  step: OnboardingStep;
  n: number;
  current: boolean;
  many: boolean;
  preview: boolean;
  target: StepTarget | null;
  rowProps: object;
  onToggle: () => void;
}) {
  const t = useT<Messages>('onboarding');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { done, title } = step;
  const mark = done ? (
    <Check aria-hidden className="size-4" strokeWidth={2.5} />
  ) : (
    <span aria-hidden>{num(n, locale)}</span>
  );
  return (
    <li
      {...rowProps}
      className="group relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* The trail: a line through the markers, solid where the member has been. */}
      <span
        aria-hidden
        className={cn(
          'absolute start-3.75 top-8 -bottom-1 w-0.5 group-last:hidden',
          done ? 'bg-foreground' : 'bg-border',
        )}
      />
      {step.auto || preview ? (
        <span
          className={cn(
            'relative z-10 mt-1 flex size-8 items-center justify-center rounded-full border text-caption font-semibold tabular-nums',
            done
              ? 'border-foreground bg-foreground text-background'
              : current
                ? 'border-foreground bg-card text-foreground'
                : 'border-border bg-card text-muted-foreground',
          )}
        >
          {mark}
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
            done
              ? 'border-foreground bg-foreground text-background'
              : current
                ? 'border-foreground bg-card text-foreground hover:bg-accent'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            focusRing,
          )}
        >
          {mark}
        </button>
      )}
      <div className="flex min-w-0 flex-col gap-0.5 pt-1.5 pb-5">
        <p className={cn('text-body-lg', done ? 'text-muted-foreground' : 'font-semibold text-foreground')}>
          <StepTitle target={preview ? null : target} title={title} />
        </p>
        {!done && step.why && <p className="text-body-sm text-muted-foreground">{step.why}</p>}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-muted-foreground">
          {step.kind === 'doc' && (
            <code dir="ltr" translate="no" className="key text-caption break-all">
              {step.ref}
            </code>
          )}
          {step.command && !done && <CopyButton text={step.command} compact />}
          {step.minutes && !done && <span>{plural(step.minutes, locale, t.minutes)}</span>}
          {step.auto && (
            <span className="inline-flex items-center gap-1" title={t.autoHint}>
              <Bot aria-hidden className="size-3.5" strokeWidth={1.75} />
              {done ? t.doneAuto : t.auto}
            </span>
          )}
          {many && <span className="sr-only">{step.roles.map((r) => kit.roles[r]).join(', ')}</span>}
        </div>
      </div>
    </li>
  );
}

const useDocKeyOf = () => {
  const tree = useDocTree();
  const all: readonly DocCard[] = tree.data?.all ?? [];
  return (step: OnboardingStep) => docKeyOfStep(step, all);
};

export function OnboardingPage() {
  const t = useT<Messages>('onboarding');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { ws } = useRoute();
  const { me, roles, isManager, workspace } = useSession();
  const previewRole = useFilter('preview') as Role | null;
  const preview = isManager && previewRole ? previewRole : null;
  const heading = useRef<HTMLHeadingElement>(null);
  const mine = useOnboarding();
  const previewed = useRolePath(preview);
  const docKeyOf = useDocKeyOf();

  const query = preview ? previewed : mine;
  const steps: OnboardingStep[] = query.data?.steps ?? [];
  const activeRoles: Role[] = preview ? [preview] : roles;
  const shown = preview ? steps.map((s) => ({ ...s, done: false })) : steps;
  const doneCount = shown.filter((s) => s.done).length;
  const nextStep = nextStepOf(shown);
  const targetOf = (step: OnboardingStep) => stepTarget(step, docKeyOf(step));

  const toggle = (step: OnboardingStep) => {
    if (preview || step.auto) return;
    const was = step.done;
    const fail = (error: unknown) =>
      showToast({ message: isHubError(error) ? error.message : kit.actionFailed, tone: 'error' });
    void setStepDone(ws, step.id, !was).catch(fail);
    if (!was) {
      showToast({
        message: fmt(t.markedDone, { title: step.title }),
        onUndo: () => void setStepDone(ws, step.id, false).catch(fail),
      });
    }
  };

  const list = useKeyboardList({
    ids: shown.map((s) => s.id),
    emptyFocusRef: heading,
    onOpen: (id) => {
      const step = shown.find((s) => s.id === id);
      const target = step && targetOf(step);
      if (target) follow(target);
    },
    actions: {
      d: (id) => {
        const step = shown.find((s) => s.id === id);
        if (step) toggle(step);
      },
    },
  });

  const name = firstName(me.name) ?? '';
  const project = workspace?.name ?? '';
  const title = fmt(t.title, { name, project });
  const allDone = !preview && shown.length > 0 && !nextStep;
  const header = (
    <PageHeader
      title={title}
      meta={
        query.isPending || query.isError || !shown.length ? undefined : (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{fmt(t.progress, { done: num(doneCount, locale), total: num(shown.length, locale) })}</span>
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

  const previewChips = isManager && (
    <ChipGroup
      label={t.preview.label}
      options={[
        { value: 'mine', label: t.preview.mine },
        ...PREVIEW_ROLES.map((r) => ({ value: r, label: kit.roles[r] })),
      ]}
      isActive={(value) => (value === 'mine' ? !preview : preview === value)}
      onPick={(value) => setQuery({ preview: value === 'mine' ? null : value })}
    />
  );

  if (query.isError) {
    const error = query.error;
    return (
      <PageContainer>
        {header}
        <ErrorState
          thing={t.errorThing}
          code={isHubError(error) ? error.code : 'hub.onboarding.unavailable'}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void query.refetch()}
        />
      </PageContainer>
    );
  }
  if (query.isPending) {
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
  if (shown.length === 0) {
    const linkClass = cn(
      'inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9',
      focusRing,
    );
    return (
      <PageContainer>
        <PageHeader title={title} />
        {previewChips}
        <EmptyState
          size="page"
          icon={Compass}
          // Speak to the person who can act: a manager sets the path, in Settings › General (review M8).
          title={
            isManager
              ? t.emptyTitleManager
              : fmt(t.emptyTitle, {
                  role: roles.map((r) => kit.roles[r]).join(locale === 'ar' ? '، ' : ', '),
                })
          }
          action={
            isManager ? (
              <AppLink view="settings" query={{ tab: 'general' }} className={linkClass}>
                {t.emptyActionManager}
              </AppLink>
            ) : (
              <AppLink view="docs" className={linkClass}>
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

  const nextIndex = nextStep ? shown.indexOf(nextStep) : -1;

  return (
    <PageContainer>
      {header}
      <ProgressBar cells={shown.map((s) => s.done)} label={t.progressLabel} />

      {previewChips}
      {preview && (
        <p className="rounded-md bg-muted px-3 py-2 text-body-sm text-foreground">
          {fmt(t.preview.banner, { role: kit.roles[preview] })}{' '}
          <AppLink
            view="settings"
            query={{ tab: 'general' }}
            className={cn('font-medium text-primary underline-offset-4 hover:underline', focusRing)}
          >
            {t.preview.settings}
          </AppLink>
        </p>
      )}

      {/* "You are here" stays in view beside the map of the whole path. On a phone it comes first. */}
      <div className="grid items-start gap-8 lg:@page-lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="lg:@page-lg:sticky lg:@page-lg:top-18">
          {allDone ? (
            <motion.section
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
              aria-labelledby="done-title"
              className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 md:p-6"
            >
              <PartyPopper aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.75} />
              <h2 id="done-title" className="text-title font-semibold text-foreground">
                {t.doneTitle}
              </h2>
              <p className="text-body text-muted-foreground">{t.doneBody}</p>
              <AppLink
                view="today"
                className={cn(
                  'mt-2 inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9',
                  focusRing,
                )}
              >
                {t.goToday}
              </AppLink>
            </motion.section>
          ) : (
            nextStep && (
              <NextStep
                step={nextStep}
                index={nextIndex}
                target={targetOf(nextStep)}
                onDone={() => toggle(nextStep)}
                preview={!!preview}
              />
            )
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {PHASES.filter((phase) => shown.some((s) => s.phase === phase)).map((phase, i) => (
            <section key={phase} aria-labelledby={`phase-${phase}`} className="flex flex-col gap-3">
              <h2
                ref={i === 0 ? heading : undefined}
                id={`phase-${phase}`}
                tabIndex={-1}
                className="text-title-sm font-semibold text-foreground outline-none"
              >
                {t.phases[phase]}
              </h2>
              <ol data-hub-list className="flex flex-col">
                {shown
                  .filter((s) => s.phase === phase)
                  .map((step) => (
                    <StepRow
                      key={step.id}
                      step={step}
                      n={shown.indexOf(step) + 1}
                      current={step === nextStep}
                      many={activeRoles.length > 1}
                      preview={!!preview}
                      target={targetOf(step)}
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
