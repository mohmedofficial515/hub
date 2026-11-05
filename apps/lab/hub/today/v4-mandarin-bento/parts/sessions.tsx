import { CircleCheck, Clock } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { SessionRow } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Chip, CopyButton, EmptyNote, fill, fmt, HubLink, Ltr, Tile, TileHead } from './atoms';
import { num, plural, when } from './format';

export function SessionsWithoutSummary({ sessions, className }: { sessions: SessionRow[]; className?: string }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <Tile rule="orange" labelledBy="sessions-title" className={className}>
      <TileHead id="sessions-title" title={t.sessions.title} count={sessions.length > 0 ? sessions.length : undefined} />
      {sessions.length === 0 ? (
        <EmptyNote icon={CircleCheck} title={t.sessions.empty} className="mt-3" />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {sessions.map((s) => (
            <li key={s.sessionId} data-row className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <HubLink
                  data-row-title
                  to={`/timeline?kind=session&id=${encodeURIComponent(s.sessionId)}`}
                  title={`${s.repo}/${s.branch}`}
                  className="min-w-0 truncate text-body-sm font-medium underline-offset-4 hover:underline"
                >
                  <code dir="ltr" translate="no" className="key">
                    {s.repo}/{s.branch}
                  </code>
                </HubLink>
                <Chip tone="warn" icon={Clock}>
                  {t.sessions.noSummary}
                </Chip>
              </div>
              <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-body-sm text-(--t-muted)">
                <time dateTime={s.at}>{when(s.at, locale)}</time>
                <span>{fmt(t.sessions.minutes, { n: num(s.durationMin, locale) })}</span>
                <span>{plural(s.commits, locale, t.sessions.commits)}</span>
                <span>{plural(s.files, locale, t.sessions.files)}</span>
                <Ltr mono>{s.sessionId}</Ltr>
              </p>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-(--t-muted)">{fill(t.sessions.hint, { cmd: <CopyButton text="/hub:start" /> })}</p>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}
