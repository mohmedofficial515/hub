import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronRight, FileText, FolderClosed, Search, X } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { CardType, HubCard } from '@lab/mocks/hub-app';
import { StatusBadge, TypeDot, TypeIcon } from './badges';
import { Button } from './button';
import { allCards, getCard, searchCards, useCardStoreVersion } from './card-store';
import { Modal } from './dialog';
import { plural, type PluralForms } from './format';
import { kitMessages } from './i18n';
import { matchKey } from './keys';
import { focusRing, focusRingInset } from './meta';
import { Bidi, Ltr } from './text';

/** Picker strings live here, so `kit/i18n.ts` stays the card vocabulary. */
interface PickerDict {
  cardTitle: string;
  docTitle: string;
  searchCards: string;
  searchDocs: string;
  typeFilter: string;
  allTypes: string;
  results: string;
  noResults: string;
  noResultsBody: string;
  noDocs: string;
  noDocsBody: string;
  selected: string;
  remove: string;
  confirm: string;
  count: PluralForms;
  hint: string;
  tree: string;
}

const pickerMessages: { ar: PickerDict; en: PickerDict } = {
  ar: {
    cardTitle: 'اختر بطاقات',
    docTitle: 'اختر وثائق',
    searchCards: 'ابحث بالمفتاح أو العنوان',
    searchDocs: 'ابحث في المسار أو العنوان',
    typeFilter: 'نوع البطاقة',
    allTypes: 'كل الأنواع',
    results: 'النتائج',
    noResults: 'لا شيء يطابق بحثك',
    noResultsBody: 'جرّب كلمة أخرى، أو الصق مفتاح البطاقة كاملًا.',
    noDocs: 'لا وثائق مفهرسة بعد',
    noDocsBody: 'تظهر الوثائق هنا بعد ربط مصدر وثائق في الإعدادات.',
    selected: 'المختارة',
    remove: 'أزل {key}',
    confirm: 'أضف',
    count: { zero: 'لم تختر شيئًا بعد', one: 'اخترت عنصرًا واحدًا', two: 'اخترت عنصرين', few: 'اخترت # عناصر', many: 'اخترت # عنصرًا', other: 'اخترت # عنصر' },
    hint: 'الأسهم للتنقل، Enter للاختيار، Ctrl+Enter للإضافة',
    tree: 'شجرة الوثائق',
  },
  en: {
    cardTitle: 'Pick cards',
    docTitle: 'Pick docs',
    searchCards: 'Search by key or title',
    searchDocs: 'Search by path or title',
    typeFilter: 'Card type',
    allTypes: 'All types',
    results: 'Results',
    noResults: 'Nothing matches your search',
    noResultsBody: 'Try another word, or paste the full card key.',
    noDocs: 'No docs indexed yet',
    noDocsBody: 'Docs appear here once a docs source is connected in Settings.',
    selected: 'Selected',
    remove: 'Remove {key}',
    confirm: 'Add',
    count: { zero: 'Nothing picked yet', one: '1 picked', other: '# picked' },
    hint: 'Arrows move, Enter picks, Ctrl+Enter adds',
    tree: 'Docs tree',
  },
};

const ALL_TYPES: CardType[] = ['task', 'decision', 'need', 'handoff', 'change', 'redesign', 'doc', 'release'];

/** The picked keys as removable chips. Backspace in the search removes the last one. */
function PickedChips({ keys, onRemove }: { keys: string[]; onRemove: (key: string) => void }) {
  const t = useT(pickerMessages);
  if (!keys.length) return null;
  return (
    <ul aria-label={t.selected} className="flex flex-wrap gap-1.5">
      {keys.map((key) => {
        const card = getCard(key);
        return (
          <li key={key} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-border bg-card ps-2.5 text-caption text-foreground">
            {card && <TypeDot type={card.type} />}
            <Ltr mono className="shrink-0">
              {key}
            </Ltr>
            <button
              type="button"
              aria-label={t.remove.replace('{key}', key)}
              title={t.remove.replace('{key}', key)}
              onClick={() => onRemove(key)}
              className={cn('hit-44 me-0.5 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground', focusRing)}
            >
              <X aria-hidden className="size-3.5" strokeWidth={1.75} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PickerFooter({ count, onCancel, onConfirm, confirmLabel }: { count: number; onCancel: () => void; onConfirm: () => void; confirmLabel?: string }) {
  const t = useT(pickerMessages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  return (
    <>
      <p aria-live="polite" className="me-auto text-body-sm text-muted-foreground">
        {plural(count, locale, t.count)}
      </p>
      <Button onClick={onCancel}>{kit.cancel}</Button>
      <Button variant="primary" disabled={count === 0} onClick={onConfirm}>
        {confirmLabel ?? t.confirm}
      </Button>
    </>
  );
}

function SearchField({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: (props: { className: string; value: string; dir: 'auto'; placeholder: string; 'aria-label': string; onChange: (e: { target: { value: string } }) => void }) => ReactNode }) {
  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
      {children({
        className: cn('h-11 w-full rounded-md border border-input bg-card ps-9 pe-3 text-body text-foreground placeholder:text-muted-foreground md:h-10', focusRing),
        value,
        dir: 'auto',
        placeholder: label,
        'aria-label': label,
        onChange: (e) => onChange(e.target.value),
      })}
    </div>
  );
}

/**
 * 09 §19 CardPicker: search by key or title, type filter, multi-select chips. A combobox over a listbox, as the
 * palette is, so the keyboard stays in the search field. The store's `searchCards` stands in for `/search?scope=cards`.
 *
 * ```tsx
 * <CardPicker open={open} onOpenChange={setOpen} types={['task']} exclude={[card.key]} onConfirm={(keys) => …} />
 * ```
 */
export function CardPicker({
  open,
  onOpenChange,
  onConfirm,
  title,
  confirmLabel,
  value = [],
  types,
  exclude = [],
  multi = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The picked card keys. */
  onConfirm: (keys: string[]) => void;
  title?: ReactNode;
  confirmLabel?: string;
  /** Keys picked already when the dialog opens. */
  value?: string[];
  /** Limit to these types. One type hides the type filter. */
  types?: CardType[];
  /** Keys that cannot be picked, such as the card being edited. */
  exclude?: string[];
  /** `false` picks one card: Enter or a click confirms at once. */
  multi?: boolean;
}) {
  const t = useT(pickerMessages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  useCardStoreVersion();
  const id = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<CardType | null>(null);
  const [picked, setPicked] = useState<string[]>(value);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setType(null);
    setPicked(value);
    setActive(0);
    // `value` is read when the dialog opens, not while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const allowed = types ?? ALL_TYPES;
  const q = query.trim();
  const results: HubCard[] = (q ? searchCards(q, locale, 60) : [...allCards()].sort((a, b) => Date.parse(b.lastEventAt) - Date.parse(a.lastEventAt)))
    .filter((c) => !c.archivedAt && !exclude.includes(c.key) && allowed.includes(c.type) && (!type || c.type === type))
    .slice(0, 30);

  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const confirm = (keys = picked) => {
    onConfirm(keys);
    onOpenChange(false);
  };
  const toggle = (key: string) => {
    if (!multi) return confirm([key]);
    setPicked((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (matchKey(e, 'ArrowDown') || matchKey(e, 'ArrowUp')) {
      e.preventDefault();
      if (results.length) setActive((i) => (i + (matchKey(e, 'ArrowDown') ? 1 : -1) + results.length) % results.length);
    } else if (matchKey(e, 'Enter') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (picked.length) confirm();
    } else if (matchKey(e, 'Enter')) {
      e.preventDefault();
      if (results[active]) toggle(results[active].key);
    } else if (matchKey(e, 'Backspace') && !query && picked.length) {
      setPicked((list) => list.slice(0, -1));
    }
  };

  const optionId = (i: number) => `${id}-opt-${i}`;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? t.cardTitle}
      footer={multi ? <PickerFooter count={picked.length} onCancel={() => onOpenChange(false)} onConfirm={() => confirm()} confirmLabel={confirmLabel} /> : undefined}
    >
      <div className="flex flex-col gap-3">
        <SearchField label={t.searchCards} value={query} onChange={setQuery}>
          {(field) => (
            <input
              {...field}
              data-autofocus
              role="combobox"
              aria-expanded
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={results.length ? optionId(active) : undefined}
              onKeyDown={onKeyDown}
            />
          )}
        </SearchField>
        {allowed.length > 1 && (
          <div role="group" aria-label={t.typeFilter} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {[null, ...allowed].map((option) => (
              <button
                key={option ?? 'all'}
                type="button"
                aria-pressed={type === option}
                onClick={() => setType(option)}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-body-sm font-medium transition-colors duration-120 md:h-8',
                  type === option ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                  focusRing,
                )}
              >
                {option ? kit.types[option] : t.allTypes}
              </button>
            ))}
          </div>
        )}
        {multi && <PickedChips keys={picked} onRemove={(key) => setPicked((list) => list.filter((k) => k !== key))} />}
        {results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <p className="text-body font-medium text-foreground">{t.noResults}</p>
            <p className="mt-1 text-body-sm text-muted-foreground">{t.noResultsBody}</p>
          </div>
        ) : (
          <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={t.results} aria-multiselectable={multi || undefined} className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card">
            {results.map((card, i) => {
              const selected = picked.includes(card.key);
              return (
                <li
                  key={card.key}
                  id={optionId(i)}
                  data-index={i}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => setActive(i)}
                  onClick={() => toggle(card.key)}
                  className={cn('flex min-h-12 cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2 last:border-b-0', i === active && 'bg-accent')}
                >
                  <TypeIcon type={card.type} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body text-foreground">
                      <Bidi>{card.title[locale]}</Bidi>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
                      <Ltr mono>{card.key}</Ltr>
                      <StatusBadge status={card.status} />
                    </span>
                  </span>
                  <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-sm border', selected ? 'border-foreground bg-foreground text-background' : 'border-input')}>
                    {selected && <Check className="size-3.5" strokeWidth={2.25} />}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="hidden text-body-sm text-muted-foreground md:block">{t.hint}</p>
      </div>
    </Modal>
  );
}

// ── DocPicker ─────────────────────────────────────────────────────────────────────────────────────

/** One doc the picker can offer. Filled from the store's doc cards unless a page passes its own list. */
export interface DocPickerItem {
  key: string;
  /** Repo-relative path, `docs/21-confirmation-safety.md`. */
  path: string;
  source: string;
  title: string;
}

interface TreeRow {
  id: string;
  level: number;
  label: string;
  doc?: DocPickerItem;
  parent: string | null;
  isOpen?: boolean;
}

interface TreeNode {
  id: string;
  label: string;
  children: Map<string, TreeNode>;
  doc?: DocPickerItem;
}

function buildTree(docs: DocPickerItem[]) {
  const root: TreeNode = { id: '', label: '', children: new Map() };
  for (const doc of docs) {
    const parts = [doc.source, ...doc.path.split('/')];
    let node = root;
    parts.forEach((part, i) => {
      const leaf = i === parts.length - 1;
      const id = `${node.id}/${part}`;
      let next = node.children.get(part);
      if (!next) {
        next = { id, label: part, children: new Map(), doc: leaf ? doc : undefined };
        node.children.set(part, next);
      }
      node = next;
    });
  }
  return root;
}

function flatten(root: TreeNode, closed: Set<string>): TreeRow[] {
  const out: TreeRow[] = [];
  const walk = (node: TreeNode, level: number, parent: string | null) => {
    // Folders first, then files, each sorted by path (04 §3.23 `docs/tree`).
    const kids = [...node.children.values()].sort((a, b) => Number(!!a.doc) - Number(!!b.doc) || a.label.localeCompare(b.label));
    for (const kid of kids) {
      const folder = !kid.doc;
      const isOpen = folder ? !closed.has(kid.id) : undefined;
      out.push({ id: kid.id, level, label: kid.label, doc: kid.doc, parent, isOpen });
      if (folder && isOpen) walk(kid, level + 1, kid.id);
    }
  };
  walk(root, 1, null);
  return out;
}

/**
 * 09 §19 DocPicker: tree + search, returns doc card keys. The tree is a real `role="tree"` with a roving tabindex.
 * Forward opens a folder and back closes it, whichever side that is in the current direction. A search flattens nothing:
 * it filters the tree and opens every folder on the way to a match.
 */
export function DocPicker({
  open,
  onOpenChange,
  onConfirm,
  title,
  confirmLabel,
  value = [],
  exclude = [],
  docs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The picked doc card keys. */
  onConfirm: (keys: string[]) => void;
  title?: ReactNode;
  confirmLabel?: string;
  value?: string[];
  exclude?: string[];
  /** A page's own doc list, such as a docs mock. Defaults to every doc card in the store. */
  docs?: DocPickerItem[];
}) {
  const t = useT(pickerMessages);
  const locale = useLocale();
  const version = useCardStoreVersion();
  const treeRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>(value);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPicked(value);
    setClosed(new Set());
    setFocusId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const all = useMemo<DocPickerItem[]>(
    () =>
      docs ??
      allCards()
        .filter((c): c is Extract<HubCard, { type: 'doc' }> => c.type === 'doc' && !c.archivedAt)
        .map((c) => ({ key: c.key, path: c.doc.path, source: c.doc.sourceName, title: c.title[locale] })),
    // `version` re-reads the store after a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docs, locale, version],
  );

  const q = query.trim().toLowerCase();
  const shown = all.filter((d) => !exclude.includes(d.key) && (!q || d.path.toLowerCase().includes(q) || d.title.toLowerCase().includes(q) || d.key.toLowerCase().includes(q)));
  const rows = useMemo(() => flatten(buildTree(shown), q ? new Set() : closed), [shown, closed, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = rows.find((r) => r.id === focusId) ?? rows[0];

  const toggleDoc = (key: string) => setPicked((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
  const setFolder = (id: string, isOpen: boolean) =>
    setClosed((set) => {
      const next = new Set(set);
      if (isOpen) next.delete(id);
      else next.add(id);
      return next;
    });

  const focusRow = (id: string) => {
    setFocusId(id);
    // The row keeps its element, so focus moves right away; a row that just appeared is picked up by the effect below.
    treeRef.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)?.focus();
  };

  const onTreeKey = (e: KeyboardEvent<HTMLLIElement>, row: TreeRow) => {
    const at = rows.indexOf(row);
    const forward = locale === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    const back = locale === 'ar' ? 'ArrowRight' : 'ArrowLeft';
    if (matchKey(e, 'ArrowDown') && rows[at + 1]) focusRow(rows[at + 1].id);
    else if (matchKey(e, 'ArrowUp')) {
      if (rows[at - 1]) focusRow(rows[at - 1].id);
      else treeRef.current?.closest('[role="dialog"]')?.querySelector<HTMLElement>('input')?.focus();
    } else if (matchKey(e, 'Home') && rows[0]) focusRow(rows[0].id);
    else if (matchKey(e, 'End') && rows.length) focusRow(rows[rows.length - 1].id);
    else if (matchKey(e, forward) && row.isOpen === false) setFolder(row.id, true);
    else if (matchKey(e, forward) && row.isOpen && rows[at + 1]) focusRow(rows[at + 1].id);
    else if (matchKey(e, back) && row.isOpen) setFolder(row.id, false);
    else if (matchKey(e, back) && row.parent) focusRow(row.parent);
    else if ((matchKey(e, 'Enter') && (e.ctrlKey || e.metaKey)) && picked.length) {
      onConfirm(picked);
      onOpenChange(false);
    } else if (matchKey(e, 'Enter') || matchKey(e, ' ')) {
      if (row.doc) toggleDoc(row.doc.key);
      else setFolder(row.id, !row.isOpen);
    } else return;
    e.preventDefault();
  };

  const rootLabel = t.tree;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? t.docTitle}
      footer={
        <PickerFooter
          count={picked.length}
          onCancel={() => onOpenChange(false)}
          onConfirm={() => {
            onConfirm(picked);
            onOpenChange(false);
          }}
          confirmLabel={confirmLabel}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <SearchField label={t.searchDocs} value={query} onChange={setQuery}>
          {(field) => (
            <input
              {...field}
              data-autofocus
              onKeyDown={(e) => {
                if (matchKey(e, 'ArrowDown') && current) {
                  e.preventDefault();
                  focusRow(current.id);
                } else if (matchKey(e, 'Backspace') && !query && picked.length) {
                  setPicked((list) => list.slice(0, -1));
                }
              }}
            />
          )}
        </SearchField>
        <PickedChips keys={picked} onRemove={(key) => setPicked((list) => list.filter((k) => k !== key))} />
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <p className="text-body font-medium text-foreground">{all.length ? t.noResults : t.noDocs}</p>
            <p className="mt-1 text-body-sm text-muted-foreground">{all.length ? t.noResultsBody : t.noDocsBody}</p>
          </div>
        ) : (
          <ul ref={treeRef} role="tree" aria-label={rootLabel} aria-multiselectable className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card py-1">
            {rows.map((row) => {
              const selected = !!row.doc && picked.includes(row.doc.key);
              return (
                <li
                  key={row.id}
                  role="treeitem"
                  data-tree-id={row.id}
                  aria-level={row.level}
                  aria-expanded={row.isOpen}
                  aria-selected={row.doc ? selected : undefined}
                  tabIndex={row === current ? 0 : -1}
                  onFocus={() => setFocusId(row.id)}
                  onKeyDown={(e) => onTreeKey(e, row)}
                  onClick={() => (row.doc ? toggleDoc(row.doc.key) : setFolder(row.id, !row.isOpen))}
                  // Indent by logical padding: a level is one step of the spacing scale.
                  style={{ paddingInlineStart: `${0.5 + (row.level - 1) * 1.25}rem` }}
                  className={cn('flex min-h-11 cursor-pointer items-center gap-2 py-1 pe-3 hover:bg-accent md:min-h-9', focusRingInset)}
                >
                  {row.doc ? (
                    <>
                      <span aria-hidden className="size-4 shrink-0" />
                      <FileText aria-hidden className="size-4 shrink-0 text-type-doc-fg" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body text-foreground">
                          <Bidi>{row.doc.title}</Bidi>
                        </span>
                        <code dir="ltr" translate="no" className="key block truncate text-start text-caption text-muted-foreground">
                          {row.label}
                        </code>
                      </span>
                      <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-sm border', selected ? 'border-foreground bg-foreground text-background' : 'border-input')}>
                        {selected && <Check className="size-3.5" strokeWidth={2.25} />}
                      </span>
                    </>
                  ) : (
                    <>
                      <ChevronRight aria-hidden className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-120 motion-reduce:transition-none rtl:-scale-x-100', row.isOpen && 'rotate-90 rtl:-rotate-90')} strokeWidth={1.75} />
                      <FolderClosed aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <code dir="ltr" translate="no" className="key min-w-0 truncate text-start text-body-sm text-foreground">
                        {row.label}
                      </code>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="hidden text-body-sm text-muted-foreground md:block">{t.hint}</p>
      </div>
    </Modal>
  );
}
