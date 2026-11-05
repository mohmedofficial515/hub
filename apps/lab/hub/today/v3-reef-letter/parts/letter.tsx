import { Fragment, useId, useState, type ReactNode } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { NOW, type L, type NarrativeRef, type Today } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, CardChip, CopyButton, fill, Ltr } from './atoms';
import { longDate, time } from './format';
import { useMedia } from './hooks';

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
        <strong key={k} className="font-bold">
          {text}
        </strong>
      ) : span.kind === 'code' ? (
        <code key={k} dir="ltr" translate="no" className="key rounded-sm bg-muted px-1 py-0.5 text-body-sm whitespace-nowrap">
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

/**
 * A letter, not a widget: a sheet of paper with its own dateline, a measure and leading of its own, and
 * a signature at the end. It is the only long prose on the page, and it says plainly who wrote it (P4).
 * Phone opens folded to three lines; a wider screen opens it. The reader's choice then stands.
 */
export function MorningLetter({ narrative }: { narrative: Narrative | null }) {
  const t = useT(messages);
  const locale = useLocale();
  const phone = useMedia('(max-width: 767px)');
  const [choice, setChoice] = useState<boolean | null>(null);
  const folded = choice ?? phone;
  const bodyId = useId();

  if (!narrative) {
    return (
      <section aria-labelledby="letter-title" className="flex items-start gap-3">
        <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bot className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 id="letter-title" className="text-title-sm font-semibold text-foreground">
            {t.letter.absentTitle}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body text-muted-foreground">
            {fill(t.letter.absentBody, { cmd: <CopyButton text="/hub:start" /> })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <article aria-labelledby="letter-title" className="rounded-md border border-border bg-card px-5 py-5 md:px-10 md:py-9">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="letter-title" className="reef-h2 text-foreground">
          {t.letter.title}
        </h2>
        <time dateTime={NOW.slice(0, 10)} className="text-body-sm text-muted-foreground">
          {longDate(NOW, locale)}
        </time>
      </header>
      <div id={bodyId} className={cn('reef-letter mt-3 max-w-[65ch] text-pretty text-foreground md:mt-5', folded && 'line-clamp-3')}>
        {render(narrative.markdown[locale], narrative.refs ?? [], locale)}
      </div>
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 md:mt-5">
        <div className="-ms-3 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" aria-expanded={!folded} aria-controls={bodyId} onClick={() => setChoice(!folded)}>
            {folded ? t.letter.expand : t.letter.collapse}
            <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-200 motion-reduce:transition-none', !folded && 'rotate-180')} strokeWidth={1.75} />
          </Button>
          {!folded && <CopyButton text="/hub:start" />}
        </div>
        <p className="ms-auto flex items-center gap-2 text-body-sm font-medium text-foreground">
          <Bot aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
          {fill(t.letter.signed, { when: <Ltr className="tabular-nums">{time(narrative.at, locale)}</Ltr> })}
        </p>
      </footer>
    </article>
  );
}
