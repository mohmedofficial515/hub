'use client';

/**
 * @file change.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/sheet-sections/change.tsx. Contract: apps/web/README.md.
 */
import { ExternalLink } from 'lucide-react';

import { ActorChip } from '@/components/cards/avatar';
import { Pill, StatusBadge } from '@/components/cards/badges';
import { CardChip } from '@/components/cards/card-key';
import { focusRing } from '@/components/cards/meta';
import { Fact, Facts, type SectionProps, SubHeading } from '@/components/cards/sheet-sections/shared';
import { CopyButton } from '@/components/common/copy-button';
import { RelativeTime } from '@/components/common/relative-time';
import { Bidi, fill, Ltr } from '@/components/common/text';
import { duration, num, plural, time } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';

/** Strings only this section needs. The shared vocabulary stays in `kit/i18n.ts`. */
/** Added against removed at a glance. The numbers beside it say the same, so colour is not alone. */
function SizeBar({ added, removed }: { added: number; removed: number }) {
  const t = useT(kitMessages).sections.change;
  const total = added + removed || 1;
  return (
    <span
      role="img"
      aria-label={t.sizeLabel.replace('{added}', String(added)).replace('{removed}', String(removed))}
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <span className="h-full bg-success" style={{ inlineSize: `${(added / total) * 100}%` }} />
      <span className="h-full bg-destructive" style={{ inlineSize: `${(removed / total) * 100}%` }} />
    </span>
  );
}

/** 08 §5.2: commits, a pull request or a session. One section, because all three answer "what changed, and who wrote it". */
export function ChangeSection({ card }: SectionProps<'change'>) {
  const t = useT(kitMessages).sections.change;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const c = card.change;
  const s = kit.sheet.change;
  const hidden = c.kind === 'commits' ? c.commitCount - c.commits.length : 0;
  const related = card.links.filter((l) => l.kind === 'relates');
  return (
    <div className="flex flex-col gap-5">
      <Facts>
        <Fact label={kit.sheet.fields.kind}>{s.kinds[c.kind]}</Fact>
        {c.authorUserId ? (
          <Fact label={s.author}>
            <ActorChip memberId={c.authorUserId} />
          </Fact>
        ) : (
          c.authorLogin && (
            <Fact label={t.login}>
              <Ltr mono>{c.authorLogin}</Ltr>
            </Fact>
          )
        )}
        {card.branch && (
          <Fact label={kit.sheet.fields.branch} wide>
            <code dir="ltr" translate="no" className="key break-all">
              {card.repo}/{card.branch}
            </code>
          </Fact>
        )}
        {c.windowStart && c.windowEnd && (
          <Fact label={t.window} wide>
            <Ltr className="tabular-nums">
              {time(c.windowStart, locale)} – {time(c.windowEnd, locale)}
            </Ltr>{' '}
            <span className="text-muted-foreground">
              ({duration(Date.parse(c.windowEnd) - Date.parse(c.windowStart), locale)})
            </span>
          </Fact>
        )}
        <Fact label={s.commits}>
          <Ltr className="tabular-nums">{num(c.commitCount, locale)}</Ltr>
        </Fact>
        <Fact label={s.files}>
          <Ltr className="tabular-nums">{num(c.filesChanged, locale)}</Ltr>
        </Fact>
        <Fact label={s.added}>
          <Ltr className="tabular-nums">+{num(c.additions, locale)}</Ltr>
        </Fact>
        <Fact label={s.removed}>
          <Ltr className="tabular-nums">−{num(c.deletions, locale)}</Ltr>
        </Fact>
      </Facts>
      {c.additions + c.deletions > 0 && <SizeBar added={c.additions} removed={c.deletions} />}

      {c.kind === 'pull_request' && c.prNumber && (
        <div className="flex flex-wrap items-center gap-2 text-body-sm">
          <Ltr mono className="text-foreground">
            #{c.prNumber}
          </Ltr>
          <StatusBadge
            status={c.prState === 'merged' ? 'merged' : c.prState === 'closed' ? 'cancelled' : 'open'}
          />
          {c.prUrl && (
            <a
              href={c.prUrl}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 hover:underline ${focusRing}`}
            >
              {s.openPr}
              <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
            </a>
          )}
        </div>
      )}

      {c.commits.length > 0 && (
        <div className="flex flex-col gap-2">
          <SubHeading>{s.commitList}</SubHeading>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {c.commits.map((commit) => (
              <li key={commit.sha} className="flex flex-col gap-0.5 px-3 py-2">
                <code dir="ltr" translate="no" className="key text-start text-body-sm text-foreground">
                  <span className="text-muted-foreground">{commit.sha}</span> {commit.message}
                </code>
                <span className="flex flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
                  <RelativeTime iso={commit.at} />
                  <span>{plural(commit.files, locale, t.files)}</span>
                  <Ltr className="tabular-nums">
                    +{commit.additions} −{commit.deletions}
                  </Ltr>
                </span>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="text-body-sm text-muted-foreground">{plural(hidden, locale, t.moreCommits)}</p>
          )}
        </div>
      )}

      {c.session && (
        <div className="flex flex-col gap-2">
          <SubHeading>{s.session}</SubHeading>
          <Facts>
            <Fact label={s.session}>
              <Ltr mono>{c.session.sessionId}</Ltr>
            </Fact>
            <Fact label={s.duration}>{duration(c.session.durationSec * 1000, locale)}</Fact>
            {c.session.changed && (
              <Fact label={s.changed} wide>
                <Bidi>{c.session.changed}</Bidi>
              </Fact>
            )}
            {c.session.remaining && (
              <Fact label={s.remaining} wide>
                <Bidi>{c.session.remaining}</Bidi>
              </Fact>
            )}
          </Facts>
          {c.session.noSummary && (
            <p className="text-body-sm leading-9 text-muted-foreground">
              <Pill tone="warning" className="me-2">
                {s.noSummary}
              </Pill>
              {fill(s.noSummaryHint, {
                cmd: <CopyButton compact text="/hub:start" className="align-middle" />,
              })}
            </p>
          )}
        </div>
      )}

      {related.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{t.related}</SubHeading>
          <div className="flex flex-wrap gap-2">
            {related.map((l) => (
              <CardChip key={l.key} k={l.key} showTitle showStatus className="h-auto min-h-8 py-1" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
