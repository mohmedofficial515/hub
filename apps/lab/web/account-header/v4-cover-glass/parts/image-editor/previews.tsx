import { useAccount } from '../model';
import { Postmark } from '../postmark';

/**
 * The cover in context: a scaled-down header bar and hero with the same glass layers as the page, so the customer
 * sees what the plate will cover. With no image it shows the flat navy hero.
 */
export function CoverPreview({ url }: { url: string | null }) {
  const m = useAccount();
  return (
    <div
      aria-hidden
      className="relative isolate overflow-hidden rounded-xl border border-(--border) bg-(--surface-brand)"
      style={{ aspectRatio: '2.4 / 1' }}
    >
      {url && <img src={url} alt="" className="absolute inset-0 size-full object-cover" />}
      {url && <span className="absolute inset-0 bg-(--cg-veil)" />}
      <span className={url ? 'cg-bar absolute inset-x-0 top-0 h-[18%]' : 'absolute inset-x-0 top-0 h-[18%]'}>
        <span className="absolute inset-x-0 bottom-0 h-px bg-(--ah-on-brand-line)" />
        <span className="absolute start-[5%] top-1/2 h-1.5 w-[16%] -translate-y-1/2 rounded-full bg-white/85" />
        <span className="absolute end-[5%] top-1/2 size-3 -translate-y-1/2 rounded-full bg-white/70" />
      </span>
      <span
        className={
          url
            ? 'cg-plate absolute start-[30%] top-[34%] rounded-lg border border-(--cg-line) px-3 py-2'
            : 'absolute start-[30%] top-[34%] px-3 py-2'
        }
      >
        <span className="block text-sm leading-tight font-bold whitespace-nowrap text-white">
          {m.t.hero.welcome} {m.firstName}
        </span>
        <span className="mt-1 block h-1 w-16 rounded-full bg-white/60" />
      </span>
      <span className="absolute start-[5%] bottom-0 h-[30%] w-[20%] rounded-t-md bg-(--card)" />
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
          <figcaption className="text-xs text-(--ink-muted) tabular-nums">{m.t.editor.sizes(size)}</figcaption>
        </figure>
      ))}
      <figure className="flex flex-col items-center gap-1.5">
        <div data-pm-tone="brand" className="flex size-12 items-center justify-center rounded-lg bg-(--surface-brand)">
          <Postmark size={32} tone="brand" {...common} />
        </div>
        <figcaption className="text-xs text-(--ink-muted) tabular-nums">{m.t.editor.sizes(32)}</figcaption>
      </figure>
    </div>
  );
}
