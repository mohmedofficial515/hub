import { useId, useState } from 'react';
import { cn } from '@lab/utils';

import { useAccount } from '../model';
import { Postmark } from '../postmark';
import { BANDS } from './veil';

type Shape = 'desktop' | 'phone';

/**
 * The cover in context, as the desktop band (1440) or the phone band (390): photo, the cover's own veil, the header
 * row, the camera button, the title and subtitle, and where the side card starts. With no image: flat navy.
 */
export function CoverPreview({ url, veil, compact = false }: { url: string | null; veil: number; compact?: boolean }) {
  const m = useAccount();
  const e = m.t.editor;
  const [shape, setShape] = useState<Shape>('desktop');
  const name = useId();
  const band = BANDS[shape];
  return (
    <div className="space-y-2">
      <fieldset className="flex gap-1 rounded-lg bg-(--surface-2) p-1">
        <legend className="sr-only">{e.previewShape}</legend>
        {(['desktop', 'phone'] as const).map((s) => (
          <label
            key={s}
            className={cn(
              'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md text-sm font-semibold has-focus-visible:ring-2 has-focus-visible:ring-(--ring)',
              shape === s ? 'bg-(--card) text-(--brand-ink) shadow-sm' : 'text-(--ink-muted)',
            )}
          >
            <input
              type="radio"
              name={name}
              value={s}
              checked={shape === s}
              onChange={() => setShape(s)}
              className="sr-only"
            />
            {s === 'desktop' ? e.guideDesktop : e.guidePhone}
          </label>
        ))}
      </fieldset>
      <div
        aria-hidden
        className={cn(
          'relative isolate mx-auto max-w-full overflow-hidden rounded-xl border border-(--border) bg-(--surface-brand)',
        )}
        style={{
          aspectRatio: `${band.width} / ${band.height}`,
          containerType: 'inline-size',
          // The phone band is nearly square: give it a fixed height so it fits above the fold in the sheet.
          ...(shape === 'phone' ? { width: ((compact ? 150 : 220) * band.width) / band.height } : null),
        }}
      >
        {url && <img src={url} alt="" className="absolute inset-0 size-full object-cover" />}
        {url && (
          <span
            className="absolute inset-0"
            style={{ background: `rgb(31 50 92 / ${veil})`, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
          />
        )}
        {/* Header row: logo, links, avatar; the hairline under it. */}
        <span className="absolute inset-x-0 top-0 h-[20%]">
          <span className="absolute inset-x-0 bottom-0 h-px bg-white/30" />
          <span className="absolute start-[5%] top-1/2 h-[18%] w-[14%] -translate-y-1/2 rounded-full bg-white" />
          {shape === 'desktop' && <span className="absolute start-[24%] top-1/2 h-[10%] w-[34%] -translate-y-1/2 rounded-full bg-white/85" />}
          <span className="absolute end-[5%] top-1/2 aspect-square h-[36%] -translate-y-1/2 rounded-full bg-white/85" />
        </span>
        {/* Camera button, title, subtitle. */}
        <span className="absolute end-[4%] top-[25%] aspect-square h-[13%] rounded-full border border-white/70" />
        <span className={cn('absolute top-[33%]', shape === 'desktop' ? 'start-[31%]' : 'start-[5%]')}>
          <span className="block font-bold leading-tight whitespace-nowrap text-white" style={{ fontSize: shape === 'desktop' ? '4.2cqw' : '8cqw' }}>
            {m.t.hero.welcome} {m.firstName}
          </span>
          <span className="mt-[0.6cqw] block h-[1.2cqw] w-[30cqw] rounded-full bg-white/80" />
        </span>
        {/* Where the side card starts (start column on desktop, full width on phones). */}
        <span
          className={cn(
            'absolute bottom-0 rounded-t-md bg-(--card)',
            shape === 'desktop' ? 'start-[7%] h-[30%] w-[22%]' : 'inset-x-[4%] h-[20%]',
          )}
        />
      </div>
      {url && <p className="text-sm text-(--ink-muted)">{e.veilNote(Math.round(veil * 100))}</p>}
    </div>
  );
}

/** The avatar in its Postmark frame at the three sizes it is used at, with the customer's current level. */
export function AvatarPreview({ url }: { url: string | null }) {
  const m = useAccount();
  const photo = url ? { url, thumbUrl: url } : null;
  const common = {
    level: m.frame,
    label: m.a11yName,
    initial: m.initial,
    photo,
    memberSince: m.customer.memberSince,
  };
  return (
    <div aria-hidden className="flex flex-wrap items-end justify-center gap-x-6 gap-y-3 rounded-xl border border-(--border) bg-(--card) p-4">
      {([128, 64, 32] as const).map((size) => (
        <figure key={size} className="flex flex-col items-center gap-1.5">
          <div className={size === 128 && m.frame === 'GOLD' ? 'ps-4' : undefined}>
            <Postmark size={size} {...common} />
          </div>
          <figcaption className="text-sm text-(--ink-muted) tabular-nums">{m.t.editor.sizes(size)}</figcaption>
        </figure>
      ))}
      <figure className="flex flex-col items-center gap-1.5">
        <div data-pm-tone="brand" className="flex size-12 items-center justify-center rounded-lg bg-(--surface-brand)">
          <Postmark size={32} tone="brand" {...common} />
        </div>
        <figcaption className="text-sm text-(--ink-muted) tabular-nums">{m.t.editor.sizes(32)}</figcaption>
      </figure>
    </div>
  );
}
