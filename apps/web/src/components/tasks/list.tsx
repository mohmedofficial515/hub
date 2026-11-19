'use client';

/**
 * @file list.tsx
 * @description Ported from v5 `pages/tasks/parts/list.tsx`. 09 §6 List view: a real table with column sort. On a phone a ten-column table
 * helps no one, so it becomes `CardRow`s.
 */
import { isAllowed } from '@hub/contracts';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import {
  ActorChip,
  AppLink,
  Bidi,
  CardRow,
  cn,
  fmt,
  focusRing,
  focusRingInset,
  kitMessages,
  Ltr,
  PriorityBadge,
  RelativeTime,
  Select,
  setQuery,
  showToast,
  StatusBadge,
  type TaskCard,
  updateCard,
  useLocale,
  usePageWide,
  useSession,
  useT,
  when,
} from '@/components/kit';
import type { Priority } from '@/features/cards/types';
import { isFinished, PRIORITIES, type SortKey } from '@/features/tasks/model';
import { isHubError } from '@/lib/api/errors';

import type { TaskMessages } from './messages';
import { MoveButton, type OnMove, TaskFacts, TaskSignals } from './task-bits';

function SortHead({
  id,
  label,
  sort,
  desc,
  className,
}: {
  id: SortKey;
  label: string;
  sort: SortKey | null;
  desc: boolean;
  className?: string | undefined;
}) {
  const t = useT<TaskMessages>('tasks');
  const active = sort === id;
  const Icon = active ? (desc ? ArrowDown : ArrowUp) : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
      className={cn('px-2.5 py-2 text-start font-medium', className)}
    >
      <button
        type="button"
        aria-label={fmt(t.table.sortBy, { name: label })}
        // Ascending, then descending, then back to the default order: open work first, then the backlog, then finished (review M5, R9).
        onClick={() =>
          setQuery(
            !active
              ? { sort: id, order: null }
              : desc
                ? { sort: null, order: null }
                : { sort: id, order: 'desc' },
          )
        }
        className={cn(
          'inline-flex items-center gap-1 rounded-sm whitespace-nowrap hover:text-foreground',
          active && 'text-foreground',
          focusRing,
        )}
      >
        {label}
        <Icon aria-hidden className="size-3.5" strokeWidth={1.75} />
      </button>
    </th>
  );
}

/** Columns a page narrower than 80rem (1440 px with the sidebar) leaves out, so the action column is never cut off. The sheet still shows them. */
const roomy = 'hidden @min-[80rem]:table-cell';

const None = ({ label }: { label: string }) => <span aria-label={label}>—</span>;

export function TaskList({
  tasks,
  sort,
  desc,
  rowProps,
  onMove,
  canMove,
  primaryKey,
}: {
  tasks: TaskCard[];
  sort: SortKey | null;
  desc: boolean;
  rowProps: (id: string) => Record<string, unknown>;
  onMove: OnMove;
  canMove: boolean;
  primaryKey?: string | undefined;
}) {
  const t = useT<TaskMessages>('tasks');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { roles } = useSession();
  const wide = usePageWide(768);
  const canPrioritise = isAllowed('card.edit_routing', roles);

  if (!wide) {
    return (
      <ul data-hub-list className="flex flex-col gap-2">
        {tasks.map((card) => (
          <li key={card.key}>
            <CardRow
              {...rowProps(card.key)}
              cardKey={card.key}
              type="task"
              title={card.title}
              priority={card.priority}
              titleId={`task-${card.key}`}
              hideType
              meta={
                <>
                  <StatusBadge status={card.status} />
                  <TaskFacts card={card} />
                  {canMove && (
                    <span className="relative z-10 mt-1 basis-full empty:hidden">
                      <MoveButton card={card} onMove={onMove} full primary={card.key === primaryKey} />
                    </span>
                  )}
                </>
              }
            />
          </li>
        ))}
      </ul>
    );
  }

  const setPriority = (key: string, priority: Priority) =>
    void updateCard(key, { priority }).catch((error: unknown) =>
      showToast({ tone: 'error', message: isHubError(error) ? error.message : kit.actionFailed }),
    );

  const head = 'px-2.5 py-2 text-start font-medium';
  const cell = 'px-2.5 py-2.5 align-top';
  return (
    // The wrapper scrolls by itself at 768 px, so it can take focus and be scrolled by keyboard.
    <div
      tabIndex={0}
      role="region"
      aria-label={t.table.caption}
      className={cn('relative overflow-x-auto rounded-lg border border-border bg-card', focusRingInset)}
    >
      <table className="w-full min-w-200 border-collapse text-body-sm">
        <caption className="sr-only">{t.table.caption}</caption>
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            <SortHead id="key" label={t.table.key} sort={sort} desc={desc} />
            <th scope="col" className={head}>
              {t.table.task}
            </th>
            <th scope="col" className={head}>
              {t.table.specialty}
            </th>
            <th scope="col" className={head}>
              {t.table.effort}
            </th>
            <SortHead id="priority" label={t.table.priority} sort={sort} desc={desc} />
            <SortHead id="status" label={t.table.status} sort={sort} desc={desc} />
            <th scope="col" className={head}>
              {t.table.assignee}
            </th>
            <th scope="col" className={cn(head, roomy)}>
              {t.table.branch}
            </th>
            <SortHead id="due" label={t.table.due} sort={sort} desc={desc} />
            <SortHead id="updated" label={t.table.updated} sort={sort} desc={desc} className={roomy} />
            {canMove && (
              <th scope="col" className={head}>
                <span className="sr-only">{t.table.action}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {tasks.map((card) => {
            const branch = card.task.branch ?? card.branch;
            const pr = card.task.prUrl ? /(\d+)\/?$/.exec(card.task.prUrl)?.[1] : undefined;
            return (
              <tr
                key={card.key}
                {...rowProps(card.key)}
                aria-labelledby={`task-${card.key}`}
                className="border-b border-border outline-none transition-colors duration-120 last:border-b-0 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <td className={cn(cell, 'whitespace-nowrap')}>
                  <Ltr mono className="text-caption text-muted-foreground">
                    {card.key}
                  </Ltr>
                </td>
                <td className={cn(cell, 'min-w-60')}>
                  <AppLink
                    id={`task-${card.key}`}
                    card={card.key}
                    className={cn(
                      'rounded-sm font-medium text-foreground underline-offset-4 hover:underline',
                      focusRing,
                    )}
                  >
                    <Bidi>{card.title}</Bidi>
                  </AppLink>
                  <TaskSignals card={card} />
                </td>
                <td className={cn(cell, 'whitespace-nowrap text-muted-foreground')}>
                  {kit.sheet.task.specialties[card.task.specialty]}
                </td>
                <td className={cell}>
                  {card.task.effort && (
                    <Ltr mono className="rounded-sm bg-muted px-1 text-caption text-foreground">
                      {card.task.effort}
                    </Ltr>
                  )}
                </td>
                <td className="px-2.5 py-2 align-top">
                  {/* 09 §6: owner and pm edit priority in place. */}
                  {canPrioritise && !isFinished(card) ? (
                    <label>
                      <span className="sr-only">{fmt(t.table.setPriority, { key: card.key })}</span>
                      <Select
                        value={card.priority}
                        onChange={(e) => setPriority(card.key, e.target.value as Priority)}
                        className="key h-8 w-auto border-transparent bg-transparent ps-1 pe-0 text-caption hover:border-input md:h-8"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : (
                    <PriorityBadge priority={card.priority} />
                  )}
                </td>
                <td className={cn(cell, 'whitespace-nowrap')}>
                  <StatusBadge status={card.status} />
                </td>
                <td className={cn(cell, 'whitespace-nowrap text-muted-foreground')}>
                  {card.assigneeId ? <ActorChip memberId={card.assigneeId} /> : <None label={t.table.none} />}
                </td>
                <td className={cn(cell, roomy, 'max-w-36 text-muted-foreground')}>
                  {pr ? (
                    <Ltr mono className="text-caption">
                      #{pr}
                    </Ltr>
                  ) : branch ? (
                    <code
                      dir="ltr"
                      translate="no"
                      title={branch}
                      className="key block truncate text-start text-caption"
                    >
                      {branch}
                    </code>
                  ) : (
                    <None label={t.table.none} />
                  )}
                </td>
                <td className={cn(cell, 'whitespace-nowrap text-muted-foreground')}>
                  {card.dueAt ? when(card.dueAt, locale) : <None label={t.table.none} />}
                </td>
                <td className={cn(cell, roomy, 'whitespace-nowrap text-muted-foreground')}>
                  <RelativeTime iso={card.lastEventAt} />
                </td>
                {canMove && (
                  <td className="px-2.5 py-1.5 align-top whitespace-nowrap">
                    <MoveButton card={card} onMove={onMove} primary={card.key === primaryKey} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
