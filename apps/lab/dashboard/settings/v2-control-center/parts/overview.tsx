/**
 * The overview is a status board, not a directory: header (title, scope, search), the "needs attention" triage
 * list with a Fix link into the exact field, the latest changes, then the 8 sections as a balanced masonry of calm
 * cards whose rows carry live values, state, distance from defaults and the last change.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Building2, CircleDashed, Clock, Info, OctagonAlert, PencilLine, SlidersHorizontal, TriangleAlert, UserRound } from 'lucide-react';
import { cn } from '@lab/utils';
import { SETTINGS_SECTIONS, getGroup, type SettingsGroup, type SettingsSection } from '@lab/mocks/settings';
import { fill, num, relative } from './format';
import { StatePill } from './group-page';
import { attentionItems, fieldLabel, changedFromDefault, groupState, summarize, type AttentionItem, type Severity } from './model';
import { SearchBox } from './search';
import { useStore, who } from './store';
import { Btn, IconTile, Pill, Segmented } from './ui';

// ─── Header ─────────────────────────────────────────────────────────────────

export function BoardHeader() {
  const { t, route, go } = useStore();
  const scope = route.view === 'prefs' ? 'mine' : 'org';
  return (
    <header className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="text-32 font-extrabold leading-tight tracking-tight">{t.meta.title}</h1>
          <p className="mt-1 max-w-[62ch] text-14 leading-relaxed text-muted-foreground">{t.meta.lead}</p>
        </div>
        <div className="grid w-full gap-1.5 sm:w-[24rem]">
          <Segmented
            label={t.scope.label}
            value={scope}
            stretch
            onChange={(v) => go(v === 'mine' ? { view: 'prefs', tab: route.tab ?? 'appearance' } : { view: 'overview' })}
            options={[
              {
                value: 'org',
                label: (
                  <>
                    <Building2 className="size-4" aria-hidden />
                    {t.scope.org}
                  </>
                ),
              },
              {
                value: 'mine',
                label: (
                  <>
                    <SlidersHorizontal className="size-4" aria-hidden />
                    {t.scope.mine}
                  </>
                ),
              },
            ]}
          />
          <p className="text-12 text-muted-foreground sm:text-end">{scope === 'org' ? t.scope.orgHint : t.scope.mineHint}</p>
        </div>
      </div>
      <SearchBox size="lg" />
    </header>
  );
}

// ─── Attention ──────────────────────────────────────────────────────────────

const SEV_ICON: Record<Severity, { icon: typeof Info; cls: string }> = {
  blocking: { icon: OctagonAlert, cls: 'bg-destructive/10 text-destructive-soft-foreground' },
  risky: { icon: TriangleAlert, cls: 'bg-warning/18 text-warning-strong' },
  gap: { icon: CircleDashed, cls: 'bg-info/12 text-info-soft-foreground' },
  pending: { icon: Clock, cls: 'bg-info/12 text-info-soft-foreground' },
  draft: { icon: PencilLine, cls: 'bg-primary/5 text-primary' },
  info: { icon: Info, cls: 'bg-muted text-foreground/70' },
};

const VISIBLE = 6;

export function AttentionPanel() {
  const { t, locale, groups, saved, drafts, pending, scenario, go } = useStore();
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const items = useMemo(
    () => attentionItems({ groups, saved, drafts, pending, locale, t, allClear: scenario === 'empty' }),
    [groups, saved, drafts, pending, locale, t, scenario],
  );
  const shown = expanded ? items : items.slice(0, VISIBLE);
  const bySeverity = items.reduce<Partial<Record<Severity, number>>>((acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }), {});

  const act = (item: AttentionItem) => {
    if (item.action === 'review') go({ view: 'group', group: item.groupKey, panel: 'review' });
    else go({ view: 'group', group: item.groupKey, field: item.fieldKey });
  };

  if (!items.length) {
    return (
      <section aria-labelledby="att-title" className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-success/12 text-success-soft-foreground">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M5 12.5 10 17l9-10" />
          </svg>
        </span>
        <div>
          <h2 id="att-title" className="text-17 font-extrabold">
            {t.attention.clearTitle}
          </h2>
          <p className="text-13 text-muted-foreground">{t.attention.clearLead}</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="att-title" className="rounded-3xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <h2 id="att-title" className="text-20 font-extrabold">
            {t.attention.title}
          </h2>
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-warning/20 px-2 text-13 font-extrabold tabular-nums text-warning-soft-foreground" aria-label={fill(t.attention.countAria, { n: num(locale, items.length) })}>
            {num(locale, items.length)}
          </span>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label={t.attention.lead}>
          {(Object.keys(bySeverity) as Severity[]).map((sev) => (
            <li key={sev}>
              <Pill tone="outline" className="gap-1">
                <span className="tabular-nums text-foreground">{num(locale, bySeverity[sev]!)}</span> {t.sev[sev]}
              </Pill>
            </li>
          ))}
        </ul>
      </header>
      <p className="px-5 pt-1 text-13 text-muted-foreground">{t.attention.lead}</p>
      <ol className="mt-3 grid gap-x-2 px-2 pb-2 lg:grid-cols-2">
        {shown.map((item, i) => {
          const group = getGroup(item.groupKey)!;
          const sev = SEV_ICON[item.severity];
          const SevIcon = sev.icon;
          const field = item.fieldKey ? group.subsections.flatMap((s) => s.fields).find((f) => f.key === item.fieldKey) : undefined;
          return (
            <motion.li
              key={item.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: reduce ? 0 : 0.06 + i * 0.045, ease: 'easeOut' }}
              className="flex items-start gap-3 rounded-2xl px-3 py-3 hover:bg-muted/60"
            >
              <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl', sev.cls)}>
                <SevIcon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-12 font-bold text-muted-foreground">
                  <span className="text-foreground">{group.title[locale]}</span>
                  <span>{t.sev[item.severity]}</span>
                </p>
                <p className="mt-0.5 text-13 leading-relaxed text-foreground/90">{item.text}</p>
                {field ? <p className="mt-0.5 truncate text-12 text-muted-foreground">{fieldLabel(field, locale, t)}</p> : null}
              </div>
              <Btn
                variant="outline"
                onClick={() => act(item)}
                aria-label={`${item.action === 'review' ? t.attention.review : item.action === 'open' ? t.attention.open : t.attention.fix}: ${group.title[locale]}${field ? ` — ${field.label[locale]}` : ''}`}
              >
                {item.action === 'review' ? t.attention.review : item.action === 'open' ? t.attention.open : t.attention.fix}
              </Btn>
            </motion.li>
          );
        })}
      </ol>
      {items.length > VISIBLE ? (
        <div className="border-t border-border px-3 py-2">
          <Btn variant="quiet" size="sm" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
            {expanded ? t.attention.showLess : fill(t.attention.showAll, { n: num(locale, items.length) })}
          </Btn>
        </div>
      ) : null}
    </section>
  );
}

// ─── Latest changes ─────────────────────────────────────────────────────────

export function RecentChanges() {
  const { t, locale, history, groups, go } = useStore();
  const visible = new Set(groups.map((g) => g.key));
  const latest = Object.entries(history)
    .filter(([key]) => visible.has(key))
    .flatMap(([key, entries]) => entries.filter((e) => e.changes.length).map((entry) => ({ key, entry })))
    .sort((a, b) => b.entry.at.localeCompare(a.entry.at) || b.entry.version - a.entry.version)
    .slice(0, 5);

  return (
    <section aria-labelledby="recent-title" className="rounded-3xl border border-border bg-card p-5 xl:self-start">
      <h2 id="recent-title" className="text-16 font-extrabold">
        {t.recent.title}
      </h2>
      {latest.length === 0 ? (
        <p className="mt-2 text-13 text-muted-foreground">{t.recent.empty}</p>
      ) : (
        <ol className="mt-3 grid gap-1">
          {latest.map(({ key, entry }) => {
            const group = getGroup(key)!;
            return (
              <li key={`${key}-${entry.version}`}>
                <button
                  type="button"
                  onClick={() => go({ view: 'group', group: key, panel: 'history' })}
                  aria-label={fill(t.recent.viewHistory, { group: group.title[locale] })}
                  className="flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-start outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <IconTile name={group.icon} section={group.section} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-14 font-bold">{group.title[locale]}</span>
                      <span className="text-12 font-bold tabular-nums text-muted-foreground">v{num(locale, entry.version)}</span>
                    </span>
                    <span className="mt-0.5 block text-12 text-muted-foreground">
                      {who(t, entry.by)} · {relative(locale, entry.at)}
                    </span>
                    {entry.note ? <span className="mt-0.5 line-clamp-1 block text-12 text-foreground/80">«{entry.note[locale]}»</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ─── Board ──────────────────────────────────────────────────────────────────

/** Columns by the board's own width (not the viewport), so it also fits inside the dashboard's content pane. */
function useColumns(ref: RefObject<HTMLDivElement | null>) {
  const [cols, setCols] = useState(() => (window.innerWidth >= 1200 ? 3 : window.innerWidth >= 720 ? 2 : 1));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setCols(w >= 1080 ? 3 : w >= 680 ? 2 : 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return cols;
}

export function Board() {
  const { t, groups, canSee } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const cols = useColumns(ref);
  const visible = new Set(groups.map((g) => g.key));

  // Balanced columns: tallest sections first into the shortest column, then each column back in section order.
  const columns = useMemo(() => {
    const order = new Map(SETTINGS_SECTIONS.map((s, i) => [s.id, i]));
    const height = (s: SettingsSection) => 120 + s.groupKeys.filter((k) => visible.has(k)).length * 104;
    const out: SettingsSection[][] = Array.from({ length: cols }, () => []);
    const heights = Array(cols).fill(0) as number[];
    for (const section of [...SETTINGS_SECTIONS].sort((a, b) => height(b) - height(a) || order.get(a.id)! - order.get(b.id)!)) {
      const i = heights.indexOf(Math.min(...heights));
      out[i].push(section);
      heights[i] += height(section);
    }
    return out.map((col) => col.sort((a, b) => order.get(a.id)! - order.get(b.id)!));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, groups]);

  return (
    <section aria-labelledby="board-title" className="grid gap-4">
      <h2 id="board-title" className="sr-only">
        {t.board.title}
      </h2>
      <div ref={ref} className="grid gap-5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {columns.map((column, i) => (
          <div key={i} className="grid content-start gap-5">
            {column.map((section) => (
              <SectionCard key={section.id} section={section} hidden={section.groupKeys.filter((k) => !canSee(k)).length} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionCard({ section, hidden }: { section: SettingsSection; hidden: number }) {
  const { t, locale, groups } = useStore();
  const list = section.groupKeys.map((k) => groups.find((g) => g.key === k)).filter((g): g is SettingsGroup => !!g);
  return (
    <section aria-labelledby={`sec-${section.id}`} className="rounded-3xl border border-border bg-card">
      <header className="flex items-start gap-3 px-5 pb-2 pt-5">
        <IconTile name={section.icon} section={section.id} />
        <div className="min-w-0 flex-1">
          <h3 id={`sec-${section.id}`} className="text-16 font-extrabold leading-snug">
            {section.title[locale]}
          </h3>
          <p className="mt-0.5 text-12 leading-relaxed text-muted-foreground">{section.description[locale]}</p>
        </div>
        <span className="mt-1 shrink-0 whitespace-nowrap text-12 font-semibold text-muted-foreground">
          {list.length === 1 ? t.board.groupsOne : fill(t.board.groups, { n: num(locale, list.length) })}
        </span>
      </header>
      <ul className="grid px-2 pb-2">
        {list.map((group) => (
          <GroupRow key={group.key} group={group} />
        ))}
      </ul>
      {hidden ? (
        <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-12 text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/50" />
          {t.board.hidden}
        </p>
      ) : null}
    </section>
  );
}

function GroupRow({ group }: { group: SettingsGroup }) {
  const { t, locale, saved, meta, drafts, pending, go } = useStore();
  const values = saved[group.key];
  const state = groupState(group, values);
  const summary = summarize(group, values, locale, t).filter(Boolean);
  const changed = group.kind === 'server' ? changedFromDefault(group, values).length : 0;
  const m = meta[group.key];
  const draftCount = Object.keys(drafts[group.key] ?? {}).length;

  return (
    <li>
      <button
        type="button"
        onClick={() => go({ view: 'group', group: group.key })}
        className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-start outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="mt-0.5">
          <IconTile name={group.icon} section={group.section} size="sm" lamp={state} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-14 font-bold leading-snug">{group.title[locale]}</span>
            <StatePill state={state} />
            {!group.inDashboard ? <Pill tone="info">{t.pill.new}</Pill> : null}
            {draftCount ? <Pill tone="primary">{fill(t.pill.draft, { n: num(locale, draftCount) })}</Pill> : null}
            {pending[group.key] ? <Pill tone="info">{t.pill.pending}</Pill> : null}
          </span>
          <span className="mt-1 block text-13 leading-relaxed text-foreground/85">
            {summary.map((part, i) => (
              <span key={i}>
                {i ? <span className="px-1.5 text-muted-foreground/70" aria-hidden>·</span> : null}
                <bdi>{part}</bdi>
              </span>
            ))}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-muted-foreground">
            <span className="font-bold tabular-nums text-foreground/70">v{num(locale, m.version)}</span>
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3" aria-hidden />
              {who(t, m.updatedBy)}
            </span>
            <span>{relative(locale, m.updatedAt)}</span>
            {group.kind === 'server' ? (
              changed ? (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                  {fill(t.row.changed, { n: num(locale, changed) })}
                </span>
              ) : (
                <span>{t.row.noneChanged}</span>
              )
            ) : (
              <span>{t.row.special}</span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
