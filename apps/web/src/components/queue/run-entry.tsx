'use client';

/**
 * @file run-entry.tsx
 * @description Where a run starts from outside the queue page (docs/16 §9): Run now and Schedule on a task (the sheet, Do next), on a plan step (its menu), and a card's own runs on its sheet. All of them add a run through the owner's press; nothing here runs by itself (D51).
 */
import { CalendarClock, Play } from 'lucide-react';
import { useState } from 'react';

import { Button, RowMenu, Tip } from '@/components/kit';
import { useQueue } from '@/features/queue/queries';

import {
  runMenuItems,
  RunRow,
  type RunTarget,
  ScheduleDialog,
  useQueueWords,
  useRunActions,
  useRunNow,
  useRunOff,
} from './run-bits';

/** Run now and Schedule, as quiet buttons beside the card's own actions. */
export function RunButtons({
  target,
  disabledWhy,
}: {
  target: RunTarget;
  disabledWhy?: string | null | undefined;
}) {
  const t = useQueueWords();
  const runNow = useRunNow();
  const off = useRunOff();
  const [scheduling, setScheduling] = useState<RunTarget | null>(null);
  const blocked = !!off || !!disabledWhy;
  const reason = off ? t.dialog[off] : (disabledWhy ?? undefined);
  return (
    <>
      <Tip k="queue:run" off={reason ? { why: reason, fix: '' } : null} label={t.runNow}>
        <Button
          size="sm"
          variant="ghost"
          data-queue-run-now
          disabled={blocked}
          onClick={() => runNow(target)}
        >
          <Play aria-hidden className="size-3.5" strokeWidth={1.75} />
          {t.runNow}
        </Button>
      </Tip>
      <Tip k="queue:schedule" off={reason ? { why: reason, fix: '' } : null} label={t.schedule}>
        <Button
          size="sm"
          variant="ghost"
          data-queue-schedule
          disabled={blocked}
          onClick={() => setScheduling(target)}
        >
          <CalendarClock aria-hidden className="size-3.5" strokeWidth={1.75} />
          {t.schedule}
        </Button>
      </Tip>
      <ScheduleDialog target={scheduling} onClose={() => setScheduling(null)} />
    </>
  );
}

/** A plan step's menu: Run now or Schedule this one step. A step that became a task runs as that task. */
export function StepRunMenu({ cardKey, index, title }: { cardKey: string; index: number; title: string }) {
  const t = useQueueWords();
  const runNow = useRunNow();
  const off = useRunOff();
  const [scheduling, setScheduling] = useState<RunTarget | null>(null);
  const target: RunTarget = { source: 'plan_step', cardKey, planStep: index, title };
  return (
    <>
      <RowMenu
        label={t.actions.more}
        items={[
          { label: t.runNow, icon: Play, disabled: !!off, onSelect: () => runNow(target) },
          { label: t.schedule, icon: CalendarClock, disabled: !!off, onSelect: () => setScheduling(target) },
        ]}
      />
      <ScheduleDialog target={scheduling} onClose={() => setScheduling(null)} />
    </>
  );
}

/** A card's runs on its sheet: the result of each, its changed files, and its chat. Shown only when there is one. */
export function CardRuns({ cardKey }: { cardKey: string }) {
  const t = useQueueWords();
  const act = useRunActions();
  const query = useQueue({ card: cardKey });
  const runs = query.data?.runs ?? [];
  if (runs.length === 0) return null;
  return (
    <section aria-labelledby={`card-runs-${cardKey}`} data-card-runs className="flex flex-col gap-1.5">
      <h3 id={`card-runs-${cardKey}`} className="text-body-sm font-semibold text-muted-foreground">
        {t.card.title}
      </h3>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {runs.slice(0, 5).map((run) => (
          <li key={run.id} data-card-run={run.state} className="p-3">
            <RunRow run={run} menu={runMenuItems(run, t, act)} />
            {run.changedFiles.length > 0 && (
              <details className="mt-1.5 ps-6.5 text-body-sm text-muted-foreground">
                <summary className="cursor-pointer select-none">{t.card.files}</summary>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {run.changedFiles.slice(0, 50).map((file) => (
                    <li key={file.path} dir="ltr" className="key text-start [overflow-wrap:anywhere]">
                      {file.path}
                      {file.additions !== undefined && ` +${file.additions} -${file.deletions ?? 0}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
