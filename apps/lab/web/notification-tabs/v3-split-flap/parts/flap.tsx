/**
 * Split-flap pieces: one tile that flips its top half down and its bottom half into place, a hook that runs a tile
 * through other faces before it settles, and the three ways text sits on tiles.
 *
 * Arabic shaping: every face is a whole string rendered twice (once clipped to the top half, once to the bottom half)
 * with `clip-path`, never cut into letters. Arabic labels therefore get one tile per word and pass through whole
 * printed words (city names) while they settle, the way a real board's destination flaps are printed whole. Latin
 * labels, codes and digits get one tile per character.
 */
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@lab/utils';

const TICK_MS = 72;
const HALF_S = 0.06;
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

const randomOf = (list: string | readonly string[]) => list[Math.floor(Math.random() * list.length)] ?? '';

/** One flap tile. Whenever `value` changes, the old top half falls and the new bottom half lands. */
export function FlapTile({ value, sizer, className }: { value: string; sizer?: string; className?: string }) {
  const reduce = useReducedMotion();
  const [face, setFace] = useState({ cur: value, prev: value, n: 0 });
  // Derived during render, so the flip starts on the same frame as the change.
  if (face.cur !== value) setFace({ cur: value, prev: face.cur, n: face.n + 1 });

  return (
    <span
      aria-hidden
      className={cn('relative inline-grid place-items-center overflow-hidden rounded-[5px] bg-(--flap) leading-none', className)}
      style={{ perspective: 220 }}
    >
      {/* Keeps the tile at its final width while other faces pass through it. */}
      <span className="invisible col-start-1 row-start-1 whitespace-nowrap">{sizer ?? (value || ' ')}</span>
      <Half side="top">{face.cur}</Half>
      <Half side="bottom">{reduce ? face.cur : face.prev}</Half>
      {!reduce && face.n > 0 && (
        <Fragment key={face.n}>
          <Half
            side="top"
            motion
            initial={{ rotateX: 0 }}
            animate={{ rotateX: -90 }}
            transition={{ duration: HALF_S, ease: 'easeIn' }}
          >
            {face.prev}
          </Half>
          <Half
            side="bottom"
            motion
            initial={{ rotateX: 90 }}
            animate={{ rotateX: 0 }}
            transition={{ duration: HALF_S * 1.2, delay: HALF_S, ease: 'easeOut' }}
          >
            {face.cur}
          </Half>
        </Fragment>
      )}
      {/* the split between the two flaps */}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-(--flap-split)" />
    </span>
  );
}

type HalfProps = {
  side: 'top' | 'bottom';
  children: ReactNode;
  motion?: boolean;
  initial?: { rotateX: number };
  animate?: { rotateX: number };
  transition?: object;
};

function Half({ side, children, motion: moving, initial, animate, transition }: HalfProps) {
  const className = 'absolute inset-0 flex items-center justify-center whitespace-nowrap bg-(--flap)';
  const style = {
    clipPath: side === 'top' ? 'inset(0 0 50% 0)' : 'inset(50% 0 0 0)',
    transformOrigin: '50% 50%',
    backfaceVisibility: 'hidden' as const,
  };
  const content = children === '' ? ' ' : children;
  if (!moving) return <span className={className} style={style}>{content}</span>;
  return (
    <motion.span className={className} style={style} initial={initial} animate={animate} transition={transition}>
      {content}
    </motion.span>
  );
}

/**
 * Runs a face through `frames` other faces, then settles on `final`. Runs again whenever `trigger` changes.
 * With reduced motion it shows `final` at once.
 */
export function useScramble(
  final: string,
  { trigger, delay, frames, pick, blankFirst }: { trigger: unknown; delay: number; frames: number; pick: () => string; blankFirst?: boolean },
) {
  const reduce = useReducedMotion();
  const [text, setText] = useState(() => (reduce || !blankFirst ? final : ''));
  const pickRef = useRef(pick);
  pickRef.current = pick;

  useEffect(() => {
    if (reduce || frames <= 0) {
      setText(final);
      return;
    }
    let i = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const wait = setTimeout(() => {
      timer = setInterval(() => {
        i++;
        if (i > frames) {
          setText(final);
          clearInterval(timer);
        } else setText(pickRef.current());
      }, TICK_MS);
    }, delay);
    return () => {
      clearTimeout(wait);
      if (timer) clearInterval(timer);
    };
  }, [trigger, final, reduce, delay, frames]);

  return text;
}

type FlapTextProps = {
  text: string;
  trigger: unknown;
  /** ms before the first tile starts */
  delay: number;
  /** faces the first tile passes through; later tiles get a few more */
  frames: number;
  blankFirst?: boolean;
  tileClassName?: string;
  className?: string;
};

/** Latin text, one tile per character (codes, English labels). Spaces stay as gaps. */
export function FlapLetters({ text, tileClassName, className, ...run }: FlapTextProps) {
  return (
    <span dir="ltr" className={cn('inline-flex gap-[2px]', className)}>
      {text.split('').map((ch, i) =>
        ch === ' ' ? (
          <span key={i} aria-hidden className="w-1.5" />
        ) : (
          <LetterTile key={i} ch={ch} index={i} tileClassName={tileClassName} {...run} />
        ),
      )}
    </span>
  );
}

function LetterTile({
  ch,
  index,
  trigger,
  delay,
  frames,
  blankFirst,
  tileClassName,
}: { ch: string; index: number; tileClassName?: string } & Omit<FlapTextProps, 'text' | 'tileClassName' | 'className'>) {
  const pool = /\d/.test(ch) ? DIGITS : LATIN;
  const face = useScramble(ch, {
    trigger,
    delay: delay + index * 45,
    frames: frames > 0 ? frames + index : 0,
    pick: () => randomOf(pool),
    blankFirst,
  });
  return <FlapTile value={face} sizer="W" className={tileClassName} />;
}

/** Arabic text, one tile per whole word; while settling each tile shows other whole words from `deck`. */
export function FlapWords({ text, deck, tileClassName, className, ...run }: FlapTextProps & { deck: string[] }) {
  return (
    <span className={cn('inline-flex gap-[3px]', className)}>
      {text.split(' ').map((word, i) => (
        <WordTile key={`${word}-${i}`} word={word} index={i} deck={deck} tileClassName={tileClassName} {...run} />
      ))}
    </span>
  );
}

function WordTile({
  word,
  index,
  deck,
  trigger,
  delay,
  frames,
  blankFirst,
  tileClassName,
}: { word: string; index: number; deck: string[]; tileClassName?: string } & Omit<FlapTextProps, 'text' | 'tileClassName' | 'className'>) {
  // Faces about as long as the word, so a passing face is rarely clipped by the tile.
  const fits = deck.filter((w) => w !== word && w.length <= word.length + 2);
  const pool = fits.length ? fits : deck;
  const face = useScramble(word, {
    trigger,
    delay: delay + index * 110,
    frames: frames > 0 ? frames + index * 2 : 0,
    pick: () => randomOf(pool),
    blankFirst,
  });
  return <FlapTile value={face} sizer={word} className={tileClassName} />;
}

/** A two-digit flap counter. It steps one by one toward `value`, each step flipping the digit that changes. */
export function FlapCounter({ value, startFrom, delay = 0, tileClassName }: { value: number; startFrom?: number; delay?: number; tileClassName?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(() => (reduce ? value : (startFrom ?? value)));

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    if (shown === value) return;
    const id = setTimeout(() => setShown((s) => s + Math.sign(value - s)), shown === startFrom ? delay : 130);
    return () => clearTimeout(id);
  }, [value, shown, reduce, delay, startFrom]);

  const digits = String(Math.min(shown, 99)).padStart(2, '0');
  return (
    <span dir="ltr" className="tnum inline-flex gap-[2px]">
      {digits.split('').map((d, i) => (
        <FlapTile key={i} value={d} sizer="0" className={tileClassName} />
      ))}
    </span>
  );
}

/** The small gold "boarding" lamp. It flickers on when lit. */
export function Lamp({ lit, className }: { lit: boolean; className?: string }) {
  return (
    <motion.span
      aria-hidden
      className={cn('block size-2 shrink-0 rounded-full', lit ? 'bg-(--lamp)' : 'bg-(--lamp-off)', className)}
      initial={false}
      animate={lit ? { opacity: [0.2, 1, 0.45, 1] } : { opacity: 1 }}
      transition={{ duration: 0.45, times: [0, 0.3, 0.55, 1] }}
    />
  );
}
