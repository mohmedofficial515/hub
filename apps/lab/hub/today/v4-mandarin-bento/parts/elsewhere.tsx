import { useLocale, useT } from '@lab/i18n';
import { messages } from '../i18n';
import { HubLink, Ltr } from './atoms';
import { num } from './format';

export interface ElsewhereItem {
  key: 'inbox' | 'decisions' | 'needs' | 'handoffs' | 'redesigns';
  value: number;
  to: string;
}

/**
 * The counters strip the spec draws at the bottom of Today (09 §4). It only holds numbers no tile above
 * shows, each says its own scope in words, and each links to a page with that same scope (v2 finding M9).
 */
export function Elsewhere({ items, className }: { items: ElsewhereItem[]; className?: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const open = items.filter((i) => i.value > 0);
  return (
    <nav aria-labelledby="elsewhere-title" className={className}>
      <div className="tile-paper flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-t-border pt-4">
        <h2 id="elsewhere-title" className="text-body font-extrabold text-foreground">
          {t.elsewhere.title}
        </h2>
        {open.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">{t.elsewhere.quiet}</p>
        ) : (
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {open.map((i) => (
              <li key={i.key}>
                <HubLink to={i.to} className="inline-flex min-h-11 items-baseline gap-1.5 py-2.5 text-body-sm text-muted-foreground underline-offset-4 hover:underline md:min-h-0 md:py-0">
                  <Ltr className="text-body font-extrabold text-foreground tabular-nums">{num(i.value, locale)}</Ltr>
                  {t.elsewhere[i.key]}
                </HubLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
