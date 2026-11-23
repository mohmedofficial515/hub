import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Dialog, Direction, Tabs } from 'radix-ui';
import { AlertCircle, Camera, Check, Crop as CropIcon, ImagePlus, Loader2, RotateCw, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@lab/utils';

import { COVER_PRESETS, presetById, type CoverPresetId } from '../covers';
import { resolveCover, type Cover, type Customer } from '../mock';
import { useAccount } from '../model';
import {
  ACCEPTED_TYPES,
  ASPECT,
  checkFile,
  clampCrop,
  imageFrom,
  INITIAL_CROP,
  loadUrl,
  OUTPUT_WIDTH,
  renderCrop,
  toBlob,
  type CheckError,
  type Crop,
  type EditorKind,
  type Original,
  type Source,
} from './crop';
import { Cropper, ZoomControl, type CropOrigin } from './cropper';
import { AvatarPreview, CoverPreview } from './previews';
import { measureVeil } from './veil';

export type { Original } from './crop';

/** What a save hands back to the page: the new value (null = removed) and, for an upload, the session original. */
export type EditorResult = (
  | { kind: 'cover'; value: Cover | null }
  | { kind: 'avatar'; value: Customer['avatar'] }
) & { original?: Original | null };

const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--popover)';
const outlineBtn = cn(
  'inline-flex h-11 items-center justify-center gap-2 rounded-md border border-(--border-strong) px-4 text-sm font-semibold text-(--brand-ink) hover:bg-(--surface-2) aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
  focus,
);
const primaryBtn = cn(
  'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-(--action) px-5 text-sm font-bold text-(--action-foreground) hover:bg-(--action-hover) aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-busy:opacity-100',
  focus,
);

function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Closing asks the body first: with unsaved changes it shows "Discard?" instead (returns true = handled). */
type Guard = { current: (() => boolean) | null };

/**
 * One editor for the cover and the profile photo. Desktop: a centred dialog, source / crop on the start side and the
 * preview on the end side. Below 640 px: a full-screen sheet, preview first so it is above the fold, actions pinned
 * to the bottom. Radix Dialog (focus trap, Escape, focus back to the opener) inside a Direction provider, so every
 * Radix part (Tabs) and all text follow the page direction.
 */
export function ImageEditor({
  kind,
  originals,
  onClose,
  onSave,
}: {
  kind: EditorKind | null;
  originals: Partial<Record<EditorKind, Original>>;
  onClose: () => void;
  /** Mock save: resolves after a short delay; rejects to show the save error. */
  onSave: (result: EditorResult) => Promise<void>;
}) {
  const m = useAccount();
  const reduce = useReducedMotion();
  const phone = !useMedia('(min-width: 640px)');
  const opener = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const guard: Guard = useRef(null);
  const initial = useRef<HTMLElement | null>(null);
  const open = kind !== null;

  useEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
  }, [open]);

  const requestClose = useCallback(() => {
    if (busy.current) return;
    if (guard.current?.()) return;
    onClose();
  }, [onClose]);

  const sheet = phone && !reduce;
  return (
    <Direction.Provider dir={m.dir}>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <AnimatePresence>
          {open && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.18 }}
                  className="fixed inset-0 z-50 bg-(--navy-950)/60"
                />
              </Dialog.Overlay>
              <Dialog.Content
                asChild
                forceMount
                dir={m.dir}
                onOpenAutoFocus={(ev) => {
                  // First meaningful control (the chosen preset, Choose a file, or the crop frame), not Close.
                  ev.preventDefault();
                  requestAnimationFrame(() => initial.current?.focus());
                }}
                onCloseAutoFocus={(ev) => {
                  ev.preventDefault();
                  opener.current?.focus();
                }}
              >
                <motion.div
                  initial={sheet ? { y: '100%' } : { opacity: 0, y: reduce ? 0 : 12 }}
                  animate={sheet ? { y: 0 } : { opacity: 1, y: 0 }}
                  exit={sheet ? { y: '100%' } : { opacity: 0, y: reduce ? 0 : 12 }}
                  transition={{ type: 'tween', duration: reduce ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    'ah-root fixed z-50 flex flex-col bg-(--popover) text-start text-(--ink)',
                    // Phone: full screen. From 640 px: centred by auto margins inside a fixed inset-0 box.
                    'inset-0 sm:m-auto sm:h-fit sm:max-h-[min(92dvh,800px)] sm:w-[min(960px,calc(100vw-48px))] sm:rounded-2xl sm:border sm:border-(--border)',
                  )}
                >
                  <EditorBody
                    key={kind}
                    kind={kind}
                    original={originals[kind] ?? null}
                    requestClose={requestClose}
                    onClose={onClose}
                    onSave={onSave}
                    busy={busy}
                    guard={guard}
                    initial={initial}
                    phone={phone}
                  />
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </Direction.Provider>
  );
}

function EditorBody({
  kind,
  original,
  requestClose,
  onClose,
  onSave,
  busy,
  guard,
  initial,
  phone,
}: {
  kind: EditorKind;
  original: Original | null;
  requestClose: () => void;
  onClose: () => void;
  onSave: (result: EditorResult) => Promise<void>;
  busy: { current: boolean };
  guard: Guard;
  initial: RefObject<HTMLElement | null>;
  phone: boolean;
}) {
  const m = useAccount();
  const e = m.t.editor;
  const aspect = ASPECT[kind];
  const currentCover = kind === 'cover' ? resolveCover(m.customer.cover) : null;
  const current = kind === 'cover' ? currentCover : m.customer.avatar;
  const currentPreset = currentCover?.presetId ?? null;
  const currentUpload = kind === 'cover' && currentCover && !currentCover.presetId ? currentCover : null;

  const [tab, setTab] = useState<'gallery' | 'upload'>(kind === 'avatar' || currentUpload ? 'upload' : 'gallery');
  const [preset, setPreset] = useState<CoverPresetId | null>(currentPreset);
  // Re-crop: the session original (with its last crop) opens straight in the cropper.
  const [source, setSource] = useState<Source | null>(original?.source ?? null);
  const [crop, setCrop] = useState<Crop>(original?.crop ?? INITIAL_CROP);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<CheckError | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirm, setConfirm] = useState<'remove' | 'discard' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [preview, setPreview] = useState<{ url: string; veil: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const saveBtn = useRef<HTMLButtonElement>(null);
  const keepBtn = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  const changed = tab === 'gallery' ? preset !== null && preset !== currentPreset : source !== null && dirty;

  // Closing with unsaved work asks first (Esc, Close, Cancel, a click outside).
  useEffect(() => {
    guard.current = () => {
      if (!changed) return false;
      setConfirm('discard');
      return true;
    };
    return () => {
      guard.current = null;
    };
  }, [changed, guard]);
  useEffect(() => {
    if (confirm) requestAnimationFrame(() => keepBtn.current?.focus());
  }, [confirm]);

  // A file replaced inside the editor is dropped; the session original stays alive for re-cropping.
  const sessionUrl = original?.source.url;
  useEffect(
    () => () => {
      if (source && source.url !== sessionUrl && source.url.startsWith('blob:')) URL.revokeObjectURL(source.url);
    },
    [source, sessionUrl],
  );

  const take = useCallback(async (file: File | null) => {
    if (!file) return;
    setTab('upload');
    setError(null);
    setReading(true);
    const result = await checkFile(file);
    setReading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSource(result.source);
    setCrop(INITIAL_CROP);
    setDirty(true);
  }, []);

  const adjustCurrent = async () => {
    if (!currentUpload) return;
    setReading(true);
    const s = await loadUrl(currentUpload.url);
    setReading(false);
    if (!s) return setError({ code: 'unreadable' });
    setSource(s);
    setCrop(INITIAL_CROP);
  };

  // Paste anywhere in the editor (Ctrl+V / long-press paste on phones).
  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const file = imageFrom(ev.clipboardData?.items);
      if (file) {
        ev.preventDefault();
        void take(file);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [take]);

  // Live preview of the crop, and the veil it needs, once per frame at most.
  useEffect(() => {
    if (!source) {
      setPreview(null);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const canvas = renderCrop(source, crop, aspect, kind === 'cover' ? 720 : 256);
      setPreview({ url: canvas.toDataURL('image/webp', 0.82), veil: kind === 'cover' ? measureVeil(canvas).veil : 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [source, crop, aspect, kind]);

  const updateCrop = (next: Crop, origin: CropOrigin) => {
    // The slider announces itself (aria-valuetext); only key, wheel and button changes go to the live region.
    if (origin === 'key') {
      if (next.zoom !== crop.zoom) setAnnounce(e.zoomNow(Math.round(next.zoom * 100)));
      else if (next.rotation !== crop.rotation) setAnnounce(e.rotated(next.rotation));
    }
    setCrop(next);
    setDirty(true);
  };

  const galleryPreset = tab === 'gallery' ? presetById(preset) : undefined;
  const previewUrl =
    tab === 'gallery' ? (galleryPreset?.url ?? null) : (preview?.url ?? (source ? null : (current?.url ?? null)));
  const previewVeil =
    tab === 'gallery' ? (galleryPreset?.veil ?? 0.55) : (preview?.veil ?? currentCover?.veil ?? 0.55);

  const run = async (result: EditorResult) => {
    setSaving(true);
    setSaveError(false);
    busy.current = true;
    setAnnounce(e.saving);
    try {
      await onSave(result);
      busy.current = false;
      guard.current = null;
      onClose();
    } catch {
      busy.current = false;
      setSaving(false);
      setSaveError(true);
      setConfirm(null);
      // Focus stays in the flow: back on Save, ready to retry.
      requestAnimationFrame(() => saveBtn.current?.focus());
    }
  };

  const save = async () => {
    if (!changed || saving) return;
    if (kind === 'cover' && tab === 'gallery') {
      if (preset) await run({ kind, value: { presetId: preset } });
      return;
    }
    if (!source) return;
    const canvas = renderCrop(source, crop, aspect, OUTPUT_WIDTH[kind]);
    const veil = kind === 'cover' ? measureVeil(canvas).veil : 0;
    const blob = await toBlob(canvas);
    const url = URL.createObjectURL(blob);
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    const keep: Original = { source, crop };
    await run(
      kind === 'cover'
        ? { kind, value: { fileId: `file_${Date.now().toString(36)}`, url, thumbUrl: url, expiresAt, veil }, original: keep }
        : { kind, value: { url, thumbUrl: url, expiresAt }, original: keep },
    );
  };

  const errorText = error
    ? error.code === 'type'
      ? e.errors.type
      : error.code === 'size'
        ? e.errors.size(error.mb)
        : error.code === 'dimensions'
          ? e.errors.dimensions(error.width, error.height)
          : e.errors.unreadable
    : null;

  const onDrop = (ev: DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    setDragOver(false);
    void take(imageFrom(ev.dataTransfer.items) ?? imageFrom(ev.dataTransfer.files));
  };

  const accept = ACCEPTED_TYPES.join(',');
  const setInitial = (el: HTMLElement | null) => {
    if (el) initial.current = el;
  };
  const busyClick = (fn: () => void) => () => {
    if (!saving) fn();
  };

  const uploadPanel = (
    <div className="space-y-3">
      <input
        ref={fileInput}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(ev) => {
          void take(ev.target.files?.[0] ?? null);
          ev.target.value = '';
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept={accept}
        capture={kind === 'avatar' ? 'user' : 'environment'}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(ev) => {
          void take(ev.target.files?.[0] ?? null);
          ev.target.value = '';
        }}
      />
      {source ? (
        <>
          <div ref={setInitial} tabIndex={-1} className="outline-none">
            <Cropper kind={kind} source={source} crop={crop} aspect={aspect} onChange={updateCrop} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <ZoomControl crop={crop} onChange={(zoom, origin) => updateCrop(clampCrop({ ...crop, zoom }, source, aspect), origin)} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateCrop(clampCrop({ ...crop, rotation: crop.rotation + 90 }, source, aspect), 'key')}
                className={outlineBtn}
              >
                <RotateCw aria-hidden className="size-4" />
                {e.rotate}
              </button>
              <button type="button" onClick={() => fileInput.current?.click()} className={outlineBtn}>
                <ImagePlus aria-hidden className="size-4" />
                {e.another}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div
          onDragOver={(ev) => {
            ev.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
            dragOver ? 'border-(--action) bg-(--action-soft)' : 'border-(--border-strong) bg-(--surface-2)',
          )}
          style={{ minHeight: kind === 'cover' ? 220 : 260 }}
        >
          {reading ? (
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-(--ink)">
              <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
              {e.reading}
            </p>
          ) : (
            <>
              <Upload aria-hidden className="size-7 text-(--ink-muted)" strokeWidth={1.75} />
              <p className="text-base font-semibold text-(--ink)">
                {coarse ? e.dropTitleTouch : dragOver ? e.dropActive : e.dropTitle}
              </p>
              {!coarse && <p className="text-sm text-(--ink-muted)">{e.dropOr}</p>}
              <div className="flex flex-wrap justify-center gap-2">
                <button ref={setInitial} type="button" onClick={() => fileInput.current?.click()} className={outlineBtn}>
                  <ImagePlus aria-hidden className="size-4" />
                  {e.pick}
                </button>
                {coarse && (
                  <button type="button" onClick={() => cameraInput.current?.click()} className={outlineBtn}>
                    <Camera aria-hidden className="size-4" />
                    {e.camera}
                  </button>
                )}
                {currentUpload && (
                  <button type="button" onClick={() => void adjustCurrent()} className={outlineBtn}>
                    <CropIcon aria-hidden className="size-4" />
                    {e.adjustCurrent}
                  </button>
                )}
              </div>
              {!coarse && <p className="text-sm text-(--ink-muted)">{e.pasteHint}</p>}
            </>
          )}
        </div>
      )}
      <p className="text-sm text-(--ink-muted)">{e.rules}</p>
      {errorText && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-(--danger-ink)/40 bg-(--danger-soft) p-3 text-sm font-semibold text-(--danger-ink)"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{errorText}</span>
        </p>
      )}
    </div>
  );

  const galleryPanel = (
    <fieldset>
      <legend className="sr-only">{e.galleryLabel}</legend>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        {COVER_PRESETS.map((p, i) => {
          const checked = preset === p.id;
          const first = checked || (preset === null && i === 0);
          return (
            <label
              key={p.id}
              className={cn(
                'group relative block cursor-pointer overflow-hidden rounded-lg border bg-(--surface-2) has-focus-visible:ring-2 has-focus-visible:ring-(--ring) has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-(--popover)',
                checked ? 'border-(--action) ring-2 ring-(--action)' : 'border-(--border) hover:border-(--border-strong)',
              )}
            >
              <input
                ref={first && tab === 'gallery' ? setInitial : undefined}
                type="radio"
                name={`cover-preset-${titleId}`}
                value={p.id}
                checked={checked}
                onChange={() => setPreset(p.id)}
                className="sr-only"
              />
              <img src={p.thumbUrl} alt="" width={480} height={160} className="aspect-[3/1] h-auto w-full object-cover" />
              <span className="flex min-h-10 items-center justify-between gap-1 px-2 py-1 text-sm font-semibold text-(--ink)">
                <span className="truncate">{p.name[m.locale]}</span>
                {checked && <Check aria-hidden className="size-4 shrink-0 text-(--action-ink)" strokeWidth={2.5} />}
                {!checked && p.id === currentPreset && (
                  <span className="shrink-0 text-sm font-medium text-(--ink-muted)">{e.current}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  const tabClass = cn(
    'inline-flex h-11 flex-1 items-center justify-center rounded-md px-4 text-sm font-semibold text-(--ink-muted) data-[state=active]:bg-(--card) data-[state=active]:text-(--brand-ink) data-[state=active]:shadow-sm sm:flex-none',
    focus,
  );

  const previewBlock = (
    <section aria-label={e.preview} className="min-w-0">
      <h3 className="text-sm font-semibold text-(--ink)">{e.preview}</h3>
      <p className="mb-2 text-sm text-(--ink-muted)">{kind === 'cover' ? e.previewCover : e.previewAvatar}</p>
      {kind === 'cover' ? (
        <CoverPreview url={previewUrl} veil={previewVeil} compact={phone} />
      ) : (
        <AvatarPreview url={previewUrl} />
      )}
    </section>
  );

  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-(--border) px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 pt-1">
          <Dialog.Title className="text-lg leading-snug font-bold text-(--brand-ink)">
            {kind === 'cover' ? e.coverTitle : e.avatarTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-0.5 text-sm text-(--ink-muted)">
            {kind === 'cover' ? e.coverDescription : e.avatarDescription}
          </Dialog.Description>
        </div>
        <button
          type="button"
          aria-label={e.close}
          aria-disabled={saving || undefined}
          onClick={busyClick(requestClose)}
          className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg text-(--ink) hover:bg-(--surface-2)', focus)}
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px] md:gap-6">
          {/* Phones and tablets: the preview comes first, so the result is visible without scrolling. */}
          <div className="md:order-2">{previewBlock}</div>
          <div className="min-w-0 md:order-1">
            {kind === 'cover' ? (
              <Tabs.Root dir={m.dir} value={tab} onValueChange={(v) => setTab(v as 'gallery' | 'upload')}>
                <Tabs.List aria-label={e.tabs} className="mb-4 flex gap-1 rounded-lg bg-(--surface-2) p-1 sm:inline-flex">
                  <Tabs.Trigger value="gallery" className={tabClass}>
                    {e.gallery}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="upload" className={tabClass}>
                    {e.upload}
                  </Tabs.Trigger>
                </Tabs.List>
                {/* The panels start with their own controls, so they are not an extra Tab stop. */}
                <Tabs.Content value="gallery" tabIndex={-1} className="outline-none">
                  {galleryPanel}
                </Tabs.Content>
                <Tabs.Content value="upload" tabIndex={-1} className="outline-none">
                  {uploadPanel}
                </Tabs.Content>
              </Tabs.Root>
            ) : (
              uploadPanel
            )}
          </div>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <Footer phone={phone}>
        {saveError && (
          <p role="alert" className="flex w-full items-center gap-2 text-sm font-semibold text-(--danger-ink)">
            <AlertCircle aria-hidden className="size-4 shrink-0" />
            {e.errors.save}
          </p>
        )}
        {confirm ? (
          <div
            role="group"
            aria-label={confirm === 'remove' ? e.remove[kind] : e.discardConfirm}
            className="flex w-full flex-wrap items-center gap-2"
          >
            <p className="me-auto min-w-0 text-sm font-semibold text-(--ink)">
              {confirm === 'remove' ? e.removeConfirm[kind] : e.discardConfirm}
            </p>
            <button
              ref={keepBtn}
              type="button"
              aria-disabled={saving || undefined}
              onClick={busyClick(() => setConfirm(null))}
              className={outlineBtn}
            >
              {confirm === 'remove' ? e.keep : e.keepEditing}
            </button>
            <button
              type="button"
              aria-disabled={saving || undefined}
              aria-busy={saving || undefined}
              onClick={busyClick(() => {
                if (confirm === 'discard') {
                  guard.current = null;
                  onClose();
                } else void run(kind === 'cover' ? { kind, value: null, original: null } : { kind, value: null, original: null });
              })}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-(--red-700) px-4 text-sm font-bold text-white hover:opacity-90',
                focus,
              )}
            >
              {saving ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
              {saving ? e.saving : confirm === 'remove' ? e.removeYes : e.discardYes}
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-wrap items-center gap-2">
            {current && (
              <button
                type="button"
                aria-disabled={saving || undefined}
                onClick={busyClick(() => setConfirm('remove'))}
                className={cn(
                  'me-auto inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-(--danger-ink) hover:bg-(--danger-soft) aria-disabled:opacity-50',
                  focus,
                )}
              >
                <Trash2 aria-hidden className="size-4" />
                {e.remove[kind]}
              </button>
            )}
            <div className="ms-auto flex flex-1 gap-2 sm:flex-none">
              <button
                type="button"
                aria-disabled={saving || undefined}
                onClick={busyClick(requestClose)}
                className={cn(outlineBtn, 'flex-1 sm:flex-none')}
              >
                {e.cancel}
              </button>
              <button
                ref={saveBtn}
                type="button"
                onClick={() => void save()}
                aria-disabled={!changed || saving || undefined}
                aria-busy={saving || undefined}
                className={cn(primaryBtn, 'flex-1 sm:flex-none')}
              >
                {saving && <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />}
                {saving ? e.saving : e.save}
              </button>
            </div>
          </div>
        )}
      </Footer>
    </>
  );
}

function Footer({ phone, children }: { phone: boolean; children: ReactNode }) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2 border-t border-(--border) bg-(--popover) px-4 py-3 sm:rounded-b-2xl sm:px-6"
      style={phone ? { paddingBottom: 'max(12px, env(safe-area-inset-bottom))' } : undefined}
    >
      {children}
    </div>
  );
}
