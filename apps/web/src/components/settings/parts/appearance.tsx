'use client';

/**
 * @file appearance.tsx
 * @description Appearance, for every member: light or dark, and the text size of every page. Both live in cookies, so the first paint is already right,
 * and both apply at once, with a live preview here.
 */
import { Moon, Palette, Sun, Type } from 'lucide-react';

import { cn, focusRing, SectionHeader, Segmented, useT } from '@/components/kit';
import type { SettingsMessages } from '@/features/settings/messages';
import { FONT_SIZES, type FontSize, setFontSize, setTheme, useFontSize, useTheme } from '@/lib/theme';

export function AppearanceTab() {
  const a = useT<SettingsMessages>('settings').appearance;
  const theme = useTheme();
  const size = useFontSize();
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="theme-title" className="flex flex-col gap-3">
        <SectionHeader id="theme-title" icon={Palette} title={a.theme} />
        <div className="grid gap-3 sm:grid-cols-2">
          {(['light', 'dark'] as const).map((value) => {
            const Icon = value === 'light' ? Sun : Moon;
            const on = theme === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => setTheme(value)}
                className={cn(
                  'group flex flex-col gap-3 rounded-2xl border p-3 text-start transition-[border-color,box-shadow] duration-200',
                  on
                    ? 'border-primary shadow-md ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/40',
                  focusRing,
                )}
              >
                {/* A miniature of the frame in that theme: the aurora, a glass sidebar and two glass cards. */}
                <span
                  aria-hidden
                  className={cn(
                    'aurora flex h-24 gap-2 overflow-hidden rounded-xl border border-border p-2',
                    value,
                  )}
                >
                  <span className="glass-chrome w-8 rounded-lg border border-border" />
                  <span className="flex flex-1 flex-col gap-2">
                    <span className="glass h-7 rounded-lg" />
                    <span className="glass flex-1 rounded-lg" />
                  </span>
                </span>
                <span className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                  <Icon aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  {a.themes[value]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="font-title" className="flex flex-col gap-3">
        <SectionHeader id="font-title" icon={Type} title={a.font} />
        <p className="max-w-prose text-body-sm text-muted-foreground">{a.fontHint}</p>
        <Segmented<FontSize>
          label={a.font}
          value={size}
          options={FONT_SIZES.map((value) => ({ value, label: a.sizes[value] }))}
          onChange={setFontSize}
          className="self-start"
        />
        <div className="glass flex flex-col gap-1.5 rounded-2xl p-4">
          <p className="text-caption text-muted-foreground">{a.previewLabel}</p>
          <p className="text-title-sm font-semibold text-foreground">{a.previewTitle}</p>
          <p className="max-w-prose text-body-sm text-muted-foreground">{a.previewBody}</p>
        </div>
      </section>
    </div>
  );
}
