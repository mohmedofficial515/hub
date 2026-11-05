import { Fragment, type ReactNode } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { NOW, type L, type NarrativeRef, type Today } from '@lab/mocks/hub-today';
import { Button, CardChip, cn, CopyButton, fill, longDate, Ltr, time } from '../../../kit';
import { messages } from '../i18n';

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
 * The agent's letter (08 P4): Cairo at reading size with a tall line, signed by the agent. Doc 08's gradient ban
 * stands, so the rule under the header is gone. On a phone it starts clamped to 3 lines, so the first action is on
 * the first screen (review B2).
 */
export function MorningLetter({ narrative, collapsed, onToggle, framed }: { narrative: Narrative | null; collapsed: boolean; onToggle: () => void; framed: boolean }) {
  const t = useT(messages);
  const locale = useLocale();

  if (!narrative) {
    return (
      <section aria-labelledby="letter-title" className={cn('flex items-start gap-3 rounded-lg border border-dashed border-border p-4', framed ? 'bg-card' : 'bg-background')}>
        <Bot aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0">
          <h2 id="letter-title" className="text-body font-medium text-foreground">
            {t.letter.absentTitle}
          </h2>
          <p className="mt-1.5 text-body-sm leading-9 text-muted-foreground">{fill(t.letter.absentBody, { cmd: <CopyButton text="/hub:start" compact className="align-middle" /> })}</p>
        </div>
      </section>
    );
  }

  return (
    <article aria-labelledby="letter-title" className={cn(framed && 'rounded-lg border border-border bg-card p-4')}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="letter-title" className="text-title-sm font-semibold text-foreground">
          {t.letter.title}
        </h2>
        <time dateTime={NOW.slice(0, 10)} className={cn('text-body-sm text-muted-foreground', framed && 'hidden sm:block')}>
          {longDate(NOW, locale)}
        </time>
      </header>
      <div id="letter-body" className={cn('hub-letter mt-2 text-pretty text-foreground', collapsed && 'line-clamp-3')}>
        {render(narrative.markdown[locale], narrative.refs ?? [], locale)}
      </div>
      <footer className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
          <Bot aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          {fill(t.letter.signed, { when: <Ltr className="tabular-nums">{time(narrative.at, locale)}</Ltr> })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" aria-expanded={!collapsed} aria-controls="letter-body" onClick={onToggle}>
            {collapsed ? t.letter.expand : t.letter.collapse}
            <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-200 motion-reduce:transition-none', !collapsed && 'rotate-180')} strokeWidth={1.75} />
          </Button>
          {!collapsed && <CopyButton text="/hub:start" compact />}
        </div>
      </footer>
    </article>
  );
}
