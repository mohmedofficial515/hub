import type { MouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, ListTodo } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { CardRow } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, EmptyState, fill, fmt, HubLink, Ltr, PriorityMark, rich, SectionHead, TypeIcon } from './atoms';
import { rowIdOf } from './model';

/** "Blocked by GTV-231" → the blocker key, from the meta line the API sends. */
export const blockerOf = (c: CardRow) => /GTV-\d+/.exec(c.meta?.en ?? '')?.[0];

export function ReadyTasks({
  tasks,
  onClaim,
  onBlocked,
}: {
  tasks: CardRow[];
  onClaim: (task: CardRow, row: HTMLElement | null) => void;
  onBlocked: (task: CardRow) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <section aria-labelledby="ready-title" className="flex flex-col gap-2 md:gap-3">
      <SectionHead id="ready-title" title={t.ready.title} />
      {tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title={t.ready.emptyTitle}>
          {t.ready.emptyBody}{' '}
          <HubLink to="/tasks?status=backlog" className="font-medium text-primary underline underline-offset-4">
            {t.ready.emptyLink}
          </HubLink>
        </EmptyState>
      ) : (
        <ul data-list="ready" data-keep-toast className="flex flex-col divide-y divide-border">
          <AnimatePresence initial={false} mode="popLayout">
            {tasks.map((task) => {
              const blocked = !!task.flags?.blocked;
              const blocker = blocked ? blockerOf(task) : undefined;
              const titleId = `ready-${task.key}`;
              const blockId = `ready-${task.key}-blocked`;
              return (
                <motion.li
                  key={task.key}
                  layout="position"
                  exit={{ opacity: 0, transition: { duration: 0.16 } }}
                  transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  id={rowIdOf(task.key)}
                  data-row
                  tabIndex={-1}
                  aria-labelledby={titleId}
                  className="relative grid scroll-my-24 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-3 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:gap-x-4"
                >
                  <TypeIcon type="task" className={cn('self-start', blocked && 'opacity-60')} />
                  <div className="min-w-0">
                    <p id={titleId} className="text-title-sm font-semibold text-pretty text-foreground">
                      <HubLink data-row-open to={`/cards/${task.key}`} className="underline-offset-4 after:absolute after:inset-0 hover:underline">
                        {rich(task.title[locale])}
                      </HubLink>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-body-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Ltr mono className="text-caption">
                          {task.key}
                        </Ltr>
                        <PriorityMark p={task.priority} className="text-caption" />
                      </span>
                      {task.specialty && <span>{t.ready.specialty[task.specialty]}</span>}
                      {task.effort && (
                        <span className="inline-flex items-center gap-1">
                          <span className="sr-only">{t.ready.effort}</span>
                          <Ltr mono className="rounded-sm bg-muted px-1 text-caption text-foreground">
                            {task.effort}
                          </Ltr>
                        </span>
                      )}
                      {blocked && blocker && (
                        <span id={blockId} className="inline-flex items-center gap-1 font-medium text-foreground">
                          <Ban aria-hidden className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                          {fill(t.ready.blockedBy, { key: <Ltr mono className="text-caption">{blocker}</Ltr> })}
                        </span>
                      )}
                    </p>
                  </div>
                  {/* aria-disabled, not disabled: a blocked Claim stays focusable and says why when pressed. */}
                  <Button
                    size="sm"
                    data-claim
                    aria-disabled={blocked || undefined}
                    aria-describedby={blocked ? blockId : undefined}
                    aria-label={fmt(t.ready.claimTask, { key: task.key })}
                    aria-keyshortcuts="c"
                    className={cn('relative z-10 min-w-16', blocked && 'border-border text-muted-foreground hover:bg-card')}
                    onClick={(e: MouseEvent<HTMLButtonElement>) => {
                      if (blocked) onBlocked(task);
                      else onClaim(task, e.currentTarget.closest<HTMLElement>('[data-row]'));
                    }}
                  >
                    {t.ready.claim}
                  </Button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
