import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, MousePointerClick, RefreshCw, SearchX } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { TooltipProvider } from '@dash/components/ui/tooltip';
import { messages, fill } from './i18n';
import { CurrencyCards } from './parts/cards';
import { COLUMNS, type Act, type CellCtx, type ColId, type PanelSection, type Tab } from './parts/columns';
import { localName } from './parts/derive';
import { DiffSheet } from './parts/diff-sheet';
import { KpiStrip } from './parts/kpi';
import { CurrencyPanel } from './parts/panel';
import { PinDialog } from './parts/pin-dialog';
import { Overlay } from './parts/sheet';
import { useCurrencyLab } from './parts/store';
import { CurrencyTable } from './parts/table';
import { BulkBar, Pagination } from './parts/grid-chrome';
import { Toasts } from './parts/toasts';
import { FILTERS, Toolbar, matchesFilter, type Density, type Filter, type Sort } from './parts/toolbar';

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export default function FinanceCurrenciesV2() {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const lab = useCurrencyLab(t);
  const isXl = useMedia('(min-width: 1280px)');
  const isMd = useMedia('(min-width: 768px)');

  const [tab, setTab] = useState<Tab>('rates');
  const [hiddenCols, setHiddenCols] = useState<Set<ColId>>(new Set());
  const [density, setDensity] = useState<Density>('standard');
  const [sort, setSort] = useState<Sort>({ id: 'currency', dir: 'asc' });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches ? 'EGP' : null,
  );
  const [section, setSection] = useState<{ name: PanelSection; tick: number } | null>(null);
  const [pinTarget, setPinTarget] = useState<string | null>(null);

  const { metas } = lab;
  const q = search.trim().toLowerCase();

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f, metas.filter((m) => matchesFilter(m, f)).length])) as Record<Filter, number>,
    [metas],
  );

  const sorted = useMemo(() => {
    const list = metas.filter((m) => matchesFilter(m, filter) && (!q || m.searchText.includes(q)));
    const idx = new Map(metas.map((m, i) => [m.code, i]));
    const col = COLUMNS.find((c) => c.id === sort.id);
    const key = (m: (typeof metas)[number]) => (col ? col.sort(m) : (idx.get(m.code) ?? 0));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return c * dir || (idx.get(a.code) ?? 0) - (idx.get(b.code) ?? 0);
    });
  }, [metas, filter, q, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages);
  const rows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const act: Act = {
    open: (code, sec) => {
      setSelected(code);
      setSection(sec ? { name: sec, tick: Date.now() } : null);
    },
    toggle: lab.toggleVisible,
    pin: (code) => setPinTarget(code),
    revoke: lab.revokePin,
    copy: lab.copyRate,
    refresh: lab.refreshOne,
    busy: lab.busy,
  };
  const ctx: CellCtx = { t, locale, act };

  const selectedMeta = metas.find((m) => m.code === selected) ?? null;
  const names = useMemo(() => Object.fromEntries(metas.map((m) => [m.code, localName(m.row.currency, locale)])), [metas, locale]);

  const nav = useCallback(
    (dir: -1 | 1) => {
      const list = sorted.length ? sorted : metas;
      const i = list.findIndex((m) => m.code === selected);
      const next = list[(i + dir + list.length) % list.length];
      if (next) setSelected(next.code);
    },
    [sorted, metas, selected],
  );

  const toggleCol = (id: ColId) =>
    setHiddenCols((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const check = (code: string, v: boolean) =>
    setChecked((s) => {
      const n = new Set(s);
      if (v) n.add(code);
      else n.delete(code);
      return n;
    });
  const checkAll = (v: boolean) =>
    setChecked((s) => {
      const n = new Set(s);
      rows.forEach((r) => (v ? n.add(r.code) : n.delete(r.code)));
      return n;
    });
  const resetView = () => {
    setSearch('');
    setFilter('all');
  };
  const applyFilter = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };

  const checkedList = [...checked];
  const exportCodes = checkedList.length ? checkedList : sorted.map((m) => m.code);
  const loading = lab.scenario === 'loading';
  const failed = lab.scenario === 'error';
  const refreshing = lab.diff?.phase === 'loading';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto grid max-w-[1680px] grid-cols-[minmax(0,1fr)] gap-5 p-4 md:p-6">
          <motion.header
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-wrap items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <h1 className="text-26 font-extrabold leading-tight">{t.title}</h1>
              <p className="mt-1 max-w-2xl text-14 text-muted-foreground">{t.subtitle}</p>
            </div>
          </motion.header>

          {failed ? (
            <div role="alert" className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-6 shadow-sm">
              <AlertTriangle className="size-6 text-destructive-soft-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 className="text-16 font-bold">{t.error.title}</h2>
                <p className="text-14 text-muted-foreground">{t.error.body}</p>
              </div>
              <Button variant="outline" className="h-11" onClick={() => lab.setScenario('ok')}>
                {t.error.retry}
              </Button>
            </div>
          ) : (
            <>
              <KpiStrip metas={metas} t={t} filter={filter} onFilter={applyFilter} />

              <div className={cn('grid grid-cols-[minmax(0,1fr)] items-start gap-5', isXl && selectedMeta && 'xl:grid-cols-[minmax(0,1fr)_420px]')}>
                <section aria-label={t.title} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
                  {/* DataGrid frame: rounded-2xl border bg-card shadow-sm, header bar reaches the edge, pb-4 */}
                  <div className="overflow-hidden rounded-2xl border bg-card pb-4 shadow-sm">
                    <div className="space-y-4">
                      <Toolbar
                        t={t}
                        search={search}
                        onSearch={(v) => {
                          setSearch(v);
                          setPage(1);
                        }}
                        tab={tab}
                        onTab={setTab}
                        filter={filter}
                        onFilter={applyFilter}
                        counts={counts}
                        density={density}
                        onDensity={setDensity}
                        hiddenCols={hiddenCols}
                        onToggleCol={toggleCol}
                        onExport={() => lab.exportCsv(exportCodes)}
                        sort={sort}
                        onSort={setSort}
                        showTabs={isMd}
                        gridAction={
                          <Button className="h-9 gap-2 rounded-lg px-3.5 text-13" onClick={lab.startRefresh} disabled={loading || failed || refreshing}>
                            <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
                            {refreshing ? t.refreshing : t.refreshAll}
                          </Button>
                        }
                      />

                      {checked.size > 0 && (
                        <BulkBar
                          t={t}
                          count={checked.size}
                          onShow={() => lab.setVisibleMany(checkedList, true)}
                          onHide={() => lab.setVisibleMany(checkedList, false)}
                          onExport={() => lab.exportCsv(checkedList)}
                          onClear={() => setChecked(new Set())}
                        />
                      )}

                      {loading ? (
                        <div role="status" aria-label={t.sr.live} className="grid gap-2 px-4">
                          {Array.from({ length: 6 }, (_, i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" aria-hidden />
                          ))}
                        </div>
                      ) : sorted.length === 0 ? (
                        <div className="mx-4 grid place-items-center gap-2 rounded-xl border px-4 py-14 text-center">
                          <SearchX className="size-8 text-muted-foreground" aria-hidden />
                          <h2 className="text-14 font-bold">{t.empty.title}</h2>
                          <p className="text-13 text-muted-foreground">{t.empty.body}</p>
                          <Button variant="outline" className="mt-2 h-9 rounded-lg" onClick={resetView}>
                            {t.empty.reset}
                          </Button>
                        </div>
                      ) : isMd ? (
                        <CurrencyTable
                          rows={rows}
                          ctx={ctx}
                          tab={tab}
                          hiddenCols={hiddenCols}
                          density={density}
                          sort={sort}
                          onSort={setSort}
                          selectedCode={selected}
                          panelOpen={isXl && !!selected}
                          checked={checked}
                          onCheck={check}
                          onCheckAll={checkAll}
                        />
                      ) : (
                        <div className="mx-4">
                          <CurrencyCards rows={rows} ctx={ctx} selectedCode={selected} checked={checked} onCheck={check} />
                        </div>
                      )}

                      {!loading && sorted.length > 0 && (
                        <Pagination
                          t={t}
                          page={safePage - 1}
                          pages={pages}
                          pageSize={pageSize}
                          total={sorted.length}
                          selected={checked.size}
                          sizes={[5, 10]}
                          onPage={(p) => setPage(p + 1)}
                          onSize={(n) => {
                            setPageSize(n);
                            setPage(1);
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <p className="text-12 text-muted-foreground">{t.demo}</p>
                </section>

                {isXl && selectedMeta && (
                  <aside
                    aria-label={t.panel.title}
                    className="sticky top-4 flex max-h-[calc(100dvh-2rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card"
                  >
                    {selectedMeta ? (
                      <CurrencyPanel
                        key={selectedMeta.code}
                        m={selectedMeta}
                        metas={metas}
                        ctx={ctx}
                        overrides={lab.overrides}
                        lab={lab}
                        section={section}
                        embedded
                        onClose={() => setSelected(null)}
                        onNav={nav}
                      />
                    ) : (
                      <div className="grid flex-1 place-items-center gap-3 p-10 text-center">
                        <MousePointerClick className="size-8 text-muted-foreground" aria-hidden />
                        <p className="max-w-64 text-14 text-muted-foreground">{t.panel.empty}</p>
                      </div>
                    )}
                  </aside>
                )}
              </div>
            </>
          )}
        </main>

        {!isXl && (
          <Overlay
            open={!!selectedMeta && !pinTarget && !lab.diff}
            onClose={() => setSelected(null)}
            label={t.panel.title}
            closeLabel={t.panel.close}
            className="h-[92dvh]"
          >
            {selectedMeta && (
              <CurrencyPanel
                key={selectedMeta.code}
                m={selectedMeta}
                metas={metas}
                ctx={ctx}
                overrides={lab.overrides}
                lab={lab}
                section={section}
                embedded={false}
                onClose={() => setSelected(null)}
                onNav={nav}
              />
            )}
          </Overlay>
        )}

        <PinDialog meta={metas.find((m) => m.code === pinTarget) ?? null} t={t} onClose={() => setPinTarget(null)} onSubmit={lab.pinRate} />
        <DiffSheet diff={lab.diff} t={t} locale={locale} names={names} onApply={lab.applyRefresh} onDiscard={lab.discardRefresh} />
        <Toasts toasts={lab.toasts} onDismiss={lab.dismissToast} t={t} />
      </div>
    </TooltipProvider>
  );
}
