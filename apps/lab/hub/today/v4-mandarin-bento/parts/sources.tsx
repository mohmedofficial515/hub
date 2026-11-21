import { Clock, TriangleAlert } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { SourceHealth } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { fmt, Ltr, Tile, TileHead } from './atoms';
import { duration, num, rel, when } from './format';

/**
 * The status dot is never alone: words follow it on every row. Only a failing source moves, and only
 * three pulses on load. A healthy dot holds still, so the eye goes to what needs attention (v2 finding).
 */
function StatusDot({ status }: { status: SourceHealth['status'] }) {
  return (
    <span aria-hidden className="relative mt-1.5 inline-flex size-2.5 shrink-0">
      {status === 'failing' && <span className="absolute inset-0 rounded-full bg-(--alarm-fg) motion-safe:animate-(--animate-alert)" />}
      <span className={cn('relative size-2.5 rounded-full', status === 'ok' && 'bg-success', status === 'lagging' && 'bg-warning-strong', status === 'failing' && 'bg-(--alarm-fg)')} />
    </span>
  );
}

function SourceRow({ s }: { s: SourceHealth }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    // Cyan lines are this tile's signature: each source hangs from one.
    <li className="flex min-w-0 gap-3 border-t-2 border-t-(--fish-cyan) py-3">
      <StatusDot status={s.status} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <code dir="ltr" translate="no" className="key text-body font-medium">
            {s.name}
          </code>
          <span className="text-body-sm text-(--t-muted)">{t.sources.kinds[s.kind]}</span>
        </p>
        <p
          className={cn(
            'mt-0.5 flex flex-wrap items-center gap-x-1.5 text-body-sm',
            s.status === 'lagging' && 'font-bold text-warning-strong',
            s.status === 'failing' && 'font-bold text-(--alarm-fg)',
          )}
        >
          {s.status === 'lagging' && <Clock aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />}
          {s.status === 'failing' && <TriangleAlert aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />}
          {s.status === 'ok' && fmt(t.sources.ok, { rel: rel(s.lastSuccessAt, locale) })}
          {s.status === 'lagging' && fmt(t.sources.lagging, { d: duration(s.lagSec * 1000, locale) })}
          {s.status === 'failing' && (
            <>
              {t.sources.failing}
              <span className="font-normal text-(--t-muted)">{fmt(t.sources.lastSuccess, { when: when(s.lastSuccessAt, locale) })}</span>
            </>
          )}
        </p>
        {s.lastError && s.status !== 'ok' && <p className="mt-1 text-body-sm text-(--t-fg)">{s.lastError[locale]}</p>}
        {/* Phone keeps the status and the error; target and run counts start at 640 px. */}
        <p dir="ltr" translate="no" className="key mt-1 hidden truncate text-start text-caption text-(--t-muted) sm:block rtl:text-end">
          {s.target}
        </p>
        <dl className="mt-1 hidden flex-wrap gap-x-4 text-caption text-(--t-muted) sm:flex">
          <div className="flex gap-1">
            <dt>{t.sources.runs}</dt>
            <dd className="font-medium text-(--t-fg) tabular-nums">
              <Ltr>{num(s.runs24h, locale)}</Ltr>
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>{t.sources.cards}</dt>
            <dd className="font-medium text-(--t-fg) tabular-nums">
              <Ltr>{num(s.cards24h, locale)}</Ltr>
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}

export function CaptureSources({ sources, className }: { sources: SourceHealth[]; className?: string }) {
  const t = useT(messages);
  const ok = sources.filter((s) => s.status === 'ok').length;
  const lag = sources.filter((s) => s.status === 'lagging').length;
  const fail = sources.filter((s) => s.status === 'failing').length;
  // Problems first: a failing source should not hide in the middle of a healthy list.
  const order = { failing: 0, lagging: 1, ok: 2 } as const;
  const sorted = [...sources].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <Tile rule="cyan" labelledBy="sources-title" className={className}>
      <TileHead
        id="sources-title"
        title={t.sources.title}
        aside={<span className="text-body-sm text-(--t-muted)">{ok === sources.length ? t.sources.allLive : fmt(t.sources.summary, { ok, lag, fail })}</span>}
      />
      <ul className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((s) => (
          <SourceRow key={s.name} s={s} />
        ))}
      </ul>
    </Tile>
  );
}
