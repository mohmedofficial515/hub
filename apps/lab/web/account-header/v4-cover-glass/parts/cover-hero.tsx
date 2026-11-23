import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Camera, ImagePlus } from 'lucide-react';
import { cn } from '@lab/utils';

import { useAccount } from './model';

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface-brand)';

/** True while the cover image is set and has not failed to load (an expired link falls back to flat navy). */
export function useCoverShown(): boolean {
  const m = useAccount();
  const url = m.customer.cover?.url ?? null;
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onerror = () => setFailed(url);
    img.src = url;
  }, [url]);
  return Boolean(url) && failed !== url && m.state !== 'loading';
}

/**
 * The cover band: the photo runs from the top of the page through the header and the hero, under a navy veil
 * (30 %, no blur). The header and the title plate carry their own glass (tokens.css §5). Without a cover this renders
 * nothing and the header and hero are v3's flat navy, unchanged.
 */
export function CoverBand({ shown, children }: { shown: boolean; children: ReactNode }) {
  const m = useAccount();
  const reduce = useReducedMotion();
  const url = m.customer.cover?.url;
  const [loaded, setLoaded] = useState<string | null>(null);
  return (
    <div className={cn('relative isolate', shown ? 'bg-(--surface-brand)' : undefined)}>
      {shown && url && (
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <motion.img
            key={url}
            src={url}
            alt=""
            decoding="async"
            fetchPriority="high"
            onLoad={() => setLoaded(url)}
            initial={false}
            animate={{ opacity: loaded === url ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.4 }}
            className="size-full object-cover object-center"
          />
          <span className="absolute inset-0 bg-(--cg-veil)" />
        </div>
      )}
      {children}
    </div>
  );
}

/** The hero's camera button (top end corner): "Change cover" on a glass chip, or "Add a cover" on flat navy. */
export function CoverButton({ shown }: { shown: boolean }) {
  const m = useAccount();
  const label = shown ? m.t.cover.change : m.t.cover.add;
  const Icon = shown ? Camera : ImagePlus;
  return (
    <button
      type="button"
      onClick={() => m.openEditor('cover')}
      disabled={m.state === 'loading'}
      aria-label={label}
      className={cn(
        'inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold text-(--ah-on-brand) disabled:opacity-50 sm:px-4',
        shown
          ? 'cg-plate border-(--cg-line) hover:bg-(--cg-bar)'
          : 'border-(--ah-on-brand-line) hover:bg-(--ah-on-brand-hover)',
        focusRing,
      )}
    >
      <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
