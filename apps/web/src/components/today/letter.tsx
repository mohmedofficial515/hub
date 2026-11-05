'use client';

/**
 * @file letter.tsx
 * @description The agent's letter (08 P4): Cairo at reading size with a tall line, signed by the agent. On a phone it starts clamped to 3 lines, so
 * the first action is on the first screen (review B2). The body is what the agent saved through `hub.save_brief`: a small subset of Markdown, with
 * card keys turned into chips.
 */
import { Bot, ChevronDown } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

import {
  Button,
  CardChip,
  cn,
  CopyButton,
  fill,
  longDate,
  Ltr,
  time,
  useLocale,
  useT,
} from '@/components/kit';

import { NS, type TodayMessages } from './messages';

type Span = { kind: 'text' | 'bold' | 'code'; text: string };

/** The agent writes **bold** and `code`. Anything else reads as the plain text it is. */
export function parseLetter(md: string): Span[] {
  return md
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') && part.length > 4
        ? { kind: 'bold', text: part.slice(2, -2) }
        : part.startsWith('`') && part.length > 2
          ? { kind: 'code', text: part.slice(1, -1) }
          : { kind: 'text', text: part },
    );
}

const CARD_KEY = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/;

/** Text and the keys inside it, in order. Odd places are the keys. */
export const splitKeys = (text: string) => text.split(CARD_KEY);

function Keyed({ text }: { text: string }) {
  return splitKeys(text).map((part, i) =>
    i % 2 === 1 ? <CardChip key={i} k={part} /> : <Fragment key={i}>{part}</Fragment>,
  );
}

function renderLetter(md: string): ReactNode[] {
  return parseLetter(md).map((span, i) =>
    span.kind === 'code' ? (
      <code
        key={i}
        dir="ltr"
        translate="no"
        className="key rounded-sm bg-muted px-1 py-0.5 text-body-sm whitespace-nowrap"
      >
        {span.text}
      </code>
    ) : span.kind === 'bold' ? (
      <strong key={i} className="font-bold">
        <Keyed text={span.text} />
      </strong>
    ) : (
      <Keyed key={i} text={span.text} />
    ),
  );
}

export interface Narrative {
  markdown: string;
  at: string | null;
  date: string;
}

export function MorningLetter({
  narrative,
  collapsed,
  onToggle,
  framed,
}: {
  narrative: Narrative | null;
  collapsed: boolean;
  onToggle: () => void;
  framed: boolean;
}) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();

  if (!narrative) {
    return (
      <section
        aria-labelledby="letter-title"
        className={cn(
          'flex items-start gap-3 rounded-lg border border-dashed border-border p-4',
          framed ? 'bg-card' : 'bg-background',
        )}
      >
        <Bot aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0">
          <h2 id="letter-title" className="text-body font-medium text-foreground">
            {t.letter.absentTitle}
          </h2>
          <p className="mt-1.5 text-body-sm leading-9 text-muted-foreground">
            {fill(t.letter.absentBody, {
              cmd: <CopyButton text="/hub:start" compact className="align-middle" />,
            })}
          </p>
        </div>
      </section>
    );
  }

  return (
    <article
      aria-labelledby="letter-title"
      className={cn(framed && 'rounded-lg border border-border bg-card p-4')}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="letter-title" className="text-title-sm font-semibold text-foreground">
          {t.letter.title}
        </h2>
        <time
          dateTime={narrative.date}
          className={cn('text-body-sm text-muted-foreground', framed && 'hidden sm:block')}
        >
          {longDate(`${narrative.date}T12:00:00+03:00`, locale)}
        </time>
      </header>
      <div
        id="letter-body"
        className={cn(
          'hub-letter mt-2 text-pretty whitespace-pre-line text-foreground',
          collapsed && 'line-clamp-3',
        )}
      >
        {renderLetter(narrative.markdown)}
      </div>
      <footer className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {narrative.at && (
          <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
            <Bot aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
            {fill(t.letter.signed, {
              when: <Ltr className="tabular-nums">{time(narrative.at, locale)}</Ltr>,
            })}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={!collapsed}
            aria-controls="letter-body"
            onClick={onToggle}
          >
            {collapsed ? t.letter.expand : t.letter.collapse}
            <ChevronDown
              aria-hidden
              className={cn(
                'size-4 transition-transform duration-200 motion-reduce:transition-none',
                !collapsed && 'rotate-180',
              )}
              strokeWidth={1.75}
            />
          </Button>
          {!collapsed && <CopyButton text="/hub:start" compact />}
        </div>
      </footer>
    </article>
  );
}
