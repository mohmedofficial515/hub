'use client';

/**
 * @file redesign.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/sheet-sections/redesign.tsx. Contract: apps/web/README.md.
 */
import { ExternalLink, FileText, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';

import { ActorChip } from '@/components/cards/avatar';
import { CardChip } from '@/components/cards/card-key';
import { focusRing, focusRingInset } from '@/components/cards/meta';
import {
  Fact,
  Facts,
  NoteActionForm,
  type SectionProps,
  SubHeading,
} from '@/components/cards/sheet-sections/shared';
import { Lightbox } from '@/components/common/lightbox';
import { MarkdownView } from '@/components/common/markdown';
import { RelativeTime } from '@/components/common/relative-time';
import { Bidi, fmt, Ltr } from '@/components/common/text';
import { Modal } from '@/components/ui/dialog';
import { type ShotMeta, shotsOf } from '@/features/redesign/sheet-support';
import { useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import type { RedesignMessages } from '@/lib/i18n/page-dicts';

const linkClass = `inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline hit-44 ${focusRing}`;

/** 08 §5.4: thumbnails that open the Lightbox on the same picture. */
function Screenshots({ shots, version }: { shots: ShotMeta[]; version: string }) {
  const t = useT<RedesignMessages>('redesign');
  const kit = useT(kitMessages);
  const srcs: string[] = shots.map((s) => s.url);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  return (
    <div className="flex flex-col gap-1.5">
      <SubHeading>{kit.sheet.redesign.shots}</SubHeading>
      {shots.length === 0 ? (
        <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <ImageIcon aria-hidden className="size-4" strokeWidth={1.75} />
          {t.sheet.noShots}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shots.map((shot, i) => (
            <li key={shot.name}>
              <button
                type="button"
                aria-label={fmt(t.sheet.enlarge, { name: shot.name })}
                onClick={() => {
                  setIndex(i);
                  setOpen(true);
                }}
                className={`group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-start hover:bg-accent ${focusRingInset}`}
              >
                <span className="relative block aspect-video overflow-hidden bg-muted">
                  {srcs[i] && (
                    <img
                      src={srcs[i]}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover object-top"
                    />
                  )}
                </span>
                <code
                  dir="ltr"
                  translate="no"
                  className="key truncate border-t border-border px-1.5 py-1 text-start text-caption text-muted-foreground"
                >
                  {shot.name}
                </code>
              </button>
            </li>
          ))}
        </ul>
      )}
      {srcs.length > 0 && (
        <Lightbox
          open={open}
          onOpenChange={setOpen}
          index={index}
          onIndexChange={setIndex}
          images={shots.map((s, i) => ({ src: srcs[i] ?? '', name: s.name, alt: `${version}: ${s.name}` }))}
        />
      )}
    </div>
  );
}

export function RedesignSection({ card, action, cancelAction, perform }: SectionProps<'redesign'>) {
  const t = useT(kitMessages);
  const page = useT<RedesignMessages>('redesign');
  const r = card.redesign;
  const s = t.sheet.redesign;
  const [review, setReview] = useState(false);
  // The real API returns `portTaskId`. In the lab, the catalogue's port task is the one this card blocks.
  const portKey =
    r.portTaskKey ??
    (card.status === 'approved' || card.status === 'ported'
      ? card.links.find((l) => l.kind === 'blocks')?.key
      : undefined);
  return (
    <div className="flex flex-col gap-5">
      {action === 'approve' && (
        <NoteActionForm
          noteLabel={s.noteOptional}
          saveLabel={s.saveApprove}
          onSave={(note) => perform('approve', { note: note || undefined })}
          onCancel={cancelAction}
        />
      )}
      {action === 'request_changes' && (
        <NoteActionForm
          noteLabel={t.sheet.fields.note}
          required
          requiredMessage={s.noteRequired}
          saveLabel={s.saveChanges}
          onSave={(note) => perform('request_changes', { note })}
          onCancel={cancelAction}
        />
      )}
      {action === 'reject' && (
        <NoteActionForm
          noteLabel={t.sheet.fields.note}
          required
          requiredMessage={s.noteRequired}
          saveLabel={s.saveReject}
          destructive
          onSave={(note) => perform('reject', { note })}
          onCancel={cancelAction}
        />
      )}
      {action === 'mark_ported' && (
        <NoteActionForm
          hint={page.sheet.markPortedHint}
          noteLabel={page.sheet.markPortedRef}
          required
          requiredMessage={page.sheet.refRequired}
          saveLabel={page.sheet.savePorted}
          onSave={(ref) => perform('mark_ported', { ref })}
          onCancel={cancelAction}
        />
      )}

      <div className="flex flex-col gap-1">
        <code dir="ltr" translate="no" className="key text-start text-body-sm break-all text-foreground">
          {r.labPath}
        </code>
        <p className="text-body text-foreground">
          <Bidi>{r.concept}</Bidi>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <a href={r.labUrl.replace(/^\/lab\//, '/')} target="_blank" rel="noreferrer" className={linkClass}>
            {s.openLab}
            <ExternalLink aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
          </a>
        </div>
      </div>

      <Facts>
        {r.base && (
          <Fact label={s.base}>
            <Ltr mono>{r.base}</Ltr>
          </Fact>
        )}
        {r.reviewScore !== undefined && (
          <Fact label={s.score}>
            <Ltr className="font-semibold tabular-nums">{r.reviewScore}/100</Ltr>
          </Fact>
        )}
        {r.reviewSummary && (
          <Fact label={s.review} wide>
            <Bidi>{r.reviewSummary}</Bidi>
          </Fact>
        )}
        {r.approvedById && (
          <Fact label={t.status.approved} wide>
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip memberId={r.approvedById} />
              {r.approvedAt && <RelativeTime iso={r.approvedAt} className="text-muted-foreground" />}
            </span>
          </Fact>
        )}
        {r.rejectedById && (
          <Fact label={t.status.rejected} wide>
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip memberId={r.rejectedById} />
              {r.rejectedAt && <RelativeTime iso={r.rejectedAt} className="text-muted-foreground" />}
            </span>
          </Fact>
        )}
        {r.decisionNote && (
          <Fact label={t.sheet.fields.note} wide>
            <Bidi>{r.decisionNote}</Bidi>
          </Fact>
        )}
        {portKey && (
          <Fact label={s.portTask}>
            <CardChip k={portKey} />
          </Fact>
        )}
        {r.portedRef && (
          <Fact label={s.ported} wide>
            <Ltr mono className="break-all">
              {r.portedRef}
            </Ltr>
          </Fact>
        )}
      </Facts>

      {r.touchesComponents.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{s.touches}</SubHeading>
          <ul className="flex flex-wrap gap-1.5">
            {r.touchesComponents.map((path) => (
              <li key={path}>
                <code
                  dir="ltr"
                  translate="no"
                  className="key inline-block max-w-full rounded-sm bg-muted px-1.5 py-0.5 text-caption break-all text-foreground"
                >
                  {path}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Screenshots shots={shotsOf(card)} version={r.version} />

      {card.attachments.some((x) => x.kind === 'review') && (
        <button type="button" onClick={() => setReview(true)} className={`self-start ${linkClass}`}>
          <FileText aria-hidden className="size-3.5" strokeWidth={1.75} />
          {s.openReview}
        </button>
      )}

      <Modal
        open={review}
        onOpenChange={setReview}
        title={fmt(page.sheet.reviewTitle, { version: r.version })}
        className="md:max-w-2xl"
      >
        {review && (
          <MarkdownView
            source={r.reviewSummary ?? ''}
            dir="ltr"
            headingOffset={2}
            copyCodeLabel={page.sheet.copyCode}
          />
        )}
      </Modal>
    </div>
  );
}
