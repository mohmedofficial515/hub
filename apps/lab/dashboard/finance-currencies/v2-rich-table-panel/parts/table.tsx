import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@lab/utils';
import { Checkbox } from '@dash/components/ui/checkbox';
import { fill } from '../i18n';
import { COLUMNS, IdentityCell, RowActions, type CellCtx, type ColId, type Tab } from './columns';
import type { Meta } from './derive';
import type { Density, Sort, SortId } from './toolbar';

/** DataGrid DENSITY_CELL / DENSITY_HEAD. */
const PAD: Record<Density, string> = { comfortable: 'py-3.5', standard: 'py-2.5', compact: 'py-1.5 text-12' };
const HEAD: Record<Density, string> = { comfortable: 'h-12', standard: 'h-11', compact: 'h-9' };

/** DataGrid select cell: the shared Checkbox, inside a 44px hit area. */
export function RowCheck({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <span className="flex size-11 items-center justify-center">
      <Checkbox
        checked={indeterminate ? 'indeterminate' : checked}
        onCheckedChange={(v) => onChange(v === true)}
        aria-label={label}
      />
    </span>
  );
}

interface Props {
  rows: Meta[];
  ctx: CellCtx;
  tab: Tab;
  hiddenCols: Set<ColId>;
  density: Density;
  sort: Sort;
  onSort: (s: Sort) => void;
  selectedCode: string | null;
  /** Inline panel open: secondary columns step aside on xl. */
  panelOpen: boolean;
  checked: Set<string>;
  onCheck: (code: string, v: boolean) => void;
  onCheckAll: (v: boolean) => void;
}

function railClass(m: Meta, selected: boolean) {
  if (selected) return 'before:bg-primary';
  if (m.stale) return 'before:bg-warning';
  if (m.hidden) return 'before:bg-muted-foreground/40';
  return 'before:bg-transparent';
}

export function CurrencyTable({ rows, ctx, tab, hiddenCols, density, sort, onSort, selectedCode, panelOpen, checked, onCheck, onCheckAll }: Props) {
  const { t } = ctx;
  const reduce = useReducedMotion();
  const cols = COLUMNS.filter((c) => c.tabs.includes(tab) && !hiddenCols.has(c.id));
  const allOn = rows.length > 0 && rows.every((r) => checked.has(r.code));
  const someOn = rows.some((r) => checked.has(r.code));

  const sortBy = (id: SortId) => onSort({ id, dir: sort.id === id && sort.dir === 'asc' ? 'desc' : 'asc' });
  const SortIcon = ({ id }: { id: SortId }) =>
    sort.id !== id ? (
      <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
    ) : sort.dir === 'asc' ? (
      <ArrowUp className="size-3.5" aria-hidden />
    ) : (
      <ArrowDown className="size-3.5" aria-hidden />
    );
  const ariaSort = (id: SortId) => (sort.id !== id ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending');

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const el = e.target as HTMLElement;
    if (!el.dataset.rowOpen) return;
    const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-row-open]'));
    const next = all[all.indexOf(el) + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  // DataGrid header: bg-muted row, h-11 (density), text-12 font-medium, muted sort glyphs, border-b under it.
  const th = cn('sticky top-0 z-20 border-b bg-muted p-0 align-middle font-medium text-foreground', HEAD[density]);
  const headInner = (align: 'start' | 'end' | 'center') =>
    cn('flex items-center gap-1', align === 'start' && 'justify-start ps-3 text-start', align === 'end' && 'justify-end pe-3 text-end', align === 'center' && 'justify-center text-center');
  const sortBtn = 'flex items-center gap-1 rounded-sm text-12 font-medium outline-none select-none focus-visible:ring-2 focus-visible:ring-ring';
  const td = 'border-b bg-(--row-bg) align-middle px-2 lg:px-4 group-last/row:border-b-0';
  const tdSpecial = 'border-b bg-(--row-bg) align-middle px-2 group-last/row:border-b-0';

  return (
    <div
      onKeyDown={onKeyDown}
      className="relative mx-4 max-h-[min(70vh,760px)] overflow-auto rounded-xl"
    >
      <table className="w-full caption-bottom border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{t.title}</caption>
        <thead>
          <tr className="bg-muted">
            <th scope="col" className={cn(th, 'w-12 text-center')}>
              <span className="flex justify-center">
                <RowCheck checked={allOn} indeterminate={!allOn && someOn} onChange={onCheckAll} label={t.selectAll} />
              </span>
            </th>
            <th scope="col" aria-sort={ariaSort('currency')} className={cn(th, 'sticky start-0 z-30')}>
              <div className={headInner('start')}>
                <button type="button" onClick={() => sortBy('currency')} className={sortBtn}>
                  {t.col.currency} <span className="shrink-0 text-muted-foreground"><SortIcon id="currency" /></span>
                </button>
              </div>
            </th>
            {cols.map((c) => (
              <th
                key={c.id}
                scope="col"
                aria-sort={ariaSort(c.id)}
                className={cn(th, c.lgOnly && 'max-lg:hidden', c.lgOnly && panelOpen && 'xl:max-2xl:hidden', 'lg:min-w-(--w)')}
                style={{ '--w': `${c.w}px` } as React.CSSProperties}
              >
                <div className={headInner(c.align)}>
                  <button type="button" onClick={() => sortBy(c.id)} className={sortBtn}>
                    {t.col[c.id]} <span className="shrink-0 text-muted-foreground"><SortIcon id={c.id} /></span>
                  </button>
                </div>
              </th>
            ))}
            <th scope="col" className={th}>
              <span className="sr-only">{t.col.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m, i) => {
            const selected = m.code === selectedCode;
            return (
              <motion.tr
                key={m.code}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: reduce ? 0 : Math.min(i, 10) * 0.035, ease: [0.22, 1, 0.36, 1] }}
                data-state={selected ? 'selected' : undefined}
                className={cn(
                  'group/row transition-colors [--row-bg:var(--card)] hover:[--row-bg:color-mix(in_oklab,var(--card),var(--muted)_40%)]',
                  selected && '[--row-bg:color-mix(in_oklab,var(--card),var(--primary)_6%)] hover:[--row-bg:color-mix(in_oklab,var(--card),var(--primary)_8%)]',
                )}
              >
                <td className={cn(tdSpecial, 'relative w-12 text-center before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full', railClass(m, selected))}>
                  <span className="flex justify-center">
                    <RowCheck checked={checked.has(m.code)} onChange={(v) => onCheck(m.code, v)} label={fill(t.selectRow, { code: m.code })} />
                  </span>
                </td>
                <td className={cn(td, 'sticky start-0 z-10', PAD[density])}>
                  <IdentityCell m={m} ctx={ctx} compact={density === 'compact'} />
                </td>
                {cols.map((c) => (
                  <td
                    key={c.id}
                    className={cn(td, PAD[density], c.align === 'end' ? 'text-end' : 'text-start', c.lgOnly && 'max-lg:hidden', c.lgOnly && panelOpen && 'xl:max-2xl:hidden')}
                  >
                    {c.render(m, ctx)}
                  </td>
                ))}
                <td className={cn(tdSpecial, PAD[density])}>
                  <RowActions m={m} ctx={ctx} />
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
