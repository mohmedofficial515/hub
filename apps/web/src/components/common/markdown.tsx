'use client';

/**
 * @file markdown.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/markdown.tsx. Contract: apps/web/README.md.
 */
import { skipToken, useQuery } from '@tanstack/react-query';
import {
  Check,
  Image as ImageIcon,
  Info,
  Lightbulb,
  type LucideIcon,
  MessageSquareWarning,
  OctagonAlert,
  TextWrap,
  TriangleAlert,
} from 'lucide-react';
import { marked, type Token, type Tokens } from 'marked';
import { Fragment, type ReactNode, useMemo, useState } from 'react';

import { focusRing } from '@/components/cards/meta';
import { CopyButton } from '@/components/common/copy-button';
import { MermaidDiagram } from '@/components/common/mermaid-diagram';
import { AppLink, currentRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import type { Me } from '@/features/session/session';
import { blockDirection, LATIN_NUMBER_RUN, type TextDirection, textDirection } from '@/lib/direction';
import { kitMessages, useT } from '@/lib/i18n';
import type { KitSections } from '@/lib/i18n/kit-dict';
import { inlineMarkdownText, isSafeHref } from '@/lib/markdown-text';
import { cn } from '@/lib/utils';

export interface MarkdownHeading {
  level: number;
  text: string;
  anchor: string;
}

/**
 * The API's anchor for a heading (`apps/api/src/modules/docs/domain/markdown.ts`, `slugger`), letter for letter: GitHub's rule, keeping Arabic letters,
 * their marks and `_`, one dash per space. The outline in a card, the search results and this view must name the same section.
 */
export function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** Anchors unique within one file, as the API numbers them: the second `Notes` is `notes-1`. */
export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

/**
 * Each heading's anchor. The API counts the headings it can see in the file, `#` to `####` at the start of a line outside a fence, so only
 * those take a number. Anything else (a deeper or an underlined heading) gets its plain slug.
 */
function anchorsOf(tokens: readonly Token[]): Map<Token, string> {
  const slug = createSlugger();
  const anchors = new Map<Token, string>();
  for (const token of tokens) {
    if (token.type !== 'heading') continue;
    const heading = token as Tokens.Heading;
    const counted = heading.raw.startsWith('#') && heading.depth <= 4;
    anchors.set(token, counted ? slug(heading.text) : slugify(heading.text));
  }
  return anchors;
}

/** The outline of a document: levels 2 and 3, with the anchors the view gives them. */
export function headingsOf(source: string): MarkdownHeading[] {
  const tokens = marked.lexer(source);
  const anchors = anchorsOf(tokens);
  return tokens
    .filter((t): t is Tokens.Heading => t.type === 'heading' && t.depth >= 2 && t.depth <= 3)
    .map((t) => ({
      level: t.depth,
      text: inlineMarkdownText(t.text),
      anchor: anchors.get(t) ?? slugify(t.text),
    }));
}

export interface MarkdownViewProps {
  source: string;
  /** Direction of the document itself. An English doc stays LTR inside the Arabic UI. `auto` goes by the majority of its letters. */
  dir?: 'ltr' | 'rtl' | 'auto' | undefined;
  /** Decide where a link goes: return a node, e.g. an `AppLink` to the viewer. Otherwise it is a plain external link. */
  renderLink?: ((href: string, children: ReactNode) => ReactNode) | undefined;
  /** A control beside a heading, such as "copy link to this section". `text` is the heading's words without Markdown. */
  renderHeadingAction?: ((anchor: string, text: string) => ReactNode) | undefined;
  /** Heading levels start one below the page's own h1, and below that when the view nests deeper. */
  headingOffset?: number | undefined;
  /** Text for a code block's copy button. */
  copyCodeLabel?: string | undefined;
  /**
   * Draw an image the text names, e.g. from the doc's own folder through the API (decision 13b). Return nothing to keep the framed
   * stand-in. `inLink` says the image sits inside a link, so what it returns must not be interactive itself.
   */
  renderImage?: ((image: MarkdownImage, inLink: boolean) => ReactNode) | undefined;
  className?: string | undefined;
}

/** An image as the text writes it. */
export interface MarkdownImage {
  src: string;
  alt: string;
  title: string | null;
}

type Words = KitSections['doc'];

/** What every block needs from the view: the props, each heading's anchor, the project's card keys, and the words. */
interface Ctx extends MarkdownViewProps {
  anchors: Map<Token, string>;
  /** Matches this project's card keys, `GTV-12`, as whole words. Absent before the session is known. */
  cardKey: RegExp | undefined;
  words: Words;
}

/** What a block's text reads as inside its flow: `flow` is the direction around it. Only set while rendering inline text. */
interface Flow extends Ctx {
  flow?: TextDirection | undefined;
  /** Inside a link a card key stays words: a link in a link is not allowed. */
  inLink?: boolean | undefined;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A key only with this project's prefix, so `UTF-8` and `SHA-256` stay words. */
const cardKeyPattern = (prefix: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}-])(${escapeRegExp(prefix)}-\\d+)(?![\\p{L}\\p{N}])`, 'gu');

/** In a right-to-left line, `5xx` and `100 MB` read as one unit only when isolated. */
function numberRuns(text: string, ctx: Flow, at: number): ReactNode {
  if (ctx.flow !== 'rtl') return text;
  const parts = text.split(LATIN_NUMBER_RUN);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 ? (
      <bdi key={`${at}-${i}`} dir="ltr" className="whitespace-nowrap">
        {part}
      </bdi>
    ) : (
      <Fragment key={`${at}-${i}`}>{part}</Fragment>
    ),
  );
}

const keyLinkClass = `key hit-44 rounded-sm text-primary underline underline-offset-4 ${focusRing}`;

/** A card's key in the text opens that card (knowledge-08). Then the number runs, in what is left. */
function plainText(text: string, ctx: Flow): ReactNode {
  if (!ctx.cardKey || ctx.inLink) return numberRuns(text, ctx, 0);
  const parts = text.split(ctx.cardKey);
  if (parts.length === 1) return numberRuns(text, ctx, 0);
  return parts.map((part, i) =>
    i % 2 ? (
      <bdi key={i} dir="ltr">
        <AppLink card={part} className={keyLinkClass}>
          {part}
        </AppLink>
      </bdi>
    ) : (
      <Fragment key={i}>{numberRuns(part, ctx, i)}</Fragment>
    ),
  );
}

const decode = (text: string) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const linkClass = `hit-44 rounded-sm text-primary underline underline-offset-4 ${focusRing}`;

const isAbsoluteWeb = (href: string) => /^https?:\/\//i.test(href.trim()) && isSafeHref(href);

/**
 * 09 §11: an image the page does not draw itself (`renderImage`) is a framed stand-in with its alt text, and a link out when it is a web
 * address. Nothing is fetched: a remote image never makes a request leave Hub.
 */
function ImageStandIn({ image, ctx }: { image: Tokens.Image; ctx: Flow }) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-dashed border-border px-2 py-0.5 align-middle text-body-sm text-muted-foreground">
      <ImageIcon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="sr-only">{ctx.words.image}: </span>
      <span dir="auto" className="min-w-0">
        {image.text || ctx.words.image}
      </span>
      {isAbsoluteWeb(image.href) && !ctx.inLink && (
        <a href={image.href} target="_blank" rel="noreferrer" className={linkClass}>
          {ctx.words.openImage}
        </a>
      )}
    </span>
  );
}

function Inline({ tokens, ctx }: { tokens?: Token[] | undefined; ctx: Flow }): ReactNode {
  if (!tokens) return null;
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'text':
      case 'escape':
        return (
          <Fragment key={i}>
            {'tokens' in token && token.tokens ? (
              <Inline tokens={token.tokens} ctx={ctx} />
            ) : (
              plainText(decode((token as Tokens.Text).text), ctx)
            )}
          </Fragment>
        );
      case 'strong':
        return (
          <strong key={i} className="font-bold">
            <Inline tokens={(token as Tokens.Strong).tokens} ctx={ctx} />
          </strong>
        );
      case 'em':
        return (
          <em key={i}>
            <Inline tokens={(token as Tokens.Em).tokens} ctx={ctx} />
          </em>
        );
      case 'del':
        return (
          <del key={i}>
            <Inline tokens={(token as Tokens.Del).tokens} ctx={ctx} />
          </del>
        );
      case 'codespan':
        return (
          <code
            key={i}
            dir="ltr"
            translate="no"
            className="key rounded-sm bg-muted px-1 py-0.5 text-body-sm break-words text-foreground"
          >
            {decode((token as Tokens.Codespan).text)}
          </code>
        );
      case 'br':
        return <br key={i} />;
      case 'link': {
        const link = token as Tokens.Link;
        const children = <Inline tokens={link.tokens} ctx={{ ...ctx, inLink: true }} />;
        if (!isSafeHref(link.href)) return <Fragment key={i}>{children}</Fragment>;
        const custom = ctx.renderLink?.(link.href, children);
        if (custom) return <Fragment key={i}>{custom}</Fragment>;
        return (
          <a key={i} href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
            {children}
          </a>
        );
      }
      case 'image': {
        const image = token as Tokens.Image;
        const custom = ctx.renderImage?.(
          { src: image.href, alt: decode(image.text), title: image.title ?? null },
          !!ctx.inLink,
        );
        if (custom) return <Fragment key={i}>{custom}</Fragment>;
        return <ImageStandIn key={i} image={image} ctx={ctx} />;
      }
      case 'checkbox':
        return null;
      default:
        return <Fragment key={i}>{token.raw}</Fragment>;
    }
  });
}

function Heading({ token, ctx, around }: { token: Tokens.Heading; ctx: Ctx; around: Around }) {
  const own = blockDirection(token.text, around.dir);
  const anchor = ctx.anchors.get(token) ?? slugify(token.text);
  const level = Math.min(6, token.depth + (ctx.headingOffset ?? 1));
  const H = `h${level}` as 'h2';
  const size =
    token.depth === 1
      ? 'text-title font-semibold'
      : token.depth === 2
        ? 'mt-4 text-title-sm font-semibold'
        : 'mt-2 text-body-lg font-semibold';
  return (
    <H
      id={anchor}
      tabIndex={-1}
      dir={own !== around.dir ? own : undefined}
      className={cn(
        'group/heading flex scroll-mt-20 items-baseline gap-2 text-foreground outline-none',
        size,
      )}
    >
      <span className="min-w-0">
        <Inline tokens={token.tokens} ctx={{ ...ctx, flow: own }} />
      </span>
      {ctx.renderHeadingAction?.(anchor, inlineMarkdownText(token.text))}
    </H>
  );
}

/** The direction a block sits in. Inside a list a differing line keeps the bullet's side and only its own words turn, so it isolates instead of moving. */
interface Around {
  dir: TextDirection | undefined;
  inList?: boolean;
}

/** A paragraph's words, in their own direction when that differs from the block around them (review R10). */
function Prose({
  text,
  tokens,
  ctx,
  around,
}: {
  text: string;
  tokens: Token[] | undefined;
  ctx: Ctx;
  around: Around;
}) {
  const own = blockDirection(text, around.dir);
  const differs = own !== around.dir;
  const inline = <Inline tokens={tokens} ctx={{ ...ctx, flow: own }} />;
  return (
    <p dir={differs && !around.inList ? own : undefined} className="text-body leading-7 text-foreground">
      {differs && around.inList ? <bdi dir={own}>{inline}</bdi> : inline}
    </p>
  );
}

/** A code block in its own frame: a thin bar with its language, Wrap and Copy, so nothing floats over the first or last letters of the code. */
function CodeBlock({ code, ctx }: { code: Tokens.Code; ctx: Ctx }) {
  const [wrap, setWrap] = useState(false);
  const lang = code.lang?.trim().split(/\s+/)[0] ?? '';
  const label = lang.toLowerCase() === 'mermaid' ? ctx.words.diagram : lang;
  const iconButton = cn(
    'inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground md:size-7',
    focusRing,
  );
  return (
    // The frame is left to right as a whole, so the bar's buttons sit where the code's lines end in every language.
    <div dir="ltr" translate="no" className="flex min-w-0 flex-col rounded-lg border border-border bg-muted">
      <div className="flex min-h-9 items-center gap-2 border-b border-border ps-3 pe-1">
        <span className="key min-w-0 flex-1 truncate text-caption text-muted-foreground">{label}</span>
        <button
          type="button"
          aria-pressed={wrap}
          aria-label={ctx.words.wrap}
          title={ctx.words.wrap}
          onClick={() => setWrap((v) => !v)}
          className={cn(iconButton, wrap && 'bg-accent text-foreground')}
        >
          <TextWrap aria-hidden className="size-4" strokeWidth={1.75} />
        </button>
        <CopyButton
          text={code.text}
          showText={false}
          label={ctx.copyCodeLabel}
          className="size-11 border-transparent bg-transparent md:size-7"
        />
      </div>
      <pre
        tabIndex={0}
        className={cn(
          'key overflow-x-auto rounded-b-lg p-3 text-start text-body-sm text-foreground',
          wrap && 'break-words whitespace-pre-wrap',
          focusRing,
        )}
      >
        <code>{code.text}</code>
      </pre>
    </div>
  );
}

const CALLOUT = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)/i;

type CalloutKind = 'note' | 'tip' | 'important' | 'warning' | 'caution';

const CALLOUTS: Record<CalloutKind, { icon: LucideIcon; box: string; title: string }> = {
  note: { icon: Info, box: 'bg-info-soft', title: 'text-info-soft-foreground' },
  important: { icon: MessageSquareWarning, box: 'bg-info-soft', title: 'text-info-soft-foreground' },
  tip: { icon: Lightbulb, box: 'bg-success-soft', title: 'text-success-soft-foreground' },
  warning: { icon: TriangleAlert, box: 'bg-warning-soft', title: 'text-warning-soft-foreground' },
  caution: { icon: OctagonAlert, box: 'bg-destructive-soft', title: 'text-destructive-soft-foreground' },
};

/** GitHub's `> [!WARNING]` as a titled note, the way GitHub draws it, instead of a grey quote that opens with the marker (knowledge-07). */
function Callout({ kind, body, ctx, around }: { kind: CalloutKind; body: string; ctx: Ctx; around: Around }) {
  const style = CALLOUTS[kind];
  const tokens = useMemo(() => marked.lexer(body), [body]);
  const Icon = style.icon;
  return (
    <aside role="note" className={cn('flex flex-col gap-2 rounded-md px-3 py-2.5', style.box)}>
      <p className={cn('flex items-center gap-1.5 text-body-sm font-semibold', style.title)}>
        <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        {ctx.words.callouts[kind]}
      </p>
      <Blocks tokens={tokens} ctx={ctx} around={around} />
    </aside>
  );
}

function Blocks({ tokens, ctx, around }: { tokens: Token[]; ctx: Ctx; around: Around }): ReactNode {
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'space':
      case 'def':
      case 'html':
        return null;
      case 'heading':
        return <Heading key={i} token={token as Tokens.Heading} ctx={ctx} around={around} />;
      case 'paragraph':
        return (
          <Prose
            key={i}
            text={token.raw}
            tokens={(token as Tokens.Paragraph).tokens}
            ctx={ctx}
            around={around}
          />
        );
      case 'text':
        return (
          <Prose
            key={i}
            text={token.raw}
            tokens={
              (token as Tokens.Text).tokens ?? [
                { type: 'text', raw: token.raw, text: (token as Tokens.Text).text },
              ]
            }
            ctx={ctx}
            around={around}
          />
        );
      case 'blockquote': {
        const quote = token as Tokens.Blockquote;
        const callout = CALLOUT.exec(quote.text);
        if (callout?.[1]) {
          return (
            <Callout
              key={i}
              kind={callout[1].toLowerCase() as CalloutKind}
              body={quote.text.slice(callout[0].length)}
              ctx={ctx}
              around={around}
            />
          );
        }
        return (
          <blockquote
            key={i}
            // eslint-disable-next-line hub/no-raw-palette -- a blockquote's neutral side line, kept by name in the design's README.
            className="flex flex-col gap-2 border-s-2 border-border ps-3 text-muted-foreground"
          >
            <Blocks tokens={quote.tokens} ctx={ctx} around={around} />
          </blockquote>
        );
      }
      case 'hr':
        return <hr key={i} className="border-border" />;
      case 'code': {
        const code = token as Tokens.Code;
        const block = () => <CodeBlock code={code} ctx={ctx} />;
        if (code.lang?.trim().split(/\s+/)[0]?.toLowerCase() === 'mermaid' && code.text.trim()) {
          return <MermaidDiagram key={i} code={code.text} renderCode={block} />;
        }
        return <Fragment key={i}>{block()}</Fragment>;
      }
      case 'list': {
        const list = token as Tokens.List;
        const L = list.ordered ? 'ol' : 'ul';
        const tasks = list.items.some((it) => it.task);
        // The bullets take the list's own direction, so a whole English list inside an Arabic body has them on its left.
        const own = blockDirection(list.raw, around.dir);
        // A list that goes on from `3.` starts at 3, as written.
        const start =
          list.ordered && typeof list.start === 'number' && list.start !== 1 ? list.start : undefined;
        return (
          <L
            key={i}
            start={start}
            dir={own !== around.dir ? own : undefined}
            className={cn(
              'flex flex-col gap-1.5 text-body leading-7 text-foreground',
              !tasks && 'ps-5',
              !tasks && (list.ordered ? 'list-decimal' : 'list-disc'),
            )}
          >
            {list.items.map((item, n) => (
              <li key={n} className={cn(item.task && 'flex items-start gap-2')}>
                {/* Task lists are read-only (08 §5.4): the source of truth is the file in Git. */}
                {item.task && (
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 flex size-4 shrink-0 items-center justify-center rounded-sm border',
                      item.checked ? 'border-foreground bg-foreground text-background' : 'border-input',
                    )}
                  >
                    {item.checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                )}
                <div className="min-w-0 *:leading-7">
                  <Blocks tokens={item.tokens} ctx={ctx} around={{ dir: own, inList: true }} />
                </div>
              </li>
            ))}
          </L>
        );
      }
      case 'table': {
        const table = token as Tokens.Table;
        // A wide table wraps its header words on a phone, rather than growing without end.
        const narrowHeads = table.header.length <= 4;
        const cellDir = (text: string) => blockDirection(text, around.dir);
        return (
          <div
            key={i}
            tabIndex={0}
            role="group"
            aria-label={table.header.map((h) => inlineMarkdownText(h.text)).join(', ')}
            className={cn('overflow-x-auto rounded-lg border border-border', focusRing)}
          >
            <table className="w-full border-collapse text-body-sm">
              <thead className="bg-muted">
                <tr>
                  {table.header.map((cell, n) => {
                    const own = cellDir(cell.text);
                    return (
                      <th
                        key={n}
                        scope="col"
                        dir={own !== around.dir ? own : undefined}
                        className={cn(
                          'border-b border-border px-3 py-2 text-start font-semibold text-foreground',
                          narrowHeads && 'whitespace-nowrap',
                        )}
                      >
                        <Inline tokens={cell.tokens} ctx={{ ...ctx, flow: own }} />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, r) => (
                  <tr key={r} className="border-b border-border last:border-b-0">
                    {row.map((cell, n) => {
                      // Each cell in its own direction: an English sentence in an Arabic table ends with its own full stop (review R10).
                      const own = cellDir(cell.text);
                      return (
                        <td
                          key={n}
                          dir={own !== around.dir ? own : undefined}
                          className="min-w-28 px-3 py-2 text-start align-top text-foreground"
                        >
                          <Inline tokens={cell.tokens} ctx={{ ...ctx, flow: own }} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return null;
    }
  });
}

/**
 * The project's key prefix, read from the session already in the cache. It never starts a request of its own, so a view drawn before the session
 * (or in a test with none) simply shows keys as words.
 */
function useKeyPrefix(): string | undefined {
  const me = useQuery<Me>({ queryKey: qk.me, queryFn: skipToken });
  // The view is drawn in places with no router of their own (tests, the lab), so the project comes from the address itself.
  const ws = typeof window === 'undefined' ? '' : currentRoute().ws;
  return me.data?.workspaces.find((w) => w.slug === ws)?.keyPrefix;
}

/**
 * Markdown as the app's own elements (08 §5.4 `DocViewer`): anchored headings, tables that scroll inside their own
 * frame, code with copy, read-only task lists, GitHub's callouts, and card keys that open their card. Nothing goes through
 * `dangerouslySetInnerHTML`, so a doc cannot inject markup, raw HTML is dropped or shown as text, and a `javascript:` link stays as its words.
 * The one exception is a Mermaid block: `MermaidDiagram` loads Mermaid only when such a block is on the page and inserts the SVG it draws
 * under `securityLevel: 'strict'`; a block it cannot parse stays code with a note (decision 13a). Images stay stand-ins unless the page
 * passes `renderImage`.
 */
export function MarkdownView(props: MarkdownViewProps) {
  const { source, dir, className } = props;
  const words = useT(kitMessages).sections.doc;
  const prefix = useKeyPrefix();
  const tokens = useMemo(() => marked.lexer(source), [source]);
  const anchors = useMemo(() => anchorsOf(tokens), [tokens]);
  const cardKey = useMemo(() => (prefix ? cardKeyPattern(prefix) : undefined), [prefix]);
  // `auto` asks for the text's own direction: its majority, since the browser's rule stops at the first letter (review R2).
  const read = useMemo(() => textDirection(source), [source]);
  const own = dir === 'auto' ? read : dir;
  const ctx: Ctx = { ...props, anchors, cardKey, words };
  return (
    <div
      dir={dir === 'auto' ? (read ?? 'auto') : dir}
      className={cn('flex min-w-0 flex-col gap-3.5', className)}
    >
      <Blocks tokens={tokens} ctx={ctx} around={{ dir: own }} />
    </div>
  );
}
