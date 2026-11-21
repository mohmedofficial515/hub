import { useState, type ReactNode } from 'react';
import { CircleCheck, Clock, Database, HardDrive, Layers, RefreshCw, Server, TriangleAlert } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { staleHeartbeatAt, systemSeed } from '@lab/mocks/hub-app/settings';
import { absolute, cn, duration, fmt, IconButton, isSourceProblem, Ltr, num, Pill, plural, rel, SectionHeader, time, useAdmin, useFilter, useSession, when } from '../../../kit';
import { nowMs } from '../../../kit/format';
import { messages } from '../i18n';
import { Bytes } from './shared';

function Vital({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-border py-3 sm:border-b-0 sm:px-4 sm:py-3">
      <dt className="text-body-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-title font-bold text-foreground">{value}</dd>
      {note && <dd className="text-body-sm text-muted-foreground">{note}</dd>}
    </div>
  );
}

function ServiceRow({ name, ok, detail, problem }: { name: string; ok: boolean; detail: ReactNode; problem?: string }) {
  const t = useT(messages);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="min-w-24 text-body font-medium text-foreground">{name}</span>
      <span className="min-w-0 flex-1 basis-40 text-body-sm text-muted-foreground">{detail}</span>
      {ok ? (
        <Pill tone="success" icon={CircleCheck}>
          {t.system.ok}
        </Pill>
      ) : (
        <Pill tone="danger" icon={TriangleAlert}>
          {problem ?? t.system.down}
        </Pill>
      )}
    </li>
  );
}

export function SystemTab() {
  const t = useT(messages);
  const locale = useLocale();
  const { scenario } = useSession();
  const { sources } = useAdmin(scenario);
  const s = t.system;
  const sys = systemSeed;
  // Lab only: `?worker=stale` shows what a stopped worker looks like (09 §18.6 acceptance).
  const stale = useFilter('worker') === 'stale';
  const heartbeat = stale ? staleHeartbeatAt : sys.worker.lastHeartbeatAt;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(0);

  const refresh = () => {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      setRefreshed((n) => n + 1);
    }, 800);
  };

  const enabled = sources.filter((x) => x.enabled);
  const lagging = enabled.filter((x) => x.lagSec > 3 * x.intervalSec);
  const problems = sources.filter(isSourceProblem);
  const issueCount = lagging.length + (stale ? 1 : 0);
  const diskShare = sys.disk.usedBytes / sys.disk.totalBytes;
  const docsFailing = problems.some((x) => x.kind === 'docs_folder');
  const githubFailing = problems.some((x) => x.kind === 'github_repo');
  const queues = sys.queues.map((q) => ({
    ...q,
    failed: (q.name === 'capture.docs' && !docsFailing) || (q.name === 'capture.github' && !githubFailing) ? 0 : q.failed,
  }));

  return (
    <>
      <section aria-labelledby="system-title" className="flex flex-col gap-3">
        <SectionHeader
          id="system-title"
          icon={Server}
          title={issueCount === 0 ? s.allGood : plural(issueCount, locale, s.issues)}
          aside={
            <>
              <span className="text-body-sm text-muted-foreground">
                {s.checkedAt} <Ltr className="tabular-nums">{time(new Date(nowMs()).toISOString(), locale)}</Ltr>
              </span>
              <IconButton label={s.refresh} variant="outline" disabled={refreshing} aria-busy={refreshing} onClick={refresh}>
                <RefreshCw aria-hidden className={cn('size-4', refreshing && 'motion-safe:animate-spin')} strokeWidth={1.75} />
              </IconButton>
            </>
          }
        />
        <p role="status" className="sr-only">
          {refreshed > 0 && !refreshing ? s.refreshed : ''}
        </p>
        {stale && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-body-sm font-medium text-destructive-soft-foreground">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {fmt(s.staleWorker, { rel: rel(heartbeat, locale) })}
          </p>
        )}
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          <ServiceRow name={s.services.api} ok detail={fmt(s.versionUptime, { version: sys.version.api, uptime: duration(sys.uptime.apiSec * 1000, locale) })} />
          <ServiceRow
            name={s.services.worker}
            ok={!stale}
            problem={s.heartbeatStale}
            detail={
              <>
                {fmt(s.versionUptime, { version: sys.version.worker, uptime: duration(sys.uptime.workerSec * 1000, locale) })}{' '}
                {fmt(s.heartbeat, { rel: rel(heartbeat, locale) })}
              </>
            }
          />
          <ServiceRow name={s.services.postgres} ok={sys.services.postgres} detail={fmt(s.dbDetail, { cards: num(sys.db.cards, locale), events: num(sys.db.events, locale) })} />
          <ServiceRow name={s.services.redis} ok={sys.services.redis} detail={s.redisDetail} />
          <ServiceRow name={s.services.web} ok detail={fmt(s.version, { version: sys.version.web })} />
          <ServiceRow name={s.services.lab} ok detail={fmt(s.version, { version: sys.version.lab })} />
        </ul>
      </section>

      <section aria-label={s.vitalsLabel}>
        <dl className="grid rounded-lg border border-border bg-card px-4 sm:grid-cols-2 sm:divide-x sm:divide-border sm:px-0 sm:rtl:divide-x-reverse lg:grid-cols-4">
          <Vital label={s.outbox} value={<Ltr>{num(sys.outbox.pending, locale)}</Ltr>} note={sys.outbox.failed > 0 ? plural(sys.outbox.failed, locale, s.outboxFailed) : s.outboxNoFailed} />
          <Vital label={s.oldest} value={duration(sys.outbox.oldestPendingAgeSec * 1000, locale)} note={s.oldestNote} />
          <Vital label={s.sse} value={<Ltr>{num(sys.sse.connections, locale)}</Ltr>} note={s.sseNote} />
          <Vital label={s.backup} value={when(sys.backup.lastAt, locale)} note={<Bytes value={sys.backup.sizeBytes} />} />
        </dl>
      </section>

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
                <th scope="col" className="hidden border-b border-border px-4 py-2 text-start font-medium sm:table-cell">
                  {s.lagInterval}
                </th>
                <th scope="col" className="border-b border-border px-4 py-2 text-start font-medium">
                  {s.lagCol}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sources.map((x) => {
                const late = x.enabled && x.lagSec > 3 * x.intervalSec;
                return (
                  <tr key={x.id}>
                    <th scope="row" className="px-4 py-2 text-start font-normal text-foreground">
                      <Ltr mono>{x.name}</Ltr>
                    </th>
                    <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">{duration(x.intervalSec * 1000, locale)}</td>
                    <td className="px-4 py-2">
                      {!x.enabled ? (
                        <span className="text-muted-foreground">{s.lagDisabled}</span>
                      ) : late ? (
                        <Pill tone={x.status === 'failing' ? 'danger' : 'warning'} icon={Clock}>
                          {duration(x.lagSec * 1000, locale)}
                        </Pill>
                      ) : (
                        <span className="text-foreground">{duration(Math.max(x.lagSec, 1) * 1000, locale)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="queues-title" className="flex flex-col gap-3">
        <SectionHeader id="queues-title" icon={Layers} title={s.queuesTitle} level={3} />
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-muted-foreground">
                {[s.queue, s.waiting, s.active, s.failed, s.delayed].map((h, i) => (
                  <th key={h} scope="col" className={cn('border-b border-border px-3 py-2 font-medium', i === 0 ? 'text-start' : 'text-end')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {queues.map((q) => (
                <tr key={q.name}>
                  <th scope="row" className="px-3 py-2 text-start font-normal text-foreground">
                    <Ltr mono>{q.name}</Ltr>
                  </th>
                  {[q.waiting, q.active, q.failed, q.delayed].map((value, i) => (
                    <td key={i} className={cn('px-3 py-2 text-end tabular-nums', i === 2 && value > 0 ? 'font-medium text-destructive-soft-foreground' : value === 0 ? 'text-muted-foreground' : 'text-foreground')}>
                      <Ltr>{num(value, locale)}</Ltr>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="storage-title" className="flex flex-col gap-3">
        <SectionHeader id="storage-title" icon={HardDrive} title={s.storageTitle} level={3} />
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <p className="flex flex-wrap items-baseline justify-between gap-x-4 text-body-sm">
            <span className="font-medium text-foreground">{s.disk}</span>
            <span className="text-muted-foreground">
              <Bytes value={sys.disk.usedBytes} /> {s.of} <Bytes value={sys.disk.totalBytes} />
            </span>
          </p>
          <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(diskShare * 100)} aria-label={s.disk} className="h-2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground" style={{ inlineSize: `${diskShare * 100}%` }} />
          </div>
          <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
            <Database aria-hidden className="size-4" strokeWidth={1.75} />
            <span>
              {s.dbSize} <Bytes value={sys.db.sizeBytes} className="text-foreground" />
            </span>
          </p>
          <p className="text-body-sm text-muted-foreground">{fmt(s.backupFull, { when: absolute(sys.backup.lastAt, locale) })}</p>
        </div>
      </section>
    </>
  );
}
