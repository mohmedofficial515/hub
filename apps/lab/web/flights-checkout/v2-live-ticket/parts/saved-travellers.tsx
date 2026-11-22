import { Check } from 'lucide-react';
import { cn } from '@lab/utils';
import type { T } from '../i18n';
import { ageOn, LAST_DEPARTURE, type SavedTraveller } from './data';
import { focusRing } from './ui';

const AVATAR: Record<SavedTraveller['avatarColour'], string> = {
  navy: 'bg-(--brand-soft) text-(--brand-ink)',
  teal: 'bg-(--action-soft) text-(--foreground)',
  gold: 'bg-(--highlight-soft) text-(--foreground)',
  slate: 'bg-(--surface-3) text-(--foreground)',
};

/** "Who is travelling?": saved travellers as toggle chips; a chip that fits no free seat says why. */
export function SavedTravellers({
  t,
  travellers,
  isAdded,
  canAdd,
  onToggle,
}: {
  t: T;
  travellers: SavedTraveller[];
  isAdded: (id: string) => boolean;
  canAdd: (tr: SavedTraveller) => boolean;
  onToggle: (tr: SavedTraveller) => void;
}) {
  return (
    <section aria-labelledby="saved-title" className="rounded-2xl border border-(--border) bg-(--card) px-4 py-4 sm:px-6">
      <h2 id="saved-title" className="text-base font-bold text-(--brand-ink)">
        {t.saved.title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-(--ink-muted)">{t.saved.hint}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {travellers.map((tr) => {
          const added = isAdded(tr.id);
          const disabled = !added && !canAdd(tr);
          const full = `${tr.givenName} ${tr.familyName}`;
          const age = ageOn(tr.birthDate, LAST_DEPARTURE);
          const initials = `${tr.givenName[0]}${tr.familyName[0]}`;
          return (
            <li key={tr.id}>
              <button
                type="button"
                aria-pressed={added}
                disabled={disabled}
                aria-label={added ? t.saved.remove(full) : t.saved.add(full)}
                onClick={() => onToggle(tr)}
                className={cn(
                  'flex min-h-14 items-center gap-2.5 rounded-xl border bg-(--card) py-2 ps-2 pe-3 text-start transition-colors duration-150',
                  focusRing,
                  added ? 'border-2 border-(--brand) ps-[7px] pe-[11px]' : 'border-(--border-strong) hover:bg-(--surface-2)',
                  disabled && 'cursor-not-allowed opacity-55 hover:bg-(--card)',
                )}
              >
                <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-full font-mono text-sm font-bold', AVATAR[tr.avatarColour])}>
                  {added ? <Check className="size-4" strokeWidth={3} /> : initials}
                </span>
                <span className="min-w-0">
                  <bdi dir="ltr" translate="no" className="block truncate font-mono text-sm font-semibold text-(--foreground)">
                    {full}
                  </bdi>
                  <span className="block text-xs text-(--ink-muted)">
                    {disabled ? t.saved.noFit : `${age >= 18 ? t.pax.type.ADULT : t.pax.type.CHILD} · ${age}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
