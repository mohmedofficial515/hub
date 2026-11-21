import { AnimatePresence, motion } from 'framer-motion';
import { Ban, ListTodo } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { CardRow } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, EmptyState, fill, fmt, HubLink, Ltr, Pill, PriorityBadge, SectionHead } from './atoms';

/** "Blocked by GTV-231" → the blocker key, from the meta line the API sends. */
const blockerOf = (c: CardRow) => /GTV-\d+/.exec(c.meta?.en ?? '')?.[0];

export function ReadyTasks({ tasks, onClaim }: { tasks: CardRow[]; onClaim: (c: CardRow) => void }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <section aria-labelledby="ready-title" className="flex flex-col gap-4">
      <SectionHead id="ready-title" icon={ListTodo} title={t.ready.title} count={tasks.length} />
      {tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title={t.ready.emptyTitle}>
          {t.ready.emptyBody}{' '}
          <HubLink to="/tasks?status=backlog" className="font-medium text-primary underline underline-offset-4">
            {t.ready.emptyLink}
          </HubLink>
        </EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
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
                  data-row
                  data-claim={blocked ? undefined : task.key}
                  tabIndex={-1}
                  aria-labelledby={titleId}
                  className="relative flex min-h-16 items-center gap-3 border-b border-border px-4 py-3 outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <PriorityBadge p={task.priority} className="self-start ring-1 ring-border md:self-center" />
                  <div className="min-w-0 flex-1">
                    <p id={titleId} className="flex flex-wrap items-baseline gap-x-2 text-body">
                      <Ltr mono className="text-caption text-muted-foreground">
                        {task.key}
                      </Ltr>
                      <HubLink to={`/cards/${task.key}`} className="font-medium text-foreground underline-offset-4 after:absolute after:inset-0 hover:underline">
                        {task.title[locale]}
                      </HubLink>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-muted-foreground">
                      {task.specialty && <span>{t.ready.specialty[task.specialty]}</span>}
                      {task.effort && (
                        <span className="inline-flex items-center gap-1">
                          <span className="sr-only">{t.ready.effort}</span>
                          <Ltr mono className="rounded-sm bg-muted px-1 text-foreground">
                            {task.effort}
                          </Ltr>
                        </span>
                      )}
                      {blocked && blocker && (
                        <Pill tone="muted" icon={Ban} className="bg-muted">
                          <span id={blockId}>{fill(t.ready.blockedBy, { key: <Ltr mono>{blocker}</Ltr> })}</span>
                        </Pill>
                      )}
                      {!blocked && task.meta && <span>{task.meta[locale]}</span>}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={blocked}
                    aria-describedby={blocked ? blockId : undefined}
                    aria-label={fmt(t.ready.claimTask, { key: task.key })}
                    aria-keyshortcuts="c"
                    className="relative z-10"
                    onClick={() => onClaim(task)}
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
