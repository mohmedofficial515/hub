import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useLocale } from '@lab/i18n';
import { pickShot, shotsOf, type ShotDir, type ShotMeta, type ShotTheme } from '@lab/mocks/hub-app/redesign';
import { cn } from '@lab/ui/hub-cn';
import { Skeleton } from '../../../kit/states';

const urls = new Map<ShotMeta, Promise<string>>();
const load = (meta: ShotMeta) => {
  let url = urls.get(meta);
  if (!url) {
    url = meta.load();
    urls.set(meta, url);
  }
  return url;
};

/** Resolve a picture's URL. Nothing is fetched until a picture is about to be on screen. */
export function useShotUrl(meta: ShotMeta | undefined) {
  const [url, setUrl] = useState<{ meta: ShotMeta; src: string } | null>(null);
  useEffect(() => {
    if (!meta) return;
    let live = true;
    void load(meta).then((src) => live && setUrl({ meta, src }));
    return () => {
      live = false;
    };
  }, [meta]);
  return url && url.meta === meta ? url.src : null;
}

/** All pictures of a version, for the lightbox. */
export function useShotUrls(metas: ShotMeta[]) {
  const [srcs, setSrcs] = useState<string[]>([]);
  const signature = metas.map((m) => m.name).join('|');
  useEffect(() => {
    let live = true;
    void Promise.all(metas.map(load)).then((all) => live && setSrcs(all));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return srcs;
}

/** The picture a tile shows by default: the member's own language and theme, at desktop width. */
export function useDefaultShot(labPath: string) {
  const locale = useLocale();
  const theme: ShotTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const dir: ShotDir = locale === 'ar' ? 'rtl' : 'ltr';
  return pickShot(shotsOf(labPath), { width: 1440, dir, theme });
}

/**
 * A screenshot cropped to its top, in a frame that holds its shape while loading. A version with no pictures keeps
 * the frame and says so, because that is a real state of a new version.
 */
export function ShotThumb({ labPath, alt, emptyLabel, className }: { labPath: string; alt: string; emptyLabel: string; className?: string }) {
  const meta = useDefaultShot(labPath);
  const src = useShotUrl(meta);
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {meta ? (
        src ? (
          <img src={src} alt={alt} loading="lazy" className="absolute inset-0 size-full object-cover object-top" />
        ) : (
          <Skeleton className="absolute inset-0 rounded-none" />
        )
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center">
          <ImageIcon aria-hidden className="size-5 text-muted-foreground" strokeWidth={1.75} />
          <span className="text-body-sm text-muted-foreground">{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}
