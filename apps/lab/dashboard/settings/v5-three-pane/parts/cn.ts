import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The dashboard's numeric text scale (text-8 … text-32) is unknown to tailwind-merge, which would treat it as a colour
// and drop it next to a text-<colour> class. Same registration as the dashboard's src/lib/utils.ts.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '20', '22', '26', '32'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
