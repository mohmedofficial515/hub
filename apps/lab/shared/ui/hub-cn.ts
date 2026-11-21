import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `cn()` for Hub versions. Hub's named text sizes (docs/08 §3.2: `text-caption` … `text-display`)
 * are unknown to tailwind-merge, which then treats them as colours and drops them when a
 * `text-<colour>` class follows (`text-caption text-muted-foreground` → only the colour survives).
 * Registering them as font sizes keeps both.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'body-sm', 'body', 'body-lg', 'title-sm', 'title', 'headline', 'display'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
