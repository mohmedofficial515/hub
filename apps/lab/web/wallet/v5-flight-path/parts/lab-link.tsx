import { useEffect, useState, type AnchorHTMLAttributes } from 'react';
import { ExternalLink } from 'lucide-react';
import { useT } from '@lab/i18n';
import { messages } from '../i18n';

const EVENT = 'fp-lab-nav';

/**
 * A real `<a href>` (same tab, the URL the live site would use). The lab frame cannot open site routes, so a click
 * is intercepted and the target is shown in a toast instead. At port this becomes next-intl's `Link`.
 */
export function LabLink({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(EVENT, { detail: href }));
      }}
      {...rest}
    />
  );
}

/** Lab-only toast that shows where a link would go. */
export function LabNavToast() {
  const t = useT(messages);
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      setHref((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setHref(null), 6000);
    };
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener(EVENT, on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center">
      {href && (
        <p className="pointer-events-auto flex max-w-full items-center gap-2 rounded-xl bg-ocean-deep px-4 py-3 text-sm text-white shadow-xl">
          <ExternalLink className="size-4 shrink-0 text-secondary" aria-hidden />
          <span className="shrink-0 font-bold">{t.labOpens}</span>
          <bdi dir="ltr" className="min-w-0 truncate font-mono text-xs">
            {href}
          </bdi>
        </p>
      )}
    </div>
  );
}
