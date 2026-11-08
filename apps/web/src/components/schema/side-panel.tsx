'use client';

/**
 * @file side-panel.tsx
 * @description The workspace's side panel (docs/17 §4): closed until it is needed, floating over the map's end side. Three tabs: Details (what is selected, edited in place),
 * Overview (the design's numbers, its Arabic names by domain, its most connected tables, the legend, where it is read from and its history) and Draft (the open draft).
 * Selecting a table opens it on Details; the panel button or I opens it on its last tab. Escape closes it and gives focus back.
 * Counts keep their plural forms (review M13) and the version stays an isolated Latin token (review M14).
 */
import { motion } from 'framer-motion';
import { AlertTriangle, FolderCog, MousePointerClick, Network, Plus, Sparkles, X } from 'lucide-react';
import { useMemo } from 'react';

import {
  Button,
  fill,
  fmt,
  IconButton,
  Ltr,
  matchKey,
  num,
  plural,
  type PluralForms,
  RelativeTime,
  Tooltip,
  useLocale,
} from '@/components/kit';

import { DraftPanel } from './draft-dock';
import { Inspector } from './inspector';
import { coverageOf, modelTarget, toneStyle, unsyncedCount } from './model';
import { type PanelTab, useChrome, useSchemaWords, useStudio } from './studio';
import { HistoryList } from './views';

function Stat({ value, label, tone }: { value: string | null; label: string; tone?: 'warning' | undefined }) {
  return (
    <span className="schema-stat" data-tone={tone}>
      {value && <span className="schema-stat-value">{value}</span>}
      <span className="schema-stat-label">{label}</span>
    </span>
  );
}

/** A count with its plural noun, the number in bold: "119 جدولًا", "جدولان" (Arabic's dual takes no numeral), "1 table" (review M13). */
function CountStat({ n, forms, tone }: { n: number; forms: PluralForms; tone?: 'warning' | undefined }) {
  const locale = useLocale();
  const text = plural(n, locale, forms);
  const shown = num(n, locale);
  const at = text.indexOf(shown);
  return at < 0 ? (
    <Stat value={null} label={text} tone={tone} />
  ) : (
    <Stat value={shown} label={(text.slice(0, at) + text.slice(at + shown.length)).trim()} tone={tone} />
  );
}

function Overview({ onSource }: { onSource: () => void }) {
  const studio = useStudio();
  const t = useSchemaWords();
  const locale = useLocale();
  const { doc, data } = studio;
  const coverage = coverageOf(doc.models, studio.annotations);
  const unsynced = unsyncedCount(data.annotations);

  const byDomain = useMemo(
    () =>
      doc.domains
        .map((domain) => ({
          name: domain.name,
          coverage: coverageOf(
            doc.models.filter((model) => model.domain === domain.name),
            studio.annotations,
          ),
        }))
        .sort((a, b) => a.coverage.pct - b.coverage.pct || a.name.localeCompare(b.name)),
    [doc, studio.annotations],
  );
  const connected = useMemo(() => {
    const degree = new Map<string, number>();
    for (const relation of doc.relations) {
      degree.set(relation.from, (degree.get(relation.from) ?? 0) + 1);
      degree.set(relation.to, (degree.get(relation.to) ?? 0) + 1);
    }
    return [...degree].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [doc]);

  return (
    <div className="flex flex-col gap-6 p-4">
      <section className="flex flex-col gap-2">
        <h3 className="schema-panel-heading">{t.panel.source}</h3>
        <button
          type="button"
          className="schema-link block max-w-full truncate text-start font-mono text-body-sm"
          dir="ltr"
          onClick={onSource}
          disabled={!studio.can.manage}
          title={t.setup.change}
        >
          {data.source?.path}/{data.source?.schemaDir}
        </button>
        <p className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
          <span>{fill(t.stats.readAt, { when: <RelativeTime iso={data.snapshot!.createdAt} /> })}</span>
          <span aria-hidden>·</span>
          <span>{fill(t.stats.hash, { hash: <Ltr mono>{data.snapshot!.hash.slice(0, 8)}</Ltr> })}</span>
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="schema-panel-heading">{t.panel.numbers}</h3>
        <div className="schema-stats">
          <CountStat n={doc.stats.models} forms={t.stats.models} />
          <CountStat n={doc.stats.fields} forms={t.stats.fields} />
          <CountStat n={doc.stats.enums} forms={t.stats.enums} />
          <Stat
            value={null}
            label={fmt(t.stats.relationsPair, {
              declared: num(doc.stats.relations, locale),
              implied: num(doc.stats.impliedRelations, locale),
            })}
          />
          {unsynced > 0 && <CountStat n={unsynced} forms={t.stats.unsynced} tone="warning" />}
          {doc.warnings.length > 0 && (
            <Tooltip content={t.states.warningsTip}>
              <span className="schema-stat" data-tone="warning" tabIndex={0}>
                <AlertTriangle aria-hidden className="size-4" strokeWidth={1.75} />
                <span className="schema-stat-label">
                  {plural(doc.warnings.length, locale, t.states.warnings)}
                </span>
              </span>
            </Tooltip>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className="schema-panel-heading">{t.panel.coverage}</h3>
        <div className="schema-coverage">
          <span className="schema-coverage-value">
            {fmt(t.stats.pct, { pct: num(coverage.pct, locale) })}
          </span>
          <span className="text-body-sm text-muted-foreground">
            {fmt(t.stats.coverageTip, {
              named: num(coverage.named, locale),
              total: num(coverage.total, locale),
            })}
          </span>
          <span className="schema-meter" aria-hidden>
            <motion.span
              initial={{ inlineSize: 0 }}
              animate={{ inlineSize: `${coverage.pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {studio.can.annotate && coverage.pct < 100 && (
            <Button size="sm" variant="outline" onClick={() => void studio.suggestNames({})}>
              <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
              {t.actions.suggestNames}
            </Button>
          )}
          {studio.can.draft && unsynced > 0 && !studio.draft && (
            <Tooltip content={t.actions.syncNamesTip}>
              <Button size="sm" variant="outline" onClick={() => void studio.syncNames()}>
                <FolderCog aria-hidden className="size-4" strokeWidth={1.75} />
                {t.actions.syncNames}
              </Button>
            </Tooltip>
          )}
        </div>
        <ul className="flex flex-col gap-1.5">
          {byDomain.map((domain) => (
            <li
              key={domain.name}
              className="schema-domain-bar"
              style={toneStyle(studio.tones.get(domain.name))}
            >
              <span className="schema-node-dot" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">{domain.name}</span>
              <span className="schema-domain-bar-track" aria-hidden>
                <span style={{ inlineSize: `${domain.coverage.pct}%` }} />
              </span>
              <span className="w-10 shrink-0 text-end text-caption text-muted-foreground tabular-nums">
                {fmt(t.stats.pct, { pct: num(domain.coverage.pct, locale) })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {connected.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="schema-panel-heading">
            <Network aria-hidden className="size-4" strokeWidth={1.75} />
            {t.panel.connected}
          </h3>
          <ul className="flex flex-col">
            {connected.map(([name, degree]) => {
              const domain = doc.models.find((model) => model.name === name)?.domain ?? '';
              const nameAr = studio.annotations.get(modelTarget(name))?.nameAr;
              return (
                <li key={name}>
                  <button
                    type="button"
                    className="schema-list-button"
                    onClick={() => {
                      studio.setView('diagram');
                      studio.setFocus(null);
                      studio.select({ kind: 'model', name });
                      window.setTimeout(() => studio.revealModel(name), 80);
                    }}
                  >
                    <span
                      style={toneStyle(studio.tones.get(domain))}
                      className="schema-node-dot"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-start">
                      <span className="font-mono" dir="ltr">
                        {name}
                      </span>
                      {nameAr && <span className="ms-1.5 text-muted-foreground">{nameAr}</span>}
                    </span>
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {plural(degree, locale, t.panel.links)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="schema-panel-heading">{t.legend.title}</h3>
        <ul className="flex flex-col gap-1.5 text-body-sm text-muted-foreground">
          <li className="schema-legend-item">
            <span className="schema-legend-line" aria-hidden />
            {t.legend.declared}
          </li>
          <li className="schema-legend-item">
            <span className="schema-legend-line schema-legend-dashed" aria-hidden />
            {t.legend.implied}
          </li>
          <li className="schema-legend-item">
            <Sparkles aria-hidden className="size-3.5 text-info-soft-foreground" strokeWidth={2} />
            {t.legend.changed}
          </li>
          <li className="schema-legend-item">
            <Plus aria-hidden className="size-3.5 text-success-soft-foreground" strokeWidth={2} />
            {t.legend.proposed}
          </li>
        </ul>
      </section>

      <HistoryList />
    </div>
  );
}

function NothingSelected() {
  const t = useSchemaWords();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="schema-empty-icon" aria-hidden>
        <MousePointerClick className="size-6" strokeWidth={1.5} />
      </span>
      <p className="text-title-sm font-semibold text-foreground">{t.panel.emptyTitle}</p>
      <p className="max-w-64 text-body-sm text-muted-foreground">{t.panel.emptyBody}</p>
    </div>
  );
}

export function SidePanel({ onSource }: { onSource: () => void }) {
  const studio = useStudio();
  const chrome = useChrome();
  const t = useSchemaWords();
  const locale = useLocale();
  const tab = chrome.panel;
  if (!tab) return null;
  const count = studio.draft?.changes.length ?? 0;
  const tabs: [PanelTab, string][] = [
    ['details', t.panel.details],
    ['overview', t.panel.overview],
    ['draft', studio.draft ? `${t.panel.draft} · ${num(count, locale)}` : t.panel.draft],
  ];
  const label = tab === 'details' ? t.inspector.label : tab === 'overview' ? t.panel.overview : t.draft.label;
  const close = () => {
    if (tab === 'details' && studio.selection) {
      studio.closeInspector();
      return;
    }
    chrome.setPanel(null);
    window.setTimeout(
      () => document.querySelector<HTMLElement>('[data-schema-panel-toggle]')?.focus({ preventScroll: true }),
      0,
    );
  };
  return (
    <motion.aside
      initial={{ opacity: 0, x: locale === 'ar' ? -16 : 16, scale: 0.985 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="schema-panel"
      aria-label={label}
      onKeyDown={(event) => {
        const typing = (event.target as HTMLElement).closest('input, textarea, select, [role="dialog"]');
        if (matchKey(event, 'Escape') && !typing && tab !== 'details') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="schema-panel-head">
        <div role="tablist" aria-label={t.chrome.panel} className="schema-panel-tabs">
          {tabs.map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className="schema-panel-tab"
              onClick={() => chrome.setPanel(value)}
            >
              {text}
            </button>
          ))}
        </div>
        <IconButton label={t.actions.close} className="schema-tool" onClick={close}>
          <X aria-hidden className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>
      <div className="schema-panel-body" data-tab={tab}>
        {tab === 'details' && (studio.selection ? <Inspector /> : <NothingSelected />)}
        {tab === 'overview' && <Overview onSource={onSource} />}
        {tab === 'draft' && <DraftPanel />}
      </div>
    </motion.aside>
  );
}
