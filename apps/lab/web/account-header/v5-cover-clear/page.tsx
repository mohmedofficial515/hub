import { useCallback, useState } from 'react';

import './tokens.css';
import { LabControls, StampSheet } from './parts/stamp-sheet';
import { CoverBand, CoverButton, useShownCover } from './parts/cover-hero';
import { COVER_PRESETS, type CoverPresetId } from './parts/covers';
import type { Original } from './parts/image-editor/image-editor';
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
    preset: pick<CoverPresetId>('preset', COVER_PRESETS.map((p) => p.id), 'istanbul'),
  };
}

/** Mock API: `PUT /users/me/cover/preset`, `PUT|DELETE /users/me/cover`, `PUT|DELETE /users/me/avatar`. `&save=fail` fails it. */
function mockSave(): Promise<void> {
  const fail = new URLSearchParams(location.hash.split('?')[1] ?? '').get('save') === 'fail';
  return new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error('mock')) : resolve()), 1100));
}

/**
 * v5-cover-clear (base v4-cover-glass): the cover photo is the background of the header and the hero, one continuous
 * surface under ONE even veil whose opacity is measured from the photo (image-editor/veil.ts). No header bar, no
 * title plate. No cover = v3's flat navy, exactly. One image editor serves the cover and the profile photo.
 */
export default function Page() {
  const locale = useLocale();
  const [controls, setControlsRaw] = useState<Controls>(() => initialControls(locale));
  const [edits, setEdits] = useState<Edits>({});
  const [editor, setEditor] = useState<EditorKind | null>(null);
  const [status, setStatus] = useState('');
  // The uploaded original and its crop, kept for this session only so the customer can re-crop (never uploaded).
  const [originals, setOriginals] = useState<Partial<Record<EditorKind, Original>>>({});
  // A lab switch shows that state as served by the API, so it discards what was saved in the editor.
  const setControls = useCallback((next: Controls | ((c: Controls) => Controls)) => {
    setEdits({});
    setOriginals({});
    setControlsRaw(next);
  }, []);
  const model = useAccountModelFrom(controls, edits, setEditor);
  const t = model.t;

  const save = async (result: EditorResult) => {
    await mockSave();
    setEdits((e) => (result.kind === 'cover' ? { ...e, cover: result.value } : { ...e, avatar: result.value }));
    setOriginals((o) => ({ ...o, [result.kind]: result.original ?? undefined }));
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
        <ImageEditor kind={editor} originals={originals} onClose={() => setEditor(null)} onSave={save} />
      </div>
    </AccountProvider>
  );
}

/** Header + account hero on one band: flat navy, or the veiled cover photo. */
function Frame({ status }: { status: string }) {
  const model = useAccount();
  const t = model.t;
  const cover = useShownCover();
  return (
    <CoverBand cover={cover}>
      <SiteHeader />
      {/* Account hero. The same box in every state (no cover, cover, loading, expired link), so nothing shifts. Below
          lg it is 24 px taller than v3 in all states, so the cover shows above the side card on phones and tablets. */}
      <div className="border-t border-(--ah-on-brand-line)">
        <div className="relative mx-auto grid max-w-[1280px] gap-6 px-4 pt-8 pb-30 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8 lg:pt-10 lg:pb-32">
          <div className="absolute end-4 top-3 sm:end-6 sm:top-4 lg:end-8">
            <CoverButton hasCover={Boolean(cover)} />
          </div>
          <div className="min-w-0 pe-16 sm:pe-44 lg:col-start-2">
            {model.state === 'loading' ? (
              <span aria-hidden className="block h-[35px] w-56 rounded bg-(--ah-on-brand-line) motion-safe:animate-pulse sm:h-10" />
            ) : (
              <h1 className="text-[28px] leading-tight font-bold text-(--ah-on-brand) sm:text-[32px]">
                {t.hero.welcome} <span dir="auto">{model.firstName}</span>
              </h1>
            )}
            <p className="mt-2 max-w-[56ch] text-base text-(--ah-on-brand-muted)">{t.hero.subtitle}</p>
          </div>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </CoverBand>
  );
}
