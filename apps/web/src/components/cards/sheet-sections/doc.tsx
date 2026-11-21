'use client';

/**
 * @file doc.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/sheet-sections/doc.tsx. Contract: apps/web/README.md.
 */
import { BookOpen, ExternalLink } from 'lucide-react';

import { Pill } from '@/components/cards/badges';
import { CardChip } from '@/components/cards/card-key';
import { focusRing } from '@/components/cards/meta';
import { Fact, Facts, type SectionProps, SubHeading } from '@/components/cards/sheet-sections/shared';
import { CopyButton } from '@/components/common/copy-button';
import { fmt, Ltr } from '@/components/common/text';
import { AppLink } from '@/components/shell/router';
import { useDoc } from '@/features/docs/queries';
import { num, when } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const linkClass = cn(
  'hit-44 inline-flex items-center gap-1 self-start rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline',
  focusRing,
);

export function DocSection({ card }: SectionProps<'doc'>) {
  const t = useT(kitMessages);
  const own = t.sections.doc;
  const locale = useLocale();
  // The source's name and who mentions it come with the doc's own read, not with the card.
  const full = useDoc(card.key).data;
  const d = card.doc;
  const sourceName = full?.doc.sourceName ?? d.sourceName;
  const mentions = full?.mentionedBy ?? [];
  const s = t.sheet.doc;
  // The doc's own headings, from the same text the viewer shows.
  const outline = d.headings;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className="text-caption text-muted-foreground">{s.path}</p>
        <CopyButton text={d.path} className="self-start" />
      </div>
      {card.status === 'stale' && (
        <Pill tone="warning" className="self-start">
          {own.stale}
        </Pill>
      )}
      <Facts>
        <Fact label={t.sheet.fields.kind}>{s.kinds[d.kind]}</Fact>
        {sourceName && (
          <Fact label={s.source}>
            <span translate="no">{sourceName}</span>
          </Fact>
        )}
        {d.lastCommitSha && (
          // 08 §5.4: a short SHA, the full one on hover and on the clipboard.
          <Fact label={s.commit}>
            <span className="inline-flex items-center gap-1.5" title={d.lastCommitSha}>
              <Ltr mono>{d.lastCommitSha.slice(0, 7)}</Ltr>
              <CopyButton
                text={d.lastCommitSha}
                showText={false}
                label={fmt(own.copySha, { sha: d.lastCommitSha.slice(0, 7) })}
                className="size-11 border-transparent bg-transparent md:size-7"
              />
            </span>
          </Fact>
        )}
        <Fact label={s.words}>
          <Ltr className="tabular-nums">{num(d.wordCount, locale)}</Ltr>
        </Fact>
        <Fact label={own.lang}>{own.langs[d.lang]}</Fact>
        {d.lastIndexedAt && (
          <Fact label={own.indexedLabel} wide>
            {fmt(s.indexed, { when: when(d.lastIndexedAt, locale) })}
          </Fact>
        )}
      </Facts>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {/* The viewer is a place, so this is a link. Going there closes the sheet. */}
        <AppLink view="docs" query={{ doc: card.key, anchor: null }} className={linkClass}>
          <BookOpen aria-hidden className="size-3.5" strokeWidth={1.75} />
          {own.read}
        </AppLink>
        {d.webUrl && (
          <a href={d.webUrl} target="_blank" rel="noreferrer" className={linkClass}>
            {s.openGithub}
            <ExternalLink aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
          </a>
        )}
      </div>
      {outline.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{s.outline}</SubHeading>
          <ol dir={d.lang === 'ar' ? 'rtl' : 'ltr'} className="flex flex-col gap-1 text-body text-foreground">
            {outline.map((h) => (
              <li
                key={h.anchor}
                className={h.level > 2 ? 'ps-4 text-body-sm text-muted-foreground' : undefined}
              >
                <AppLink
                  view="docs"
                  query={{ doc: card.key, anchor: h.anchor }}
                  className={cn('rounded-sm underline-offset-4 hover:underline', focusRing)}
                >
                  {h.text}
                </AppLink>
              </li>
            ))}
          </ol>
        </div>
      )}
      {mentions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{s.referencedBy}</SubHeading>
          <div className="flex flex-wrap gap-2">
            {mentions.map((c) => (
              <CardChip key={c.key} k={c.key} type={c.type} title={c.title} showTitle />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
