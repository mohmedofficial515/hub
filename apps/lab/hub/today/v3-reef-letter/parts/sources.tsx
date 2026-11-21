import { Clock, TriangleAlert } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { SourceHealth } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { fmt, Ltr, RailHead } from './atoms';
import { duration, num, rel, when } from './format';

/**
 * Text always sits next to the dot. Only the failing source moves, and only three times (motion-safe):
 * a healthy dot is still, so the eye goes to the one that needs attention (critic: "motion draws the eye
 * to the healthy sources").
 */
function StatusDot({ status }: { status: SourceHealth['status'] }) {
  return (
    <span aria-hidden className="relative mt-1.5 inline-flex size-2.5 shrink-0">
      {status === 'failing' && <span className="reef-call absolute inset-0 rounded-full bg-destructive opacity-0" />}
      <span className={cn('relative size-2.5 rounded-full', status === 'ok' && 'bg-success', status === 'lagging' && 'bg-warning', status === 'failing' && 'bg-destructive')} />
    </span>
  );
}

function SourceRow({ s }: { s: SourceHealth }) {
  const t = useT(messages);
  const locale = useLocale();
  const info = fmt(t.sources.tooltip, { kind: t.sources.kinds[s.kind], target: s.target, runs: num(s.runs24h, locale), cards: num(s.cards24h, locale) });
  return (
    <li className="flex gap-2.5" title={info}>
      <StatusDot status={s.status} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <Ltr mono className="text-body-sm font-medium text-foreground">
            {s.name}
          </Ltr>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-body-sm',
              s.status === 'ok' && 'text-muted-foreground',
              s.status === 'lagging' && 'font-semibold text-warning-strong',
              s.status === 'failing' && 'font-semibold text-destructive',
            )}
          >
            {s.status === 'lagging' && <Clock aria-hidden className="size-3.5" strokeWidth={2} />}
            {s.status === 'failing' && <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2} />}
            {s.status === 'ok' && fmt(t.sources.ok, { rel: rel(s.lastSuccessAt, locale) })}
            {s.status === 'lagging' && fmt(t.sources.lagging, { d: duration(s.lagSec * 1000, locale) })}
            {s.status === 'failing' && t.sources.failing}
          </span>
        </p>
        {s.status === 'failing' && <p className="mt-0.5 text-body-sm text-muted-foreground">{fmt(t.sources.lastSuccess, { when: when(s.lastSuccessAt, locale) })}</p>}
        {s.lastError && s.status !== 'ok' && <p className="mt-0.5 text-body-sm text-foreground">{s.lastError[locale]}</p>}
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
    <section aria-labelledby="sources-title" className="flex flex-col gap-3">
      <RailHead id="sources-title" title={t.sources.title} sub={ok === sources.length ? t.sources.allLive : fmt(t.sources.summary, { ok, lag, fail })} />
      <ul className="grid gap-x-8 gap-y-2.5 md:grid-cols-2 xl:grid-cols-1">
        {sorted.map((s) => (
          <SourceRow key={s.name} s={s} />
        ))}
      </ul>
    </section>
  );
}
