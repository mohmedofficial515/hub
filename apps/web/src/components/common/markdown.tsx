'use client';

/**
 * @file markdown.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/markdown.tsx. Contract: apps/web/README.md.
 */
import { Check } from 'lucide-react';
import { marked, type Token, type Tokens } from 'marked';
import { Fragment, type ReactNode, useMemo } from 'react';

import { focusRing } from '@/components/cards/meta';
import { CopyButton } from '@/components/common/copy-button';
import { blockDirection, LATIN_NUMBER_RUN, type TextDirection, textDirection } from '@/lib/direction';
import { isSafeHref } from '@/lib/markdown-text';
import { cn } from '@/lib/utils';

export interface MarkdownHeading {
  level: number;
  text: string;
  anchor: string;
}

/** GitHub-style anchors, which keep Arabic letters. */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** The outline of a document: levels 2 and 3. */
export function headingsOf(source: string): MarkdownHeading[] {
  return marked
    .lexer(source)
    .filter((t): t is Tokens.Heading => t.type === 'heading' && t.depth >= 2 && t.depth <= 3)
    .map((t) => ({ level: t.depth, text: t.text.replace(/[`*_]/g, ''), anchor: slugify(t.text) }));
}

export interface MarkdownViewProps {
  source: string;
  /** Direction of the document itself. An English doc stays LTR inside the Arabic UI. `auto` goes by the majority of its letters. */
  dir?: 'ltr' | 'rtl' | 'auto' | undefined;
  /** Decide where a link goes: return a node, e.g. an `AppLink` to the viewer. Otherwise it is a plain external link. */
  renderLink?: ((href: string, children: ReactNode) => ReactNode) | undefined;
  /** A control beside a heading, such as "copy link to this section". */
  renderHeadingAction?: ((anchor: string, text: string) => ReactNode) | undefined;
  /** Heading levels start one below the page's own h1, and below that when the view nests deeper. */
  headingOffset?: number | undefined;
  /** Text for a code block's copy button. */
  copyCodeLabel?: string | undefined;
  className?: string | undefined;
}

/** What a block's text reads as inside its flow: `flow` is the direction around it. Only set while rendering inline text. */
interface Flow extends MarkdownViewProps {
  flow?: TextDirection | undefined;
}

/** In a right-to-left line, `5xx` and `100 MB` read as one unit only when isolated. */
function plainText(text: string, ctx: Flow): ReactNode {
  if (ctx.flow !== 'rtl') return text;
  const parts = text.split(LATIN_NUMBER_RUN);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 ? (
      <bdi key={i} dir="ltr" className="whitespace-nowrap">
        {part}
      </bdi>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

const linkClass = `hit-44 rounded-sm text-primary underline underline-offset-4 ${focusRing}`;

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
              plainText(
                (token as Tokens.Text).text
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'"),
                ctx,
              )
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
            {(token as Tokens.Codespan).text
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")}
          </code>
        );
      case 'br':
        return <br key={i} />;
      case 'link': {
        const link = token as Tokens.Link;
        const children = <Inline tokens={link.tokens} ctx={ctx} />;
        if (!isSafeHref(link.href)) return <Fragment key={i}>{children}</Fragment>;
        const custom = ctx.renderLink?.(link.href, children);
        if (custom) return <Fragment key={i}>{custom}</Fragment>;
        return (
          <a key={i} href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
            {children}
          </a>
        );
      }
      // 09 §11: images come from GitHub raw and need the internet, so the alt text stands in here.
      case 'image':
        return (
          <em key={i} className="text-muted-foreground">
            {(token as Tokens.Image).text}
          </em>
        );
      case 'checkbox':
        return null;
      default:
        return <Fragment key={i}>{token.raw}</Fragment>;
    }
  });
}

function Heading({ token, ctx, around }: { token: Tokens.Heading; ctx: MarkdownViewProps; around: Around }) {
  const own = blockDirection(token.text, around.dir);
  const anchor = slugify(token.text);
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
      {ctx.renderHeadingAction?.(anchor, token.text)}
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
  k,
}: {
  text: string;
  tokens: Token[] | undefined;
  ctx: MarkdownViewProps;
  around: Around;
  k: number;
}) {
  const own = blockDirection(text, around.dir);
  const differs = own !== around.dir;
  const inline = <Inline tokens={tokens} ctx={{ ...ctx, flow: own }} />;
  return (
    <p
      key={k}
      dir={differs && !around.inList ? own : undefined}
      className="text-body leading-7 text-foreground"
    >
      {differs && around.inList ? <bdi dir={own}>{inline}</bdi> : inline}
    </p>
  );
}

function Blocks({
  tokens,
  ctx,
  around,
}: {
  tokens: Token[];
  ctx: MarkdownViewProps;
  around: Around;
}): ReactNode {
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
            k={i}
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
            k={i}
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
      case 'blockquote':
        return (
          <blockquote
            key={i}
            // eslint-disable-next-line hub/no-raw-palette -- a blockquote's neutral side line, kept by name in the design's README.
            className="flex flex-col gap-2 border-s-2 border-border ps-3 text-muted-foreground"
          >
            <Blocks tokens={(token as Tokens.Blockquote).tokens} ctx={ctx} around={around} />
          </blockquote>
        );
      case 'hr':
        return <hr key={i} className="border-border" />;
      case 'code': {
        const code = token as Tokens.Code;
        return (
          <div key={i} className="relative">
            <pre
              dir="ltr"
              translate="no"
              tabIndex={0}
              className={cn(
                'key overflow-x-auto rounded-lg border border-border bg-muted p-3 pe-14 text-start text-body-sm text-foreground',
                focusRing,
              )}
            >
              <code>{code.text}</code>
            </pre>
            <CopyButton
              text={code.text}
              showText={false}
              label={ctx.copyCodeLabel}
              className="absolute end-1.5 top-1.5 bg-card"
            />
          </div>
        );
      }
      case 'list': {
        const list = token as Tokens.List;
        const L = list.ordered ? 'ol' : 'ul';
        const tasks = list.items.some((it) => it.task);
        // The bullets take the list's own direction, so a whole English list inside an Arabic body has them on its left.
        const own = blockDirection(list.raw, around.dir);
        return (
          <L
            key={i}
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
        return (
          <div
            key={i}
            tabIndex={0}
            role="group"
            aria-label={table.header.map((h) => h.text).join(', ')}
            className={cn('overflow-x-auto rounded-lg border border-border', focusRing)}
          >
            <table className="w-full border-collapse text-body-sm">
              <thead className="bg-muted">
                <tr>
                  {table.header.map((cell, n) => (
                    <th
                      key={n}
                      scope="col"
                      className="border-b border-border px-3 py-2 text-start font-semibold whitespace-nowrap text-foreground"
                    >
                      <Inline tokens={cell.tokens} ctx={{ ...ctx, flow: around.dir }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, r) => (
                  <tr key={r} className="border-b border-border last:border-b-0">
                    {row.map((cell, n) => (
                      <td key={n} className="min-w-28 px-3 py-2 align-top text-foreground">
                        <Inline tokens={cell.tokens} ctx={{ ...ctx, flow: around.dir }} />
                      </td>
                    ))}
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
 * Markdown as the app's own elements (08 §5.4 `DocViewer`): anchored headings, tables that scroll inside their own
 * frame, code with copy, read-only task lists. Nothing goes through `dangerouslySetInnerHTML`, so a doc cannot inject
 * markup, raw HTML is dropped or shown as text, and a `javascript:` link stays as its words. Mermaid is not rendered in the lab; a Mermaid block shows as code.
 */
export function MarkdownView(props: MarkdownViewProps) {
  const { source, dir, className } = props;
  const tokens = useMemo(() => marked.lexer(source), [source]);
  // `auto` asks for the text's own direction: its majority, since the browser's rule stops at the first letter (review R2).
  const read = useMemo(() => textDirection(source), [source]);
  const own = dir === 'auto' ? read : dir;
  return (
    <div
      dir={dir === 'auto' ? (read ?? 'auto') : dir}
      className={cn('flex min-w-0 flex-col gap-3.5', className)}
    >
      <Blocks tokens={tokens} ctx={props} around={{ dir: own }} />
    </div>
  );
}
