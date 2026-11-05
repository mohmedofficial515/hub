import { Clock, Link2 } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { members } from '@lab/mocks/hub-app';
import { CardChip, CardRow, cn, duration, firstName, fmt, focusRing, kitMessages, MineMark, nowMs, Pill, plural, portalRoot, rel, RoleBadge, RowAction, StatusBadge, useAwaiting, useKeyboardList, type NeedCard } from '../../../kit';
import { LocationPointer } from '../../../kit/sheet-sections/need';
import { messages } from '../i18n';

type RowProps = ReturnType<typeof useKeyboardList>['rowProps'];

/** `needs.stale_days` (03 §7). */
const STALE_DAYS = 5;
export const isStale = (card: NeedCard) => card.status === 'requested' && (!!card.flags?.stale || nowMs() - Date.parse(card.createdAt) > STALE_DAYS * 86_400_000);

/** 09 §8: "Blocks n" opens a popover that lists the blocked cards. */
function BlocksBadge({ card }: { card: NeedCard }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const blocks = card.links.filter((l) => l.kind === 'blocks');
  if (!blocks.length) return null;
  return (
    <Popover.Root>
      <Popover.Trigger className={cn('hit-44 relative z-10 inline-flex items-center gap-1 rounded-sm underline decoration-dotted underline-offset-4 hover:text-foreground', focusRing)}>
        <Link2 aria-hidden className="size-3.5" strokeWidth={1.75} />
        {plural(blocks.length, locale, kit.blocksCount)}
      </Popover.Trigger>
      <Popover.Portal container={portalRoot()}>
        <Popover.Content sideOffset={6} collisionPadding={12} className="z-[75] flex max-w-80 flex-col gap-2 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md">
          <p className="text-body-sm font-medium text-foreground">{t.row.blocksTitle}</p>
          <ul className="flex flex-col gap-1.5">
            {blocks.map((l) => (
              <li key={l.key}>
                <CardChip k={l.key} showTitle showStatus className="h-auto min-h-8 flex-wrap py-1" />
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * A need on the board. It stays a `CardRow`, and what it adds sits on the meta line: who asked, how long ago, what it
 * blocks, and once delivered the location, which reads as a place to go and never as a value. The buttons take a full line, so a
 * narrow column keeps the title readable. `primary` is the one filled action of the page.
 */
export function NeedRow({ card, rowProps, showStatus = false, primary = false }: { card: NeedCard; rowProps: RowProps; showStatus?: boolean; primary?: boolean }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const n = card.need;
  const requester = members.find((m) => m.id === n.requesterId);
  const titleId = `need-${card.key}`;
  const stale = isStale(card);
  const mine = useAwaiting().some((c) => c.key === card.key);
  const open = card.status === 'requested' || card.status === 'in_progress';

  return (
    <CardRow
      {...rowProps(card.key)}
      cardKey={card.key}
      type="need"
      title={card.title[locale]}
      priority={card.priority === 'P0' || card.priority === 'P1' ? card.priority : undefined}
      titleId={titleId}
      meta={
        <>
          {showStatus && <StatusBadge status={card.status} />}
          {mine && <MineMark />}
          <span>{kit.sheet.need.kinds[n.kind]}</span>
          <RoleBadge role={n.responsibleRole} outline={false} className="text-body-sm" />
          {requester && open && <span>{stale ? fmt(t.row.requestedByStale, { name: firstName(requester.name[locale]) }) : fmt(t.row.requestedBy, { name: firstName(requester.name[locale]), rel: rel(card.createdAt, locale) })}</span>}
          {stale && (
            <Pill tone="warning" icon={Clock}>
              {fmt(t.row.stale, { d: duration(nowMs() - Date.parse(card.createdAt), locale) })}
            </Pill>
          )}
          {card.status === 'delivered' && n.deliveredAt && <span>{fmt(t.row.deliveredAt, { rel: rel(n.deliveredAt, locale) })}</span>}
          {card.status === 'verified' && n.verifiedAt && <span>{fmt(t.row.verifiedAt, { rel: rel(n.verifiedAt, locale) })}</span>}
          <BlocksBadge card={card} />
          {n.location && <LocationPointer location={n.location} className="mt-1 w-full min-w-0 basis-full" />}
          {(open || card.status === 'delivered') && (
            <div className="relative z-10 mt-1 flex basis-full flex-wrap gap-2 *:max-sm:flex-1">
              {card.status === 'delivered' ? (
                <RowAction card={card} action="verify" variant={primary ? 'primary' : 'outline'} size="sm" aria-describedby={titleId} />
              ) : (
                <RowAction card={card} action="deliver" variant={primary ? 'primary' : 'outline'} size="sm" aria-describedby={titleId} />
              )}
              {card.status === 'requested' && <RowAction card={card} action="start" variant="ghost" size="sm" aria-describedby={titleId} />}
            </div>
          )}
        </>
      }
    />
  );
}
