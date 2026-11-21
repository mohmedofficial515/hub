import { useMemo, useState } from 'react';
import { ImageOff, Maximize2 } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { PlanAttachment } from '@lab/mocks/hub-plan-page';
import { Bidi, fmt, focusRing, Lightbox, Ltr, MarkdownView, num } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import { splitBody, type Figure } from './model';

/** The version's local copies of the research shots. In Hub, `attachment.url` is served by the API instead. */
const media = import.meta.glob<string>('../media/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' });
const srcOf = (a: PlanAttachment) => media[`../media/${a.url}`];

const isArabic = (text: string) => /[؀-ۿ]/.test(text);

function FigureTile({ figure, index, total, onOpen, single }: { figure: Figure; index: number; total: number; onOpen: () => void; single: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const src = figure.attachment ? srcOf(figure.attachment) : undefined;
  const tall = !!figure.attachment?.height && !!figure.attachment.width && figure.attachment.height > figure.attachment.width;

  if (!src || !figure.attachment) {
    return (
      <figure className="m-0 flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center">
        <ImageOff aria-hidden className="size-5 text-muted-foreground" strokeWidth={1.75} />
        <figcaption className="text-body-sm text-muted-foreground">{fmt(t.missingImage, { name: figure.ref })}</figcaption>
      </figure>
    );
  }
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={fmt(t.openLarger, { caption: figure.caption })}
        className={cn(
          'group relative block w-full overflow-hidden rounded-lg border border-border bg-muted transition-colors duration-150 hover:border-foreground/30',
          single ? 'aspect-[16/9]' : 'aspect-[16/10]',
          focusRing,
        )}
      >
        <img
          src={src}
          alt={figure.alt}
          loading="lazy"
          decoding="async"
          width={figure.attachment.width ?? undefined}
          height={figure.attachment.height ?? undefined}
          className={cn('size-full object-cover', tall ? 'object-top' : 'object-center')}
        />
        <span aria-hidden className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="size-3.5" strokeWidth={1.75} />
        </span>
      </button>
      <figcaption className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <span dir="auto" className="text-body-sm text-foreground text-pretty">
          <Bidi>{figure.caption}</Bidi>
        </span>
        <span className="flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
          <span className="shrink-0 tabular-nums">{fmt(t.figure, { n: num(index + 1, locale), total: num(total, locale) })}</span>
          <Ltr mono className="min-w-0 truncate">{figure.attachment.name}</Ltr>
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * The plan's Markdown with its screenshots. A line holding only `![alt](attachment:ID "caption")` becomes a figure, and images on
 * consecutive lines sit side by side. A click opens the kit `Lightbox` on every screenshot of the plan, in text order.
 */
export function PlanText({ body, attachments }: { body: string; attachments: PlanAttachment[] }) {
  const blocks = useMemo(() => splitBody(body, attachments), [body, attachments]);
  const dir = isArabic(body) ? 'rtl' : 'ltr';
  const viewable = blocks.flatMap((b) => (b.kind === 'figures' ? b.figures.filter((f) => f.attachment && srcOf(f.attachment)) : []));
  const images = viewable.map((f) => ({ src: srcOf(f.attachment!)!, name: f.attachment!.name, alt: f.caption }));
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {blocks.map((block, i) =>
        block.kind === 'md' ? (
          <MarkdownView key={i} source={block.source} dir={dir} />
        ) : (
          <div
            key={i}
            className={cn('grid gap-4', block.figures.length === 2 && 'sm:grid-cols-2', block.figures.length >= 3 && 'sm:grid-cols-2 xl:grid-cols-3')}
          >
            {block.figures.map((f) => {
              const at = viewable.indexOf(f);
              return (
                <FigureTile
                  key={f.ref}
                  figure={f}
                  index={at}
                  total={viewable.length}
                  single={block.figures.length === 1}
                  onOpen={() => {
                    setIndex(at);
                    setOpen(true);
                  }}
                />
              );
            })}
          </div>
        ),
      )}
      {images.length > 0 && <Lightbox images={images} index={index} open={open} onOpenChange={setOpen} onIndexChange={setIndex} />}
    </div>
  );
}
