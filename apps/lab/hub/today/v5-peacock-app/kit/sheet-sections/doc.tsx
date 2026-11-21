import { BookOpen, ExternalLink } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { docContent, githubUrl } from '@lab/mocks/hub-app/docs';
import { AppLink } from '../../shell/router';
import { CardChip } from '../card-key';
import { CopyButton } from '../copy-button';
import { num, when } from '../format';
import { kitMessages } from '../i18n';
import { headingsOf } from '../markdown';
import { focusRing } from '../meta';
import { Pill } from '../badges';
import { fmt, Ltr } from '../text';
import { Fact, Facts, SubHeading, type SectionProps } from './shared';

const messages = {
  ar: { read: 'اقرأها في صفحة الوثائق', stale: 'تغيّر المصدر ولم تُفهرس بعد', lang: 'اللغة', langs: { ar: 'العربية', en: 'الإنجليزية' } },
  en: { read: 'Read it on the Docs page', stale: 'The source moved and indexing has not run yet', lang: 'Language', langs: { ar: 'Arabic', en: 'English' } },
};

const linkClass = cn('hit-44 inline-flex items-center gap-1 self-start rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline', focusRing);

export function DocSection({ card }: SectionProps<'doc'>) {
  const t = useT(kitMessages);
  const own = useT(messages);
  const locale = useLocale();
  const d = card.doc;
  const s = t.sheet.doc;
  // The doc's own headings, from the same text the viewer shows.
  const content = docContent(card.key);
  const outline = content ? headingsOf(content) : d.headings;
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
        <Fact label={s.source}>
          <span translate="no">{d.sourceName}</span>
        </Fact>
        <Fact label={s.commit}>
          <Ltr mono>{d.lastCommitSha}</Ltr>
        </Fact>
        <Fact label={s.words}>
          <Ltr className="tabular-nums">{num(d.wordCount, locale)}</Ltr>
        </Fact>
        <Fact label={own.lang}>{own.langs[d.lang]}</Fact>
        <Fact label={t.status.current} wide>
          {fmt(s.indexed, { when: when(d.lastIndexedAt, locale) })}
        </Fact>
      </Facts>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {/* The viewer is a place, so this is a link. Going there closes the sheet. */}
        <AppLink view="docs" query={{ doc: card.key, anchor: null }} className={linkClass}>
          <BookOpen aria-hidden className="size-3.5" strokeWidth={1.75} />
          {own.read}
        </AppLink>
        <a href={githubUrl(card.key)} target="_blank" rel="noreferrer" className={linkClass}>
          {s.openGithub}
          <ExternalLink aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
        </a>
      </div>
      {outline.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{s.outline}</SubHeading>
          <ol dir={d.lang === 'ar' ? 'rtl' : 'ltr'} className="flex flex-col gap-1 text-body text-foreground">
            {outline.map((h) => (
              <li key={h.anchor} className={h.level > 2 ? 'ps-4 text-body-sm text-muted-foreground' : undefined}>
                <AppLink view="docs" query={{ doc: card.key, anchor: h.anchor }} className={cn('rounded-sm underline-offset-4 hover:underline', focusRing)}>
                  {h.text}
                </AppLink>
              </li>
            ))}
          </ol>
        </div>
      )}
      {d.referencedBy.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{s.referencedBy}</SubHeading>
          <div className="flex flex-wrap gap-2">
            {d.referencedBy.map((key) => (
              <CardChip key={key} k={key} showTitle />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
