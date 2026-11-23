import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Dialog, Tabs } from 'radix-ui';
import { AlertCircle, Camera, Check, ImagePlus, Loader2, RotateCw, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@lab/utils';

import { COVER_PRESETS, presetById, type CoverPresetId } from '../covers';
import type { Cover, Customer } from '../mock';
import { useAccount } from '../model';
import {
  ACCEPTED_TYPES,
  ASPECT,
  checkFile,
  clampCrop,
  imageFrom,
  INITIAL_CROP,
  OUTPUT_WIDTH,
  renderCrop,
  toBlob,
  type CheckError,
  type Crop,
  type EditorKind,
  type Source,
} from './crop';
import { Cropper, ZoomControl } from './cropper';
import { AvatarPreview, CoverPreview } from './previews';

/** What a save hands back to the page: the new value (null = removed). In the port this is the API response. */
export type EditorResult =
  | { kind: 'cover'; value: Cover | null }
  | { kind: 'avatar'; value: Customer['avatar'] };

const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--popover)';
const outlineBtn = cn(
  'inline-flex h-11 items-center justify-center gap-2 rounded-md border border-(--border-strong) px-4 text-sm font-semibold text-(--brand-ink) hover:bg-(--surface-2) disabled:opacity-50',
  focus,
);
const primaryBtn = cn(
  'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-(--action) px-5 text-sm font-bold text-(--action-foreground) hover:bg-(--action-hover) disabled:cursor-not-allowed disabled:opacity-50',
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

/**
 * One editor for the cover and the profile photo. Desktop: a centred dialog with the source / crop on the start side
 * and the in-context preview on the end side. Below 640 px: a full-screen sheet that slides up, preview under the
 * crop, actions pinned to the bottom (safe-area aware). Built on Radix Dialog: focus trap, Escape, inert page.
 */
export function ImageEditor({
  kind,
  onClose,
  onSave,
}: {
  kind: EditorKind | null;
  onClose: () => void;
  /** Mock save: resolves after a short delay; rejects to show the save error. */
  onSave: (result: EditorResult) => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const phone = !useMedia('(min-width: 640px)');
  const opener = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const open = kind !== null;

  useEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
  }, [open]);

  const sheet = phone && !reduce;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy.current) onClose();
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
                  'ah-root fixed z-50 flex flex-col bg-(--popover) text-(--ink)',
                  // Phone: full screen. From 640 px: centred by auto margins inside a fixed inset-0 box.
                  'inset-0 sm:m-auto sm:h-fit sm:max-h-[min(92dvh,780px)] sm:w-[min(920px,calc(100vw-48px))] sm:rounded-2xl sm:border sm:border-(--border)',
                )}
              >
                <EditorBody key={kind} kind={kind} onClose={onClose} onSave={onSave} busy={busy} phone={phone} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function EditorBody({
  kind,
  onClose,
  onSave,
  busy,
  phone,
}: {
  kind: EditorKind;
  onClose: () => void;
  onSave: (result: EditorResult) => Promise<void>;
  busy: { current: boolean };
  phone: boolean;
}) {
  const m = useAccount();
  const e = m.t.editor;
  const aspect = ASPECT[kind];
  const current = kind === 'cover' ? m.customer.cover : m.customer.avatar;
  const currentPreset = kind === 'cover' ? (m.customer.cover?.presetId ?? null) : null;

  const [tab, setTab] = useState<'gallery' | 'upload'>(
    kind === 'avatar' || (m.customer.cover && !m.customer.cover.presetId) ? 'upload' : 'gallery',
  );
  const [preset, setPreset] = useState<CoverPresetId | null>(currentPreset);
  const [source, setSource] = useState<Source | null>(null);
  const [crop, setCrop] = useState<Crop>(INITIAL_CROP);
  const [error, setError] = useState<CheckError | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  // Drop the object URL of a replaced or abandoned file.
  useEffect(() => () => void (source && URL.revokeObjectURL(source.url)), [source]);

  const take = useCallback(
    async (file: File | null) => {
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
    },
    [],
  );

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

  // Live preview of the crop, at preview size, once per frame at most.
  useEffect(() => {
    if (!source) {
      setPreview(null);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const canvas = renderCrop(source, crop, aspect, kind === 'cover' ? 720 : 256);
      setPreview(canvas.toDataURL('image/webp', 0.82));
    });
    return () => cancelAnimationFrame(raf);
  }, [source, crop, aspect, kind]);

  const updateCrop = (next: Crop) => {
    if (next.zoom !== crop.zoom) setAnnounce(e.zoomNow(Math.round(next.zoom * 100)));
    else if (next.rotation !== crop.rotation) setAnnounce(e.rotated(next.rotation));
    setCrop(next);
  };

  const galleryUrl = tab === 'gallery' ? (presetById(preset)?.url ?? null) : null;
  const previewUrl = tab === 'gallery' ? galleryUrl : (preview ?? (source ? null : (current?.url ?? null)));
  const changed = tab === 'gallery' ? preset !== null && preset !== currentPreset : source !== null;

  const run = async (result: EditorResult) => {
    setSaving(true);
    setSaveError(false);
    busy.current = true;
    setAnnounce(e.saving);
    try {
      await onSave(result);
      busy.current = false;
      onClose();
    } catch {
      busy.current = false;
      setSaving(false);
      setSaveError(true);
    }
  };

  const save = async () => {
    if (!changed || saving) return;
    if (kind === 'cover' && tab === 'gallery') {
      const p = presetById(preset);
      if (p) await run({ kind, value: { url: p.url, thumbUrl: p.thumbUrl, expiresAt: null, presetId: p.id } });
      return;
    }
    if (!source) return;
    const blob = await toBlob(renderCrop(source, crop, aspect, OUTPUT_WIDTH[kind]));
    const url = URL.createObjectURL(blob);
    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    await run(
      kind === 'cover'
        ? { kind, value: { url, thumbUrl: url, expiresAt, presetId: null } }
        : { kind, value: { url, thumbUrl: url, expiresAt } },
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
          <Cropper kind={kind} source={source} crop={crop} aspect={aspect} onChange={updateCrop} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <ZoomControl crop={crop} onChange={(zoom) => updateCrop(clampCrop({ ...crop, zoom }, source, aspect))} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateCrop(clampCrop({ ...crop, rotation: crop.rotation + 90 }, source, aspect))}
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
              <p className="text-base font-semibold text-(--ink)">{dragOver ? e.dropActive : e.dropTitle}</p>
              <p className="text-sm text-(--ink-muted)">{e.dropOr}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => fileInput.current?.click()} className={outlineBtn}>
                  <ImagePlus aria-hidden className="size-4" />
                  {e.pick}
                </button>
                {coarse && (
                  <button type="button" onClick={() => cameraInput.current?.click()} className={outlineBtn}>
                    <Camera aria-hidden className="size-4" />
                    {e.camera}
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
          {errorText}
        </p>
      )}
    </div>
  );

  const galleryPanel = (
    <fieldset>
      <legend className="sr-only">{e.galleryLabel}</legend>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        {COVER_PRESETS.map((p) => {
          const checked = preset === p.id;
          return (
            <label
              key={p.id}
              className={cn(
                'group relative block cursor-pointer overflow-hidden rounded-lg border bg-(--surface-2) has-focus-visible:ring-2 has-focus-visible:ring-(--ring) has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-(--popover)',
                checked ? 'border-(--action) ring-2 ring-(--action)' : 'border-(--border) hover:border-(--border-strong)',
              )}
            >
              <input
                type="radio"
                name={`cover-preset-${titleId}`}
                value={p.id}
                checked={checked}
                onChange={() => setPreset(p.id)}
                className="sr-only"
              />
              <img src={p.thumbUrl} alt="" width={480} height={160} className="aspect-[3/1] h-auto w-full object-cover" />
              <span className="flex min-h-9 items-center justify-between gap-1 px-2 py-1 text-sm font-semibold text-(--ink)">
                <span className="truncate">{p.name[m.locale]}</span>
                {checked && <Check aria-hidden className="size-4 shrink-0 text-(--action-ink)" strokeWidth={2.5} />}
                {!checked && p.id === currentPreset && (
                  <span className="shrink-0 text-xs text-(--ink-muted)">{e.current}</span>
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

  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-(--border) px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 pt-1">
          <Dialog.Title id={titleId} className="text-lg leading-snug font-bold text-(--brand-ink)">
            {kind === 'cover' ? e.coverTitle : e.avatarTitle}
          </Dialog.Title>
          <Dialog.Description id={descId} className="mt-0.5 text-sm text-(--ink-muted)">
            {kind === 'cover' ? e.coverDescription : e.avatarDescription}
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <button
            type="button"
            aria-label={e.close}
            disabled={saving}
            className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg text-(--ink) hover:bg-(--surface-2)', focus)}
          >
            <X aria-hidden className="size-5" />
          </button>
        </Dialog.Close>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px] md:gap-6">
          <div className="min-w-0">
            {kind === 'cover' ? (
              <Tabs.Root value={tab} onValueChange={(v) => setTab(v as 'gallery' | 'upload')}>
                <Tabs.List aria-label={e.tabs} className="mb-4 flex gap-1 rounded-lg bg-(--surface-2) p-1 sm:inline-flex">
                  <Tabs.Trigger value="gallery" className={tabClass}>
                    {e.gallery}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="upload" className={tabClass}>
                    {e.upload}
                  </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="gallery" className={cn('rounded-lg', focus)}>
                  {galleryPanel}
                </Tabs.Content>
                <Tabs.Content value="upload" className={cn('rounded-lg', focus)}>
                  {uploadPanel}
                </Tabs.Content>
              </Tabs.Root>
            ) : (
              uploadPanel
            )}
          </div>

          <section aria-label={e.preview} className="min-w-0">
            <h3 className="text-sm font-semibold text-(--ink)">{e.preview}</h3>
            <p className="mb-2 text-sm text-(--ink-muted)">{kind === 'cover' ? e.previewCover : e.previewAvatar}</p>
            {kind === 'cover' ? <CoverPreview url={previewUrl} /> : <AvatarPreview url={previewUrl} />}
          </section>
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
        {confirmRemove ? (
          <div role="group" aria-label={e.remove[kind]} className="flex w-full flex-wrap items-center gap-2">
            <p className="me-auto min-w-0 text-sm font-semibold text-(--ink)">{e.removeConfirm[kind]}</p>
            <button type="button" autoFocus onClick={() => setConfirmRemove(false)} className={outlineBtn}>
              {e.keep}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void run(kind === 'cover' ? { kind, value: null } : { kind, value: null })}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-(--red-700) px-4 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50',
                focus,
              )}
            >
              {saving ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
              {saving ? e.saving : e.removeYes}
            </button>
          </div>
        ) : (
          <div className="flex w-full flex-wrap items-center gap-2">
            {current && (
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmRemove(true)}
                className={cn(
                  'me-auto inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-(--danger-ink) hover:bg-(--danger-soft) disabled:opacity-50',
                  focus,
                )}
              >
                <Trash2 aria-hidden className="size-4" />
                {e.remove[kind]}
              </button>
            )}
            <div className="ms-auto flex flex-1 gap-2 sm:flex-none">
              <Dialog.Close asChild>
                <button type="button" disabled={saving} className={cn(outlineBtn, 'flex-1 sm:flex-none')}>
                  {e.cancel}
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!changed || saving}
                aria-busy={saving || undefined}
                className={cn(primaryBtn, 'flex-1 aria-busy:opacity-100 sm:flex-none')}
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
