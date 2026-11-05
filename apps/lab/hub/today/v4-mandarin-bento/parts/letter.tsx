import { Fragment, type ReactNode } from 'react';
import { Bot, ChevronDown, Quote } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { L, NarrativeRef, Today } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, CardChip, CopyButton, fill, Ltr, Tile, TileHead } from './atoms';
import { time } from './format';
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
function render(md: string, refs: NarrativeRef[], locale: keyof L, scope: string): ReactNode[] {
  const out: ReactNode[] = [];
  parse(md).forEach((span, si) => {
    const wrap = (text: string, k: string) =>
      span.kind === 'bold' ? (
        <strong key={k} className="font-extrabold">
          {text}
        </strong>
      ) : span.kind === 'code' ? (
        <code key={k} dir="ltr" translate="no" className="key rounded-sm bg-(--t-chip) px-1 py-0.5 text-body-sm font-normal whitespace-nowrap">
          {text}
        </code>
      ) : (
        <Fragment key={k}>{text}</Fragment>
      );
    if (span.kind === 'code') {
      out.push(wrap(span.text, `${scope}s${si}`));
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
      out.push(wrap(rest.slice(0, end), `${scope}s${si}-${n}`));
      out.push(
        <Fragment key={`${scope}c${si}-${n}`}>
          {' '}
          <CardChip k={r.key} type={r.type} className="font-normal" />
        </Fragment>,
      );
      rest = rest.slice(end);
      n += 1;
    }
    if (rest) out.push(wrap(rest, `${scope}s${si}-end`));
  });
  return out;
}

/** The first sentence becomes the lede, set large; the rest reads as the letter. */
function split(md: string) {
  const m = /^(.+?[.؟!])\s+(.*)$/s.exec(md);
  return m ? { lede: m[1], body: m[2] } : { lede: md, body: '' };
}

export function MorningLetter({
  narrative,
  expanded,
  onToggle,
  className,
}: {
  narrative: Narrative | null;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const t = useT(messages);
  const locale = useLocale();
  // Collapsed only on a phone, where the letter must not push the page down (v2 finding B2).
  const wide = useMedia('(min-width: 768px)');
  const collapsed = !wide && !expanded;

  if (!narrative) {
    return (
      <Tile rule="yellow" labelledBy="letter-title" className={className}>
        <TileHead id="letter-title" title={t.letter.title} />
        <p className="mt-2 text-body font-semibold">{t.letter.absentTitle}</p>
        <p className="mt-1 text-body-sm leading-9 text-(--t-muted)">{fill(t.letter.absentBody, { cmd: <CopyButton text="/hub:start" className="align-middle" /> })}</p>
      </Tile>
    );
  }

  const refs = narrative.refs ?? [];
  const { lede, body } = split(narrative.markdown[locale]);

  return (
    <Tile rule="yellow" labelledBy="letter-title" className={cn('flex flex-col', className)}>
      <TileHead id="letter-title" title={t.letter.title} />

      <div className="mt-4 flex gap-3">
        <Quote aria-hidden className="size-8 shrink-0 fill-(--fish-yellow) text-(--fish-yellow) rtl:-scale-x-100 md:size-10" strokeWidth={0} />
        <div className="min-w-0 flex-1">
          <div id="letter-body">
            <p className={cn('text-title font-bold text-pretty', collapsed && 'line-clamp-3')}>{render(lede, refs, locale, 'l')}</p>
            {body && !collapsed && <p className="mt-3 text-body-lg text-pretty">{render(body, refs, locale, 'b')}</p>}
          </div>
        </div>
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:mt-auto md:pt-4">
        <p className="flex items-center gap-1.5 text-body-sm text-(--t-muted)">
          <Bot aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          <span>{fill(t.letter.signed, { when: <Ltr className="tabular-nums">{time(narrative.at, locale)}</Ltr> })}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!wide && (
            <Button variant="ghost" aria-expanded={!collapsed} aria-controls="letter-body" onClick={onToggle} className="px-2 font-semibold">
              {collapsed ? t.letter.expand : t.letter.collapse}
              <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-150 motion-reduce:transition-none', !collapsed && 'rotate-180')} strokeWidth={1.75} />
            </Button>
          )}
          <CopyButton text="/hub:start" />
        </div>
      </footer>
    </Tile>
  );
}
