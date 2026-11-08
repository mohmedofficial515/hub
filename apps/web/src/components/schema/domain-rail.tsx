'use client';

/**
 * @file domain-rail.tsx
 * @description The domains (docs/17 §4): one per Prisma file, with its colour, its tables and how much of it is named in Arabic. Click to show or hide it on the diagram; "Only this" isolates it.
 */
import { Eye, EyeOff, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn, fmt, IconButton, num, plural, Tooltip, useLocale } from '@/components/kit';

import { coverageOf, toneStyle } from './model';
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
  const hidden = new Set(studio.prefs.hidden);

  const domains = useMemo(
    () =>
      studio.doc.domains.map((domain) => {
        const models = studio.doc.models.filter((model) => model.domain === domain.name);
        return { ...domain, coverage: coverageOf(models, studio.annotations) };
      }),
    [studio.doc, studio.annotations],
  );
  const shown = domains.filter(
    (domain) =>
      !query ||
      domain.name.includes(query.toLowerCase()) ||
      domain.header?.toLowerCase().includes(query.toLowerCase()),
  );

  const toggle = (name: string) => {
    const next = new Set(hidden);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    studio.setFocus(null);
    studio.setPrefs({ hidden: [...next] });
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
          return (
            <li
              key={domain.name}
              style={toneStyle(studio.tones.get(domain.name))}
              className={cn('schema-rail-item', off && 'is-off')}
            >
              <button
                type="button"
                className="schema-rail-main"
                onClick={() => toggle(domain.name)}
                aria-pressed={!off}
                title={domain.header ?? domain.name}
              >
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
                {off ? (
                  <EyeOff
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Eye
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                    strokeWidth={1.75}
                  />
                )}
              </button>
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
