/**
 * @file utils.ts
 * @description `cn()`: tailwind-merge that knows Hub's named sizes, so `text-caption text-muted-foreground` keeps both.
 * Ported from F:/Goteav/redesign/shared/ui/hub-cn.ts.
 */
import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['caption', 'body-sm', 'body', 'body-lg', 'title-sm', 'title', 'headline', 'display'] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
