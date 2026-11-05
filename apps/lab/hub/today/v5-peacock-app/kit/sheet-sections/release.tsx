import { Tabs } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { notesAuthors } from '@lab/mocks/hub-app/releases';
import { ActorChip } from '../avatar';
import { CardChip } from '../card-key';
import { CopyButton } from '../copy-button';
import { absolute } from '../format';
import { kitMessages } from '../i18n';
import { tabTriggerClass } from '../tabs-class';
import { Bidi, Ltr } from '../text';
import { Fact, Facts, SubHeading, type SectionProps } from './shared';

const messages = {
  ar: { wroteBy: 'كتبها', template: 'هيكل من قالب Hub. يمكن صقله من Claude Code.', copy: 'انسخ ملاحظات {name}' },
  en: { wroteBy: 'Written by', template: 'A skeleton from Hub’s template. It can be polished from Claude Code.', copy: 'Copy the {name} notes' },
};

export function ReleaseSection({ card }: SectionProps<'release'>) {
  const t = useT(kitMessages);
  const own = useT(messages);
  const locale = useLocale();
  const r = card.release;
  const s = t.sheet.release;
  const notes = ['team', 'owner', 'accountant'] as const;
  const author = notesAuthors.get(card.key) ?? { kind: 'system' as const };
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
          {r.includedKeys.map((key) => (
            <CardChip key={key} k={key} showTitle />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <SubHeading>{s.notes}</SubHeading>
        <p className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
          <span>{own.wroteBy}</span>
          <ActorChip kind={author.kind} memberId={author.memberId} adapter={author.kind === 'system' ? 'digests' : undefined} />
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
            <Tabs.Content key={note} value={note} className="flex flex-col items-start gap-2 pt-3 outline-none">
              <p className="text-body whitespace-pre-line text-foreground">
                <Bidi>{r.notes[note][locale]}</Bidi>
              </p>
              <CopyButton text={r.notes[note][locale]} showText={false} label={own.copy.replace('{name}', s.noteTabs[note])} />
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </div>
    </div>
  );
}
