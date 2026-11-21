'use client';

/**
 * @file domain-rail.tsx
 * @description The layers (docs/17 §4), as a design tool lists them: one domain per Prisma file, with its colour, its tables and how much of it is named in Arabic. A domain opens to
 * its tables, and a table there is opened and brought to the middle of the map. The eye shows or hides a domain on the map; "Only this" isolates it.
 */
import { ChevronDown, Eye, EyeOff, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn, fmt, IconButton, num, plural, Tooltip, useLocale } from '@/components/kit';

import { coverageOf, labelOf, modelTarget, toneStyle } from './model';
import { useSchemaWords, useStudio } from './studio';

function Ring({ pct }: { pct: number }) {
  const radius = 9;
  const length = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 24 24" className="schema-ring" aria-hidden>
      <circle cx="12" cy="12" r={radius} className="schema-ring-track" />
      <circle
        cx="12"
        cy="12"
        r={radius}
        className="schema-ring-fill"
        strokeDasharray={`${(pct / 100) * length} ${length}`}
      />
    </svg>
  );
}

export function DomainRail() {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const hidden = new Set(studio.prefs.hidden);

  const domains = useMemo(
    () =>
      studio.doc.domains.map((domain) => {
        const models = studio.doc.models.filter((model) => model.domain === domain.name);
        return { ...domain, coverage: coverageOf(models, studio.annotations) };
      }),
    [studio.doc, studio.annotations],
  );
  const needle = query.trim().toLowerCase();
  const matchesTable = (name: string) =>
    name.toLowerCase().includes(needle) ||
    (studio.annotations.get(modelTarget(name))?.nameAr ?? '').includes(query.trim());
  const shown = domains.filter(
    (domain) =>
      !needle ||
      domain.name.includes(needle) ||
      domain.header?.toLowerCase().includes(needle) ||
      domain.models.some(matchesTable),
  );

  const toggleShown = (name: string) => {
    const next = new Set(hidden);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    studio.setFocus(null);
    studio.setPrefs({ hidden: [...next] });
  };
  const toggleOpen = (name: string) =>
    setOpen((before) => {
      const next = new Set(before);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const openTable = (domain: string, name: string) => {
    if (hidden.has(domain))
      studio.setPrefs({ hidden: studio.prefs.hidden.filter((entry) => entry !== domain) });
    studio.setFocus(null);
    studio.setView('diagram');
    studio.select({ kind: 'model', name });
    window.setTimeout(() => studio.revealModel(name), 80);
  };

  return (
    <nav className="schema-rail" aria-label={t.domains.title}>
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <h2 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
          {t.domains.title}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            className="schema-link hit-44 text-caption"
            onClick={() => studio.setPrefs({ hidden: [] })}
          >
            {t.domains.all}
          </button>
          <span className="text-caption text-muted-foreground">·</span>
          <button
            type="button"
            className="schema-link hit-44 text-caption"
            onClick={() => studio.setPrefs({ hidden: domains.map((domain) => domain.name) })}
          >
            {t.domains.none}
          </button>
        </div>
      </div>
      <div className="relative px-3 pt-2">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-5 top-1/2 mt-1 size-3.5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <input
          aria-label={t.domains.searchPlaceholder}
          placeholder={t.domains.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-card ps-8 pe-2 text-body-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {shown.map((domain) => {
          const off = hidden.has(domain.name);
          const expanded = open.has(domain.name) || (needle !== '' && domain.models.some(matchesTable));
          const tables =
            needle && !domain.name.includes(needle) ? domain.models.filter(matchesTable) : domain.models;
          return (
            <li
              key={domain.name}
              style={toneStyle(studio.tones.get(domain.name))}
              className={cn('schema-rail-item', off && 'is-off')}
            >
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="schema-rail-main"
                  onClick={() => toggleOpen(domain.name)}
                  aria-expanded={expanded}
                  title={domain.header ?? domain.name}
                >
                  <ChevronDown
                    aria-hidden
                    className={cn('schema-rail-chevron size-3.5 shrink-0', expanded && 'is-open')}
                    strokeWidth={2}
                  />
                  <span className="schema-rail-swatch" aria-hidden />
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-body-sm font-medium text-foreground">
                      {domain.name}
                    </span>
                    <span className="block truncate text-caption text-muted-foreground">
                      {plural(domain.models.length, locale, t.domains.tables)} ·{' '}
                      {fmt(t.domains.coverage, { pct: num(domain.coverage.pct, locale) })}
                    </span>
                  </span>
                  <Ring pct={domain.coverage.pct} />
                </button>
                <IconButton
                  label={fmt(off ? t.domains.show : t.domains.hide, { name: domain.name })}
                  aria-pressed={!off}
                  className="schema-rail-eye"
                  onClick={() => toggleShown(domain.name)}
                >
                  {off ? (
                    <EyeOff aria-hidden className="size-4" strokeWidth={1.75} />
                  ) : (
                    <Eye aria-hidden className="size-4" strokeWidth={1.75} />
                  )}
                </IconButton>
              </div>
              {expanded && (
                <ul className="schema-rail-tables">
                  {tables.map((name) => {
                    const model = studio.doc.models.find((entry) => entry.name === name);
                    const label = labelOf(studio.annotations, modelTarget(name), name, studio.prefs.labels);
                    return (
                      <li key={name}>
                        <button
                          type="button"
                          className="schema-rail-table"
                          aria-current={studio.selection?.name === name || undefined}
                          onClick={() => openTable(domain.name, name)}
                        >
                          <span
                            className="min-w-0 flex-1 truncate text-start"
                            dir={label.main === name ? 'ltr' : undefined}
                          >
                            {label.main}
                          </span>
                          <span className="shrink-0 text-caption text-muted-foreground">
                            {num(model?.fields.length ?? 0, locale)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="schema-rail-actions">
                <button
                  type="button"
                  className="schema-link hit-44 text-caption"
                  onClick={() => {
                    studio.setFocus(null);
                    studio.setPrefs({
                      hidden: domains
                        .filter((other) => other.name !== domain.name)
                        .map((other) => other.name),
                    });
                  }}
                >
                  {t.domains.isolate}
                </button>
                {studio.can.annotate && domain.coverage.pct < 100 && (
                  <Tooltip content={t.actions.suggestNamesTip}>
                    <IconButton
                      label={t.actions.suggestNames}
                      className="size-7 md:size-7"
                      onClick={() => void studio.suggestNames({ domain: domain.name })}
                    >
                      <Sparkles aria-hidden className="size-3.5" strokeWidth={1.75} />
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
