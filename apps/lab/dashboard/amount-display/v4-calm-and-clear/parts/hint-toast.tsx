/**
 * After the first currency switch: a toast-like chip that names the new currency and the basis, auto-dismisses after ~6s (paused while
 * hovered or focused) and has a 44px close target. It is `fixed` at the bottom (above the lab's floating button), rendered at the page
 * root, so it never floats over titles or inside the blurred sticky header (backdrop-filter would trap a fixed child).
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { infoOf } from './data';
import { fill, useLab } from './env';

export function HintToast() {
  const { t, locale, display, hint, dismissHint } = useLab();
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const left = useRef(6000);
  const started = useRef(0);

  useEffect(() => {
    if (!hint || paused) return;
    started.current = Date.now();
    const id = setTimeout(dismissHint, left.current);
    return () => {
      clearTimeout(id);
      left.current = Math.max(1200, left.current - (Date.now() - started.current));
    };
  }, [hint, paused, dismissHint]);
  useEffect(() => {
    if (!hint) left.current = 6000;
  }, [hint]);

  if (!hint) return null;
  const info = infoOf(display);
  const name = info ? (locale === 'ar' ? info.nameAr : info.nameEn) : display;
  return (
    <motion.div
      role="status"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="fixed inset-x-3 bottom-[4.5rem] z-40 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-full border bg-popover py-1 ps-4 pe-1 text-12 font-medium text-popover-foreground shadow-lg"
    >
      <span className="min-w-0 py-2">{fill(t.n.hint, { name, cur: display })}</span>
      <button
        type="button"
        aria-label={t.header.dismiss}
        onClick={dismissHint}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" aria-hidden />
      </button>
    </motion.div>
  );
}
