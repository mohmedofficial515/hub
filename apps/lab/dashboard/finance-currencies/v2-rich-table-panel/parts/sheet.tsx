import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface Props {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  /** `sheet` = bottom sheet (full width on phones, centred on tablets). `dialog` = centred modal. */
  variant?: 'sheet' | 'dialog';
  className?: string;
  children: ReactNode;
}

/** Small modal surface: focus trap, Esc, focus restore, reduced-motion aware. */
export function Overlay({ open, onClose, label, closeLabel, variant = 'sheet', className, children }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const id = window.setTimeout(() => ref.current?.focus(), 30);
    return () => {
      window.clearTimeout(id);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === ref.current) {
      e.preventDefault();
      last.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const isDialog = variant === 'dialog';
  const enter = reduce ? { opacity: 0 } : isDialog ? { opacity: 0, scale: 0.97, y: 8 } : { opacity: 0, y: 48 };
  const shown = reduce ? { opacity: 1 } : isDialog ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            initial={enter}
            animate={shown}
            exit={enter}
            transition={{ duration: reduce ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'absolute flex flex-col overflow-hidden border border-border bg-background text-foreground shadow-2xl outline-none',
              isDialog
                ? 'inset-x-4 top-1/2 mx-auto max-h-[92dvh] max-w-lg -translate-y-1/2 rounded-2xl'
                : 'inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-3xl rounded-t-3xl md:bottom-4 md:rounded-3xl',
              className,
            )}
          >
            {!isDialog && <span aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden" />}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={closeLabel}
              className="absolute end-3 top-3 z-10 size-11"
            >
              <X />
            </Button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
