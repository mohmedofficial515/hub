'use client';

/**
 * @file release.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/sheet-sections/release.tsx. Contract: apps/web/README.md.
 */
import { Tabs } from 'radix-ui';

import { ActorChip } from '@/components/cards/avatar';
import { CardChip } from '@/components/cards/card-key';
import { Fact, Facts, type SectionProps, SubHeading } from '@/components/cards/sheet-sections/shared';
import { CopyButton } from '@/components/common/copy-button';
import { MarkdownView } from '@/components/common/markdown';
import { Ltr } from '@/components/common/text';
import { tabTriggerClass } from '@/components/ui/tabs-class';
import { useCardEvents } from '@/features/cards/store';
import { useFinishedCards, useIncluded } from '@/features/releases/queries';
import { notesAuthor } from '@/features/releases/rules';
import { absolute } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';

export function ReleaseSection({ card }: SectionProps<'release'>) {
  const t = useT(kitMessages);
  const own = useT(kitMessages).sections.release;
  const locale = useLocale();
  const r = card.release;
  const s = t.sheet.release;
  const notes = ['team', 'owner', 'accountant'] as const;
  const events = useCardEvents(card.key);
  const author = notesAuthor(events.data ?? []);
  const finished = useFinishedCards();
  const included = useIncluded(r, finished.data?.items ?? []);
  return (
    <div className="flex flex-col gap-5">
      <Facts>
        <Fact label={s.version}>
          <Ltr mono>{r.version}</Ltr>
        </Fact>
        {r.repo && (
          <Fact label={s.repo}>
            <Ltr mono>{r.tag ? `${r.repo} · ${r.tag}` : r.repo}</Ltr>
          </Fact>
        )}
        {r.releasedAt && <Fact label={s.released}>{absolute(r.releasedAt, locale)}</Fact>}
      </Facts>
      <div className="flex flex-col gap-1.5">
        <SubHeading>{s.included}</SubHeading>
        <div className="flex flex-wrap gap-2">
          {included.map((c) => (
            <CardChip key={c.key} k={c.key} type={c.type} title={c.title} showTitle />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <SubHeading>{s.notes}</SubHeading>
        <p className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
          <span>{own.wroteBy}</span>
          <ActorChip
            kind={author.kind}
            memberId={author.memberId}
            adapter={author.kind === 'system' ? own.templateName : undefined}
          />
        </p>
        <Tabs.Root defaultValue="team" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <Tabs.List aria-label={s.notes} className="flex gap-1 border-b border-border">
            {notes.map((note) => (
              <Tabs.Trigger key={note} value={note} className={tabTriggerClass}>
                {s.noteTabs[note]}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {notes.map((note) => (
            <Tabs.Content
              key={note}
              value={note}
              className="flex flex-col items-start gap-2 pt-3 outline-none"
            >
              {r.notes[note] ? (
                <>
                  <MarkdownView source={r.notes[note]} headingOffset={3} />
                  <CopyButton
                    text={r.notes[note]}
                    showText={false}
                    label={own.copy.replace('{name}', s.noteTabs[note])}
                  />
                </>
              ) : (
                <p className="text-body-sm text-muted-foreground">{own.noNotes}</p>
              )}
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </div>
    </div>
  );
}
