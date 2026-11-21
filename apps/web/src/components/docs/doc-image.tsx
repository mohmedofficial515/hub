'use client';

/**
 * @file doc-image.tsx
 * @description An image a document names from its own folder, drawn through the API (decision 13b, 09 §11), and the Lightbox it opens in.
 * The viewer lists the doc's local images once (`localImagesOf`), so the Lightbox steps through them in reading order. A file the API
 * cannot serve becomes a framed note with its name, as the stand-in for a remote image does. Inside a link the picture is not a button:
 * the link is what a click does there.
 */
import { ImageOff } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { cn, fmt, focusRing, Lightbox, type LightboxImage, type MarkdownImage, useT } from '@/components/kit';
import { type DocImageRef, docImageUrl, imageName, isLocalImage } from '@/features/docs/images';

import type { DocsMessages } from './messages';

export interface DocImages {
  /** What `MarkdownView`'s `renderImage` takes. */
  render: (image: MarkdownImage, inLink: boolean) => ReactNode;
  /** The Lightbox itself, once beside the doc. */
  lightbox: ReactNode;
}

function Picture({ url, image, onOpen }: { url: string; image: MarkdownImage; onOpen: (() => void) | null }) {
  const t = useT<DocsMessages>('docs');
  const [failed, setFailed] = useState(false);
  const name = imageName(image.src);
  if (failed) {
    return (
      <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-dashed border-border px-2 py-0.5 align-middle text-body-sm text-muted-foreground">
        <ImageOff aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        <span dir="auto" className="min-w-0 break-words">
          {image.alt ? `${image.alt} · ` : ''}
          {fmt(t.images.missing, { name })}
        </span>
      </span>
    );
  }
  const img = (
    <img
      src={url}
      alt={image.alt}
      title={image.title ?? undefined}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-auto max-w-full rounded-md border border-border bg-card"
    />
  );
  if (!onOpen) return img;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={fmt(t.images.open, { name: image.alt || name })}
      className={cn('inline-block max-w-full cursor-zoom-in rounded-md align-middle', focusRing)}
    >
      {img}
    </button>
  );
}

/** The doc's local images, with one Lightbox for all of them. */
export function useDocImages(ws: string, docKey: string, images: readonly DocImageRef[]): DocImages {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const lightboxImages: LightboxImage[] = images.map((image) => ({
    src: docImageUrl(ws, docKey, image.src),
    name: imageName(image.src),
    alt: image.alt || undefined,
  }));
  const render = (image: MarkdownImage, inLink: boolean) => {
    if (!isLocalImage(image.src)) return undefined;
    const at = images.findIndex((known) => known.src === image.src);
    const onOpen =
      inLink || at < 0
        ? null
        : () => {
            setIndex(at);
            setOpen(true);
          };
    return <Picture url={docImageUrl(ws, docKey, image.src)} image={image} onOpen={onOpen} />;
  };
  const lightbox =
    lightboxImages.length > 0 ? (
      <Lightbox
        images={lightboxImages}
        index={Math.min(index, lightboxImages.length - 1)}
        open={open}
        onOpenChange={setOpen}
        onIndexChange={setIndex}
      />
    ) : null;
  return { render, lightbox };
}
