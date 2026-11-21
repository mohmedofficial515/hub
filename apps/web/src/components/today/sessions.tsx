'use client';

/**
 * @file sessions.tsx
 * @description My sessions that have no summary yet (docs/09 §4), each with what to run to write one. The page draws it only when there is one.
 */
import type { NoSummarySession } from '@hub/contracts';
import { Bot, Clock } from 'lucide-react';

import {
  CopyButton,
  fill,
  fmt,
  Ltr,
  num,
  Pill,
  plural,
  SectionHeader,
  useLocale,
  useT,
  when,
} from '@/components/kit';

import { NS, type TodayMessages } from './messages';

export function SessionsWithoutSummary({ sessions }: { sessions: NoSummarySession[] }) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  return (
    <section aria-labelledby="sessions-title" className="flex flex-col gap-3">
      <SectionHeader id="sessions-title" icon={Bot} title={t.sessions.title} count={sessions.length} />
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.sessionLogId} className="rounded-lg border border-border bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
              <code
                dir="ltr"
                translate="no"
                className="key min-w-0 truncate text-body-sm font-medium text-foreground"
              >
                {[s.repo, s.branch].filter(Boolean).join('/') || s.sessionId}
              </code>
              <Pill tone="warning" icon={Clock}>
                {t.sessions.noSummary}
              </Pill>
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-body-sm text-muted-foreground">
              <time dateTime={s.at}>{when(s.at, locale)}</time>
              {s.durationMin !== null && (
                <span>{fmt(t.sessions.minutes, { n: num(s.durationMin, locale) })}</span>
              )}
              <span>{plural(s.commits, locale, t.sessions.commits)}</span>
              <span>{plural(s.files, locale, t.sessions.files)}</span>
              <Ltr mono className="text-caption">
                {s.sessionId}
              </Ltr>
            </p>
            <p className="mt-2 text-body-sm leading-9 text-muted-foreground">
              {fill(t.sessions.hint, {
                cmd: <CopyButton text="/hub:start" compact className="align-middle" />,
              })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
