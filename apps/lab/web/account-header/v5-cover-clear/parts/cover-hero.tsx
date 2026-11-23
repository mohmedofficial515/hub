import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Camera, ImagePlus } from 'lucide-react';
import { cn } from '@lab/utils';

import { resolveCover } from './mock';
import { useAccount } from './model';

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface-brand)';

/** The cover the page draws, or null when there is none or its link failed (then: v3's flat navy). */
export function useShownCover() {
  const m = useAccount();
  const cover = resolveCover(m.customer.cover);
  const url = cover?.url ?? null;
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onerror = () => setFailed(url);
    img.src = url;
  }, [url]);
  return cover && failed !== url ? cover : null;
}

/**
 * v5: one continuous surface from the top of the page to the foot of the hero. The photo, then ONE even veil
 * (navy-800 at the cover's own opacity + a light backdrop blur); the header and the title sit on it with no surface
 * of their own. Without a cover this is v3's flat navy. The band's height never depends on the cover, so loading,
 * an expired link and every cover give the same layout.
 */
export function CoverBand({ cover, children }: { cover: ReturnType<typeof useShownCover>; children: ReactNode }) {
  const reduce = useReducedMotion();
  const [loaded, setLoaded] = useState<string | null>(null);
  return (
    <div
      className={cn('relative isolate bg-(--surface-brand)', cover && 'cc-on-cover')}
      style={cover ? ({ '--cc-veil': String(cover.veil) } as CSSProperties) : undefined}
    >
      {cover && (
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <motion.img
            key={cover.url}
            src={cover.url}
            alt=""
            decoding="async"
            fetchPriority="high"
            onLoad={() => setLoaded(cover.url)}
            initial={false}
            animate={{ opacity: loaded === cover.url ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.4 }}
            className="size-full object-cover object-center"
          />
          <span className="cc-veil absolute inset-0" />
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * The hero's camera button (top end corner). On a cover: "Change cover", white outline on the veil. On flat navy:
 * "Add a cover". While the account is loading, a chip-sized placeholder (never a wrong label).
 */
export function CoverButton({ hasCover }: { hasCover: boolean }) {
  const m = useAccount();
  if (m.state === 'loading')
    return <span aria-hidden className="block h-11 w-11 rounded-full bg-(--ah-on-brand-line) motion-safe:animate-pulse sm:w-36" />;
  const label = hasCover ? m.t.cover.change : m.t.cover.add;
  const Icon = hasCover ? Camera : ImagePlus;
  return (
    <button
      type="button"
      onClick={() => m.openEditor('cover')}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-(--cc-line) px-3 text-sm font-semibold text-(--ah-on-brand) hover:bg-(--cc-hover) sm:px-4',
        focusRing,
      )}
    >
      <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
