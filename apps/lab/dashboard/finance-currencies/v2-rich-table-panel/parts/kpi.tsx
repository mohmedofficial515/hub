import type { ReactNode } from 'react';
import { CalendarClock, CircleDollarSign, Eye, Pin, TriangleAlert } from 'lucide-react';
import { FX_ENVELOPE } from '@lab/mocks/currencies';
import { cn } from '@lab/utils';
import { fill, type CurrencyMessages } from '../i18n';
import { relTime, type Meta } from './derive';
import { CurrencyMark } from './marks';
import { Ltr } from './ui';

function Tile({
  icon,
  label,
  children,
  hint,
  tone = 'default',
  onClick,
  pressed,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  hint: ReactNode;
  tone?: 'default' | 'warning';
  onClick?: () => void;
  pressed?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? pressed : undefined}
      className={cn(
        'flex min-h-20 w-full items-start gap-3 rounded-2xl border bg-card p-3.5 text-start outline-none transition-colors',
        onClick && 'cursor-pointer hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        pressed && 'border-primary/60 bg-primary/5',
        tone === 'warning' ? 'border-warning/60' : 'border-border/70',
      )}
    >
      <span
        className={cn(
          'hidden size-10 shrink-0 place-items-center rounded-xl sm:grid [&_svg]:size-5',
          tone === 'warning' ? 'bg-warning/20 text-warning-soft-foreground' : 'bg-primary/10 text-primary-text',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-13 font-medium text-muted-foreground">{label}</span>
        <span className="mt-0.5 flex items-baseline gap-1.5 text-22 font-extrabold leading-tight">{children}</span>
        <span className="block text-12 text-muted-foreground">{hint}</span>
      </span>
    </Tag>
  );
}

export function KpiStrip({
  metas,
  t,
  filter,
  onFilter,
}: {
  metas: Meta[];
  t: CurrencyMessages;
  filter: string;
  onFilter: (f: 'stale' | 'pinned' | 'visible' | 'all') => void;
}) {
  const total = metas.length;
  const active = metas.filter((m) => !m.hidden).length;
  const stale = metas.filter((m) => m.stale).length;
  const pinned = metas.filter((m) => m.pin).length;
  const latest = metas.filter((m) => !m.isBase).reduce<Meta | null>((a, m) => (!a || m.ageMin < a.ageMin ? m : a), null);
  const toggle = (f: 'stale' | 'pinned' | 'visible') => onFilter(filter === f ? 'all' : f);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Tile
        icon={<Eye />}
        label={t.kpi.active}
        hint={fill(t.kpi.activeOf, { total })}
        onClick={() => toggle('visible')}
        pressed={filter === 'visible'}
      >
        <Ltr>{active}</Ltr>
        <span className="text-14 font-semibold text-muted-foreground">
          <Ltr>/ {total}</Ltr>
        </span>
      </Tile>
      <Tile
        icon={<TriangleAlert />}
        label={t.kpi.stale}
        hint={fill(t.kpi.staleHint, { minutes: FX_ENVELOPE.staleAfterMinutes })}
        tone={stale ? 'warning' : 'default'}
        onClick={() => toggle('stale')}
        pressed={filter === 'stale'}
      >
        <Ltr>{stale}</Ltr>
      </Tile>
      <Tile
        icon={<Pin />}
        label={t.kpi.pinned}
        hint={t.kpi.pinnedHint}
        onClick={() => toggle('pinned')}
        pressed={filter === 'pinned'}
      >
        <Ltr>{pinned}</Ltr>
      </Tile>
      <Tile icon={<CalendarClock />} label={t.kpi.refresh} hint={FX_ENVELOPE.provider}>
        <span className="text-18">{latest ? relTime(latest.ageMin, t) : t.kpi.none}</span>
      </Tile>
      <div className="col-span-2 md:col-span-1">
        <Tile
          icon={<CircleDollarSign />}
          label={t.kpi.base}
          hint={fill(t.kpi.baseHint, { provider: FX_ENVELOPE.provider })}
        >
          <CurrencyMark code="USD" size={26} />
          <Ltr className="font-mono">USD</Ltr>
        </Tile>
      </div>
    </div>
  );
}
