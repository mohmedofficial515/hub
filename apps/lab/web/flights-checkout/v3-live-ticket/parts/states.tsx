import { CircleAlert, FlaskConical, RotateCcw } from 'lucide-react';
import { cn } from '@lab/utils';
import type { T } from '../i18n';
import { Button, focusRing } from './ui';

function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-md bg-(--surface-3) motion-safe:animate-pulse', className)} />;
}

/** Same frame as the page, so nothing jumps when the checkout arrives. */
export function LoadingState({ t }: { t: T }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <span className="sr-only">{t.states.loadingTitle}</span>
      <div className="space-y-6">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-(--border) bg-(--card) p-6">
            <Bone className="h-5 w-40" />
            <Bone className="mt-3 h-4 w-64 max-w-full" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Bone className="h-12" />
              <Bone className="h-12" />
              <Bone className="h-12" />
              <Bone className="h-12" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-(--border) bg-(--card) lg:block">
        <div className="h-44 bg-(--surface-3) motion-safe:animate-pulse" />
        <div className="space-y-3 p-5">
          <Bone className="h-4 w-1/2" />
          <Bone className="h-4" />
          <Bone className="h-4" />
          <Bone className="h-4 w-2/3" />
          <Bone className="mt-4 h-8 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ t, onRetry }: { t: T; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-(--border) bg-(--card) px-6 py-10 text-center">
      <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-(--danger-soft) text-(--danger-ink)">
        <CircleAlert className="size-6" />
      </span>
      <h2 className="mt-4 text-xl font-bold text-(--brand-ink)">{t.states.errorTitle}</h2>
      <p className="mt-2 text-base leading-7 text-(--ink)">{t.states.errorText}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="action" size="lg" onClick={onRetry}>
          <RotateCcw aria-hidden className="size-4" />
          {t.buttons.retry}
        </Button>
        <Button variant="outline" size="lg">
          {t.states.searchAgain}
        </Button>
      </div>
    </div>
  );
}

export type Scenario = 'signed-in' | 'guest' | 'loading' | 'error' | 'no-methods';

/** Review-only control: switches the states a reviewer needs to see. Not part of the design. */
export function LabPanel({
  t,
  scenario,
  onScenario,
  onLockEnd,
}: {
  t: T;
  scenario: Scenario;
  onScenario: (s: Scenario) => void;
  onLockEnd: () => void;
}) {
  const items: { id: Scenario; label: string }[] = [
    { id: 'signed-in', label: t.lab.signedIn },
    { id: 'guest', label: t.lab.guest },
    { id: 'loading', label: t.lab.loading },
    { id: 'error', label: t.lab.error },
    { id: 'no-methods', label: t.lab.noMethods },
  ];
  return (
    <aside aria-label={t.lab.title} className="mt-10 rounded-xl border border-(--border) bg-(--surface-2) px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-(--ink)">
        <FlaskConical aria-hidden className="size-4" />
        {t.lab.title}
        <span className="font-normal text-(--ink-muted)">· {t.lab.note}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={scenario === s.id}
            onClick={() => onScenario(s.id)}
            className={cn(
              'h-9 rounded-full border px-3 text-sm font-semibold transition-colors',
              focusRing,
              scenario === s.id ? 'border-(--brand) bg-(--brand) text-(--brand-foreground)' : 'border-(--border-strong) bg-(--card) text-(--foreground)',
            )}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onLockEnd}
          className={cn('h-9 rounded-full border border-(--border-strong) bg-(--card) px-3 text-sm font-semibold text-(--foreground)', focusRing)}
        >
          {t.lab.lockEnd}
        </button>
      </div>
    </aside>
  );
}
