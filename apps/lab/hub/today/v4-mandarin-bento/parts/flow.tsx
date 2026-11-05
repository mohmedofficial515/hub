import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { Today } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { fmt, Ltr, Tile, TileHead, TypeTag } from './atoms';
import { num } from './format';

/**
 * Created against closed, per type. One hue for the whole tile: solid = created, outlined = closed,
 * so the type is the word beside the bars and the bars are never a rainbow.
 */
export function CardFlow({ flow, className }: { flow: Today['team']['flow']; className?: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const max = Math.max(...flow.flatMap((f) => [f.created, f.closed]), 1);
  return (
    <Tile rule="green" labelledBy="flow-title" className={cn('flex flex-col', className)}>
      <TileHead id="flow-title" title={t.flow.title} />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-body-sm text-(--t-muted)">{t.flow.hint}</p>
        <div aria-hidden className="flex items-center gap-3 text-body-sm text-(--t-muted)">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-(--fish-green)" />
            {t.flow.created}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full border border-(--fish-green)" />
            {t.flow.closed}
          </span>
        </div>
      </div>
      <ul className="mt-4 grid flex-1 gap-x-8 gap-y-3 md:grid-cols-2 lg:grid-cols-1 lg:content-between">
        {flow.map((f) => {
          const net = f.created - f.closed;
          const words = net > 0 ? fmt(t.flow.netMore, { n: num(net, locale) }) : net < 0 ? fmt(t.flow.netFewer, { n: num(-net, locale) }) : t.flow.netEven;
          return (
            <li key={f.type} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3">
              <span className="min-w-0">
                <TypeTag type={f.type} />
                <span className="block text-caption text-(--t-muted)">{words}</span>
              </span>
              <span className="flex flex-col gap-1">
                {(
                  [
                    ['created', f.created],
                    ['closed', f.closed],
                  ] as const
                ).map(([kind, v]) => (
                  <span key={kind} className="flex items-center gap-2">
                    <span className={kind === 'created' ? 'h-2 min-w-2.5 rounded-full bg-(--fish-green)' : 'h-2 min-w-2.5 rounded-full border border-(--fish-green)'} style={{ width: `${(v / max) * 84}%` }} />
                    <span className="text-caption text-(--t-muted) tabular-nums">
                      <Ltr>{num(v, locale)}</Ltr>
                      <span className="sr-only"> {kind === 'created' ? t.flow.created : t.flow.closed}</span>
                    </span>
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </Tile>
  );
}
