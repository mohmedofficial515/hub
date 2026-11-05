import { AnimatePresence, motion } from 'framer-motion';
import { Ban, ChevronDown, ListTodo } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { CardRow } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, CardKey, Chip, CopyButton, EmptyNote, fill, fmt, HubLink, Ltr, PriorityTag, RowDetails, rowTitle, Tile, TileHead, Title } from './atoms';

/** "Blocked by GTV-231" → the blocker key, from the meta line the API sends. */
export const blockerOf = (c: CardRow) => /GTV-\d+/.exec(c.meta?.en ?? '')?.[0];

const ease = [0.2, 0.8, 0.2, 1] as const;

export function ReadyTasks({
  tasks,
  expanded,
  onToggle,
  onClaim,
  className,
}: {
  tasks: CardRow[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onClaim: (c: CardRow) => void;
  className?: string;
}) {
  const t = useT(messages);
  const locale = useLocale();

  if (tasks.length === 0) {
    // No item to pick up: the tile stands down from solid orange to paper with an orange rule.
    return (
      <Tile rule="orange" labelledBy="ready-title" className={className}>
        <TileHead id="ready-title" title={t.ready.title} />
        <div className="mt-3">
          <EmptyNote icon={ListTodo} title={t.ready.emptyTitle}>
            {t.ready.emptyBody}{' '}
            <HubLink to="/tasks?status=backlog" className="font-semibold text-(--t-accent) underline underline-offset-4">
              {t.ready.emptyLink}
            </HubLink>
          </EmptyNote>
        </div>
      </Tile>
    );
  }

  const shown = tasks.slice(0, 10);

  return (
    <Tile tone="orange" labelledBy="ready-title" className={className}>
      <TileHead id="ready-title" title={t.ready.title} count={tasks.length} />
      <ul className="mt-3 flex flex-col">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((task, index) => {
            const blocked = !!task.flags?.blocked;
            const blocker = blocked ? blockerOf(task) : undefined;
            const titleId = `t-${task.key}`;
            const panelId = `d-${task.key}`;
            const blockId = `b-${task.key}`;
            const open = expanded.has(task.key);
            return (
              <motion.li
                key={task.key}
                layout="position"
                exit={{ opacity: 0, transition: { duration: 0.16 } }}
                transition={{ duration: 0.22, ease }}
                className={cn(index > 0 && 'border-t border-t-(--t-line)')}
              >
                <article
                  data-row
                  data-claim={task.key}
                  aria-labelledby={titleId}
                  className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 rounded-lg px-2 py-3 hover:bg-(--t-hover) md:-mx-2"
                >
                  <h3 className="min-w-0 text-title-sm font-semibold text-pretty">
                    <button
                      id={titleId}
                      data-row-title
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => onToggle(task.key)}
                      className={rowTitle}
                    >
                      <Title text={task.title[locale]} />
                    </button>
                  </h3>
                  <Button
                    disabled={blocked}
                    aria-describedby={blocked ? blockId : undefined}
                    aria-label={fmt(t.ready.claimTask, { key: task.key })}
                    aria-keyshortcuts="c"
                    className={cn(
                      'relative z-10 col-start-2 row-span-2 row-start-1 min-w-18 self-center',
                      // A disabled action stays readable: dashed and muted rather than faded away.
                      blocked && 'cursor-not-allowed border-dashed border-(--t-muted) text-(--t-muted) hover:bg-transparent',
                    )}
                    onClick={() => onClaim(task)}
                  >
                    {t.ready.claim}
                  </Button>
                  <div className="col-start-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-(--t-muted)">
                    <CardKey k={task.key} />
                    <PriorityTag p={task.priority} />
                    {task.specialty && <span>{t.ready.specialty[task.specialty]}</span>}
                    {task.effort && (
                      <span>
                        <span className="sr-only">{t.ready.effort} </span>
                        <Ltr mono className="rounded-sm bg-(--t-chip) px-1 text-caption text-(--t-fg)">
                          {task.effort}
                        </Ltr>
                      </span>
                    )}
                    {blocked && blocker && (
                      <span id={blockId} className="inline-flex items-center gap-1 font-semibold text-(--t-fg)">
                        <Ban aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
                        <span>{fill(t.ready.blockedBy, { key: <Ltr mono>{blocker}</Ltr> })}</span>
                      </span>
                    )}
                    <ChevronDown
                      aria-hidden
                      strokeWidth={1.75}
                      className={cn(
                        'size-4 shrink-0 opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100 motion-reduce:transition-none',
                        open && 'rotate-180 opacity-100',
                      )}
                    />
                  </div>
                  {open && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.14 }} className="col-span-full">
                      <RowDetails
                        id={panelId}
                        rows={[
                          ...(task.meta ? [{ label: t.needs.fieldNote, value: task.meta[locale] }] : []),
                          ...(task.ownerRole ? [{ label: t.needs.fieldFor, value: t.roles[task.ownerRole] }] : []),
                        ]}
                        actions={
                          <>
                            <HubLink to={`/cards/${task.key}`} className="text-body-sm font-semibold text-(--t-accent) underline underline-offset-4">
                              {t.row.openCard}
                            </HubLink>
                            <CopyButton text={task.key} />
                          </>
                        }
                      />
                    </motion.div>
                  )}
                </article>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {tasks.length > 10 && (
        <HubLink to="/tasks?status=ready&mine=1" className="mt-3 inline-block text-body-sm font-semibold underline underline-offset-4">
          {fill(t.ready.seeAll, { total: <Ltr>{tasks.length}</Ltr> })}
        </HubLink>
      )}
    </Tile>
  );
}
