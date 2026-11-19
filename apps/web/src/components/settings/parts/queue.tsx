'use client';

/**
 * @file queue.tsx
 * @description Settings › Queue (docs/16 §9): runs at the same time, runs per day, quiet hours, the timezone, and pause all. The limits are the member's, across projects, because every run spends one plan. Words are in `queue.json` under `limits`.
 */
import { QUEUE_ISOLATIONS, type QueueIsolation } from '@hub/contracts';
import { ListOrdered } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import {
  Button,
  cn,
  Field,
  fmt,
  plural,
  SectionHeader,
  Select,
  showToast,
  Skeleton,
  TextInput,
  useLocale,
  useT,
} from '@/components/kit';
import type { QueueMessages } from '@/components/queue/words';
import { usePauseQueue, useQueue, useQueueSettings } from '@/features/queue/queries';
import type { SettingsMessages } from '@/features/settings/messages';
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
  const general = useT<SettingsMessages>('settings').general;
  const locale = useLocale();
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
  const [perDayText, setPerDayText] = useState('5');
  const [isolation, setIsolation] = useState<QueueIsolation>('worktree');

  const reset = () => {
    if (!state) return;
    setConcurrent(state.maxConcurrent);
    setPerDay(state.perDay);
    setQuietOn(state.quietHours !== null);
    if (state.quietHours) {
      setFrom(state.quietHours.from);
      setTo(state.quietHours.to);
    }
    setZone(state.timezoneSource === 'setting' ? state.timezone : MACHINE);
    setPerDayText(String(state.perDay));
    setIsolation(state.isolation);
  };
  useEffect(reset, [state]);

  // One save model with the other tabs (queue review M7): the limits save together from the bar, which shows only with unsaved changes.
  const changed = state
    ? [
        concurrent !== state.maxConcurrent,
        perDay !== state.perDay,
        (quietOn ? `${from}-${to}` : null) !==
          (state.quietHours ? `${state.quietHours.from}-${state.quietHours.to}` : null),
        (zone === MACHINE ? null : zone) !== (state.timezoneSource === 'setting' ? state.timezone : null),
        isolation !== state.isolation,
      ].filter(Boolean).length
    : 0;

  const failed = (error: unknown) =>
    showToast({ tone: 'error', message: isHubError(error) ? error.message : String(error) });
  const submit = () =>
    save.mutate(
      {
        maxConcurrent: concurrent,
        perDay,
        quietHours: quietOn ? { from, to } : null,
        timezone: zone === MACHINE ? null : zone,
        isolation,
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
                value={perDayText}
                onChange={(e) => {
                  setPerDayText(e.target.value);
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= 50) setPerDay(n);
                }}
                // Clamped when leaving the field, not on each key, so the value can be retyped (review minor 23).
                onBlur={() => {
                  const n = Math.max(1, Math.min(50, Math.round(Number(perDayText)) || 1));
                  setPerDay(n);
                  setPerDayText(String(n));
                }}
              />
            </Field>
          </FormSection>
          <FormSection title={t.isolation} description={t.isolationHint}>
            <fieldset className="flex flex-col gap-1" data-settings-isolation>
              <legend className="sr-only">{t.isolation}</legend>
              {QUEUE_ISOLATIONS.map((value) => (
                <label
                  key={value}
                  className="flex min-h-11 items-center gap-2 text-body text-foreground md:min-h-0"
                >
                  <input
                    type="radio"
                    name={`${id}-isolation`}
                    className="size-4 accent-(--primary)"
                    value={value}
                    checked={isolation === value}
                    onChange={() => setIsolation(value)}
                  />
                  {value === 'worktree' ? t.isolationWorktree : t.isolationFolder}
                </label>
              ))}
            </fieldset>
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
          </FormSection>
          <FormSection title={t.pause} description={t.pauseHint}>
            <label className="flex min-h-11 items-center gap-2 text-body text-foreground md:min-h-0">
              <input
                type="checkbox"
                className="size-4 accent-(--primary)"
                checked={state.paused}
                disabled={pause.isPending}
                onChange={(e) => {
                  const paused = e.target.checked;
                  pause.mutate(paused, {
                    onSuccess: () =>
                      showToast({ message: paused ? words.toasts.pausedAll : words.toasts.resumedAll }),
                    onError: failed,
                  });
                }}
              />
              {t.pause}
            </label>
          </FormSection>
          <div
            className={cn(
              'sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-popover p-3 shadow-md',
              changed === 0 && 'hidden',
            )}
          >
            <p role="status" className="min-w-0 flex-1 basis-40 text-body-sm font-medium text-foreground">
              {changed > 0 && plural(changed, locale, general.unsaved)}
            </p>
            <Button variant="ghost" onClick={reset}>
              {general.discard}
            </Button>
            <Button variant="primary" busy={save.isPending} onClick={submit} data-queue-save-limits>
              {t.save}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
