import { useCallback, useState } from 'react';

import './tokens.css';
import { LabControls, StampSheet } from './parts/stamp-sheet';
import { CoverBand, CoverButton, useCoverShown } from './parts/cover-hero';
import { ImageEditor, type EditorResult } from './parts/image-editor/image-editor';
import {
  AccountProvider,
  useAccount,
  useAccountModelFrom,
  type Controls,
  type Edits,
  type EditorKind,
  type LoadState,
} from './parts/model';
import type { CoverChoice, Picture, Script, TierCode } from './parts/mock';
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
    cover: pick<CoverChoice>('cover', ['none', 'gallery', 'upload'], 'gallery'),
  };
}

/** Mock API: `PUT /users/me/cover/preset`, `PUT|DELETE /users/me/cover`, `PUT|DELETE /users/me/avatar`. `&save=fail` fails it. */
function mockSave(): Promise<void> {
  const fail = new URLSearchParams(location.hash.split('?')[1] ?? '').get('save') === 'fail';
  return new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error('mock')) : resolve()), 1100));
}

/**
 * v4-cover-glass (base v3-passport-stamp): the customer can set a cover photo. It runs from the top of the page
 * through the header and the account hero under a light navy veil; the header becomes a navy glass bar and the title
 * sits on a frosted glass plate, so the text is AA over any photo. No cover = v3's flat navy, exactly. One image
 * editor serves the cover (gallery or upload, 3:1 crop) and the profile photo (round crop, Postmark preview).
 */
export default function Page() {
  const locale = useLocale();
  const [controls, setControlsRaw] = useState<Controls>(() => initialControls(locale));
  const [edits, setEdits] = useState<Edits>({});
  const [editor, setEditor] = useState<EditorKind | null>(null);
  const [status, setStatus] = useState('');
  // A lab switch shows that state as served by the API, so it discards what was saved in the editor.
  const setControls = useCallback((next: Controls | ((c: Controls) => Controls)) => {
    setEdits({});
    setControlsRaw(next);
  }, []);
  const model = useAccountModelFrom(controls, edits, setEditor);
  const t = model.t;

  const save = async (result: EditorResult) => {
    await mockSave();
    setEdits((e) => (result.kind === 'cover' ? { ...e, cover: result.value } : { ...e, avatar: result.value }));
    const removed = result.value === null;
    setStatus((removed ? t.editor.removed : t.editor.saved)[result.kind]);
  };

  return (
    <AccountProvider value={model}>
      <div className="ah-root min-h-dvh bg-(--background) text-(--ink)">
        <Frame status={status} />
        <div className="relative z-10 mx-auto -mt-16 grid max-w-[1280px] items-start gap-6 px-4 pb-24 sm:px-6 lg:-mt-24 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
          <aside className="min-w-0">
            <SideCard onRetry={() => setControls((c) => ({ ...c, state: 'ready' }))} />
          </aside>
          <main className="min-w-0 space-y-6 lg:pt-24">
            <LabControls controls={controls} onChange={setControls} />
            <StampSheet />
          </main>
        </div>
        <ImageEditor kind={editor} onClose={() => setEditor(null)} onSave={save} />
      </div>
    </AccountProvider>
  );
}

/** Header + account hero. With a cover: photo band, glass header, title on the glass plate. */
function Frame({ status }: { status: string }) {
  const model = useAccount();
  const t = model.t;
  const shown = useCoverShown();
  const title =
    model.state === 'loading' ? (
      <span aria-hidden className="block h-9 w-56 rounded bg-(--ah-on-brand-line) motion-safe:animate-pulse" />
    ) : (
      <h1 className="text-[28px] leading-tight font-bold text-(--ah-on-brand) sm:text-[32px]">
        {t.hero.welcome} <span dir="auto">{model.firstName}</span>
      </h1>
    );
  return (
    <CoverBand shown={shown}>
      <SiteHeader glass={shown} />
      {/* Account hero: flat navy (D7) without a cover; transparent over the cover band with one. */}
      <div className={shown ? 'border-t border-(--ah-on-brand-line)' : 'border-t border-(--ah-on-brand-line) bg-(--surface-brand)'}>
        <div className="relative mx-auto grid max-w-[1280px] gap-6 px-4 pt-8 pb-24 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8 lg:pt-10 lg:pb-32">
          <div className="absolute end-4 top-3 sm:end-6 sm:top-4 lg:end-8">
            <CoverButton shown={shown} />
          </div>
          <div className="min-w-0 pe-16 sm:pe-44 lg:col-start-2">
            {shown ? (
              <div className="cg-plate inline-block max-w-full rounded-2xl border border-(--cg-line) px-5 py-4 sm:px-6">
                {title}
                <p className="mt-1.5 max-w-[56ch] text-base text-(--cg-text-muted)">{t.hero.subtitle}</p>
              </div>
            ) : (
              <>
                {title}
                <p className="mt-2 max-w-[56ch] text-base text-(--ah-on-brand-muted)">{t.hero.subtitle}</p>
              </>
            )}
          </div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </CoverBand>
  );
}
