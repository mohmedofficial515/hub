import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, EyeOff, FileDown, X } from 'lucide-react';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import { fill, type CurrencyMessages } from '../i18n';

/** DataGrid BulkBar: mx-4 rounded-xl border bg-card p-2 shadow-lg, count badge, divider, actions, ghost clear at the end. */
export function BulkBar({
  t,
  count,
  onShow,
  onHide,
  onExport,
  onClear,
}: {
  t: CurrencyMessages;
  count: number;
  onShow: () => void;
  onHide: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  return (
    <div
      role="region"
      aria-label={fill(t.bulk.selected, { n: count })}
      className="mx-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-lg animate-in fade-in-50 slide-in-from-top-1 motion-reduce:animate-none"
    >
      <span aria-live="polite" className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
        {fill(t.bulk.selected, { n: count })}
      </span>
      <div className="h-5 w-px bg-border" />
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onShow}>
        <Eye className="size-3.5" /> {t.bulk.show}
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onHide}>
        <EyeOff className="size-3.5" /> {t.bulk.hide}
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onExport}>
        <FileDown className="size-3.5" /> {t.exportSelected}
      </Button>
      <Button size="sm" variant="ghost" className="ms-auto gap-1.5 text-muted-foreground" onClick={onClear}>
        <X className="size-3.5" />
        {t.bulk.clear}
      </Button>
    </div>
  );
}

function pageList(current: number, total: number): (number | '...')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i);
  const out: (number | '...')[] = [0];
  const from = Math.max(1, current - 1);
  const to = Math.min(total - 2, current + 1);
  if (from > 1) out.push('...');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 2) out.push('...');
  out.push(total - 1);
  return out;
}

/** DataGrid pagination footer: range text at the start; rows-per-page select + first/prev/pages/next/last at the end. */
export function Pagination({
  t,
  page,
  pages,
  pageSize,
  total,
  selected,
  sizes,
  onPage,
  onSize,
}: {
  t: CurrencyMessages;
  /** Zero-based. */
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  selected: number;
  sizes: number[];
  onPage: (p: number) => void;
  onSize: (n: number) => void;
}) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-12 text-muted-foreground">
        {selected > 0 ? (
          <>
            <span className="font-medium text-foreground tabular-nums">{selected}</span> {fill(t.pager.selectedOf, { n: '', total }).trim()}
          </>
        ) : (
          <span className="tabular-nums" dir="auto">
            {fill(t.pager.range, { from: start, to: end, total })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="cur-rows" className="text-12 text-muted-foreground">
            {t.pager.perPage}
          </label>
          <select
            id="cur-rows"
            value={pageSize}
            onChange={(e) => onSize(Number(e.target.value))}
            className="h-8 w-[72px] rounded-md border border-input bg-background px-2 text-13 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {sizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" disabled={page <= 0} onClick={() => onPage(0)} aria-label={t.pager.first}>
            <ChevronsLeft className="size-4 rtl:rotate-180" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" disabled={page <= 0} onClick={() => onPage(page - 1)} aria-label={t.pager.prev}>
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
          {pageList(page, pages).map((p, i) =>
            p === '...' ? (
              <span key={`e${i}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant="outline"
                size="icon"
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'size-8 text-12 tabular-nums',
                  p === page && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                )}
                onClick={() => onPage(p)}
              >
                {p + 1}
              </Button>
            ),
          )}
          <Button variant="outline" size="icon" className="size-8" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label={t.pager.next}>
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" disabled={page >= pages - 1} onClick={() => onPage(pages - 1)} aria-label={t.pager.last}>
            <ChevronsRight className="size-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}
