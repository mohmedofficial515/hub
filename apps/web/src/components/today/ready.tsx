'use client';

/**
 * @file ready.tsx
 * @description Tasks I could take now. `GET /tasks/ready` leaves blocked ones out, so every row here can be claimed.
 */
import { seesAllReadyWork } from '@hub/contracts';
import { AnimatePresence, motion } from 'framer-motion';
import { ListTodo } from 'lucide-react';
import { useRef } from 'react';

import {
  AppLink,
  Button,
  type CardListItem,
  CardRow,
  cn,
  EmptyState,
  fmt,
  focusRing,
  Ltr,
  plural,
  SectionHeader,
  type TaskCard,
  useKeyboardList,
  useLocale,
  usePerformAction,
  useSession,
  useT,
} from '@/components/kit';

import { NS, type TodayMessages } from './messages';

export function ReadyTasks({
  tasks,
  inNext = 0,
  fillFirst = false,
}: {
  tasks: (CardListItem & { task?: Partial<TaskCard['task']> | undefined })[];
  /** Ready tasks left out because "Start with these" above already shows them (owner decision 4). They still count in the title. */
  inNext?: number;
  /** The page's one filled button lands here when nothing above it asks for it. */
  fillFirst?: boolean;
}) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  const seesAll = seesAllReadyWork(useSession().roles);
  const perform = usePerformAction();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const list = useKeyboardList({
    ids: tasks.map((row) => row.key),
    emptyFocusRef: headingRef,
    actions: { c: (key) => perform(key, 'claim') },
  });

  return (
    <section aria-labelledby="ready-title" className="flex flex-col gap-3">
      <SectionHeader
        ref={headingRef}
        id="ready-title"
        icon={ListTodo}
        title={seesAll ? plural(tasks.length + inNext, locale, t.ready.titleProject) : t.ready.title}
        {...(seesAll ? {} : { count: tasks.length + inNext })}
      />
      <p data-today-ready-subtitle className="-mt-2 text-body-sm text-muted-foreground">
        {plural(inNext, locale, t.ready.subtitle)}
      </p>
      {tasks.length === 0 && inNext > 0 ? null : tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title={seesAll ? t.ready.emptyTitleProject : t.ready.emptyTitle}>
          {seesAll ? t.ready.emptyBodyProject : t.ready.emptyBody}{' '}
          <AppLink
            view="tasks"
            query={{ status: 'backlog' }}
            className={cn(
              'hit-44 rounded-sm font-medium text-primary underline underline-offset-4',
              focusRing,
            )}
          >
            {t.ready.emptyLink}
          </AppLink>
        </EmptyState>
      ) : (
        <ul data-hub-list className="overflow-hidden rounded-lg border border-border bg-card">
          <AnimatePresence initial={false} mode="popLayout">
            {tasks.map((task) => (
              <motion.li
                key={task.key}
                layout="position"
                exit={{ opacity: 0, transition: { duration: 0.16 } }}
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                className="border-b border-border last:border-b-0"
              >
                <CardRow
                  {...list.rowProps(task.key)}
                  variant="flush"
                  cardKey={task.key}
                  type={task.type}
                  title={task.title}
                  priority={task.priority}
                  titleId={`ready-${task.key}`}
                  className="border-b-0"
                  meta={
                    <>
                      {task.task?.specialty && <span>{t.ready.specialty[task.task.specialty]}</span>}
                      {task.task?.effort && (
                        <span className="inline-flex items-center gap-1">
                          <span className="sr-only">{t.ready.effort}</span>
                          <Ltr mono className="rounded-sm bg-muted px-1 text-caption text-foreground">
                            {task.task.effort}
                          </Ltr>
                        </span>
                      )}
                    </>
                  }
                  action={
                    <Button
                      variant={fillFirst && task.key === tasks[0]?.key ? 'primary' : 'outline'}
                      aria-label={fmt(t.ready.claimTask, { key: task.key })}
                      aria-keyshortcuts="c"
                      onClick={() => perform(task.key, 'claim')}
                    >
                      {t.ready.claim}
                    </Button>
                  }
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
