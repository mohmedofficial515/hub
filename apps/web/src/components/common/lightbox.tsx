'use client';

/**
 * @file lightbox.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/lightbox.tsx. Contract: apps/web/README.md.
 */
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect } from 'react';

import { focusRing } from '@/components/cards/meta';
import { fmt, Ltr } from '@/components/common/text';
import { IconButton } from '@/components/ui/button';
import { num } from '@/lib/format';
import { portalRoot, useFocusReturn } from '@/lib/hooks';
import { useLocale, useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { matchKey } from '@/lib/keys';
import { cn } from '@/lib/utils';

export interface LightboxImage {
  src: string;
  /** The file name: the caption, and the name a download gets (09 §19). */
  name: string;
  /** Alt text. Defaults to the file name. */
  alt?: string | undefined;
}

/**
 * 09 §19: screenshots at reading size, with arrows, the file name as the caption, and download. Full-page shots are
 * tall, so a picture fills the width and scrolls instead of shrinking to a thumbnail. The arrow keys follow reading
 * direction: in Arabic, Left is next. Portals into the version root and stacks over the sheet.
 */
export function Lightbox({
  images,
  index,
  open,
  onOpenChange,
  onIndexChange,
}: {
  images: LightboxImage[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
}) {
  const t = useT(kitMessages).sections.lightbox;
  const locale = useLocale();
  const onCloseAutoFocus = useFocusReturn(open);
  const image = images[index];
  const many = images.length > 1;
  const go = (delta: number) => onIndexChange((index + delta + images.length) % images.length);

  useEffect(() => {
    if (!open || !many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!matchKey(e, 'ArrowLeft') && !matchKey(e, 'ArrowRight')) return;
      e.preventDefault();
      const forward = matchKey(e, 'ArrowRight');
      go((locale === 'ar' ? !forward : forward) ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!image) return null;
  const Previous = locale === 'ar' ? ChevronRight : ChevronLeft;
  const Next = locale === 'ar' ? ChevronLeft : ChevronRight;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={portalRoot()}>
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          aria-describedby={undefined}
          className="fixed inset-0 z-[70] flex flex-col bg-background text-foreground outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        >
          <Dialog.Title className="sr-only">{t.label}</Dialog.Title>
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5 md:px-4">
            <p className="min-w-0 flex-1 truncate text-body-sm text-foreground">
              <Ltr mono>{image.name}</Ltr>
            </p>
            {many && (
              <span className="shrink-0 text-body-sm text-muted-foreground tabular-nums">
                {fmt(t.count, { n: num(index + 1, locale), total: num(images.length, locale) })}
              </span>
            )}
            <a
              href={image.src}
              download={image.name}
              aria-label={fmt(t.download, { name: image.name })}
              title={fmt(t.download, { name: image.name })}
              className={cn(
                'inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground md:size-9',
                focusRing,
              )}
            >
              <Download aria-hidden className="size-4" strokeWidth={1.75} />
            </a>
            <Dialog.Close asChild>
              <IconButton label={t.close}>
                <X aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
            </Dialog.Close>
          </header>
          <div className="relative min-h-0 flex-1">
            <div
              tabIndex={0}
              aria-label={image.alt ?? image.name}
              role="group"
              className={cn('h-full overflow-auto overscroll-contain p-3 md:px-16 md:py-4', focusRing)}
            >
              <img
                key={image.src}
                src={image.src}
                alt={image.alt ?? image.name}
                className="mx-auto block h-auto max-w-full rounded-md border border-border"
              />
            </div>
            {many && (
              <>
                <IconButton
                  label={t.previous}
                  variant="outline"
                  onClick={() => go(-1)}
                  className="absolute start-2 top-1/2 -translate-y-1/2 md:start-3"
                >
                  <Previous aria-hidden className="size-5" strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  label={t.next}
                  variant="outline"
                  onClick={() => go(1)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 md:end-3"
                >
                  <Next aria-hidden className="size-5" strokeWidth={1.75} />
                </IconButton>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
