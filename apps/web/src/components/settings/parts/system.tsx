'use client';

/**
 * @file system.tsx
 * @description Ported from the approved design, pages/settings/parts/system.tsx, on `GET /workspaces/{ws}/system` and the public health checks.
 * What the API does not report is left out: there is no disk figure. The last backup is Settings › Backups' (docs/16 D61 to D63).
 * The owner also sees where Hub's mail goes, with a test email (`MailSection`, docs/16 D68).
 */
import type { SystemData } from '@hub/contracts';
import { CircleCheck, Clock, Database, Layers, RefreshCw, Server, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  cn,
  duration,
  ErrorState,
  fmt,
  IconButton,
  Ltr,
  num,
  Pill,
  rel,
  SectionHeader,
  SkeletonRows,
  time,
  useLocale,
  useSession,
  useT,
  when,
} from '@/components/kit';
import { useLabRunning } from '@/features/redesign/queries';
import type { SettingsMessages } from '@/features/settings/messages';
import { useHealth, useSettings, useSources, useSystem } from '@/features/settings/queries';
import { intervalSecOf, sourceState } from '@/features/settings/source-state';
import { isHubError } from '@/lib/api/errors';

import { MailSection } from './mail';

const SIZES = ['B', 'KB', 'MB', 'GB', 'TB'];

/** "18.4 GB" as an LTR isolate. Units stay Latin in both languages. */
export function Bytes({ value, className }: { value: number; className?: string }) {
  const locale = useLocale();
  const power = Math.min(SIZES.length - 1, Math.floor(Math.log10(Math.max(1, value)) / 3));
  const scaled = value / 10 ** (power * 3);
  return <Ltr className={className}>{`${num(Math.round(scaled * 10) / 10, locale)} ${SIZES[power]}`}</Ltr>;
}

function Vital({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-border py-3 sm:border-b-0 sm:px-4 sm:py-3">
      <dt className="text-body-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-title font-bold text-foreground">{value}</dd>
      {note && <dd className="text-body-sm text-muted-foreground">{note}</dd>}
    </div>
  );
}

function ServiceRow({
  name,
  state,
  detail,
  problem,
}: {
  name: string;
  state: 'ok' | 'failed' | 'unknown';
  detail?: ReactNode;
  problem?: string;
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
          {problem ?? t.system.down}
        </Pill>
      ) : (
        <Pill tone="muted">{t.system.unknown}</Pill>
      )}
    </li>
  );
}

function Panels({ sys }: { sys: SystemData }) {
  const t = useT<SettingsMessages>('settings');
  const locale = useLocale();
  const s = t.system;
  const sources = useSources().data ?? [];
  const settings = useSettings().data;
  return (
    <>
      <section aria-label={s.vitalsLabel}>
        <dl className="grid rounded-lg border border-border bg-card px-4 sm:@page-sm:grid-cols-2 sm:divide-x sm:divide-border sm:px-0 sm:rtl:divide-x-reverse lg:@page-lg:grid-cols-4">
          <Vital
            label={s.outbox}
            value={<Ltr>{num(sys.outbox.pending, locale)}</Ltr>}
            note={
              sys.outbox.failed > 0
                ? fmt(s.outboxFailed.other, { n: num(sys.outbox.failed, locale) })
                : s.outboxNoFailed
            }
          />
          <Vital
            label={s.oldest}
            value={
              sys.outbox.oldestPendingAgeSec === null
                ? s.oldestNone
                : duration(sys.outbox.oldestPendingAgeSec * 1000, locale)
            }
            note={s.oldestNote}
          />
          <Vital label={s.sse} value={<Ltr>{num(sys.sse.connections, locale)}</Ltr>} note={s.sseNote} />
          <Vital
            label={s.backup}
            value={sys.backup.lastAt ? when(sys.backup.lastAt, locale) : s.backupNone}
            note={sys.backup.sizeBytes !== null ? <Bytes value={sys.backup.sizeBytes} /> : s.backupNoneNote}
          />
        </dl>
      </section>

      {sys.sources.length > 0 && (
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
                {sources.map((x) => {
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

      {sys.queues.length > 0 && (
        <section aria-labelledby="queues-title" className="flex flex-col gap-3">
          <SectionHeader id="queues-title" icon={Layers} title={s.queuesTitle} level={3} />
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-muted-foreground">
                  {[s.queue, s.waiting, s.active, s.failed, s.delayed].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={cn(
                        'border-b border-border px-3 py-2 font-medium',
                        i === 0 ? 'text-start' : 'text-end',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sys.queues.map((q) => (
                  <tr key={q.name}>
                    <th scope="row" className="px-3 py-2 text-start font-normal text-foreground">
                      <Ltr mono>{q.name}</Ltr>
                    </th>
                    {[q.waiting, q.active, q.failed, q.delayed].map((value, i) => (
                      <td
                        key={i}
                        className={cn(
                          'px-3 py-2 text-end tabular-nums',
                          i === 2 && value > 0
                            ? 'font-medium text-destructive-soft-foreground'
                            : value === 0
                              ? 'text-muted-foreground'
                              : 'text-foreground',
                        )}
                      >
                        <Ltr>{num(value, locale)}</Ltr>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="storage-title" className="flex flex-col gap-3">
        <SectionHeader id="storage-title" icon={Database} title={s.storageTitle} level={3} />
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
            <span>
              {s.dbSize} <Bytes value={sys.db.sizeBytes} className="text-foreground" />
            </span>
          </p>
          <p className="text-body-sm text-muted-foreground">
            {fmt(s.dbDetail, { cards: num(sys.db.cards, locale), events: num(sys.db.events, locale) })}
          </p>
        </div>
      </section>
    </>
  );
}

export function SystemTab() {
  const labRunning = useLabRunning();
  const t = useT<SettingsMessages>('settings');
  const locale = useLocale();
  const s = t.system;
  const system = useSystem();
  const health = useHealth();
  const { isOwner } = useSession();
  const checks = health.data?.checks ?? null;
  const stateOf = (key: string): 'ok' | 'failed' | 'unknown' => {
    const value = checks?.[key];
    return value === 'ok' ? 'ok' : value === 'failed' ? 'failed' : 'unknown';
  };

  if (system.isPending) return <SkeletonRows count={6} withAction={false} />;
  if (system.isError) {
    const { error } = system;
    return (
      <ErrorState
        thing={t.errorThing}
        code={isHubError(error) ? error.code : undefined}
        requestId={isHubError(error) ? error.requestId : undefined}
        onRetry={() => void system.refetch()}
      />
    );
  }

  const sys = system.data;
  const workerDown = !sys.worker.alive;
  const failing =
    (workerDown ? 1 : 0) +
    ['postgres', 'redis', 'reposVolume'].filter((key) => stateOf(key) === 'failed').length;
  const heartbeat = sys.worker.lastHeartbeatAt;
  const refreshing = system.isFetching || health.isFetching;

  return (
    <>
      <section aria-labelledby="system-title" className="flex flex-col gap-3">
        <SectionHeader
          id="system-title"
          icon={Server}
          title={failing === 0 ? s.allGood : `${num(failing, locale)} ${s.down}`}
          aside={
            <>
              <span className="text-body-sm text-muted-foreground">
                {s.checkedAt}{' '}
                <Ltr className="tabular-nums">
                  {time(new Date(system.dataUpdatedAt).toISOString(), locale)}
                </Ltr>
              </span>
              <IconButton
                label={s.refresh}
                variant="outline"
                disabled={refreshing}
                aria-busy={refreshing}
                onClick={() => {
                  void system.refetch();
                  void health.refetch();
                }}
              >
                <RefreshCw
                  aria-hidden
                  className={cn('size-4', refreshing && 'motion-safe:animate-spin')}
                  strokeWidth={1.75}
                />
              </IconButton>
            </>
          }
        />
        {workerDown && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-body-sm font-medium text-destructive-soft-foreground"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {heartbeat ? fmt(s.staleWorker, { rel: rel(heartbeat, locale) }) : s.workerNever}
          </p>
        )}
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          <ServiceRow
            name={s.services.api}
            state="ok"
            detail={fmt(s.version, { version: sys.version.api })}
          />
          <ServiceRow
            name={s.services.worker}
            state={workerDown ? 'failed' : 'ok'}
            problem={s.heartbeatStale}
            detail={heartbeat ? fmt(s.heartbeat, { rel: rel(heartbeat, locale) }) : s.workerNever}
          />
          <ServiceRow name={s.services.postgres} state={stateOf('postgres')} />
          <ServiceRow name={s.services.redis} state={stateOf('redis')} detail={s.redisDetail} />
          <ServiceRow name={s.services.repos} state={stateOf('reposVolume')} />
          {sys.version.web && (
            <ServiceRow
              name={s.services.web}
              state="ok"
              detail={fmt(s.version, { version: sys.version.web })}
            />
          )}
          {sys.version.lab && (
            <ServiceRow
              name={s.services.lab}
              state={labRunning.data === undefined ? 'unknown' : labRunning.data ? 'ok' : 'failed'}
              problem={s.labDown}
              detail={fmt(s.labAddress, { url: sys.version.lab })}
            />
          )}
        </ul>
      </section>
      {isOwner && <MailSection />}
      <Panels sys={sys} />
    </>
  );
}
