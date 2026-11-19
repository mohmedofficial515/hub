// Group page: header (state, related groups, notes), subsection index and field rows that stage into the ticket; history drawer.
import { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'radix-ui';
import { ChevronDown, ChevronLeft, ChevronRight, History, Lock, RotateCcw, Ticket, TriangleAlert, Users, X } from 'lucide-react';
import { cn } from '@dash/lib/utils';
import { getGroup, getSection, type SettingsGroup, type Subsection } from '@lab/mocks/settings';
import { canonicalId, FIELD_INDEX, groupHistory } from './data';
import { EntryCard } from './entry';
import { FieldRow } from './field-row';
import { num, relative, sameValue } from './format';
import { useDesk } from './store';
import { SpecialPage } from './special';
import { Badge, Btn, Card, focusRing, IconTile } from './ui';

export function GroupPage({ groupKey }: { groupKey: string }) {
  const { t, go } = useDesk();
  const group = getGroup(groupKey);
  if (!group) {
    return (
      <Card className="grid justify-items-start gap-3 p-8">
        <p className="text-16 font-bold">{t.group.notFound}</p>
        <Btn variant="outline" onClick={() => go({ v: 'overview' })}>
          {t.group.back}
        </Btn>
      </Card>
    );
  }
  return (
    <div className="grid gap-5">
      <GroupHeader group={group} />
      {group.kind === 'special' ? <SpecialPage group={group} /> : <GroupBody group={group} />}
    </div>
  );
}

export function Breadcrumb({ group }: { group: SettingsGroup }) {
  const { t, l, go } = useDesk();
  const Chevron = t.dir === 'rtl' ? ChevronLeft : ChevronRight;
  const section = getSection(group.section);
  return (
    <nav aria-label={t.group.breadcrumbLabel} className="flex flex-wrap items-center gap-1 text-12 text-muted-foreground">
      <button type="button" onClick={() => go({ v: 'overview' })} className={cn('min-h-11 rounded px-1 hover:text-foreground sm:min-h-9', focusRing)}>
        {t.group.breadcrumbRoot}
      </button>
      <Chevron aria-hidden className="size-3.5" />
      <span className="px-1">{section?.title[l]}</span>
      <Chevron aria-hidden className="size-3.5" />
      <span aria-current="page" className="px-1 font-semibold text-foreground">
        {group.title[l]}
      </span>
    </nav>
  );
}

function GroupHeader({ group }: { group: SettingsGroup }) {
  const { t, l, go, versions, updated, session, ticketCode } = useDesk();
  const [historyOpen, setHistoryOpen] = useState(false);
  const entries = groupHistory(group.key, session);
  const related = t.related[group.key] ?? [];
  const u = updated[group.key];
  return (
    <Card className="grid gap-4 p-5 sm:p-6">
      <Breadcrumb group={group} />
      <div className="flex flex-wrap items-start gap-4">
        <IconTile name={group.icon} size="lg" />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-22 font-extrabold leading-tight sm:text-26">{group.title[l]}</h1>
            {!group.inDashboard && <Badge tone="info">{t.group.newGroup}</Badge>}
            {group.key === 'payment_gateways' && (
              <Badge tone="neutral" icon={<Lock aria-hidden />}>
                {t.special.ownerOnly}
              </Badge>
            )}
            {group.approval === 'second-approver' && (
              <Badge tone="neutral" icon={<Users aria-hidden />}>
                {t.field.security}
              </Badge>
            )}
            {group.approval === 'controls' && (
              <Badge tone="neutral" icon={<Lock aria-hidden />}>
                {t.field.money}
              </Badge>
            )}
          </div>
          <p className="max-w-[72ch] text-14 leading-relaxed text-muted-foreground">{group.description[l]}</p>
          {group.kind === 'server' && (
            <p className="text-12 text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{t.group.version(versions[group.key])}</span> · {t.group.updated(u.by, relative(u.at, l))}
            </p>
          )}
        </div>
        {group.kind === 'server' && (
          <Btn variant="outline" onClick={() => setHistoryOpen(true)}>
            <History aria-hidden />
            {t.group.history}
            <span className="rounded bg-muted px-1.5 text-12 tabular-nums">{num(entries.length, l)}</span>
          </Btn>
        )}
      </div>

      {(group.attention || group.notes || !group.inDashboard) && (
        <div className="grid gap-2">
          {group.attention && (
            <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-13 leading-relaxed">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" />
              {group.attention[l]}
            </p>
          )}
          {!group.inDashboard && <p className="rounded-xl bg-muted/60 p-3 text-13 leading-relaxed text-muted-foreground">{t.group.newGroupNote}</p>}
          {group.notes && <p className="rounded-xl bg-muted/60 p-3 text-13 leading-relaxed text-muted-foreground">{group.notes[l]}</p>}
        </div>
      )}

      {related.length > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          <span className="pt-1.5 text-12 font-bold text-muted-foreground">{t.group.related}:</span>
          <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
            {related.map((r) => {
              const rg = getGroup(r.key);
              if (!rg) return null;
              return (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => go({ v: 'group', g: r.key })}
                    className={cn('grid min-h-11 rounded-lg border px-3 py-1.5 text-start hover:bg-muted sm:min-h-0', focusRing)}
                  >
                    <span className="text-13 font-semibold">{rg.title[l]}</span>
                    <span className="text-12 text-muted-foreground">{r.why}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {group.kind === 'server' && (
        <p className="flex items-center gap-2 text-12 text-muted-foreground">
          <Ticket aria-hidden className="size-4 shrink-0 text-[color:var(--primary)]" />
          {t.group.stagingNote(ticketCode)}
        </p>
      )}

      <Dialog.Root open={historyOpen} onOpenChange={setHistoryOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            dir={t.dir}
            className="fixed inset-y-0 end-0 z-50 flex w-full max-w-xl flex-col border-s bg-background shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <div className="flex items-start justify-between gap-3 border-b p-5">
              <div className="grid gap-1">
                <Dialog.Title className="text-18 font-extrabold">{t.timeline.groupHistory(group.title[l])}</Dialog.Title>
                <Dialog.Description className="text-12 text-muted-foreground">{t.timeline.forwardOnly}</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Btn size="icon" variant="ghost" aria-label={t.toast.close}>
                  <X aria-hidden />
                </Btn>
              </Dialog.Close>
            </div>
            <div className="grid flex-1 content-start gap-3 overflow-y-auto p-5">
              {entries.length === 0 ? <p className="text-13 text-muted-foreground">{t.timeline.historyEmpty}</p> : entries.map((e) => <EntryCard key={e.version} entry={e} showGroup={false} />)}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}

function GroupBody({ group }: { group: SettingsGroup }) {
  const { t, l, draft } = useDesk();
  const [active, setActive] = useState(group.subsections[0]?.id);
  const jump = (id: string) => {
    setActive(id);
    document.getElementById(`sub-${group.key}-${id}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  const stagedIn = (s: Subsection) => s.fields.filter((f) => canonicalId(FIELD_INDEX.get(`${group.key}.${f.key}`)!) in draft).length;
  const showNav = group.subsections.length > 1;

  return (
    <div className={cn('grid gap-5', showNav && 'lg:grid-cols-[15rem_minmax(0,1fr)]')}>
      {showNav && (
        <nav aria-label={t.group.sections} className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0">
            {group.subsections.map((s) => {
              const n = stagedIn(s);
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => jump(s.id)}
                    aria-current={active === s.id ? 'true' : undefined}
                    className={cn(
                      'flex min-h-11 w-full items-center justify-between gap-2 whitespace-nowrap rounded-lg border px-3 text-13 font-semibold lg:min-h-10 lg:border-transparent',
                      focusRing,
                      active === s.id ? 'bg-card text-foreground lg:border-border lg:shadow-xs' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span className="truncate">{s.title[l]}</span>
                    {n > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-12 font-bold tabular-nums text-warning-foreground">
                        {num(n, l)}
                        <span className="sr-only"> {t.ticket.staged}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      <div className="grid min-w-0 gap-5">
        {group.subsections.map((s) => (
          <SubsectionCard key={s.id} group={group} sub={s} />
        ))}
      </div>
    </div>
  );
}

function SubsectionCard({ group, sub }: { group: SettingsGroup; sub: Subsection }) {
  const { t, l, get, stageMany, toast, route } = useDesk();
  const fields = useMemo(() => sub.fields.map((f) => FIELD_INDEX.get(`${group.key}.${f.key}`)!).filter(Boolean), [group.key, sub.fields]);
  const main = fields.filter((f) => !f.advanced);
  const advanced = fields.filter((f) => f.advanced);
  const focusedAdvanced = advanced.some((f) => route.v === 'group' && route.f === f.key);
  const [openAdv, setOpenAdv] = useState(focusedAdvanced);
  useEffect(() => {
    if (focusedAdvanced) setOpenAdv(true);
  }, [focusedAdvanced]);
  const resettable = fields.filter((f) => !f.proposed && !f.readOnly && !f.structured && !sameValue(get(canonicalId(f)), f.default));
  const resetAll = () => {
    const n = stageMany(resettable.map((f) => ({ field: f, to: f.default })));
    toast(t.group.resetSubDone(n));
  };
  return (
    <Card id={`sub-${group.key}-${sub.id}`} className="scroll-mt-4 overflow-hidden" aria-labelledby={`h-${group.key}-${sub.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div className="grid min-w-0 gap-0.5">
          <h2 id={`h-${group.key}-${sub.id}`} className="text-16 font-extrabold">
            {sub.title[l]}
          </h2>
          <p className="text-13 text-muted-foreground">{sub.description[l]}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-12 text-muted-foreground tabular-nums">{t.group.fieldsCount(fields.length)}</span>
          {resettable.length > 0 && (
            <Btn size="sm" variant="ghost" onClick={resetAll}>
              <RotateCcw aria-hidden />
              {t.group.resetSub}
            </Btn>
          )}
        </div>
      </div>
      <div className="grid divide-y px-1 sm:px-2">
        {main.map((f) => (
          <FieldRow key={f.id} field={f} />
        ))}
      </div>
      {advanced.length > 0 && (
        <div className="border-t">
          <button
            type="button"
            aria-expanded={openAdv}
            onClick={() => setOpenAdv((o) => !o)}
            className={cn('flex min-h-12 w-full items-center gap-2 px-4 text-start text-13 font-bold hover:bg-muted/50 sm:px-5', focusRing)}
          >
            <ChevronDown aria-hidden className={cn('size-4 transition-transform', openAdv && 'rotate-180')} />
            {t.group.advanced(advanced.length)}
            <span className="font-normal text-muted-foreground">· {t.group.advancedHint}</span>
          </button>
          {openAdv && (
            <div className="grid divide-y px-1 pb-2 sm:px-2">
              {advanced.map((f) => (
                <FieldRow key={f.id} field={f} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
