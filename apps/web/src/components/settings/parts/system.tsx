'use client';

/**
 * @file system.tsx
 * @description What the API can truly report today: its health checks and each source's lag. The worker, queues, outbox, backups and disk
 * in the design wait for `GET /workspaces/{ws}/system` (H2-07), and until then this page says so instead of showing a number.
 */
import { CircleCheck, Clock, Hourglass, RefreshCw, Server, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  cn,
  duration,
  EmptyState,
  fmt,
  IconButton,
  Ltr,
  Pill,
  SectionHeader,
  SkeletonRows,
  time,
  useLocale,
  useT,
} from '@/components/kit';
import type { SettingsMessages } from '@/features/settings/messages';
import { useHealth, useSettings, useSources } from '@/features/settings/queries';
import { intervalSecOf, sourceState } from '@/features/settings/source-state';

function ServiceRow({
  name,
  state,
  detail,
}: {
  name: string;
  state: 'ok' | 'failed' | 'unknown';
  detail?: ReactNode;
}) {
  const t = useT<SettingsMessages>('settings');
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="min-w-24 text-body font-medium text-foreground">{name}</span>
      <span className="min-w-0 flex-1 basis-40 text-body-sm text-muted-foreground">{detail}</span>
      {state === 'ok' ? (
        <Pill tone="success" icon={CircleCheck}>
          {t.system.ok}
        </Pill>
      ) : state === 'failed' ? (
        <Pill tone="danger" icon={TriangleAlert}>
          {t.system.down}
        </Pill>
      ) : (
        <Pill tone="muted">{t.system.unknown}</Pill>
      )}
    </li>
  );
}

export function SystemTab() {
  const t = useT<SettingsMessages>('settings');
  const locale = useLocale();
  const s = t.system;
  const health = useHealth();
  const sources = useSources();
  const settings = useSettings().data;
  const checks = health.data?.checks ?? null;
  const uptime = health.data?.uptimeSec ?? null;
  const stateOf = (key: string): 'ok' | 'failed' | 'unknown' => {
    const value = checks?.[key];
    return value === 'ok' ? 'ok' : value === 'failed' ? 'failed' : 'unknown';
  };
  const failing = ['postgres', 'redis', 'reposVolume'].filter((key) => stateOf(key) === 'failed').length;

  if (health.isPending) return <SkeletonRows count={4} withAction={false} />;

  return (
    <>
      <section aria-labelledby="system-title" className="flex flex-col gap-3">
        <SectionHeader
          id="system-title"
          icon={Server}
          title={failing === 0 && checks ? s.allGood : s.services.api}
          aside={
            <>
              <span className="text-body-sm text-muted-foreground">
                {s.checkedAt}{' '}
                <Ltr className="tabular-nums">
                  {time(new Date(health.dataUpdatedAt).toISOString(), locale)}
                </Ltr>
              </span>
              <IconButton
                label={s.refresh}
                variant="outline"
                disabled={health.isFetching}
                aria-busy={health.isFetching}
                onClick={() => void health.refetch()}
              >
                <RefreshCw
                  aria-hidden
                  className={cn('size-4', health.isFetching && 'motion-safe:animate-spin')}
                  strokeWidth={1.75}
                />
              </IconButton>
            </>
          }
        />
        {!checks && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-body-sm font-medium text-destructive-soft-foreground"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {s.failedLoad}
          </p>
        )}
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          <ServiceRow
            name={s.services.api}
            state={uptime === null ? 'failed' : 'ok'}
            detail={uptime === null ? undefined : fmt(s.uptime, { uptime: duration(uptime * 1000, locale) })}
          />
          <ServiceRow name={s.services.postgres} state={stateOf('postgres')} />
          <ServiceRow name={s.services.redis} state={stateOf('redis')} />
          <ServiceRow name={s.services.repos} state={stateOf('reposVolume')} />
        </ul>
      </section>

      {(sources.data?.length ?? 0) > 0 && (
        <section aria-labelledby="lag-title" className="flex flex-col gap-3">
          <SectionHeader id="lag-title" icon={Clock} title={s.lagTitle} level={3} />
          <p className="max-w-prose text-body-sm text-muted-foreground">{s.lagBody}</p>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="border-b border-border px-4 py-2 text-start font-medium">
                    {s.lagSource}
                  </th>
                  <th
                    scope="col"
                    className="hidden border-b border-border px-4 py-2 text-start font-medium sm:table-cell"
                  >
                    {s.lagInterval}
                  </th>
                  <th scope="col" className="border-b border-border px-4 py-2 text-start font-medium">
                    {s.lagCol}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sources.data?.map((x) => {
                  const state = sourceState(x, settings);
                  return (
                    <tr key={x.id}>
                      <th scope="row" className="px-4 py-2 text-start font-normal text-foreground">
                        <Ltr mono>{x.name}</Ltr>
                      </th>
                      <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">
                        {duration(intervalSecOf(x, settings) * 1000, locale)}
                      </td>
                      <td className="px-4 py-2">
                        {state === 'disabled' ? (
                          <span className="text-muted-foreground">{s.lagDisabled}</span>
                        ) : x.lagSec === null ? (
                          <span className="text-muted-foreground">{s.lagNever}</span>
                        ) : state === 'lagging' || state === 'failing' ? (
                          <Pill tone={state === 'failing' ? 'danger' : 'warning'} icon={Clock}>
                            {duration(x.lagSec * 1000, locale)}
                          </Pill>
                        ) : (
                          <span className="text-foreground">
                            {duration(Math.max(x.lagSec, 1) * 1000, locale)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <EmptyState icon={Hourglass} title={s.laterTitle}>
        {s.laterBody}
      </EmptyState>
    </>
  );
}
