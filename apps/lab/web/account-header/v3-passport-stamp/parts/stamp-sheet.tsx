import type { ReactNode } from 'react';
import { cn } from '@lab/utils';

import { LevelMark } from './account-avatar';
import { monogram, type TierCode } from './mock';
import { useAccount } from './model';
import { Postmark } from './postmark';
import { AccountDropdownPanel, MobileAccountRow } from './site-header';
import type { Controls } from './model';

const LEVELS: TierCode[] = ['BLUE', 'SILVER', 'GOLD'];
const LEVEL_NAMES = {
  ar: { BLUE: 'أزرق', SILVER: 'فضي', GOLD: 'ذهبي' },
  en: { BLUE: 'Blue', SILVER: 'Silver', GOLD: 'Gold' },
};

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-semibold text-(--ink-muted)">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'relative inline-flex h-11 cursor-pointer items-center rounded-md border px-3 text-sm font-semibold has-focus-visible:ring-2 has-focus-visible:ring-(--ring)',
              value === o.value
                ? 'border-(--brand-ink) bg-(--brand-soft) text-(--brand-ink)'
                : 'border-(--border) text-(--ink) hover:bg-(--surface-2)',
            )}
          >
            <input
              type="radio"
              name={label}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Lab-only switches; clearly fenced so nobody mistakes them for page content. */
export function LabControls({ controls, onChange }: { controls: Controls; onChange: (c: Controls) => void }) {
  const m = useAccount();
  const l = m.t.lab;
  const names = LEVEL_NAMES[m.locale];
  return (
    <section
      aria-label={l.title}
      className="rounded-2xl border border-dashed border-(--border-strong) bg-(--surface-2) p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold text-(--brand-ink)">{l.title}</h2>
        <p className="text-sm text-(--ink-muted)">{l.note}</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Segmented
          label={l.level}
          value={controls.level}
          options={LEVELS.map((v) => ({ value: v, label: names[v] }))}
          onChange={(level) => onChange({ ...controls, level })}
        />
        <Segmented
          label={l.picture}
          value={controls.picture}
          options={(['photo', 'initial', 'broken'] as const).map((v) => ({ value: v, label: l.pictures[v] }))}
          onChange={(picture) => onChange({ ...controls, picture })}
        />
        <Segmented
          label={l.state}
          value={controls.state}
          options={(['ready', 'loading', 'error'] as const).map((v) => ({ value: v, label: l.states[v] }))}
          onChange={(state) => onChange({ ...controls, state })}
        />
        <Segmented
          label={l.name}
          value={controls.script}
          options={(['arabic', 'latin'] as const).map((v) => ({ value: v, label: l.names[v] }))}
          onChange={(script) => onChange({ ...controls, script })}
        />
      </div>
    </section>
  );
}

function Cell({ caption, children, className }: { caption: string; children: ReactNode; className?: string }) {
  return (
    <figure className={cn('flex flex-col items-center gap-2', className)}>
      <div className="flex min-h-[136px] items-center justify-center">{children}</div>
      <figcaption className="text-xs font-semibold text-(--ink-muted) tabular-nums">{caption}</figcaption>
    </figure>
  );
}

/**
 * The stamp sheet: every level at 128 / 64 / 32, photo and monogram, on the card and on the navy bar; then the
 * edge states and the two menus in context.
 */
export function StampSheet() {
  const m = useAccount();
  const l = m.t.lab;
  const names = LEVEL_NAMES[m.locale];
  const initial = monogram(m.customer.name, m.customer.email);
  const photo = { url: PHOTO_FALLBACK, thumbUrl: PHOTO_FALLBACK };
  const label = (code: TierCode) => m.t.card.a11y(m.customer.name, names[code]);

  return (
    <section aria-labelledby="stamp-sheet" className="rounded-2xl border border-(--border) bg-(--card) p-4 sm:p-6">
      <h2 id="stamp-sheet" className="text-xl font-bold text-(--brand-ink)">
        {l.sheetTitle}
      </h2>
      <p className="mt-1 max-w-[62ch] text-sm text-(--ink-muted)">{l.sheetNote}</p>

      <div className="mt-6 divide-y divide-(--border)">
        {LEVELS.map((code) => (
          <div key={code} className="py-6 first:pt-0">
            <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-bold text-(--foreground)">
              <LevelMark level={code} />
              {m.t.card.level(names[code])}
              <span className="text-sm font-medium text-(--ink-muted)">{l.structure[code]}</span>
            </h3>
            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
              <Cell caption="128" className={code === 'GOLD' ? 'pe-8' : undefined}>
                <Postmark size={128} level={code} label={label(code)} initial={initial} photo={photo} memberSince={m.customer.memberSince} />
              </Cell>
              <Cell caption="128" className={code === 'GOLD' ? 'pe-8' : undefined}>
                <Postmark size={128} level={code} label={label(code)} initial={initial} memberSince={m.customer.memberSince} />
              </Cell>
              <Cell caption="64">
                <Postmark size={64} level={code} label={label(code)} initial={initial} photo={photo} />
              </Cell>
              <Cell caption="64">
                <Postmark size={64} level={code} label={label(code)} initial={initial} />
              </Cell>
              <Cell caption="32">
                <Postmark size={32} level={code} label={label(code)} initial={initial} photo={photo} />
              </Cell>
              <Cell caption="32">
                <Postmark size={32} level={code} label={label(code)} initial={initial} />
              </Cell>
              <Cell caption={`32 · ${l.onNavy}`}>
                <span data-pm-tone="brand" className="flex items-center gap-3 rounded-lg bg-(--surface-brand) px-3 py-2">
                  <Postmark size={32} tone="brand" level={code} label={label(code)} initial={initial} photo={photo} />
                  <Postmark size={32} tone="brand" level={code} label={label(code)} initial={initial} />
                </span>
              </Cell>
            </div>
          </div>
        ))}

        <div className="py-6">
          <h3 className="text-base font-bold text-(--foreground)">{l.statesTitle}</h3>
          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
            <Cell caption={l.stateLabels.loading}>
              <Postmark size={64} level="NONE" label="" initial={initial} state="loading" />
            </Cell>
            <Cell caption={l.stateLabels.none}>
              <Postmark size={64} level="NONE" label={m.customer.name} initial={initial} />
            </Cell>
            <Cell caption={l.stateLabels.other}>
              <Postmark size={64} level="OTHER" label={m.customer.name} initial={initial} />
            </Cell>
            <Cell caption={l.stateLabels.broken}>
              <Postmark
                size={64}
                level="SILVER"
                label={label('SILVER')}
                initial={initial}
                photo={{ url: 'https://files.invalid/a.webp', thumbUrl: 'https://files.invalid/a.webp' }}
              />
            </Cell>
            <Cell caption={l.stateLabels.signedOut}>
              <span className="flex items-center gap-3">
                <Postmark size={64} level="NONE" label={l.stateLabels.signedOut} initial="" state="signed-out" />
                <Postmark size={32} level="NONE" label={l.stateLabels.signedOut} initial="" state="signed-out" />
              </span>
            </Cell>
          </div>
        </div>

        <div className="pt-6">
          <h3 className="text-base font-bold text-(--foreground)">{l.contextsTitle}</h3>
          <div className="mt-4 grid gap-6 xl:grid-cols-2">
            <figure className="min-w-0">
              <figcaption className="mb-2 text-xs font-semibold text-(--ink-muted)">{l.dropdown}</figcaption>
              <AccountDropdownPanel />
            </figure>
            <figure className="min-w-0">
              <figcaption className="mb-2 text-xs font-semibold text-(--ink-muted)">{l.mobileRow}</figcaption>
              <div className="max-w-[360px] rounded-2xl bg-(--surface-2) p-4">
                <MobileAccountRow />
              </div>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

const PHOTO_FALLBACK =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop&crop=faces&q=70';
