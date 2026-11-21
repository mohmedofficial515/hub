/**
 * Side sheet (inline end on tablet and desktop, bottom sheet on phones) on the Radix dialog primitive: focus trap,
 * Esc, labelled title. framer-motion animates open/close and steps aside for prefers-reduced-motion.
 * The dashboard Sheet is not used: its close label imports next/navigation, which does not run in the lab.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@lab/utils';
import { Btn } from './ui';

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg';
}) {
  const reduce = useReducedMotion();
  const wide = useWide();
  const rtl = document.documentElement.dir === 'rtl';
  const hidden = wide ? { x: rtl ? '-100%' : '100%' } : { y: '100%' };
  const shown = wide ? { x: 0 } : { y: 0 };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[60] bg-foreground/30 backdrop-blur-[2px] dark:bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.18 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount {...(description ? {} : { 'aria-describedby': undefined })}>
              <motion.div
                className={cn(
                  'fixed z-[70] flex flex-col bg-card text-card-foreground shadow-2xl outline-none',
                  'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl',
                  'md:inset-y-0 md:end-0 md:start-auto md:max-h-none md:rounded-none md:rounded-s-3xl',
                  width === 'lg' ? 'md:w-[min(640px,92vw)]' : 'md:w-[min(560px,92vw)]',
                )}
                initial={reduce ? { opacity: 0 } : hidden}
                animate={reduce ? { opacity: 1 } : shown}
                exit={reduce ? { opacity: 0 } : hidden}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 40 }}
              >
                <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden />
                <header className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-4 md:px-6 md:pt-6">
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="text-18 font-extrabold leading-snug">{title}</Dialog.Title>
                    {description ? <Dialog.Description className="mt-1 text-13 leading-relaxed text-muted-foreground">{description}</Dialog.Description> : null}
                  </div>
                  <Dialog.Close asChild>
                    <Btn variant="ghost" size="icon" aria-label={closeLabel} className="-me-2 -mt-1">
                      <X />
                    </Btn>
                  </Dialog.Close>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6">{children}</div>
                {footer ? <footer className="border-t border-border bg-card px-5 py-4 md:px-6">{footer}</footer> : null}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
