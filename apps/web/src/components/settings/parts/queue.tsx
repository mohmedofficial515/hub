'use client';

/**
 * @file queue.tsx
 * @description Settings › Queue (docs/16 §9): runs at the same time, runs per day, quiet hours, the timezone, and pause all. The limits are the member's, across projects, because every run spends one plan. Words are in `queue.json` under `limits`.
 */
import { ListOrdered } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import {
  Button,
  Field,
  fmt,
  SectionHeader,
  Select,
  showToast,
  Skeleton,
  TextInput,
  useT,
} from '@/components/kit';
import type { QueueMessages } from '@/components/queue/words';
import { usePauseQueue, useQueue, useQueueSettings } from '@/features/queue/queries';
import { isHubError } from '@/lib/api/errors';

import { FormSection } from './shared';

const MACHINE = '';

function zones(current: string): string[] {
  const all =
    (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  return all.includes(current) || !current ? all : [current, ...all];
}

export function QueueTab() {
  const words = useT<QueueMessages>('queue');
  const t = words.limits;
  const id = useId();
  const query = useQueue();
  const save = useQueueSettings();
  const pause = usePauseQueue();
  const state = query.data?.state;
  const [concurrent, setConcurrent] = useState(1);
  const [perDay, setPerDay] = useState(5);
  const [quietOn, setQuietOn] = useState(false);
  const [from, setFrom] = useState('22:00');
  const [to, setTo] = useState('07:00');
  const [zone, setZone] = useState(MACHINE);

  useEffect(() => {
    if (!state) return;
    setConcurrent(state.maxConcurrent);
    setPerDay(state.perDay);
    setQuietOn(state.quietHours !== null);
    if (state.quietHours) {
      setFrom(state.quietHours.from);
      setTo(state.quietHours.to);
    }
    setZone(state.timezoneSource === 'setting' ? state.timezone : MACHINE);
  }, [state]);

  const failed = (error: unknown) =>
    showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) });
  const submit = () =>
    save.mutate(
      {
        maxConcurrent: concurrent,
        perDay,
        quietHours: quietOn ? { from, to } : null,
        timezone: zone === MACHINE ? null : zone,
      },
      { onSuccess: () => showToast({ message: words.toasts.saved }), onError: failed },
    );

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3" data-settings-queue>
      <SectionHeader id={`${id}-title`} icon={ListOrdered} title={t.title} />
      <p className="max-w-prose text-body-sm text-muted-foreground">{t.intro}</p>
      {!state ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <FormSection title={t.concurrent}>
            <Field id={`${id}-concurrent`} label={t.concurrent}>
              <Select
                id={`${id}-concurrent`}
                className="max-w-32"
                value={concurrent}
                onChange={(e) => setConcurrent(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={`${id}-per-day`} label={t.perDay}>
              <TextInput
                id={`${id}-per-day`}
                type="number"
                inputMode="numeric"
                dir="ltr"
                min={1}
                max={50}
                className="max-w-32"
                value={perDay}
                onChange={(e) => setPerDay(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              />
            </Field>
          </FormSection>
          <FormSection title={t.quiet}>
            <label className="flex min-h-11 items-center gap-2 text-body text-foreground md:min-h-0">
              <input
                type="checkbox"
                className="size-4 accent-(--primary)"
                checked={quietOn}
                onChange={(e) => setQuietOn(e.target.checked)}
              />
              {t.quietOn}
            </label>
            {quietOn && (
              <div className="grid max-w-sm grid-cols-2 gap-3">
                <Field id={`${id}-from`} label={t.from}>
                  <TextInput
                    id={`${id}-from`}
                    type="time"
                    dir="ltr"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </Field>
                <Field id={`${id}-to`} label={t.to}>
                  <TextInput
                    id={`${id}-to`}
                    type="time"
                    dir="ltr"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </FormSection>
          <FormSection title={t.timezone} description={t.timezoneHint}>
            <Field id={`${id}-zone`} label={t.timezone}>
              <Select
                id={`${id}-zone`}
                dir="ltr"
                className="text-start"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              >
                <option value={MACHINE}>{fmt(t.machine, { zone: state.machineTimezone })}</option>
                {zones(zone).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <Button variant="primary" busy={save.isPending} onClick={submit} data-queue-save-limits>
                {t.save}
              </Button>
            </div>
          </FormSection>
          <FormSection title={t.pause} description={t.pauseHint}>
            <label className="flex min-h-11 items-center gap-2 text-body text-foreground md:min-h-0">
              <input
                type="checkbox"
                className="size-4 accent-(--primary)"
                checked={state.paused}
                disabled={pause.isPending}
                onChange={(e) => pause.mutate(e.target.checked, { onError: failed })}
              />
              {t.pause}
            </label>
          </FormSection>
        </>
      )}
    </section>
  );
}
