'use client';

/**
 * @file search-dialog.tsx
 * @description Search the design (docs/17 §4): tables, columns and enums by code name, table name, Arabic name or description, with Arabic letters folded. `/` or Ctrl+Shift+K opens it on
 * this page; Enter opens the result on the diagram and in the inspector, and focus moves to the inspector's heading (review B2). In Arabic a result leads with its Arabic name.
 */
import { Hash, ListTree, Search, Table2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn, fill, Kbd, Modal, useLocale } from '@/components/kit';

import { type SearchHit, searchSchema, toneStyle } from './model';
import { useSchemaWords, useStudio } from './studio';

const ICONS = { model: Table2, field: Hash, enum: ListTree } as const;

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(
    () => searchSchema(studio.doc, studio.annotations, query),
    [studio.doc, studio.annotations, query],
  );

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    if (open) {
      setQuery('');
      window.setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  const choose = (hit: SearchHit) => {
    onOpenChange(false);
    if (hit.kind === 'enum') {
      studio.setView('enums');
      studio.select({ kind: 'enum', name: hit.model }, { focus: true });
      return;
    }
    studio.setFocus(null);
    if (studio.prefs.hidden.includes(hit.domain))
      studio.setPrefs({ hidden: studio.prefs.hidden.filter((name) => name !== hit.domain) });
    studio.setView('diagram');
    studio.select({ kind: 'model', name: hit.model, field: hit.field }, { focus: true });
    window.setTimeout(() => studio.revealModel(hit.model), 80);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t.search.title} className="md:max-w-xl">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <input
            ref={input}
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="schema-search-results"
            aria-activedescendant={hits[index] ? `schema-hit-${index}` : undefined}
            className="h-11 w-full rounded-md border border-input bg-card ps-9 pe-3 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={t.search.placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setIndex((value) => Math.min(value + 1, hits.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setIndex((value) => Math.max(value - 1, 0));
              } else if (event.key === 'Enter' && hits[index]) {
                event.preventDefault();
                choose(hits[index]);
              }
            }}
          />
        </div>
        <ul id="schema-search-results" role="listbox" className="flex max-h-96 flex-col overflow-y-auto">
          {query.trim() && hits.length === 0 && (
            <li className="px-2 py-6 text-center text-body-sm text-muted-foreground">{t.search.empty}</li>
          )}
          {hits.map((hit, position) => {
            const Icon = ICONS[hit.kind];
            const arabicFirst = locale === 'ar' && !!hit.nameAr;
            return (
              <li
                key={`${hit.kind}:${hit.code}`}
                id={`schema-hit-${position}`}
                role="option"
                aria-selected={position === index}
                className={cn('schema-hit', position === index && 'is-active')}
                style={toneStyle(studio.tones.get(hit.domain))}
                onPointerMove={() => setIndex(position)}
                onClick={() => choose(hit)}
              >
                <span className="schema-hit-icon" aria-hidden>
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  {arabicFirst ? (
                    <>
                      <span className="block truncate text-body-sm text-foreground">{hit.nameAr}</span>
                      <span
                        className="block truncate text-start font-mono text-caption text-muted-foreground"
                        dir="ltr"
                      >
                        {hit.code}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="block truncate text-start font-mono text-body-sm text-foreground"
                        dir="ltr"
                      >
                        {hit.code}
                      </span>
                      {hit.nameAr && (
                        <span className="block truncate text-caption text-muted-foreground">
                          {hit.nameAr}
                        </span>
                      )}
                    </>
                  )}
                </span>
                <span className="shrink-0 text-caption text-muted-foreground">{hit.domain}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-caption text-muted-foreground">{fill(t.search.hint, { key: <Kbd>Enter</Kbd> })}</p>
      </div>
    </Modal>
  );
}
