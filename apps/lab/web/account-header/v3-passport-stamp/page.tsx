import { useState } from 'react';

import './tokens.css';
import { LabControls, StampSheet } from './parts/stamp-sheet';
import { AccountProvider, useAccountModelFrom, type Controls, type LoadState } from './parts/model';
import type { Picture, Script, TierCode } from './parts/mock';
import { SideCard } from './parts/side-card';
import { SiteHeader } from './parts/site-header';
import { useLocale } from '@lab/i18n';

/** Initial lab state from the frame's hash, e.g. `#/account-header/v2-passport-stamp?lang=ar&level=GOLD&pic=initial`. */
function initialControls(locale: 'ar' | 'en'): Controls {
  const query = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const v = query.get(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  };
  return {
    level: pick<TierCode>('level', ['BLUE', 'SILVER', 'GOLD'], 'SILVER'),
    picture: pick<Picture>('pic', ['photo', 'initial', 'broken'], 'photo'),
    state: pick<LoadState>('state', ['ready', 'loading', 'error'], 'ready'),
    script: pick<Script>('name', ['arabic', 'latin'], locale === 'ar' ? 'arabic' : 'latin'),
  };
}

/**
 * v2-passport-stamp: the navy header and the account hero are one flat passport cover; the side card is the data
 * page, stamped with the customer's Postmark avatar. The content column holds the lab's stamp sheet.
 */
export default function Page() {
  const locale = useLocale();
  const [controls, setControls] = useState<Controls>(() => initialControls(locale));
  const model = useAccountModelFrom(controls);
  const t = model.t;

  return (
    <AccountProvider value={model}>
      <div className="ah-root min-h-dvh bg-(--background) text-(--ink)">
        <SiteHeader />

        {/* Account hero: flat navy (decision D7), continuous with the header; a hairline separates them. */}
        <div className="border-t border-(--ah-on-brand-line) bg-(--surface-brand)">
          <div className="mx-auto grid max-w-[1280px] gap-6 px-4 pt-8 pb-24 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8 lg:pt-10 lg:pb-32">
            <div className="lg:col-start-2">
              {model.state === 'loading' ? (
                <span aria-hidden className="block h-9 w-56 rounded bg-(--ah-on-brand-line) motion-safe:animate-pulse" />
              ) : (
                <h1 className="text-[28px] leading-tight font-bold text-(--ah-on-brand) sm:text-[32px]">
                  {t.hero.welcome} <span dir="auto">{model.firstName}</span>
                </h1>
              )}
              <p className="mt-2 max-w-[56ch] text-base text-(--ah-on-brand-muted)">{t.hero.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto -mt-16 grid max-w-[1280px] items-start gap-6 px-4 pb-24 sm:px-6 lg:-mt-24 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
          <aside className="min-w-0">
            <SideCard onRetry={() => setControls((c) => ({ ...c, state: 'ready' }))} />
          </aside>
          <main className="min-w-0 space-y-6 lg:pt-24">
            <LabControls controls={controls} onChange={setControls} />
            <StampSheet />
          </main>
        </div>
      </div>
    </AccountProvider>
  );
}
