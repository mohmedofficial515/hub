'use client';

/**
 * @file letter.tsx
 * @description The agent's letter (08 P4): Cairo at reading size with a tall line, signed by the agent. On a phone it starts clamped to 3 lines, so
 * the first action is on the first screen (review B2). The body is what the agent saved through `hub.save_brief`: a small subset of Markdown
 * (headings, lists, bold, code, safe links), with card keys turned into chips.
 */
import { Bot, ChevronDown } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

import {
  Button,
  CardChip,
  cn,
  CopyButton,
  fill,
  focusRing,
  longDate,
  Ltr,
  time,
  useLocale,
  useT,
} from '@/components/kit';
import { isSafeHref, markdownExcerpt } from '@/lib/markdown-text';

import { NS, type TodayMessages } from './messages';

type Span = { kind: 'text' | 'bold' | 'code'; text: string } | { kind: 'link'; text: string; href: string };

/** The agent writes **bold**, `code` and [words](links). A link the browser could run (`javascript:`) stays as its words. */
export function parseLetter(md: string): Span[] {
  return md
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]\n]+\]\([^)\s]+\))/)
    .filter(Boolean)
    .map((part): Span => {
      if (part.startsWith('**') && part.length > 4) return { kind: 'bold', text: part.slice(2, -2) };
      if (part.startsWith('`') && part.length > 2) return { kind: 'code', text: part.slice(1, -1) };
      const link = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/.exec(part);
      if (link) {
        const [, text = '', href = ''] = link;
        return isSafeHref(href) ? { kind: 'link', text, href } : { kind: 'text', text };
      }
      return { kind: 'text', text: part };
    });
}

export type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullets' | 'numbers'; items: string[] };

const HEADING = /^#{1,4}\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBER = /^\d+[.)]\s+(.*)$/;

/**
 * The letter's lines: headings (`#` to `####`), bulleted and numbered lists, and paragraphs between blank lines. The agent writes like this,
 * and a marker should never reach the page as text (flow-12).
 */
export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const number = NUMBER.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: 'heading', text: heading[1] ?? '' });
    } else if (bullet || number) {
      flush();
      const kind = bullet ? 'bullets' : 'numbers';
      const item = (bullet ?? number)?.[1] ?? '';
      const last = blocks.at(-1);
      if (last && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

const CARD_KEY = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/;

/** Text and the keys inside it, in order. Odd places are the keys. */
export const splitKeys = (text: string) => text.split(CARD_KEY);

function Keyed({ text }: { text: string }) {
  return splitKeys(text).map((part, i) =>
    i % 2 === 1 ? <CardChip key={i} k={part} /> : <Fragment key={i}>{part}</Fragment>,
  );
}

function renderInline(md: string): ReactNode[] {
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
    ) : span.kind === 'link' ? (
      <a
        key={i}
        href={span.href}
        // Only a link with a scheme leaves Hub; a path inside the app opens in place.
        {...(/^[a-z][a-z0-9+.-]*:/i.test(span.href.trim()) ? { target: '_blank', rel: 'noreferrer' } : {})}
        className={cn('hit-44 rounded-sm text-primary underline underline-offset-4', focusRing)}
      >
        <Keyed text={span.text} />
      </a>
    ) : (
      <Keyed key={i} text={span.text} />
    ),
  );
}

function renderBlocks(md: string): ReactNode[] {
  return parseBlocks(md).map((block, i) => {
    switch (block.kind) {
      case 'heading':
        return (
          <h3 key={i} className="text-body font-semibold text-foreground">
            {renderInline(block.text)}
          </h3>
        );
      case 'bullets':
      case 'numbers': {
        const List = block.kind === 'bullets' ? 'ul' : 'ol';
        return (
          <List
            key={i}
            className={cn(
              'flex flex-col gap-1 ps-5',
              block.kind === 'bullets' ? 'list-disc' : 'list-decimal',
            )}
          >
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item)}</li>
            ))}
          </List>
        );
      }
      default:
        return (
          <p key={i} className="whitespace-pre-line">
            {renderInline(block.text)}
          </p>
        );
    }
  });
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
          className={cn('text-body-sm text-muted-foreground', framed && 'hidden sm:@page-sm:block')}
        >
          {longDate(`${narrative.date}T12:00:00+03:00`, locale)}
        </time>
      </header>
      {/* `line-clamp` cannot clamp a box of lists and headings, so the folded letter is its first paragraph as one clamped line of prose. */}
      <div id="letter-body" className="hub-letter mt-2 text-pretty text-foreground">
        {collapsed ? (
          <p className="line-clamp-3">
            <Keyed text={markdownExcerpt(narrative.markdown)} />
          </p>
        ) : (
          <div className="flex flex-col gap-3">{renderBlocks(narrative.markdown)}</div>
        )}
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
