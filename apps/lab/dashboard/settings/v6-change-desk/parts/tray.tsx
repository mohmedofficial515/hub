// The draft ticket dock: always at the bottom (desktop: a floating ticket; mobile: a full-width bar that opens as a sheet).
import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronUp, Crosshair, Lock, Ticket, TriangleAlert, X } from 'lucide-react';
import { cn } from '@dash/lib/utils';
import { getGroup } from '@lab/mocks/settings';
import { FromTo } from './field-row';
import { impactOf } from './impact';
import { num } from './format';
import { ticketStats, useDesk, useStaged, type StagedItem } from './store';
import { Badge, Btn, focusRing, Icon } from './ui';
import { riskOf } from './data';

export function RiskBadge({ item }: { item: StagedItem }) {
  const { t } = useDesk();
  const r = riskOf(item.field);
  if (r === 'high') return <Badge tone="danger" icon={<TriangleAlert aria-hidden />}>{t.risk.high}</Badge>;
  if (r === 'security') return <Badge tone="neutral" icon={<Lock aria-hidden />}>{t.risk.security}</Badge>;
  if (r === 'money') return <Badge tone="neutral" icon={<Lock aria-hidden />}>{t.risk.money}</Badge>;
  return null;
}

/** One staged change as a sentence: "Label: from → to", then its effect. */
export function ChangeLine({ item, actions = true, compact = false }: { item: StagedItem; actions?: boolean; compact?: boolean }) {
  const { t, l, get, getApplied, unstage, go } = useDesk();
  const impact = impactOf(item.id, getApplied, get, l, t);
  return (
    <li className={cn('flex items-start gap-3', compact ? 'py-2' : 'py-3')}>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-13 leading-relaxed">
          <span className="font-semibold">{item.field.label[l]}:</span>
          <FromTo field={item.field} from={item.from} to={item.to} />
          <RiskBadge item={item} />
          {item.field.proposed && <Badge tone="info">{t.field.proposed}</Badge>}
        </p>
        {impact && (
          <p className="text-12 leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground/80">{t.ticket.effect}:</span> {impact}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center">
          <Btn size="icon" variant="ghost" aria-label={`${t.ticket.goTo}: ${item.field.label[l]}`} title={t.ticket.goTo} onClick={() => go({ v: 'group', g: item.field.groupKey, f: item.field.key })}>
            <Crosshair aria-hidden />
          </Btn>
          <Btn size="icon" variant="ghost" aria-label={`${t.ticket.remove}: ${item.field.label[l]}`} title={t.ticket.remove} onClick={() => unstage(item.id)}>
            <X aria-hidden />
          </Btn>
        </div>
      )}
    </li>
  );
}

export function TicketStub({ count, className }: { count: number; className?: string }) {
  const { t, l, ticketCode, pulse } = useDesk();
  const reduce = useReducedMotion();
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-lg', count ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
        <Ticket aria-hidden className="size-4.5" />
      </span>
      <div className="grid leading-tight">
        <span className="text-12 font-semibold text-muted-foreground">{t.ticket.name}</span>
        <span className="flex items-baseline gap-1.5">
          <bdi dir="ltr" className="text-14 font-extrabold tracking-wide tabular-nums">
            {ticketCode}
          </bdi>
          {count > 0 && (
            <motion.span
              key={reduce ? 'n' : `${count}-${pulse}`}
              initial={reduce ? false : { scale: 1.35 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-12 font-bold tabular-nums text-warning-foreground"
              aria-hidden
            >
              {num(count, l)}
            </motion.span>
          )}
        </span>
      </div>
    </div>
  );
}

/** The perforation between the ticket stub and its body (a dashed rule with two cut-out notches). */
export function Perforation({ vertical = true, className }: { vertical?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn('relative shrink-0', vertical ? 'mx-1 self-stretch border-s border-dashed' : 'my-1 w-full border-t border-dashed', className)}>
      <span className={cn('absolute size-3 rounded-full border bg-background', vertical ? '-top-[19px] -start-[6.5px] border-t-0' : '-start-[19px] -top-[6.5px] border-s-0')} />
      <span className={cn('absolute size-3 rounded-full border bg-background', vertical ? '-bottom-[19px] -start-[6.5px] border-b-0' : '-end-[19px] -top-[6.5px] border-e-0')} />
    </span>
  );
}

export function Tray() {
  const { t, l, role, route, go, trayOpen, setTrayOpen, discardAll, versions, staleGroups, rebase, updated, saveNow } = useDesk();
  const { items, byGroup } = useStaged();
  const reduce = useReducedMotion();
  const panelId = useId();
  const [asking, setAsking] = useState(false);
  const stats = ticketStats(items, role);
  const count = items.length;

  useEffect(() => {
    if (count === 0) setTrayOpen(false);
    setAsking(false);
  }, [count, setTrayOpen]);

  useEffect(() => {
    if (!trayOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTrayOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trayOpen, setTrayOpen]);

  if (route.v === 'review' || route.v === 'prefs' || route.v === 'asof' || count === 0) return null;
  const fast = count === 1 && (riskOf(items[0].field) === 'normal' || riskOf(items[0].field) === 'money') && !staleGroups.length ? items[0] : null;

  return (
    <>
      <AnimatePresence>
        {trayOpen && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/20 sm:bg-foreground/10"
            onClick={() => setTrayOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>
      <section
        aria-label={t.ticket.trayLabel}
        className="fixed inset-x-0 bottom-0 z-50 sm:bottom-4 sm:mx-auto sm:max-w-3xl sm:px-4"
      >
        <div className="overflow-hidden rounded-t-2xl border bg-card shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.25)] sm:rounded-2xl sm:shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)]">
          <AnimatePresence initial={false}>
            {trayOpen && count > 0 && (
              <motion.div
                id={panelId}
                key="panel"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                className="max-h-[min(70dvh,560px)] overflow-y-auto overscroll-contain border-b"
              >
                <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-4">
                  <h2 className="text-15 font-extrabold">{t.ticket.summary(count, byGroup.length)}</h2>
                  {asking ? (
                    <div className="flex items-center gap-1.5" role="group" aria-label={t.ticket.discardAsk(count)}>
                      <span className="hidden text-12 text-muted-foreground sm:inline">{t.ticket.discardAsk(count)}</span>
                      <Btn size="sm" variant="danger" onClick={discardAll}>
                        {t.ticket.discardYes}
                      </Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setAsking(false)}>
                        {t.ticket.discardNo}
                      </Btn>
                    </div>
                  ) : (
                    <Btn size="sm" variant="ghost" onClick={() => setAsking(true)}>
                      {t.ticket.discardAll}
                    </Btn>
                  )}
                </div>
                <div className="grid gap-1 px-4 pb-3">
                  {byGroup.map(({ groupKey, items: list }) => {
                    const g = getGroup(groupKey);
                    if (!g) return null;
                    const v = versions[groupKey] ?? g.version;
                    return (
                      <div key={groupKey} className="border-t pt-3 first:border-t-0">
                        <button
                          type="button"
                          onClick={() => go({ v: 'group', g: groupKey })}
                          className={cn('flex min-h-11 items-center gap-2 rounded-md text-start sm:min-h-8', focusRing)}
                        >
                          <Icon name={g.icon} className="size-4 text-[color:var(--primary)]" />
                          <span className="text-13 font-bold">{g.title[l]}</span>
                          <span className="text-12 text-muted-foreground tabular-nums">
                            v{v} → v{v + 1}
                          </span>
                        </button>
                        {staleGroups.includes(groupKey) && (
                          <div className="my-1 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warning/10 px-3 py-2 text-12">
                            <span>{t.ticket.stale(g.title[l], updated[groupKey]?.by ?? g.updatedBy)}</span>
                            <Btn size="sm" variant="outline" onClick={() => rebase(groupKey)}>
                              {t.ticket.rebase}
                            </Btn>
                          </div>
                        )}
                        <ul className="divide-y">
                          {list.map((it) => (
                            <ChangeLine key={it.id} item={it} compact />
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-2.5">
            <TicketStub count={count} />
            <Perforation className="hidden sm:block" />
            <div className="min-w-0 flex-1">
              {count === 0 ? (
                <p className="truncate text-12 text-muted-foreground sm:text-13">{t.ticket.emptyTitle}</p>
              ) : (
                <div className="hidden min-w-0 gap-0.5 sm:grid">
                  <p className="truncate text-13 font-bold">{t.ticket.summary(count, stats.groups)}</p>
                  <div className="hidden flex-wrap gap-1 sm:flex">
                    {stats.high > 0 && <Badge tone="danger">{t.ticket.highRisk(stats.high)}</Badge>}
                    {stats.security > 0 && <Badge tone="neutral">{t.ticket.security(stats.security)}</Badge>}
                    {stats.waitGroups > 0 && <Badge tone="info">{t.ticket.waits(stats.waitGroups)}</Badge>}
                  </div>
                </div>
              )}
            </div>
            {count > 0 && (
              <>
                {fast && (
                  <Btn variant="primary" title={t.ticket.saveNowHint} onClick={() => saveNow(fast.id)}>
                    {t.ticket.saveNow}
                  </Btn>
                )}
                <Btn variant={fast ? 'outline' : 'primary'} className={fast ? 'hidden sm:inline-flex' : undefined} onClick={() => go({ v: 'review' })}>
                  {t.ticket.review}
                </Btn>
                <Btn
                  size="icon"
                  variant="outline"
                  aria-expanded={trayOpen}
                  aria-controls={panelId}
                  aria-label={trayOpen ? t.ticket.close : t.ticket.open}
                  onClick={() => setTrayOpen(!trayOpen)}
                >
                  <ChevronUp aria-hidden className={cn('transition-transform', trayOpen && 'rotate-180')} />
                </Btn>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
