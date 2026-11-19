// Sticky save bar of a group page: always present. Up to date → "v9 · Sara Haddad · 2 hours ago";
// with changes → "3 unsaved changes" + Discard + Review & save (kept enabled, Primer). Mentions drafts in other groups.

import { CheckCircle2 } from 'lucide-react';
import type { SettingsGroup } from '@lab/mocks/settings';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { fmtNumber, fmtRelative, loc } from './format';
import { entryOf } from './model';
import { useStore } from './store';
import { navigate } from './route';
import { Btn, focusRing } from './ui';

export function SaveBar({
  group,
  dirty,
  otherDirty,
  onReview,
  onDiscard,
}: {
  group: SettingsGroup;
  dirty: number;
  otherDirty: number;
  onReview: () => void;
  onDiscard: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const latest = store.history(group.key)[0];
  const names = Object.keys(store.drafts[group.key] ?? {})
    .map((k) => entryOf(group.key, k))
    .filter(Boolean)
    .map((e) => loc(e!.field.label, locale));
  return (
    <div
      role="region"
      aria-label={t.save.region}
      className={cn(
        'sticky bottom-[var(--settings-sticky-bottom,0px)] z-30 -mx-4 mt-10 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6',
        dirty ? 'border-border bg-card/95 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.18)]' : 'border-border bg-background/92',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {dirty ? (
          <>
            <div className="min-w-0 flex-1 basis-56" aria-live="polite">
              <p className="flex items-center gap-2 text-14 font-bold">
                <span aria-hidden className="size-2 rounded-full bg-warning-strong" />
                {t.n.unsaved(dirty)}
              </p>
              <p className="mt-0.5 truncate text-12 text-muted-foreground">{new Intl.ListFormat(locale, { style: 'narrow' }).format(names.slice(0, 3))}{names.length > 3 ? ` ${t.value.more(names.length - 3)}` : ''}</p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Btn variant="ghost" onClick={onDiscard} className="flex-1 sm:flex-none">
                {t.save.discard}
              </Btn>
              <Btn variant="primary" onClick={onReview} className="flex-[2] sm:flex-none">
                {t.save.review}
              </Btn>
            </div>
          </>
        ) : (
          <p className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-13 text-muted-foreground">
            <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />
            <span className="truncate">
              {t.save.upToDate(fmtNumber(store.version(group.key), locale), latest?.by ?? group.updatedBy, fmtRelative(latest?.at ?? group.updatedAt, locale))}
            </span>
          </p>
        )}
        {otherDirty > 0 && (
          <button
            type="button"
            onClick={() => navigate({ view: 'home' })}
            className={cn('inline-flex min-h-11 w-full items-center rounded-lg px-1 text-start text-12 font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground sm:w-auto xl:min-h-10', focusRing)}
          >
            {t.save.otherGroups(otherDirty)}
          </button>
        )}
      </div>
    </div>
  );
}
