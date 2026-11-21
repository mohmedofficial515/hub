import { Fragment, useMemo, type ReactNode } from 'react';
import { marked, type Token, type Tokens } from 'marked';
import { Check } from 'lucide-react';
import { cn } from '@lab/ui/hub-cn';
import { CopyButton } from './copy-button';
import { focusRing } from './meta';

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
  /** Direction of the document itself. An English doc stays LTR inside the Arabic UI. */
  dir?: 'ltr' | 'rtl';
  /** Decide where a link goes: return a node, e.g. an `AppLink` to the viewer. Otherwise it is a plain external link. */
  renderLink?: (href: string, children: ReactNode) => ReactNode;
  /** A control beside a heading, such as "copy link to this section". */
  renderHeadingAction?: (anchor: string, text: string) => ReactNode;
  /** Heading levels start one below the page's own h1, and below that when the view nests deeper. */
  headingOffset?: number;
  /** Text for a code block's copy button. */
  copyCodeLabel?: string;
  className?: string;
}

const linkClass = `hit-44 rounded-sm text-primary underline underline-offset-4 ${focusRing}`;

function Inline({ tokens, ctx }: { tokens?: Token[]; ctx: MarkdownViewProps }): ReactNode {
  if (!tokens) return null;
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'text':
      case 'escape':
        return <Fragment key={i}>{'tokens' in token && token.tokens ? <Inline tokens={token.tokens} ctx={ctx} /> : (token as Tokens.Text).text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")}</Fragment>;
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
          <code key={i} dir="ltr" translate="no" className="key rounded-sm bg-muted px-1 py-0.5 text-body-sm break-words text-foreground">
            {(token as Tokens.Codespan).text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")}
          </code>
        );
      case 'br':
        return <br key={i} />;
      case 'link': {
        const link = token as Tokens.Link;
        const children = <Inline tokens={link.tokens} ctx={ctx} />;
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

function Heading({ token, ctx }: { token: Tokens.Heading; ctx: MarkdownViewProps }) {
  const anchor = slugify(token.text);
  const level = Math.min(6, token.depth + (ctx.headingOffset ?? 1));
  const H = `h${level}` as 'h2';
  const size = token.depth === 1 ? 'text-title font-semibold' : token.depth === 2 ? 'mt-4 text-title-sm font-semibold' : 'mt-2 text-body-lg font-semibold';
  return (
    <H id={anchor} tabIndex={-1} className={cn('group/heading flex scroll-mt-20 items-baseline gap-2 text-foreground outline-none', size)}>
      <span className="min-w-0">
        <Inline tokens={token.tokens} ctx={ctx} />
      </span>
      {ctx.renderHeadingAction?.(anchor, token.text)}
    </H>
  );
}

function Blocks({ tokens, ctx }: { tokens: Token[]; ctx: MarkdownViewProps }): ReactNode {
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'space':
      case 'def':
      case 'html':
        return null;
      case 'heading':
        return <Heading key={i} token={token as Tokens.Heading} ctx={ctx} />;
      case 'paragraph':
        return (
          <p key={i} className="text-body leading-7 text-foreground">
            <Inline tokens={(token as Tokens.Paragraph).tokens} ctx={ctx} />
          </p>
        );
      case 'text':
        return (
          <p key={i} className="text-body leading-7 text-foreground">
            <Inline tokens={(token as Tokens.Text).tokens ?? [{ type: 'text', raw: token.raw, text: (token as Tokens.Text).text } as Token]} ctx={ctx} />
          </p>
        );
      case 'blockquote':
        return (
          <blockquote key={i} className="flex flex-col gap-2 border-s-2 border-border ps-3 text-muted-foreground">
            <Blocks tokens={(token as Tokens.Blockquote).tokens} ctx={ctx} />
          </blockquote>
        );
      case 'hr':
        return <hr key={i} className="border-border" />;
      case 'code': {
        const code = token as Tokens.Code;
        return (
          <div key={i} className="relative">
            <pre dir="ltr" translate="no" tabIndex={0} className={cn('key overflow-x-auto rounded-lg border border-border bg-muted p-3 pe-14 text-start text-body-sm text-foreground', focusRing)}>
              <code>{code.text}</code>
            </pre>
            <CopyButton text={code.text} showText={false} label={ctx.copyCodeLabel} className="absolute end-1.5 top-1.5 bg-card" />
          </div>
        );
      }
      case 'list': {
        const list = token as Tokens.List;
        const L = list.ordered ? 'ol' : 'ul';
        const tasks = list.items.some((it) => it.task);
        return (
          <L key={i} className={cn('flex flex-col gap-1.5 text-body leading-7 text-foreground', !tasks && 'ps-5', !tasks && (list.ordered ? 'list-decimal' : 'list-disc'))}>
            {list.items.map((item, n) => (
              <li key={n} className={cn(item.task && 'flex items-start gap-2')}>
                {/* Task lists are read-only (08 §5.4): the source of truth is the file in Git. */}
                {item.task && (
                  <span aria-hidden className={cn('mt-1.5 flex size-4 shrink-0 items-center justify-center rounded-sm border', item.checked ? 'border-foreground bg-foreground text-background' : 'border-input')}>
                    {item.checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                )}
                <div className="min-w-0 *:leading-7">
                  <Blocks tokens={item.tokens} ctx={ctx} />
                </div>
              </li>
            ))}
          </L>
        );
      }
      case 'table': {
        const table = token as Tokens.Table;
        return (
          <div key={i} tabIndex={0} role="group" aria-label={table.header.map((h) => h.text).join(', ')} className={cn('overflow-x-auto rounded-lg border border-border', focusRing)}>
            <table className="w-full border-collapse text-body-sm">
              <thead className="bg-muted">
                <tr>
                  {table.header.map((cell, n) => (
                    <th key={n} scope="col" className="border-b border-border px-3 py-2 text-start font-semibold whitespace-nowrap text-foreground">
                      <Inline tokens={cell.tokens} ctx={ctx} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, r) => (
                  <tr key={r} className="border-b border-border last:border-b-0">
                    {row.map((cell, n) => (
                      <td key={n} className="min-w-28 px-3 py-2 align-top text-foreground">
                        <Inline tokens={cell.tokens} ctx={ctx} />
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
 * markup. Mermaid is not rendered in the lab; a Mermaid block shows as code.
 */
export function MarkdownView(props: MarkdownViewProps) {
  const { source, dir, className } = props;
  const tokens = useMemo(() => marked.lexer(source), [source]);
  return (
    <div dir={dir} className={cn('flex min-w-0 flex-col gap-3.5', className)}>
      <Blocks tokens={tokens} ctx={props} />
    </div>
  );
}
