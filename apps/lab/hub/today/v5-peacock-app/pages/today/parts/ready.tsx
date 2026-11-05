import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, ListTodo } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { AppLink, Button, CardRow, cn, EmptyState, fill, fmt, focusRing, Ltr, openBlockers, Pill, SectionHeader, showToast, useKeyboardList, usePerformAction, type TaskCard } from '../../../kit';
import { messages } from '../i18n';

export function ReadyTasks({ tasks }: { tasks: TaskCard[] }) {
  const t = useT(messages);
  const locale = useLocale();
  const perform = usePerformAction();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const claim = (key: string) => {
    const task = tasks.find((row) => row.key === key);
    if (!task) return;
    const blocker = openBlockers(task)[0];
    if (blocker) {
      // `c` on a blocked row answers instead of doing nothing (review, minor).
      showToast({
        tone: 'error',
        message: fill(t.ready.blockedToast, { key: <Ltr mono>{task.key}</Ltr>, blocker: <Ltr mono>{blocker}</Ltr> }),
      });
      return;
    }
    perform(task.key, 'claim');
  };

  const list = useKeyboardList({ ids: tasks.map((row) => row.key), emptyFocusRef: headingRef, actions: { c: claim } });

  return (
    <section aria-labelledby="ready-title" className="flex flex-col gap-3">
      <SectionHeader ref={headingRef} id="ready-title" icon={ListTodo} title={t.ready.title} count={tasks.length} />
      {tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title={t.ready.emptyTitle}>
          {t.ready.emptyBody}{' '}
          <AppLink view="tasks" query={{ status: 'backlog' }} className={cn('rounded-sm font-medium text-primary underline underline-offset-4', focusRing)}>
            {t.ready.emptyLink}
          </AppLink>
        </EmptyState>
      ) : (
        <ul data-hub-list className="overflow-hidden rounded-lg border border-border bg-card">
          <AnimatePresence initial={false} mode="popLayout">
            {tasks.map((task) => {
              const blocker = openBlockers(task)[0];
              const blockId = `ready-${task.key}-blocked`;
              return (
                <motion.li key={task.key} layout="position" exit={{ opacity: 0, transition: { duration: 0.16 } }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} className="border-b border-border last:border-b-0">
                  <CardRow
                    {...list.rowProps(task.key)}
                    variant="flush"
                    cardKey={task.key}
                    type={task.type}
                    title={task.title[locale]}
                    priority={task.priority}
                    titleId={`ready-${task.key}`}
                    className="border-b-0"
                    meta={
                      <>
                        <span>{t.ready.specialty[task.task.specialty]}</span>
                        {task.task.effort && (
                          <span className="inline-flex items-center gap-1">
                            <span className="sr-only">{t.ready.effort}</span>
                            <Ltr mono className="rounded-sm bg-muted px-1 text-caption text-foreground">
                              {task.task.effort}
                            </Ltr>
                          </span>
                        )}
                        {blocker && (
                          <Pill icon={Ban}>
                            <span id={blockId}>{fill(t.ready.blockedBy, { key: <Ltr mono>{blocker}</Ltr> })}</span>
                          </Pill>
                        )}
                      </>
                    }
                    action={
                      <Button
                        disabled={!!blocker}
                        aria-describedby={blocker ? blockId : undefined}
                        aria-label={fmt(t.ready.claimTask, { key: task.key })}
                        aria-keyshortcuts="c"
                        onClick={() => claim(task.key)}
                      >
                        {t.ready.claim}
                      </Button>
                    }
                  />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
