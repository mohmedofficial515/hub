'use client';

/**
 * @file step-evidence.tsx
 * @description A step's evidence in its drawer (v5-live-plan, batch 3): the before and after on one frame, every picture in the lightbox, each clip in
 * a player, and, for a member who may, adding a file (a picture or a clip, its kind and a caption) and removing one. Hub checks every file from its
 * bytes; the page checks the type and size first only so a wrong file is said at once.
 */
import { Bot, Images, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import {
  Button,
  ConfirmDialog,
  fmt,
  focusRing,
  IconButton,
  kitMessages,
  Lightbox,
  type LightboxImage,
  num,
  showToast,
  useLocale,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import { Field, Select, TextInput } from '@/components/ui/form';
import type { StepEvidence } from '@/features/cards/types';
import {
  addEvidence,
  defaultKind,
  EVIDENCE_ACCEPT,
  EVIDENCE_IMAGE_MAX_BYTES,
  EVIDENCE_KINDS,
  EVIDENCE_VIDEO_MAX_BYTES,
  type EvidenceKind,
  evidenceName,
  evidenceUrl,
  removeEvidence,
} from '@/features/planning/evidence';
import type { JourneyStep } from '@/features/planning/journey';
import { isHubError } from '@/lib/api/errors';

import { Compare } from './compare';
import { FileDrop } from './file-drop';
import type { PlanningMessages } from './messages';

const ACCEPTED = new Set(EVIDENCE_ACCEPT.split(','));

/** Why a file cannot go, before it is sent: its type or its size. Null when it may. */
export function fileProblem(file: File, kind: EvidenceKind): 'type' | 'size' | 'kind' | null {
  if (!ACCEPTED.has(file.type)) return 'type';
  const video = file.type.startsWith('video/');
  if (file.size > (video ? EVIDENCE_VIDEO_MAX_BYTES : EVIDENCE_IMAGE_MAX_BYTES)) return 'size';
  if (video !== (kind === 'video')) return 'kind';
  return null;
}

function AddEvidence({ cardKey, step }: { cardKey: string; step: JourneyStep }) {
  const e = useT<PlanningMessages>('planning').detail.evidence;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<EvidenceKind>(() => defaultKind(null, step.evidence ?? []));
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words: Record<'type' | 'size' | 'kind', string> = {
    type: e.wrongType,
    size: e.tooLarge,
    kind: e.wrongKind,
  };
  /** A type or size problem is said as soon as the file is chosen; the kind is checked on send, as it may still change. */
  const fileProblemWords = (picked: File) => {
    const problem = fileProblem(picked, picked.type.startsWith('video/') ? 'video' : 'after');
    return problem && problem !== 'kind' ? words[problem] : undefined;
  };

  const send = async () => {
    if (!file) {
      setError(e.chooseFile);
      return;
    }
    const problem = fileProblem(file, kind);
    if (problem) {
      setError(words[problem]);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await addEvidence(cardKey, step.id, { file, kind, caption });
      showToast({ message: fmt(e.uploaded, { n: num(step.n, locale) }) });
      setFile(null);
      setCaption('');
      setKind(defaultKind(null, [...(step.evidence ?? []), { kind } as StepEvidence]));
    } catch (failure: unknown) {
      setError(isHubError(failure) ? failure.message : kit.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      data-pj-evidence-form
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-dashed border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <FileDrop
        accept={EVIDENCE_ACCEPT}
        file={file}
        error={error}
        words={{
          label: e.file,
          hint: e.fileHint,
          drop: e.drop,
          dropOr: e.dropOr,
          choose: e.choose,
          chosen: e.chosen,
          clearFile: e.clearFile,
          dropActive: e.dropActive,
        }}
        onFile={(picked) => {
          setFile(picked);
          setError(picked ? (fileProblemWords(picked) ?? null) : null);
          if (picked) setKind(defaultKind(picked, step.evidence ?? []));
        }}
      />
      <div className="grid min-w-0 gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field id={`${id}-kind`} label={e.kind}>
          <Select
            id={`${id}-kind`}
            value={kind}
            onChange={(event) => setKind(event.target.value as EvidenceKind)}
          >
            {EVIDENCE_KINDS.map((value) => (
              <option key={value} value={value}>
                {e.kinds[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-caption`} label={e.caption} hint={e.captionHint}>
          <TextInput
            id={`${id}-caption`}
            dir="auto"
            maxLength={200}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />
        </Field>
      </div>
      <Button type="submit" size="sm" className="self-start" disabled={busy}>
        <Plus aria-hidden className="size-3.5" strokeWidth={1.75} />
        {busy ? e.uploading : e.upload}
      </Button>
    </form>
  );
}

export function StepEvidenceSection({
  cardKey,
  step,
  canAdd,
  canRemove: canRemoveAny,
}: {
  cardKey: string;
  step: JourneyStep;
  canAdd: boolean;
  /** The plan's owner, a pm or its creator: any file. Anyone else removes only what they added. */
  canRemove: boolean;
}) {
  const e = useT<PlanningMessages>('planning').detail.evidence;
  const kit = useT(kitMessages);
  const { ws } = useRoute();
  const [shot, setShot] = useState<number | null>(null);
  const [removing, setRemoving] = useState<StepEvidence | null>(null);
  const [adding, setAdding] = useState(false);
  const evidence = step.evidence ?? [];
  const { me } = useSession();
  const canRemove = (item: StepEvidence) => canRemoveAny || (!!item.addedBy && item.addedBy === me.id);
  const url = (item: StepEvidence) => evidenceUrl(ws, cardKey, item.attachmentId);
  const thumb = (item: StepEvidence) => (item.thumb ? `${url(item)}?size=thumb` : url(item));
  const before = evidence.find((item) => item.kind === 'before');
  const after = evidence.find((item) => item.kind === 'after');
  const pictures = evidence.filter((item) => item.kind !== 'video');
  const videos = evidence.filter((item) => item.kind === 'video');
  const images: LightboxImage[] = pictures.map((item) => ({
    src: url(item),
    name: evidenceName(item),
    alt: item.caption ?? e.kinds[item.kind],
  }));

  const remove = (item: StepEvidence) => {
    removeEvidence(cardKey, step.id, item.attachmentId)
      .then(() => showToast({ message: e.removed }))
      .catch((failure: unknown) =>
        showToast({ tone: 'error', message: isHubError(failure) ? failure.message : kit.actionFailed }),
      );
  };

  return (
    <div data-pj-evidence className="flex min-w-0 flex-col gap-3">
      {evidence.length === 0 && <p className="text-body-sm text-muted-foreground">{e.none}</p>}
      {before && after && (
        <Compare
          before={url(before)}
          after={url(after)}
          beforeAlt={before.caption ?? e.before}
          afterAlt={after.caption ?? e.after}
        />
      )}
      {videos.map((item) => (
        <figure key={item.attachmentId} className="flex min-w-0 flex-col gap-1.5">
          {/* A clip has no captions file of its own; its caption is the line under it. */}
          <video className="pj-video" src={url(item)} controls preload="metadata" playsInline />
          <figcaption dir="auto" className="flex items-center gap-1.5 text-caption text-muted-foreground">
            {item.via === 'mcp' && <Bot aria-label={e.byClaude} className="size-3.5" strokeWidth={1.75} />}
            {item.caption ?? e.kinds.video}
            {canRemove(item) && (
              <IconButton
                label={fmt(e.remove, { name: evidenceName(item) })}
                className="ms-auto"
                onClick={() => setRemoving(item)}
              >
                <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
            )}
          </figcaption>
        </figure>
      ))}
      {pictures.length > 0 && (
        <ul className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3" aria-label={e.title}>
          {pictures.map((item, index) => (
            <li key={item.attachmentId} className="flex min-w-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => setShot(index)}
                aria-label={fmt(e.open, { name: evidenceName(item) })}
                className={`relative overflow-hidden rounded-lg border border-border bg-muted ${focusRing}`}
              >
                <img src={thumb(item)} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                <span className="pj-compare-tag" style={{ insetInlineStart: '0.375rem' }}>
                  {e.kinds[item.kind]}
                </span>
              </button>
              <span className="flex min-w-0 items-center gap-1">
                {item.via === 'mcp' && (
                  <Bot
                    aria-label={e.byClaude}
                    className="size-3.5 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                )}
                <span dir="auto" className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
                  {item.caption ?? e.kinds[item.kind]}
                </span>
                {canRemove(item) && (
                  <IconButton
                    label={fmt(e.remove, { name: evidenceName(item) })}
                    onClick={() => setRemoving(item)}
                  >
                    <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                  </IconButton>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canAdd &&
        (adding ? (
          <AddEvidence cardKey={cardKey} step={step} />
        ) : (
          <Button size="sm" variant="outline" className="self-start" onClick={() => setAdding(true)}>
            <Images aria-hidden className="size-3.5" strokeWidth={1.75} />
            {e.add}
          </Button>
        ))}
      <Lightbox
        images={images}
        index={shot ?? 0}
        open={shot !== null}
        onOpenChange={(open) => !open && setShot(null)}
        onIndexChange={setShot}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={e.removeTitle}
        description={e.removeBody}
        confirmLabel={removing ? fmt(e.remove, { name: evidenceName(removing) }) : ''}
        onConfirm={() => {
          if (removing) remove(removing);
          setRemoving(null);
        }}
      />
    </div>
  );
}
