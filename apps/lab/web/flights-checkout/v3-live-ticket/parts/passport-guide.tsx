/**
 * The passport-name helper: a drawn passport data page (always LTR, as printed) with the two fields that map to the
 * form numbered 1 and 2, plus the machine-readable lines. Example data only; no real document.
 */
import type { T } from '../i18n';

function Marker({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="grid size-5 shrink-0 place-items-center rounded-full bg-(--brand) text-xs font-bold text-(--brand-foreground)"
    >
      {n}
    </span>
  );
}

export function PassportGuide({ t }: { t: T }) {
  const p = t.pax;
  return (
    <figure className="rounded-xl border border-(--border) bg-(--surface-2) p-3 sm:p-4">
      <figcaption className="mb-3 text-sm font-semibold text-(--brand-ink)">{p.guideTitle}</figcaption>

      <div dir="ltr" className="overflow-hidden rounded-lg border border-(--border-strong) bg-(--card)" aria-hidden>
        <div className="flex gap-3 p-3">
          <div className="grid h-20 w-16 shrink-0 place-items-center rounded-md bg-(--surface-3)">
            <svg viewBox="0 0 40 48" className="h-12 w-10 text-(--ink-subtle)" fill="currentColor">
              <circle cx="20" cy="16" r="9" />
              <path d="M4 46c1-10 8-16 16-16s15 6 16 16z" />
            </svg>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2 text-start">
            <div className="col-span-2 flex items-start gap-2 rounded-md border-2 border-(--brand) px-2 py-1">
              <Marker n={1} />
              <div className="min-w-0">
                <p className="text-xs text-(--ink-muted)">{p.guideSurname}</p>
                <p className="truncate text-sm font-bold tracking-wide text-(--foreground)">ALHARBI</p>
              </div>
            </div>
            <div className="col-span-2 flex items-start gap-2 rounded-md border-2 border-(--brand) px-2 py-1">
              <Marker n={2} />
              <div className="min-w-0">
                <p className="text-xs text-(--ink-muted)">{p.guideGiven}</p>
                <p className="truncate text-sm font-bold tracking-wide text-(--foreground)">MOHAMMED SALEH</p>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-(--border) bg-(--surface-2) px-3 py-2 text-xs leading-5 font-semibold tracking-[0.12em] text-(--ink) [overflow-wrap:anywhere]">
          <p>
            P&lt;SAU<span className="rounded-sm bg-(--brand-soft) px-0.5 text-(--brand-ink)">ALHARBI</span>&lt;&lt;
            <span className="rounded-sm bg-(--brand-soft) px-0.5 text-(--brand-ink)">MOHAMMED&lt;SALEH</span>&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
          </p>
          <p>A12••••&lt;&lt;5SAU8803146M3006304&lt;&lt;&lt;&lt;02</p>
        </div>
      </div>

      <ol className="mt-3 grid gap-2 text-sm leading-6 text-(--foreground) sm:grid-cols-2">
        <li className="flex items-center gap-2">
          <Marker n={1} />
          <span>{p.guideToFamily}</span>
        </li>
        <li className="flex items-center gap-2">
          <Marker n={2} />
          <span>{p.guideToGiven}</span>
        </li>
      </ol>
      <p className="mt-2 text-sm leading-6 text-(--ink-muted)">{p.guideMrz}</p>
      <p className="mt-1 text-sm leading-6 text-(--ink-muted)">{p.guideNote}</p>
    </figure>
  );
}
