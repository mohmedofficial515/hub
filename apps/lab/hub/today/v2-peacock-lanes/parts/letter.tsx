import { Fragment, type ReactNode } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { NOW, type L, type NarrativeRef, type Today } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, CardChip, CopyButton, fill, Ltr } from './atoms';
import { longDate, time } from './format';

type Narrative = NonNullable<Today['narrative']> & { refs?: NarrativeRef[] };
type Span = { kind: 'text' | 'bold' | 'code'; text: string };

/** The agent writes a small subset of Markdown: **bold** and `code`. */
function parse(md: string): Span[] {
  return md
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**')
        ? { kind: 'bold', text: part.slice(2, -2) }
        : part.startsWith('`')
          ? { kind: 'code', text: part.slice(1, -1) }
          : { kind: 'text', text: part },
    );
}

/** Insert a CardChip right after every phrase the agent linked to a card (`refs[].after`). */
function render(md: string, refs: NarrativeRef[], locale: keyof L): ReactNode[] {
  const out: ReactNode[] = [];
  parse(md).forEach((span, si) => {
    const wrap = (text: string, k: string) =>
      span.kind === 'bold' ? (
        <strong key={k} className="font-semibold">
          {text}
        </strong>
      ) : span.kind === 'code' ? (
        <code key={k} dir="ltr" className="key rounded-sm bg-muted px-1 py-0.5 text-body-sm whitespace-nowrap">
          {text}
        </code>
      ) : (
        <Fragment key={k}>{text}</Fragment>
      );
    if (span.kind === 'code') {
      out.push(wrap(span.text, `s${si}`));
      return;
    }
    let rest = span.text;
    let n = 0;
    for (;;) {
      const hits = refs
        .map((r) => ({ r, at: rest.indexOf(r.after[locale]) }))
        .filter((h) => h.at >= 0)
        .sort((a, b) => a.at - b.at);
      if (!hits.length) break;
      const { r, at } = hits[0];
      const end = at + r.after[locale].length;
      out.push(wrap(rest.slice(0, end), `s${si}-${n}`));
      out.push(
        <Fragment key={`c${si}-${n}`}>
          {' '}
          <CardChip k={r.key} type={r.type} />
        </Fragment>,
      );
      rest = rest.slice(end);
      n += 1;
    }
    if (rest) out.push(wrap(rest, `s${si}-end`));
  });
  return out;
}

export function MorningLetter({
  narrative,
  collapsed,
  onToggle,
  framed = false,
  idSuffix,
}: {
  narrative: Narrative | null;
  collapsed: boolean;
  onToggle: () => void;
  framed?: boolean;
  idSuffix: string;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const titleId = `letter-title-${idSuffix}`;
  const bodyId = `letter-body-${idSuffix}`;

  if (!narrative) {
    return (
      <section
        aria-labelledby={titleId}
        className={cn('flex items-start gap-3 rounded-2xl border border-dashed border-border p-4', framed ? 'bg-card' : 'bg-background/40')}
      >
        <Bot aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0">
          <h2 id={titleId} className="text-body font-medium text-foreground">
            {t.letter.absentTitle}
          </h2>
          <p className="mt-1.5 text-body-sm leading-8 text-muted-foreground">
            {fill(t.letter.absentBody, { cmd: <CopyButton text="/hub:start" compact className="align-middle" /> })}
          </p>
        </div>
      </section>
    );
  }

  return (
    <article
      aria-labelledby={titleId}
      className={cn(framed && 'rounded-2xl border border-border bg-card p-4 sm:p-5')}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={titleId} className="text-title-sm font-semibold text-foreground">
          {t.letter.title}
        </h2>
        <time dateTime={NOW.slice(0, 10)} className="text-caption text-muted-foreground">
          {longDate(NOW, locale)}
        </time>
      </header>
      {/* The page's only gradient: neck blue → eye cyan → tail teal, 2 px, under the letter header. */}
      <div aria-hidden className="mt-3 h-0.5 rounded-full bg-linear-to-r from-type-task via-type-handoff to-type-doc rtl:bg-linear-to-l" />
      <div id={bodyId} className={cn('peacock-letter mt-4 text-pretty text-foreground', collapsed && 'line-clamp-3')}>
        {render(narrative.markdown[locale], narrative.refs ?? [], locale)}
      </div>
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-caption text-muted-foreground">
          <Bot aria-hidden className="size-4" strokeWidth={1.75} />
          {fill(t.letter.signed, { when: <Ltr className="tabular-nums">{time(narrative.at, locale)}</Ltr> })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" aria-expanded={!collapsed} aria-controls={bodyId} onClick={onToggle}>
            {collapsed ? t.letter.expand : t.letter.collapse}
            <ChevronDown
              aria-hidden
              className={cn('size-4 transition-transform duration-200 motion-reduce:transition-none', !collapsed && 'rotate-180')}
              strokeWidth={1.75}
            />
          </Button>
          <CopyButton text="/hub:start" compact />
        </div>
      </footer>
    </article>
  );
}
