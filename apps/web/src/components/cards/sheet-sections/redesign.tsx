'use client';

/**
 * @file redesign.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/sheet-sections/redesign.tsx. Contract: apps/web/README.md.
 */
import { ExternalLink, FileText, GitCompareArrows, Image as ImageIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
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
import { hrefFor } from '@/components/shell/router';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { versionQuery } from '@/features/redesign/gallery';
import { compareDefaults, type ShotMeta, shotsFrom } from '@/features/redesign/lab';
import { useVersionFiles } from '@/features/redesign/queries';
import { usePageVersions } from '@/features/redesign/sheet-support';
import { useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import type { RedesignMessages } from '@/lib/i18n/page-dicts';

const RedesignCompare = dynamic(() => import('@/components/redesign/compare'), { ssr: false });

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
  const [compare, setCompare] = useState(false);
  const [review, setReview] = useState(false);
  const files = useVersionFiles(card.key, review);
  const versions = usePageVersions(card);
  const [a, b] = compareDefaults(card, versions);
  const portKey = r.portTaskKey;
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
          <a
            href={hrefFor('redesign', { card: null, query: versionQuery(r) })}
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            {s.openLab}
            <ExternalLink aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
          </a>
          {versions.length > 1 && (
            <Button onClick={() => setCompare(true)}>
              <GitCompareArrows aria-hidden className="size-4" strokeWidth={1.75} />
              {s.compare}
            </Button>
          )}
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

      <Screenshots shots={shotsFrom(card.attachments)} version={r.version} />

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
            source={files.data?.review ?? r.reviewSummary ?? ''}
            dir="ltr"
            headingOffset={1}
            copyCodeLabel={page.sheet.copyCode}
          />
        )}
      </Modal>

      {compare && (
        <RedesignCompare
          open={compare}
          a={a}
          b={b}
          versions={versions}
          pageLabel={`${r.app}/${r.page}`}
          onOpenChange={setCompare}
        />
      )}
    </div>
  );
}
