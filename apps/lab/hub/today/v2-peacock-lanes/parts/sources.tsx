import { Clock, Radio, TriangleAlert } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { SourceHealth } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { fmt, Ltr, SectionHead } from './atoms';
import { duration, num, rel, when } from './format';

/**
 * A living status dot. Healthy sources breathe once every 4 s (static under reduced motion);
 * lagging and failing ones hold still and carry an icon. Text always follows the dot.
 */
function StatusDot({ status }: { status: SourceHealth['status'] }) {
  return (
    <span aria-hidden className="relative mt-1.5 inline-flex size-2.5 shrink-0">
      {status === 'ok' && (
        <span className="absolute -inset-1 rounded-full bg-success/20" />
      )}
      <span
        className={cn(
          'relative size-2.5 rounded-full',
          status === 'ok' && 'bg-success motion-safe:animate-(--animate-breathe)',
          status === 'lagging' && 'bg-warning',
          status === 'failing' && 'bg-destructive',
        )}
      />
    </span>
  );
}

function SourceRow({ s }: { s: SourceHealth }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <li className="flex gap-3 rounded-xl border border-border bg-card p-3 sm:p-3.5">
      <StatusDot status={s.status} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <code dir="ltr" className="key text-body-sm font-medium text-foreground">
            {s.name}
          </code>
          <span className="text-caption text-muted-foreground">{t.sources.kinds[s.kind]}</span>
        </p>
        <p
          className={cn(
            'mt-1 flex flex-wrap items-center gap-x-1.5 text-body-sm',
            s.status === 'ok' && 'text-foreground',
            s.status === 'lagging' && 'font-medium text-warning-strong',
            s.status === 'failing' && 'font-medium text-destructive',
          )}
        >
          {s.status === 'lagging' && <Clock aria-hidden className="size-3.5" strokeWidth={2} />}
          {s.status === 'failing' && <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2} />}
          {s.status === 'ok' && fmt(t.sources.ok, { rel: rel(s.lastSuccessAt, locale) })}
          {s.status === 'lagging' && fmt(t.sources.lagging, { d: duration(s.lagSec * 1000, locale) })}
          {s.status === 'failing' && (
            <>
              {t.sources.failing}
              <span className="font-normal text-muted-foreground">{fmt(t.sources.lastSuccess, { when: when(s.lastSuccessAt, locale) })}</span>
            </>
          )}
        </p>
        {s.lastError && s.status !== 'ok' && (
          <p
            className={cn(
              'mt-2 rounded-md px-2 py-1 text-caption',
              s.status === 'failing' ? 'bg-destructive-soft text-destructive-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground',
            )}
          >
            {s.lastError[locale]}
          </p>
        )}
        {/* Phone keeps the status and the error; target and run counts start at 640 px. */}
        <p dir="ltr" className="key mt-1.5 hidden truncate text-start text-caption text-muted-foreground sm:block rtl:text-end">
          {s.target}
        </p>
        <dl className="mt-2 hidden gap-4 text-caption text-muted-foreground sm:flex">
          <div className="flex gap-1">
            <dt>{t.sources.runs}</dt>
            <dd className="font-medium text-foreground tabular-nums">
              <Ltr>{num(s.runs24h, locale)}</Ltr>
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>{t.sources.cards}</dt>
            <dd className="font-medium text-foreground tabular-nums">
              <Ltr>{num(s.cards24h, locale)}</Ltr>
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}

export function CaptureSources({ sources }: { sources: SourceHealth[] }) {
  const t = useT(messages);
  const ok = sources.filter((s) => s.status === 'ok').length;
  const lag = sources.filter((s) => s.status === 'lagging').length;
  const fail = sources.filter((s) => s.status === 'failing').length;
  // Problems first: a failing source should not hide in the middle of a healthy list.
  const order = { failing: 0, lagging: 1, ok: 2 } as const;
  const sorted = [...sources].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <section aria-labelledby="sources-title" className="flex flex-col gap-4">
      <SectionHead
        id="sources-title"
        icon={Radio}
        title={t.sources.title}
        aside={
          <span className="text-caption text-muted-foreground">
            {ok === sources.length ? t.sources.allLive : fmt(t.sources.summary, { ok, lag, fail })}
          </span>
        }
      />
      <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
        {sorted.map((s) => (
          <SourceRow key={s.name} s={s} />
        ))}
      </ul>
    </section>
  );
}
