'use client';

/**
 * @file mermaid-diagram.tsx
 * @description A fenced `mermaid` block drawn as a diagram (decision 13a, 08 §5.4). Mermaid 12 is loaded with a dynamic `import()` the first
 * time a page holds such a block, so it never sits in the main bundle. It runs with `securityLevel: 'strict'` (labels are text, no click
 * handlers, the SVG sanitised by Mermaid's own DOMPurify), a block's own directive may not touch the theme or its CSS (`SECURE_KEYS`),
 * nothing in the drawn SVG may load from outside (`inertSvg`), and the `base` theme is filled from Hub's tokens; it draws again when the theme
 * changes. The diagram is focusable, says what it is in its label (the block's `accTitle`/`accDescr` when it has them), and a toggle shows
 * its source as the code block. A block Mermaid cannot parse shows that code block with a short note, never an error in the page.
 */
import { Code, Workflow } from 'lucide-react';
import type mermaidApi from 'mermaid';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { focusRing } from '@/components/cards/meta';
import { fmt } from '@/components/common/text';
import { useT } from '@/lib/i18n';
import { type Theme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** `messages/{ar,en}/docs.json` → `diagram`. */
interface DiagramWords {
  label: string;
  plain: string;
  alt: string;
  titled: string;
  showSource: string;
  showDiagram: string;
  drawing: string;
  failed: string;
  /** The reader's word for a diagram type, by Mermaid's name; a type not listed keeps Mermaid's name. */
  types?: Record<string, string>;
}

type Drawn = { status: 'drawing' } | { status: 'ready'; svg: string; type: string } | { status: 'failed' };

type MermaidApi = typeof mermaidApi;

let loaded: Promise<MermaidApi> | null = null;
const loadMermaid = () => (loaded ??= import('mermaid').then((m) => m.default));

/** `initialize` is global to the page, so each draw sets the theme and renders before the next one starts. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

/**
 * Keys a block's own `%%{init}%%` directive or front-matter `config:` may not set. Mermaid's default list keeps only
 * `securityLevel` and the like; its directive check lets `themeCSS` through with nothing but a bracket count, so a document
 * could `@import` from anywhere or paint over Hub's colours. The theme stays Hub's (09 §11: nothing leaves Hub).
 */
const SECURE_KEYS = [
  'secure',
  'securityLevel',
  'startOnLoad',
  'maxTextSize',
  'suppressErrorRendering',
  'maxEdges',
  'theme',
  'themeVariables',
  'themeCSS',
  'fontFamily',
  'altFontFamily',
  'darkMode',
  'htmlLabels',
  'look',
];

/** `url(...)` that does not point inside the SVG (`url(#id)`), and `@import`: what would make the reader's browser fetch. */
const OUTSIDE_URL = /url\(\s*(?!['"]?#)[^)]*\)/gi;
const IMPORT = /@import[^;]*;?/gi;
const LINK_ATTRS = ['href', 'xlink:href', 'src', 'srcset', 'poster', 'background', 'action', 'formaction'];

const inertCss = (css: string) => css.replace(IMPORT, '').replace(OUTSIDE_URL, 'none');

/**
 * Mermaid's SVG with every way to load from outside taken out: `@import` and outside `url()` in `<style>` and in
 * attributes, and any link or source that is not `#id` or `data:`. Parsed in an inert `<template>`, so nothing loads
 * while it is read.
 */
export function inertSvg(svg: string): string {
  const template = document.createElement('template');
  template.innerHTML = svg;
  for (const style of template.content.querySelectorAll('style')) {
    style.textContent = inertCss(style.textContent ?? '');
  }
  for (const element of template.content.querySelectorAll('*')) {
    for (const attr of [...element.attributes]) {
      const value = attr.value.trim();
      if (LINK_ATTRS.includes(attr.name.toLowerCase())) {
        if (!value.startsWith('#') && !/^data:image\//i.test(value)) element.removeAttribute(attr.name);
      } else if (/url\(|@import/i.test(value)) {
        element.setAttribute(attr.name, inertCss(value));
      }
    }
  }
  return template.innerHTML;
}

const HEX = /^#[0-9a-f]{3,8}$/i;

/** Hub's own colours, as Mermaid's `base` theme takes them: hex only, since it derives shades from them. */
function themeVariables(theme: Theme): Record<string, string | boolean> {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => {
    const value = css.getPropertyValue(name).trim();
    return HEX.test(value) ? value : undefined;
  };
  const pairs: [string, string | undefined][] = [
    ['background', token('--background')],
    ['primaryColor', token('--info-soft')],
    ['primaryTextColor', token('--foreground')],
    ['primaryBorderColor', token('--input')],
    ['secondaryColor', token('--success-soft')],
    ['tertiaryColor', token('--background')],
    ['lineColor', token('--muted-foreground')],
    // An edge's label sits on the diagram's own ground, not on Mermaid's derived grey (a black box in the dark theme).
    ['edgeLabelBackground', token('--background')],
    ['textColor', token('--foreground')],
    ['noteBkgColor', token('--warning-soft')],
    ['noteTextColor', token('--warning-soft-foreground')],
    ['noteBorderColor', token('--warning')],
  ];
  const vars: Record<string, string | boolean> = { darkMode: theme === 'dark', fontSize: '14px' };
  for (const [name, value] of pairs) if (value) vars[name] = value;
  const font = getComputedStyle(document.body).fontFamily;
  if (font) vars['fontFamily'] = font;
  return vars;
}

/** The block's own accessible title and description, as Mermaid's syntax writes them. */
function accessibleText(code: string): string | null {
  const title = /^\s*accTitle\s*:\s*(.+)$/m.exec(code)?.[1]?.trim();
  const descr = /^\s*accDescr\s*:\s*(.+)$/m.exec(code)?.[1]?.trim();
  return [title, descr].filter(Boolean).join('. ') || null;
}

const typeName = (type: string, types: Record<string, string> = {}) => {
  const name = type.replace(/-v\d+$/, '').replace(/[-_]/g, ' ');
  return types[name.toLowerCase()] ?? name;
};

let drawCount = 0;

export function MermaidDiagram({ code, renderCode }: { code: string; renderCode: () => ReactNode }) {
  const words = useT<{ diagram: DiagramWords }>('docs').diagram;
  const theme = useTheme();
  const base = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [drawn, setDrawn] = useState<Drawn>({ status: 'drawing' });
  const [source, setSource] = useState(false);

  useEffect(() => {
    let live = true;
    const id = `hub-mermaid-${base}-${++drawCount}`;
    serial(async () => {
      const mermaid = await loadMermaid();
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        secure: SECURE_KEYS,
        suppressErrorRendering: true,
        theme: 'base',
        themeVariables: themeVariables(theme),
      });
      const parsed = await mermaid.parse(code);
      const { svg } = await mermaid.render(id, code);
      return { svg: inertSvg(svg), type: parsed ? parsed.diagramType : '' };
    }).then(
      ({ svg, type }) => live && setDrawn({ status: 'ready', svg, type }),
      () => {
        // Mermaid may leave its scratch node behind on a failed draw.
        document.getElementById(`d${id}`)?.remove();
        if (live) setDrawn({ status: 'failed' });
      },
    );
    return () => {
      live = false;
    };
  }, [code, theme, base]);

  if (drawn.status === 'failed') {
    return (
      <div className="flex min-w-0 flex-col gap-1.5" data-mermaid="failed">
        {renderCode()}
        <p role="note" className="text-caption text-muted-foreground">
          {words.failed}
        </p>
      </div>
    );
  }

  const type = drawn.status === 'ready' && drawn.type ? typeName(drawn.type, words.types) : '';
  const own = accessibleText(code);
  const label = own ? fmt(words.titled, { title: own }) : type ? fmt(words.alt, { type }) : words.plain;
  const Icon = source ? Workflow : Code;
  return (
    <figure className="flex min-w-0 flex-col gap-1.5" data-mermaid={drawn.status}>
      <div className="flex min-h-9 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
          {type ? fmt(words.label, { type }) : words.plain}
        </span>
        <button
          type="button"
          aria-pressed={source}
          onClick={() => setSource((v) => !v)}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground md:min-h-7',
            focusRing,
          )}
        >
          <Icon aria-hidden className="size-4" strokeWidth={1.75} />
          {source ? words.showDiagram : words.showSource}
        </button>
      </div>
      {source ? (
        renderCode()
      ) : drawn.status === 'drawing' ? (
        <div
          role="status"
          className="flex min-h-24 items-center justify-center rounded-lg border border-border bg-muted text-body-sm text-muted-foreground"
        >
          {words.drawing}
        </div>
      ) : (
        <div
          role="img"
          tabIndex={0}
          aria-label={label}
          dir="ltr"
          className={cn(
            'overflow-x-auto rounded-lg border border-border bg-background p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full',
            focusRing,
          )}
          // Mermaid's own output under `securityLevel: 'strict'` (its DOMPurify: no script or handler), then `inertSvg`: nothing loads.
          dangerouslySetInnerHTML={{ __html: drawn.svg }}
        />
      )}
    </figure>
  );
}
