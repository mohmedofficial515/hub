'use client';

/**
 * @file tree.tsx
 * @description 09 §11: sources, then folders, then docs. A twin in another language has no row of its own. File names stay LTR inside the
 * Arabic layout, so the tree reads like the repository it mirrors. `j` and `k` walk the visible docs. Ported from the design's
 * `pages/docs/parts/tree.tsx`.
 */
import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import { useState } from 'react';

import { AppLink, cn, fmt, focusRing, focusRingInset, Ltr, num, useLocale, useT } from '@/components/kit';
import type { DocCard } from '@/features/cards/types';
import { type DocFolder, type DocSource, fileName, folderSize, readableName, treeContains } from '@/features/docs/tree';

import type { DocsMessages } from './messages';

type RowProps = (id: string) => object;

function DocLink({
  doc,
  current,
  rowProps,
  depth,
}: {
  doc: DocCard;
  current: string | null;
  rowProps: RowProps;
  depth: number;
}) {
  const t = useT<DocsMessages>('docs');
  const active = current === doc.key;
  const name = readableName(doc.doc.path);
  return (
    <li>
      <AppLink
        {...rowProps(doc.key)}
        tabIndex={0}
        view="docs"
        query={{ doc: doc.key, anchor: null }}
        aria-current={active ? 'page' : undefined}
        title={doc.title}
        style={{ paddingInlineStart: `${0.5 + depth * 0.875}rem` }}
        className={cn(
          'relative flex min-h-11 items-center gap-2 rounded-lg py-1.5 pe-2 text-body-sm transition-colors duration-120 hover:bg-accent md:min-h-10',
          active
            ? 'bg-primary/10 font-medium text-foreground ring-1 ring-primary/15'
            : 'text-muted-foreground hover:text-foreground',
          focusRingInset,
        )}
      >
        {name.n ? (
          <span
            aria-hidden
            className={cn(
              'flex h-5 min-w-6 shrink-0 items-center justify-center rounded-md px-1 text-caption font-semibold tabular-nums',
              active ? 'bg-primary/15 text-primary-text' : 'bg-muted text-muted-foreground',
            )}
          >
            <Ltr>{name.n}</Ltr>
          </span>
        ) : (
          <FileText aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span dir="auto" className="truncate text-body-sm">
            {doc.title || name.words}
          </span>
          <Ltr mono className="truncate text-caption text-muted-foreground/80">
            {fileName(doc.doc.path)}
          </Ltr>
        </span>
        {doc.status === 'stale' && (
          <span
            title={t.staleHint}
            className="ms-auto inline-flex shrink-0 items-center gap-1 text-caption font-medium text-warning-soft-foreground"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-warning" />
            {t.stale}
          </span>
        )}
      </AppLink>
    </li>
  );
}

function FolderNode({
  folder,
  current,
  rowProps,
  depth,
}: {
  folder: DocFolder;
  current: string | null;
  rowProps: RowProps;
  depth: number;
}) {
  const t = useT<DocsMessages>('docs');
  const locale = useLocale();
  const [open, setOpen] = useState(() => treeContains(folder, current));
  const Icon = open ? FolderOpen : Folder;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-label={fmt(open ? t.collapse : t.expand, { name: folder.name })}
        onClick={() => setOpen((v) => !v)}
        style={{ paddingInlineStart: `${0.5 + depth * 0.875}rem` }}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 rounded-md py-1 pe-2 text-body-sm text-foreground transition-colors duration-120 hover:bg-accent md:min-h-8',
          focusRingInset,
        )}
      >
        <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <Ltr mono className="min-w-0 truncate text-caption font-medium">
          {folder.name}
        </Ltr>
        <span className="ms-auto text-caption text-muted-foreground tabular-nums">
          <Ltr>{num(folderSize(folder), locale)}</Ltr>
        </span>
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform duration-120 motion-reduce:transition-none rtl:-scale-x-100',
            open && 'rotate-90 rtl:-rotate-90',
          )}
          strokeWidth={1.75}
        />
      </button>
      {open && <FolderBody folder={folder} current={current} rowProps={rowProps} depth={depth + 1} />}
    </li>
  );
}

function FolderBody({
  folder,
  current,
  rowProps,
  depth,
}: {
  folder: DocFolder;
  current: string | null;
  rowProps: RowProps;
  depth: number;
}) {
  return (
    <ul className="flex flex-col gap-px">
      {folder.docs.map((doc) => (
        <DocLink key={doc.key} doc={doc} current={current} rowProps={rowProps} depth={depth} />
      ))}
      {folder.folders.map((sub) => (
        <FolderNode key={sub.path} folder={sub} current={current} rowProps={rowProps} depth={depth} />
      ))}
    </ul>
  );
}

export function DocTree({
  sources,
  current,
  rowProps,
  className,
}: {
  sources: DocSource[];
  current: string | null;
  rowProps: RowProps;
  className?: string | undefined;
}) {
  const t = useT<DocsMessages>('docs');
  const locale = useLocale();
  const [openSources, setOpenSources] = useState<Record<string, boolean>>({});
  return (
    <nav aria-label={t.treeLabel} className={cn('flex flex-col gap-4', className)}>
      {sources.map((source, i) => {
        const open = openSources[source.id] ?? (i === 0 || treeContains(source.root, current));
        return (
          <div key={source.id} className="flex flex-col gap-1">
            <h2>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenSources((all) => ({ ...all, [source.id]: !open }))}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-body font-semibold text-foreground transition-colors duration-120 hover:bg-accent md:min-h-8',
                  focusRing,
                )}
              >
                <ChevronRight
                  aria-hidden
                  className={cn(
                    'size-3.5 shrink-0 text-muted-foreground transition-transform duration-120 motion-reduce:transition-none rtl:-scale-x-100',
                    open && 'rotate-90 rtl:-rotate-90',
                  )}
                  strokeWidth={1.75}
                />
                <span translate="no" className="min-w-0 truncate">
                  {source.name}
                </span>
                <span className="ms-auto text-caption font-normal text-muted-foreground tabular-nums">
                  <Ltr>{num(folderSize(source.root), locale)}</Ltr>
                </span>
              </button>
            </h2>
            {open && <FolderBody folder={source.root} current={current} rowProps={rowProps} depth={1} />}
          </div>
        );
      })}
    </nav>
  );
}
