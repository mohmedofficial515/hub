import { useState } from 'react';
import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { folderSize, type DocRef, type DocTreeFolder, type DocTreeSource } from '@lab/mocks/hub-app/docs';
import { AppLink, cn, focusRing, fmt, focusRingInset, getCard, Ltr, num } from '../../../kit';
import { messages } from '../i18n';

const fileName = (path: string) => path.split('/').pop()!.replace(/\.md$/, '');

function DocLink({ doc, current, rowProps, depth }: { doc: DocRef; current: string | null; rowProps: (id: string) => object; depth: number }) {
  const t = useT(messages);
  const active = current === doc.key;
  const card = getCard(doc.key);
  const stale = card?.status === 'stale';
  return (
    <li>
      <AppLink
        {...rowProps(doc.key)}
        tabIndex={0}
        view="docs"
        query={{ doc: doc.key, anchor: null }}
        aria-current={active ? 'page' : undefined}
        title={card?.title.en}
        style={{ paddingInlineStart: `${0.5 + depth * 0.875}rem` }}
        className={cn(
          'relative flex min-h-11 items-center gap-2 rounded-md py-1 pe-2 text-body-sm transition-colors duration-120 hover:bg-accent md:min-h-8',
          active ? 'bg-accent font-medium text-foreground before:absolute before:inset-y-1 before:start-0 before:w-0.5 before:rounded-full before:bg-foreground' : 'text-muted-foreground hover:text-foreground',
          focusRingInset,
        )}
      >
        <FileText aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
        <Ltr mono className="min-w-0 truncate text-caption">
          {fileName(doc.path)}
        </Ltr>
        {stale && (
          <span title={t.staleHint} className="ms-auto inline-flex shrink-0 items-center gap-1 text-caption font-medium text-warning-soft-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-warning" />
            {t.stale}
          </span>
        )}
      </AppLink>
    </li>
  );
}

function FolderNode({ folder, current, rowProps, depth, hasCurrent }: { folder: DocTreeFolder; current: string | null; rowProps: (id: string) => object; depth: number; hasCurrent: (f: DocTreeFolder) => boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const [open, setOpen] = useState(() => hasCurrent(folder));
  const Icon = open ? FolderOpen : Folder;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-label={fmt(open ? t.collapse : t.expand, { name: folder.name })}
        onClick={() => setOpen((v) => !v)}
        style={{ paddingInlineStart: `${0.5 + depth * 0.875}rem` }}
        className={cn('flex min-h-11 w-full items-center gap-2 rounded-md py-1 pe-2 text-body-sm text-foreground transition-colors duration-120 hover:bg-accent md:min-h-8', focusRingInset)}
      >
        <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <Ltr mono className="min-w-0 truncate text-caption font-medium">
          {folder.name}
        </Ltr>
        <span className="ms-auto text-caption text-muted-foreground tabular-nums">
          <Ltr>{num(folderSize(folder), locale)}</Ltr>
        </span>
        <ChevronRight aria-hidden className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-120 motion-reduce:transition-none rtl:-scale-x-100', open && 'rotate-90 rtl:-rotate-90')} strokeWidth={1.75} />
      </button>
      {open && <FolderBody folder={folder} current={current} rowProps={rowProps} depth={depth + 1} hasCurrent={hasCurrent} />}
    </li>
  );
}

function FolderBody({ folder, current, rowProps, depth, hasCurrent }: { folder: DocTreeFolder; current: string | null; rowProps: (id: string) => object; depth: number; hasCurrent: (f: DocTreeFolder) => boolean }) {
  return (
    <ul className="flex flex-col gap-px">
      {folder.docs.map((doc) => (
        <DocLink key={doc.key} doc={doc} current={current} rowProps={rowProps} depth={depth} />
      ))}
      {folder.folders.map((sub) => (
        <FolderNode key={sub.path} folder={sub} current={current} rowProps={rowProps} depth={depth} hasCurrent={hasCurrent} />
      ))}
    </ul>
  );
}

/**
 * 09 §11: sources, then folders, then docs. A twin in another language has no row of its own. File names stay LTR
 * inside the Arabic layout, so the tree reads like the repository it mirrors. `j` and `k` walk the visible docs.
 */
export function DocTree({ tree, current, rowProps, className }: { tree: DocTreeSource[]; current: string | null; rowProps: (id: string) => object; className?: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const contains = (f: DocTreeFolder): boolean => f.docs.some((d) => d.key === current) || f.folders.some(contains);
  const [openSources, setOpenSources] = useState<Record<string, boolean>>({});
  return (
    <nav aria-label={t.treeLabel} className={cn('flex flex-col gap-4', className)}>
      {tree.map(({ source, root }) => {
        const open = openSources[source.id] ?? (source.id === 'backend' || contains(root));
        return (
          <div key={source.id} className="flex flex-col gap-1">
            <h2>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenSources((all) => ({ ...all, [source.id]: !open }))}
                className={cn('flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-body font-semibold text-foreground transition-colors duration-120 hover:bg-accent md:min-h-8', focusRing)}
              >
                <ChevronRight aria-hidden className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-120 motion-reduce:transition-none rtl:-scale-x-100', open && 'rotate-90 rtl:-rotate-90')} strokeWidth={1.75} />
                <span translate="no" className="min-w-0 truncate">
                  {source.name}
                </span>
                <span className="ms-auto text-caption font-normal text-muted-foreground tabular-nums">
                  <Ltr>{num(folderSize(root), locale)}</Ltr>
                </span>
              </button>
            </h2>
            {open && <FolderBody folder={root} current={current} rowProps={rowProps} depth={1} hasCurrent={contains} />}
          </div>
        );
      })}
    </nav>
  );
}
