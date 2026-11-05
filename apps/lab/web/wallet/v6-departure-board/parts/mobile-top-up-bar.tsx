import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { GATE_ID } from './gate';
import { ringBoard } from './rings';

/**
 * Below xl only (where the gate is under the board): a floating "Top up" pill that stays reachable while the gate is off screen (review v3 improvement 1).
 * It hides as soon as any part of the gate is visible, so it never covers the form it points to. Activating it scrolls
 * to the gate and focuses the amount field.
 */
export function MobileTopUpBar({ onTopUp }: { onTopUp: () => void }) {
  const t = useT(messages);
  const reduce = useReducedMotion();
  const [gateVisible, setGateVisible] = useState(true);

  useEffect(() => {
    const el = document.getElementById(GATE_ID);
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setGateVisible(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {!gateVisible && (
        <motion.div
          key="topup-bar"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.2, ease: [0.2, 0.7, 0.3, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] xl:hidden"
        >
          <button
            type="button"
            onClick={onTopUp}
            aria-describedby="v6-topup-bar-hint"
            className={cn(
              'pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-primary-dark py-1.5 ps-1.5 pe-5 text-base font-bold text-white shadow-xl shadow-black/30 ring-1 ring-white/10',
              ringBoard,
            )}
          >
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-secondary text-primary-dark">
              <Plus className="size-5" strokeWidth={2.5} />
            </span>
            {t.topUpCta}
          </button>
          <span id="v6-topup-bar-hint" className="sr-only">
            {t.topUpCtaHint}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
