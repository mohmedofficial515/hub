/**
 * v6-cinematic-film: "how booking works" as a silent 16 s film of the real booking flow, shown as a looping GIF
 * across the section (16:9), with the three steps written under it. The film is made in hams (HyperFrames + GSAP):
 * F:/tools/hams/output/video/goteav-booking-film-20261122 (see README). One GIF per locale.
 * A GIF cannot pause, so Pause swaps it for a still frame (WCAG 2.2.2); with reduced motion the still shows first.
 */
import './tokens.css';
import { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { messages } from './i18n';
import gifAr from './media/booking-ar.gif';
import gifEn from './media/booking-en.gif';
import stillAr from './media/still-ar.png';
import stillEn from './media/still-en.png';

const MEDIA = { ar: { gif: gifAr, still: stillAr }, en: { gif: gifEn, still: stillEn } };

export default function Page() {
  return (
    <div className="gv-home min-h-dvh overflow-x-clip">
      <CinematicSteps />
    </div>
  );
}

function CinematicSteps() {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState<boolean | null>(null); // null = follow the reduced-motion setting
  const on = playing ?? !reduce;
  const media = MEDIA[locale];

  return (
    <section aria-labelledby="steps-title" className="mx-auto w-full max-w-[80rem] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-(--action-text)">{t.eyebrow}</p>
        <h2 id="steps-title" className="mt-2 text-3xl leading-tight font-bold text-balance text-(--brand-ink) md:text-4xl">
          {t.title}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-(--ink) md:text-lg">{t.lead}</p>
      </div>

      <figure className="mt-10 md:mt-12">
        <div className="relative overflow-hidden rounded-[22px] border border-(--border-strong) bg-(--surface-brand)">
          <img
            src={on ? media.gif : media.still}
            alt={t.filmAlt}
            width={1280}
            height={720}
            className="block aspect-video h-auto w-full"
            decoding="async"
          />
          <button
            type="button"
            onClick={() => setPlaying(!on)}
            aria-label={on ? t.pause : t.play}
            className="absolute end-3 bottom-3 flex size-11 items-center justify-center rounded-full border border-(--border-strong) bg-(--card) text-(--brand-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--on-brand) sm:end-4 sm:bottom-4"
          >
            {on ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
          </button>
        </div>
        <figcaption className="mt-3 text-center text-xs text-(--ink-muted)">{t.example}</figcaption>
      </figure>

      <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
        {t.items.map((step, i) => (
          <li key={i} className="flex gap-4">
            <span
              aria-hidden
              className="tnum flex size-10 shrink-0 items-center justify-center rounded-full bg-(--brand) text-base font-bold text-(--brand-foreground)"
            >
              {i + 1}
            </span>
            <div className="min-w-0 pt-1">
              <h3 className="text-lg font-bold text-(--brand-ink)">
                <span className="sr-only">{i + 1}. </span>
                {step.title}
              </h3>
              <p className="mt-1 text-base leading-relaxed text-(--ink)">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
