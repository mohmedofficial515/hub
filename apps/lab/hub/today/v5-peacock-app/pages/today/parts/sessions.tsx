import { Bot, CircleCheck, Clock } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { SessionRow } from '@lab/mocks/hub-today';
import { CopyButton, EmptyState, fill, fmt, Ltr, num, Pill, plural, SectionHeader, when } from '../../../kit';
import { messages } from '../i18n';

export function SessionsWithoutSummary({ sessions }: { sessions: SessionRow[] }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <section aria-labelledby="sessions-title" className="flex flex-col gap-3">
      <SectionHeader id="sessions-title" icon={Bot} title={t.sessions.title} count={sessions.length} />
      {sessions.length === 0 ? (
        <EmptyState icon={CircleCheck} title={t.sessions.empty} />
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.sessionId} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <code dir="ltr" translate="no" className="key min-w-0 truncate text-body-sm font-medium text-foreground">
                  {s.repo}/{s.branch}
                </code>
                <Pill tone="warning" icon={Clock}>
                  {t.sessions.noSummary}
                </Pill>
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-body-sm text-muted-foreground">
                <time dateTime={s.at}>{when(s.at, locale)}</time>
                <span>{fmt(t.sessions.minutes, { n: num(s.durationMin, locale) })}</span>
                <span>{plural(s.commits, locale, t.sessions.commits)}</span>
                <span>{plural(s.files, locale, t.sessions.files)}</span>
                <Ltr mono className="text-caption">
                  {s.sessionId}
                </Ltr>
              </p>
              <p className="mt-2 text-body-sm leading-9 text-muted-foreground">{fill(t.sessions.hint, { cmd: <CopyButton text="/hub:start" compact className="align-middle" /> })}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
