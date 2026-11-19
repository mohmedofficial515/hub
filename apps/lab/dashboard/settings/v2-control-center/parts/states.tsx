/**
 * Loading skeleton, load error, no access, owner-only page, toasts and the prototype state switcher.
 */
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CloudOff, KeyRound, Lock, X } from 'lucide-react';
import { cn } from '@lab/utils';
import { useStore, type Scenario, type Viewer } from './store';
import { Btn, Segmented } from './ui';

function Bone({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse rounded-lg bg-muted', className)} />;
}

export function BoardSkeleton() {
  const { t } = useStore();
  return (
    <div role="status" aria-label={t.states.loading} className="grid gap-6">
      <div className="grid gap-3 rounded-3xl border border-border bg-card p-5">
        <Bone className="h-5 w-48" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Bone className="size-8 rounded-full" />
            <Bone className="h-4 flex-1" />
            <Bone className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[5, 3, 4, 3, 4, 6].map((rows, i) => (
          <div key={i} className="grid content-start gap-4 rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <Bone className="size-10 rounded-xl" />
              <div className="grid flex-1 gap-2">
                <Bone className="h-4 w-1/2" />
                <Bone className="h-3 w-3/4" />
              </div>
            </div>
            {Array.from({ length: rows }, (_, j) => (
              <div key={j} className="flex gap-3">
                <Bone className="size-8" />
                <div className="grid flex-1 gap-1.5">
                  <Bone className="h-3.5 w-2/5" />
                  <Bone className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">{t.states.loading}</span>
    </div>
  );
}

function EmptyPanel({ icon, title, lead, action }: { icon: ReactNode; title: string; lead: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-3xl border border-border bg-card px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-foreground/70">{icon}</span>
      <h2 className="text-18 font-extrabold">{title}</h2>
      <p className="max-w-md text-14 leading-relaxed text-muted-foreground">{lead}</p>
      {action}
    </div>
  );
}

export function LoadError() {
  const { t, setScenario } = useStore();
  return (
    <div role="alert">
      <EmptyPanel
        icon={<CloudOff className="size-6" aria-hidden />}
        title={t.states.errorTitle}
        lead={t.states.errorLead}
        action={
          <Btn variant="primary" onClick={() => setScenario('default')}>
            {t.states.retry}
          </Btn>
        }
      />
    </div>
  );
}

export function NoAccess() {
  const { t, go } = useStore();
  return (
    <EmptyPanel
      icon={<Lock className="size-6" aria-hidden />}
      title={t.states.noAccessTitle}
      lead={t.states.noAccessLead}
      action={
        <Btn variant="outline" onClick={() => go({ view: 'prefs' })}>
          {t.states.toPrefs}
        </Btn>
      }
    />
  );
}

export function Forbidden() {
  const { t, go } = useStore();
  return (
    <EmptyPanel
      icon={<KeyRound className="size-6" aria-hidden />}
      title={t.states.forbiddenTitle}
      lead={t.states.forbiddenLead}
      action={
        <Btn variant="outline" onClick={() => go({ view: 'overview' })}>
          {t.group.back}
        </Btn>
      }
    />
  );
}

export function Toasts() {
  const { toasts, dismissToast, t } = useStore();
  const reduce = useReducedMotion();
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="pointer-events-auto flex max-w-[min(92vw,520px)] items-center gap-3 rounded-2xl bg-foreground py-2.5 pe-2 ps-4 text-14 font-semibold text-background shadow-xl"
          >
            <span className="min-w-0 flex-1 break-words">{toast.text}</span>
            <button
              type="button"
              aria-label={t.toast.dismiss}
              onClick={() => dismissToast(toast.id)}
              className="grid size-9 shrink-0 place-items-center rounded-xl outline-none hover:bg-background/15 focus-visible:ring-2 focus-visible:ring-background"
            >
              <X className="size-4" aria-hidden />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Prototype-only switches at the foot of the page: data scenario and the viewer's permissions. */
export function DemoBar() {
  const { t, scenario, setScenario, viewer, setViewer } = useStore();
  return (
    <section aria-label={t.demo.title} className="mt-12 grid gap-3 rounded-xl border-2 border-dashed border-foreground/25 bg-[repeating-linear-gradient(135deg,transparent_0_10px,var(--muted)_10px_20px)] p-4 text-12">
      <p className="flex items-center gap-2 font-bold text-foreground/80">
        <span className="rounded bg-foreground px-1.5 py-0.5 font-mono text-background" dir="ltr">LAB</span>
        {t.demo.title}
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{t.demo.scenario}</span>
          <Segmented<Scenario>
            size="sm"
            label={t.demo.scenario}
            value={scenario}
            onChange={setScenario}
            options={[
              { value: 'default', label: t.demo.sDefault },
              { value: 'loading', label: t.demo.sLoading },
              { value: 'error', label: t.demo.sError },
              { value: 'empty', label: t.demo.sEmpty },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{t.demo.viewer}</span>
          <Segmented<Viewer>
            size="sm"
            label={t.demo.viewer}
            value={viewer}
            onChange={setViewer}
            options={[
              { value: 'owner', label: t.demo.vOwner },
              { value: 'admin', label: t.demo.vAdmin },
              { value: 'none', label: t.demo.vNone },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
