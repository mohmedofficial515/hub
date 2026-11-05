import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { cn } from '@lab/utils';
import { formatUsd, MASK, type Cents } from './money';

interface AmountProps {
  cents: Cents;
  shown: boolean;
  sign?: boolean;
  className?: string;
  /** Count up from the previous value when it changes (balance after a top-up or redemption). */
  countUp?: boolean;
}

/** Every amount is isolated LTR inside <bdi> with tabular digits; masked when amounts are hidden. */
export function Amount({ cents, shown, sign, className, countUp }: AmountProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(cents);
  const prev = useRef(cents);

  useEffect(() => {
    const from = prev.current;
    prev.current = cents;
    if (!countUp || reduce || !shown || from === cents) {
      setDisplay(cents);
      return;
    }
    // Animate whole cents; the final frame is the exact value from the API string.
    const controls = animate(Number(from), Number(cents), {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(BigInt(Math.round(v))),
      onComplete: () => setDisplay(cents),
    });
    return () => controls.stop();
  }, [cents, countUp, reduce, shown]);

  return (
    <bdi dir="ltr" className={cn('tabular-nums', className)}>
      {shown ? formatUsd(display, { sign }) : `${cents < 0n ? '−' : sign && cents > 0n ? '+' : ''}${MASK}`}
    </bdi>
  );
}
