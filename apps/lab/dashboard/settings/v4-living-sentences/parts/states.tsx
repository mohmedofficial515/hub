/** Loading (a skeleton of the book), empty, error and forbidden states. Errors say what happened and what to do. */
import type { ReactNode } from 'react';
import { BookX, CloudOff, KeyRound } from 'lucide-react';
import { cn } from '@lab/utils';
import { useBook } from './store';
import { btn } from './ui';

const bar = 'rounded-full bg-muted motion-safe:animate-pulse';

export function BookSkeleton() {
  const { t } = useBook();
  const widths = ['w-11/12', 'w-full', 'w-9/12', 'w-10/12', 'w-7/12'];
  return (
    <div aria-busy="true" aria-live="polite" className="max-w-[46rem]">
      <span className="sr-only">{t.ui.loading}</span>
      <div className={cn(bar, 'h-9 w-64')} />
      <div className={cn(bar, 'mt-5 h-4 w-full')} />
      <div className={cn(bar, 'mt-3 h-4 w-10/12')} />
      {[0, 1].map((c) => (
        <div key={c} className="mt-14">
          <div className={cn(bar, 'h-3 w-24')} />
          <div className={cn(bar, 'mt-3 h-7 w-56')} />
          {[0, 1, 2].map((g) => (
            <div key={g} className="mt-8">
              <div className={cn(bar, 'h-5 w-40')} />
              {widths.slice(0, 3).map((w, i) => (
                <div key={i} className={cn(bar, 'mt-3.5 h-4', widths[(i + g + c) % widths.length] ?? w)} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Message({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div role="status" className="mx-auto mt-10 grid max-w-xl justify-items-center gap-3 rounded-3xl border border-border bg-card px-6 py-12 text-center sm:px-10">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{icon}</span>
      <h2 className="text-20 font-extrabold">{title}</h2>
      <p className="text-15 leading-relaxed text-muted-foreground">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState() {
  const { t, setPhase } = useBook();
  return (
    <Message
      icon={<BookX className="size-7" aria-hidden />}
      title={t.ui.emptyTitle}
      body={t.ui.emptyBody}
      action={
        <button type="button" className={btn('outline')} onClick={() => setPhase('ready')}>
          {t.ui.retry}
        </button>
      }
    />
  );
}

export function ErrorState() {
  const { t, setPhase } = useBook();
  return (
    <Message
      icon={<CloudOff className="size-7" aria-hidden />}
      title={t.ui.errorTitle}
      body={t.ui.errorBody}
      action={
        <button
          type="button"
          className={btn('primary')}
          onClick={() => {
            setPhase('loading');
            window.setTimeout(() => setPhase('ready'), 900);
          }}
        >
          {t.ui.retry}
        </button>
      }
    />
  );
}

export function Forbidden({ body }: { body: string }) {
  const { t, go } = useBook();
  return (
    <Message
      icon={<KeyRound className="size-7" aria-hidden />}
      title={t.ui.forbiddenTitle}
      body={body}
      action={
        <button type="button" className={btn('outline')} onClick={() => go({ view: 'overview' })}>
          {t.ui.backToBook}
        </button>
      }
    />
  );
}
