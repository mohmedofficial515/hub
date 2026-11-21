// Page chrome: scope switch (organisation / my preferences), the unsaved-changes tray, toasts, loading skeleton,
// error state and the lab-only preview controls (view as owner / admin, data state).

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Building2, CheckCircle2, Info, RefreshCw, ServerCrash, UserRound, X } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { loc } from './format';
import { groupByKey } from './model';
import { navigate, type Route } from './route';
import { useStore, type Scenario } from './store';
import { Btn, Segmented, focusRing } from './ui';

export function ScopeSwitch({ route }: { route: Route }) {
  const t = useT(messages);
  const items = [
    { id: 'org', label: t.scope.org, hint: t.scope.orgHint, icon: Building2, on: route.view !== 'prefs', go: () => navigate({ view: 'home' }) },
    { id: 'prefs', label: t.scope.prefs, hint: t.scope.prefsHint, icon: UserRound, on: route.view === 'prefs', go: () => navigate({ view: 'prefs' }) },
  ];
  return (
    <nav aria-label={t.scope.label} className="inline-flex max-w-full rounded-2xl bg-muted p-1">
      {items.map(({ id, label, hint, icon: Icon, on, go }) => (
        <button
          key={id}
          type="button"
          aria-current={on ? 'page' : undefined}
          onClick={go}
          title={hint}
          className={cn(
            'inline-flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3.5 text-14 font-semibold transition-colors',
            focusRing,
            on ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function TopBar({ route }: { route: Route }) {
  const t = useT(messages);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
      <ScopeSwitch route={route} />
      <p className="hidden text-12 text-muted-foreground md:block">{route.view === 'prefs' ? t.scope.prefsHint : t.scope.orgHint}</p>
    </div>
  );
}

export function Tray({ onReview }: { onReview: () => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const reduce = useReducedMotion();
  const n = store.dirtyCount();
  const groups = store.dirtyGroups.map((k) => loc(groupByKey(k)?.title, locale));
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.div
          role="region"
          aria-label={t.tray.region}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card p-3 ps-4 shadow-[0_18px_48px_-16px_rgb(0_0_0/0.35)] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-warning-strong ring-4 ring-warning/25" />
          <div className="min-w-0 flex-1 basis-40" aria-live="polite">
            <p className="text-14 font-bold">{t.n.unsaved(n)}</p>
            <p className="truncate text-12 text-muted-foreground">{t.tray.in(new Intl.ListFormat(locale, { style: 'narrow' }).format(groups))}</p>
          </div>
          <div className="flex gap-2 max-sm:w-full">
            <Btn variant="ghost" onClick={() => store.discard()} className="max-sm:flex-1">
              {t.tray.discard}
            </Btn>
            <Btn variant="primary" onClick={onReview} className="max-sm:flex-[2]">
              {t.tray.review}
            </Btn>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toasts({ raised }: { raised: boolean }) {
  const t = useT(messages);
  const store = useStore();
  const reduce = useReducedMotion();
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('pointer-events-none fixed inset-x-3 z-50 mx-auto flex max-w-md flex-col items-center gap-2', raised ? 'bottom-36 sm:bottom-28' : 'bottom-4')}
    >
      <AnimatePresence initial={false}>
        {store.toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="pointer-events-auto flex w-full items-center gap-3 rounded-xl bg-foreground py-2 ps-4 pe-1 text-14 font-medium text-background shadow-lg"
          >
            {toast.tone === 'done' ? <CheckCircle2 aria-hidden className="size-4 shrink-0" /> : <Info aria-hidden className="size-4 shrink-0" />}
            <span className="min-w-0 flex-1">{toast.text}</span>
            <button
              type="button"
              aria-label={t.common.dismiss}
              onClick={() => store.dismissToast(toast.id)}
              className={cn('grid size-11 shrink-0 place-items-center rounded-lg opacity-80 hover:opacity-100', focusRing)}
            >
              <X aria-hidden className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-muted motion-reduce:animate-none', className)} />;
}

export function LoadingState() {
  const t = useT(messages);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6" aria-busy="true">
      <p role="status" className="sr-only">
        {t.states.loading}
      </p>
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 pt-10 sm:pt-16">
        <Bone className="h-8 w-40" />
        <Bone className="h-4 w-72 max-w-full" />
        <Bone className="mt-4 h-16 w-full rounded-2xl" />
        <div className="flex flex-wrap justify-center gap-2">
          {['w-28', 'w-24', 'w-22', 'w-30', 'w-20'].map((w) => (
            <Bone key={w} className={cn('h-10 rounded-full', w)} />
          ))}
        </div>
      </div>
      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Bone className="h-5 w-32" />
          <div className="rounded-2xl border border-border bg-card p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <div className="flex-1 space-y-2">
                  <Bone className="h-3 w-40" />
                  <Bone className="h-4 w-64 max-w-full" />
                </div>
                <Bone className="h-10 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Bone className="h-5 w-40" />
          {[0, 1, 2].map((i) => (
            <Bone key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT(messages);
  return (
    <div className="mx-auto mt-16 flex max-w-lg flex-col items-center px-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted">
        <ServerCrash aria-hidden className="size-7 text-destructive" />
      </span>
      <h1 className="mt-5 text-22 font-bold">{t.states.errorTitle}</h1>
      <p className="mt-2 text-14 leading-relaxed text-muted-foreground">{t.states.errorBody}</p>
      <Btn variant="primary" className="mt-6" onClick={onRetry}>
        <RefreshCw aria-hidden className="size-4" />
        {t.states.retry}
      </Btn>
    </div>
  );
}

export function PreviewControls() {
  const t = useT(messages);
  const store = useStore();
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-dashed border-border px-4 py-3">
        <p className="text-12 font-semibold text-muted-foreground">{t.preview.title}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-13 text-muted-foreground">{t.preview.as}</span>
          <Segmented
            size="sm"
            label={t.preview.as}
            value={store.role}
            onChange={(v) => store.setRole(v as 'owner' | 'admin')}
            options={[
              { value: 'owner', label: t.preview.owner },
              { value: 'admin', label: t.preview.admin },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-13 text-muted-foreground">{t.preview.state}</span>
          <Segmented
            size="sm"
            label={t.preview.state}
            value={store.scenario}
            onChange={(v) => store.setScenario(v as Scenario)}
            options={(['default', 'loading', 'empty', 'error'] as const).map((s) => ({ value: s, label: t.preview.states[s] }))}
          />
        </div>
      </div>
    </footer>
  );
}
