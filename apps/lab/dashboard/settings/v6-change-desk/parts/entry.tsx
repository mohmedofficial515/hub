// One version entry (timeline and group history): who, when, why, readable changes, forward-only restore, JSON on demand.
import { useState } from 'react';
import { Braces, RotateCcw, ShieldCheck, Ticket } from 'lucide-react';
import { cn } from '@dash/lib/utils';
import { getGroup, type FlatField } from '@lab/mocks/settings';
import { entryRisk, FIELD_INDEX, valuesAtVersion, type TimelineEntry } from './data';
import { FromTo } from './field-row';
import { formatDateTime, relative } from './format';
import { useDesk } from './store';
import { Avatar, Badge, Btn, Icon } from './ui';

function fieldFor(groupKey: string, key: string): FlatField {
  return (
    FIELD_INDEX.get(`${groupKey}.${key}`) ??
    ({
      key,
      id: `${groupKey}.${key}`,
      label: { ar: key, en: key },
      help: { ar: '', en: '' },
      type: 'string',
      value: null,
      default: null,
      groupKey,
      groupTitle: { ar: groupKey, en: groupKey },
      sectionId: 'system',
      subsectionId: '',
      subsectionTitle: { ar: '', en: '' },
    } as FlatField)
  );
}

export function EntryCard({ entry, showGroup = true }: { entry: TimelineEntry; showGroup?: boolean }) {
  const { t, l, versions, session, stageMany, toast } = useDesk();
  const [raw, setRaw] = useState(false);
  const g = getGroup(entry.groupKey);
  const current = versions[entry.groupKey] ?? entry.version;
  const risk = entryRisk(entry);
  const isCurrent = entry.version === current;
  const by = entry.by === t.me ? `${entry.by} ${t.meTag}` : entry.by;

  const restore = () => {
    const at = valuesAtVersion(entry.groupKey, entry.version, session);
    const items = Object.entries(at)
      .map(([key, to]) => ({ field: FIELD_INDEX.get(`${entry.groupKey}.${key}`), to }))
      .filter((x): x is { field: FlatField; to: (typeof x)['to'] } => !!x.field);
    const n = stageMany(items);
    toast(n ? t.timeline.restoreStaged(entry.version, n) : t.timeline.restoreNothing);
  };

  return (
    <article className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <Avatar name={entry.by} className="size-9" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="text-14 font-bold leading-snug">
            {showGroup && g ? t.timeline.changed(by, g.title[l], entry.version) : `${by} · v${entry.version}`}
          </p>
          <p className="text-12 text-muted-foreground">
            <time dateTime={entry.at}>{formatDateTime(entry.at, l)}</time> · {relative(entry.at, l)}
          </p>
        </div>
        {showGroup && g && <Icon name={g.icon} className="mt-1 size-4 shrink-0 text-[color:var(--primary)]" />}
      </header>

      <p className={cn('text-13 leading-relaxed', !entry.note && 'text-muted-foreground')}>{entry.note ? `«${entry.note[l]}»` : t.timeline.noNote}</p>

      {entry.changes.length === 0 ? (
        <p className="text-13 text-muted-foreground">{t.timeline.defaults}</p>
      ) : (
        <ul className="grid gap-1.5 rounded-xl bg-muted/50 p-3">
          {entry.changes.map((c) => {
            const f = fieldFor(entry.groupKey, c.field);
            return (
              <li key={c.field} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-13">
                <span className="font-semibold">{f.label[l]}:</span>
                <FromTo field={f} from={c.from} to={c.to} />
              </li>
            );
          })}
        </ul>
      )}

      {raw && (
        <pre dir="ltr" className="max-h-56 overflow-auto rounded-xl bg-muted p-3 text-12 leading-relaxed">
          {JSON.stringify({ version: entry.version, changes: entry.changes }, null, 2)}
        </pre>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {risk === 'high' && <Badge tone="danger">{t.risk.high}</Badge>}
          {risk === 'security' && <Badge tone="neutral">{t.risk.security}</Badge>}
          {risk === 'money' && <Badge tone="neutral">{t.risk.money}</Badge>}
          {entry.requestId && entry.approvedBy && (
            <Badge tone="success" icon={<ShieldCheck aria-hidden />}>
              {t.timeline.approvedBy(entry.approvedBy, entry.requestId)}
            </Badge>
          )}
          {entry.ticket && (
            <Badge tone="warning" icon={<Ticket aria-hidden />}>
              {t.timeline.ticket(entry.ticket)}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Btn size="sm" variant="ghost" aria-pressed={raw} onClick={() => setRaw((r) => !r)}>
            <Braces aria-hidden />
            {raw ? t.timeline.hideRaw : t.timeline.raw}
          </Btn>
          <Btn size="sm" variant="outline" disabled={isCurrent || entry.changes.length === 0} onClick={restore} title={isCurrent ? t.timeline.restoreCurrent : t.timeline.forwardOnly}>
            <RotateCcw aria-hidden />
            {isCurrent ? t.timeline.restoreCurrent : t.timeline.restore(entry.version, current + 1)}
          </Btn>
        </div>
      </footer>
    </article>
  );
}
