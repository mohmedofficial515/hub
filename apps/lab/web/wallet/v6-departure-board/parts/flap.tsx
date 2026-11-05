import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@lab/utils';

/**
 * Split-flap text. Latin text (codes, amounts) splits into one tile per character; any other script (Arabic) is a
 * single tile so letter shaping is never broken. Tiles are decorative (`aria-hidden`); screen readers get the full
 * string once from a visually-hidden span — no per-character announcements.
 *
 * A tile is keyed by its character, so only tiles whose character changed remount and flip. Reduced motion → no flip.
 */
const LATIN = /^[\x20-\x7E•—]+$/;

export function Flap({
  text,
  srText,
  className,
  tileClassName,
  pad = 0,
  dir,
  stagger = 0.035,
  whole = false,
  words = false,
}: {
  text: string;
  srText?: string;
  className?: string;
  tileClassName?: string;
  /** Minimum tile count (pads with blanks at the end) so columns keep their width while values change. */
  pad?: number;
  dir?: 'ltr' | 'rtl';
  stagger?: number;
  /** One tile for the whole string (long words), even for Latin text. */
  whole?: boolean;
  /** One tile per word: for sentences ("GATE" "CLOSED"), never letter-by-letter. */
  words?: boolean;
}) {
  const reduce = useReducedMotion();
  const latin = LATIN.test(text);
  const split = latin && !whole && !words;
  const chars = split ? Array.from(text.padEnd(pad, ' ')) : words ? text.split(/\s+/).filter(Boolean) : [text];

  return (
    <span className={cn('inline-flex', className)} dir={dir ?? (latin ? 'ltr' : undefined)}>
      <span className="sr-only">{srText ?? text}</span>
      <span aria-hidden className={cn('inline-flex', words ? 'flex-wrap gap-1' : 'gap-[2px]')} style={{ perspective: 400 }}>
        {chars.map((ch, i) => (
          <motion.span
            key={`${i}:${ch}`}
            initial={reduce ? false : { rotateX: -90, opacity: 0.4 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ duration: 0.18, delay: reduce ? 0 : i * stagger, ease: [0.2, 0.7, 0.3, 1] }}
            className={cn(
              'relative inline-grid place-items-center overflow-hidden rounded-[3px] bg-white/[0.07] leading-none',
              'before:pointer-events-none before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-black/50',
              split ? 'min-w-[0.82em] px-[0.08em] py-[0.22em]' : 'px-[0.45em] py-[0.28em] whitespace-nowrap',
              tileClassName,
            )}
            style={{ transformOrigin: '50% 50%', backfaceVisibility: 'hidden' }}
          >
            {ch === ' ' ? ' ' : ch}
          </motion.span>
        ))}
      </span>
    </span>
  );
}
