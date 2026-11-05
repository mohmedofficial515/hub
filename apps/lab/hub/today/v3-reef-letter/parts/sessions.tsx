import { Bot } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { SessionRow } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { CopyButton, fill, fmt, Ltr, SectionHead, TypeIcon } from './atoms';
import { num, plural, when } from './format';

/** Omitted when there is nothing to do (07 §6.1: a section with no items is left out). */
export function SessionsWithoutSummary({ sessions }: { sessions: SessionRow[] }) {
  const t = useT(messages);
  const locale = useLocale();
  if (sessions.length === 0) return null;
  return (
    <section aria-labelledby="sessions-title" className="flex flex-col gap-2 md:gap-3">
      <SectionHead id="sessions-title" title={t.sessions.title} />
      <ul className="flex flex-col divide-y divide-border">
        {sessions.map((s) => (
          <li
            key={s.sessionId}
            id={`row-session-${s.sessionId}`}
            data-row
            tabIndex={-1}
            className="grid scroll-my-24 grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-3 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:gap-x-4"
          >
            <TypeIcon type="change" icon={Bot} />
            <div className="min-w-0">
              <p className="text-body font-medium break-words text-foreground">
                <Ltr mono>
                  {s.repo}/{s.branch}
                </Ltr>
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-body-sm text-muted-foreground">
                <time dateTime={s.at}>{when(s.at, locale)}</time>
                <span>{fmt(t.sessions.minutes, { n: num(s.durationMin, locale) })}</span>
                <span>{plural(s.commits, locale, t.sessions.commits)}</span>
                <span>{plural(s.files, locale, t.sessions.files)}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-muted-foreground">
                {fill(t.sessions.hint, { cmd: <CopyButton text="/hub:start" /> })}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
