// Loading skeletons, error, forbidden and permission-hidden states, the toast and the prototype controls.
import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CircleAlert, FlaskConical, Lock, ShieldOff } from 'lucide-react';
import { Skeleton } from '@dash/components/ui/skeleton';
import { useNav } from './nav';
import { useSettings, type Scenario } from './store';
import type { Role } from './data';
import { Btn, Card, Segmented } from './ui';

export function OverviewSkeleton() {
  const { t } = useSettings();
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t.states.loading}</span>
      <Card className="grid gap-8 p-5 sm:p-8 md:grid-cols-[15rem_minmax(0,1fr)] md:items-center">
        <Skeleton className="mx-auto aspect-square w-full max-w-60 rounded-full" />
        <div className="space-y-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-11 w-64" />
          <div className="grid gap-3 pt-4 sm:grid-cols-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </div>
      </Card>
      <div className="mt-10 space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useSettings();
  return (
    <Card className="grid place-items-center gap-3 px-6 py-14 text-center" role="alert">
      <span className="grid size-12 place-items-center rounded-full border border-border bg-background text-destructive">
        <CircleAlert className="size-6" aria-hidden />
      </span>
      <h2 className="text-18 font-bold">{t.states.errorTitle}</h2>
      <p className="max-w-[52ch] text-14 leading-relaxed text-muted-foreground">{t.states.errorBody}</p>
      <Btn onClick={onRetry}>{t.states.retry}</Btn>
    </Card>
  );
}

export function Forbidden() {
  const { t } = useSettings();
  return (
    <Card className="grid place-items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full border border-border bg-background text-muted-foreground">
        <ShieldOff className="size-6" aria-hidden />
      </span>
      <h2 className="text-18 font-bold">{t.states.forbiddenTitle}</h2>
      <p className="max-w-[52ch] text-14 leading-relaxed text-muted-foreground">{t.states.forbiddenBody}</p>
    </Card>
  );
}

export function PageHidden() {
  const { t } = useSettings();
  const nav = useNav();
  return (
    <Card className="grid place-items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full border border-border bg-background text-muted-foreground">
        <Lock className="size-6" aria-hidden />
      </span>
      <h1 className="text-18 font-bold">{t.states.pageHiddenTitle}</h1>
      <p className="max-w-[52ch] text-14 leading-relaxed text-muted-foreground">{t.states.pageHiddenBody}</p>
      <Btn variant="outline" onClick={nav.overview}>
        {t.states.backToSettings}
      </Btn>
    </Card>
  );
}

export function Toast() {
  const { state, dispatch } = useSettings();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!state.toast) return;
    const timer = window.setTimeout(() => dispatch({ type: 'toastClear' }), 4200);
    return () => window.clearTimeout(timer);
  }, [state.toast, dispatch]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 sm:bottom-24" role="status" aria-live="polite">
      <AnimatePresence>
        {state.toast ? (
          <motion.p
            key={state.toast.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto max-w-md rounded-xl bg-foreground px-4 py-3 text-center text-13 font-semibold text-background shadow-lg"
          >
            {state.toast.text}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function LabControls() {
  const { state, dispatch, t } = useSettings();
  return (
    <aside className="mt-16 rounded-2xl border border-dashed border-border px-4 py-4 sm:px-5" aria-labelledby="lab-controls">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="lab-controls" className="flex items-center gap-2 text-13 font-bold text-muted-foreground">
            <FlaskConical className="size-4" aria-hidden />
            {t.lab.title}
          </h2>
          <p className="text-12 text-muted-foreground">{t.lab.hint}</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-12 font-semibold text-muted-foreground">{t.lab.role}</span>
            <Segmented<Role>
              label={t.lab.role}
              value={state.role}
              onChange={(role) => dispatch({ type: 'role', role })}
              options={[
                { value: 'owner', label: t.lab.owner },
                { value: 'admin', label: t.lab.admin },
                { value: 'none', label: t.lab.none },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-12 font-semibold text-muted-foreground">{t.lab.scenario}</span>
            <Segmented<Scenario>
              label={t.lab.scenario}
              value={state.scenario}
              onChange={(scenario) => dispatch({ type: 'scenario', scenario })}
              options={[
                { value: 'default', label: t.lab.default },
                { value: 'loading', label: t.lab.loading },
                { value: 'empty', label: t.lab.empty },
                { value: 'error', label: t.lab.error },
              ]}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
