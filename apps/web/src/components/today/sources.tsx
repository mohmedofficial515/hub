'use client';

/**
 * @file sources.tsx
 * @description The project's enabled capture sources, problems first. Healthy sources hold still; a failing one pulses twice on load, then stops, so
 * motion points at the problem. With no source connected the section says so and how to connect one (docs/15 §3).
 */
import type { SourceHealth } from '@hub/contracts';
import { Clock, Radio, TriangleAlert } from 'lucide-react';

import {
  AppLink,
  cn,
  duration,
  EmptyState,
  fmt,
  focusRing,
  kitMessages,
  Ltr,
  num,
  rel,
  SectionHeader,
  useLocale,
  useSession,
  useT,
  when,
} from '@/components/kit';

import { NS, type TodayMessages } from './messages';

function StatusDot({ status }: { status: SourceHealth['status'] }) {
  return (
    <span aria-hidden className="relative mt-1.5 inline-flex size-2.5 shrink-0">
      <span
        className={cn(
          'relative size-2.5 rounded-full',
          status === 'ok' && 'bg-success',
          status === 'lagging' && 'bg-warning',
          status === 'failing' && 'bg-destructive motion-safe:animate-(--animate-alert)',
          status === 'never_run' && 'bg-muted-foreground',
        )}
      />
    </span>
  );
}

function SourceRow({ s }: { s: SourceHealth }) {
  const t = useT<TodayMessages>(NS);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const kinds = t.sources.kinds as Record<string, string>;
  return (
    <li className="flex gap-3 rounded-lg border border-border bg-card p-3">
      <StatusDot status={s.status} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <code dir="ltr" translate="no" className="key text-body-sm font-medium text-foreground">
            {s.name}
          </code>
          <span className="text-body-sm text-muted-foreground">{kinds[s.kind] ?? s.kind}</span>
        </p>
        <p
          className={cn(
            'mt-1 flex flex-wrap items-center gap-x-1.5 text-body-sm',
            s.status === 'ok' && 'text-foreground',
            s.status === 'never_run' && 'text-muted-foreground',
            s.status === 'lagging' && 'font-medium text-warning-strong',
            s.status === 'failing' && 'font-medium text-destructive-soft-foreground',
          )}
        >
          {s.status === 'lagging' && <Clock aria-hidden className="size-3.5" strokeWidth={2} />}
          {s.status === 'failing' && <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2} />}
          {s.status === 'ok' && s.lastSuccessAt && fmt(t.sources.ok, { rel: rel(s.lastSuccessAt, locale) })}
          {s.status === 'never_run' && t.sources.neverRun}
          {s.status === 'lagging' && fmt(t.sources.lagging, { d: duration((s.lagSec ?? 0) * 1000, locale) })}
          {s.status === 'failing' && (
            <>
              {kit.sourceStatus.failing}
              {s.lastSuccessAt && (
                <span className="font-normal text-muted-foreground">
                  {fmt(t.sources.lastSuccess, { when: when(s.lastSuccessAt, locale) })}
                </span>
              )}
            </>
          )}
        </p>
        {s.lastError && s.status !== 'ok' && (
          <p
            className={cn(
              'mt-2 rounded-md px-2 py-1 text-body-sm',
              s.status === 'failing'
                ? 'bg-destructive-soft text-destructive-soft-foreground'
                : 'bg-warning-soft text-warning-soft-foreground',
            )}
          >
            {s.lastError}
          </p>
        )}
        {/* Phone keeps the status and the error; target and run counts start at 640 px. */}
        {s.target && (
          <p
            dir="ltr"
            translate="no"
            className="key mt-1.5 hidden truncate text-start text-caption text-muted-foreground sm:@page-sm:block rtl:text-end"
          >
            {s.target}
          </p>
        )}
        <dl className="mt-1.5 hidden gap-4 text-caption text-muted-foreground sm:@page-sm:flex">
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
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  const { isManager } = useSession();
  const ok = sources.filter((s) => s.status === 'ok').length;
  const lag = sources.filter((s) => s.status === 'lagging').length;
  const fail = sources.filter((s) => s.status === 'failing').length;
  const summary =
    ok === sources.length
      ? t.sources.allLive
      : [
          ok > 0 && fmt(t.sources.summaryOk, { n: ok }),
          lag > 0 && fmt(t.sources.summaryLag, { n: lag }),
          fail > 0 && fmt(t.sources.summaryFail, { n: fail }),
        ]
          .filter(Boolean)
          .join(locale === 'ar' ? '، ' : ', ');
  return (
    <section aria-labelledby="sources-title" className="flex flex-col gap-3">
      <SectionHeader
        id="sources-title"
        icon={Radio}
        title={t.sources.title}
        aside={
          sources.length > 0 ? <span className="text-body-sm text-muted-foreground">{summary}</span> : null
        }
      />
      {sources.length === 0 ? (
        <EmptyState icon={Radio} title={t.sources.emptyTitle}>
          {t.sources.emptyBody}{' '}
          {isManager && (
            <AppLink
              view="settings"
              query={{ tab: 'sources' }}
              className={cn(
                'hit-44 rounded-sm font-medium text-primary underline underline-offset-4',
                focusRing,
              )}
            >
              {t.sources.emptyLink}
            </AppLink>
          )}
        </EmptyState>
      ) : (
        <ul className="grid gap-2 sm:@page-sm:grid-cols-2 lg:@page-lg:grid-cols-3">
          {sources.map((s) => (
            <SourceRow key={s.id} s={s} />
          ))}
        </ul>
      )}
    </section>
  );
}
