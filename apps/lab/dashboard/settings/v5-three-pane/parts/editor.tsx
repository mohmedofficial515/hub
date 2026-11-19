import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ChevronDown, ChevronLeft, CircleCheck, Clock3, Crown, History, Link2, Loader2, PanelRightClose, PanelRightOpen, PlugZap, RotateCcw, Send, ShieldCheck,
  Sparkles, TriangleAlert,
} from 'lucide-react';
import type { Field, SettingsGroup, Subsection } from '@lab/mocks/settings';
import { cn } from './cn';
import { FieldRow } from './field-row';
import { groupByKey, readable, relative, same, sectionOfGroup } from './lib';
import { GATEWAY_INDEX, RELATED } from './related';
import { useStore } from './store';
import { Btn, Icon, IconBtn, Pill, StateDot, useBp } from './ui';

export function Crumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  const { t } = useStore();
  return (
    <nav aria-label={t.editor.breadcrumbRoot} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-12 text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className={cn('flex min-w-0 items-center gap-1', i < items.length - 2 && 'hidden sm:flex')}>
            {i > 0 ? <ChevronLeft className="size-3.5 shrink-0 opacity-60 ltr:rotate-180" aria-hidden /> : null}
            {item.onClick ? (
              <button type="button" onClick={item.onClick} className="relative min-w-0 max-w-full rounded px-0.5 font-medium outline-none after:absolute after:inset-x-0 after:-inset-y-[13px] after:content-[''] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <span className="block truncate">{item.label}</span>
              </button>
            ) : (
              <span className={cn('truncate', i === items.length - 1 && 'font-semibold text-foreground')} aria-current={i === items.length - 1 ? 'location' : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Back control for the drill-in widths (below 1024 px). */
export function BackBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ms-2 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg pe-3 ps-1.5 text-14 font-semibold text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
      {label}
    </button>
  );
}

export function GroupEditor({ group }: { group: SettingsGroup }) {
  const s = useStore();
  const { t, locale } = s;
  const bp = useBp();
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const [activeSub, setActiveSub] = useState<string | undefined>(group.subsections[0]?.id);
  const section = sectionOfGroup(group.key);
  const drill = bp === 'sm' || bp === 'md';
  const rtl = locale === 'ar';

  useEffect(() => {
    setActiveSub(group.subsections[0]?.id);
    if (!s.flash) scroller.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.key]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveSub(top.target.getAttribute('data-sub') ?? undefined);
      },
      { root, rootMargin: '-20% 0px -65% 0px' },
    );
    root.querySelectorAll('[data-sub]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [group.key]);

  const jump = (id: string) => {
    const el = scroller.current?.querySelector(`[data-sub="${id}"]`);
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActiveSub(id);
  };

  const sub = group.subsections.find((x) => x.id === activeSub);
  const hiddenPage = s.hidden(group.key);
  const pending = s.pending[group.key];

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      {/* path strip: breadcrumb + group anchors, sticky above the scrolling form */}
      <div className="z-10 shrink-0 border-b bg-background/95 px-4 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
        <div className="flex min-h-11 items-center gap-2">
          {drill ? <BackBtn label={t.editor.back} onClick={() => s.go({ pane: 'list' })} /> : null}
          <div className="min-w-0 flex-1">
            <Crumbs
              items={[
                { label: t.editor.breadcrumbRoot, onClick: () => s.go({ group: null, section: null, pane: 'home' }) },
                { label: section?.title[locale] ?? '', onClick: () => s.go({ section: group.section, pane: 'list' }) },
                { label: group.title[locale] },
                ...(sub && group.subsections.length > 1 ? [{ label: sub.title[locale] }] : []),
              ]}
            />
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <IconBtn
              label={t.editor.history}
              onClick={() => {
                s.setInspectorTab('history');
                if (bp === 'xl') s.setInspectorOpen(true);
                else s.setSheetOpen(true);
              }}
              data-act="history"
            >
              <History className="size-4" aria-hidden />
            </IconBtn>
            {bp === 'xl' ? (
              <IconBtn label={s.inspectorOpen ? t.editor.closeDetails : t.editor.details} pressed={s.inspectorOpen} onClick={() => s.setInspectorOpen(!s.inspectorOpen)}>
                {s.inspectorOpen ? <PanelRightClose className="size-4 rtl:-scale-x-100" aria-hidden /> : <PanelRightOpen className="size-4 rtl:-scale-x-100" aria-hidden />}
              </IconBtn>
            ) : null}
          </div>
        </div>
        {group.subsections.length > 1 && !hiddenPage ? (
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:none]" role="navigation" aria-label={t.editor.onThisPage}>
            {group.subsections.map((x) => {
              const on = x.id === activeSub;
              const dirty = x.fields.some((f) => f.key in s.draft);
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => jump(x.id)}
                  className={cn(
                    'inline-flex min-h-11 lg:min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-12 font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    on ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {x.title[locale]}
                  {dirty ? <span className="size-1.5 rounded-full bg-warning" aria-label={t.field.edited} role="img" /> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="h-2" />
        )}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-editor-scroll>
          <motion.div
            key={group.key}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: rtl ? -18 : 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="mx-auto w-full max-w-4xl px-4 pb-10 pt-4 md:px-6 md:pt-5"
          >
            <GroupHeader group={group} />
            {hiddenPage ? (
              <PermissionHidden />
            ) : (
              <>
                {pending ? (
                  <Callout tone="warning" icon={<Clock3 className="size-4" aria-hidden />}>
                    {t.editor.pendingBanner(pending.id, pending.count)}
                  </Callout>
                ) : null}
                <div className="mt-6 grid grid-cols-1 gap-8">
                  {group.subsections.map((x) => (
                    <SubsectionBlock key={x.id} group={group} sub={x} />
                  ))}
                </div>
              </>
            )}
          </motion.div>
      </div>
      {!hiddenPage ? <SaveBar group={group} /> : null}
    </div>
  );
}

function Callout({ tone, icon, children }: { tone: 'warning' | 'info' | 'neutral'; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-13 leading-relaxed">
      <span className={cn('mt-0.5 shrink-0', tone === 'warning' && 'text-warning-strong dark:text-warning', tone === 'info' && 'text-info', tone === 'neutral' && 'text-muted-foreground')}>{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function GroupHeader({ group }: { group: SettingsGroup }) {
  const s = useStore();
  const { t, locale } = s;
  const related = RELATED[group.key];
  const meta = s.meta[group.key];
  const version = s.versions[group.key];
  const [more, setMore] = useState(false);
  const compact = useBp() === 'sm';
  const [showRelated, setShowRelated] = useState(false);
  const enabled = group.masterSwitch ? s.values[group.key]?.[group.masterSwitch] : undefined;

  return (
    <header>
      <div className="flex items-start gap-4">
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary sm:inline-flex">
          <Icon name={group.icon} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 id="v5-pane-title" tabIndex={-1} className="text-22 font-extrabold leading-tight tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-26">{group.title[locale]}</h1>
            {!group.inDashboard ? <Pill tone="info" icon={<Sparkles className="size-3" aria-hidden />}>{t.editor.new}</Pill> : null}
            {group.permission ? <Pill tone="neutral" icon={<Crown className="size-3" aria-hidden />}>{t.editor.ownerOnly}</Pill> : null}
            {enabled !== undefined ? (
              <Pill tone={enabled ? 'success' : 'neutral'}>
                <StateDot state={enabled ? 'on' : 'off'} label="" className="size-1.5" />
                {enabled ? t.state.on : t.state.off}
              </Pill>
            ) : null}
          </div>
          <p className={cn('mt-1.5 max-w-[68ch] text-14 leading-relaxed text-muted-foreground', !more && 'line-clamp-1 md:line-clamp-2')}>{group.description[locale]}</p>
          {group.description[locale].length > (compact ? 60 : 150) ? (
            <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="mt-0.5 inline-flex min-h-11 items-center gap-1 text-12 font-semibold text-primary lg:min-h-8 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronDown className={cn('size-3.5 transition-transform', more && 'rotate-180')} aria-hidden />
              {more ? t.editor.less : t.editor.more}
            </button>
          ) : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-muted-foreground">
            {group.schemaVersion !== null || version ? (
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <span className="tabular-nums">{t.editor.version(version)}</span>
              </span>
            ) : null}
            <span>{t.editor.updated(meta.by, relative(meta.at, locale))}</span>
            {group.approval === 'second-approver' ? (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5" aria-hidden />
                {t.editor.approvalSecond}
              </span>
            ) : group.approval === 'controls' ? (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5" aria-hidden />
                {t.editor.approvalControls}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {group.attention ? (
        <Callout tone="warning" icon={<TriangleAlert className="size-4" aria-hidden />}>
          {group.attention[locale]}
        </Callout>
      ) : null}
      {!group.inDashboard ? (
        <Callout tone="info" icon={<Sparkles className="size-4" aria-hidden />}>
          {t.editor.newHint}
        </Callout>
      ) : null}
      {group.key === 'payment_gateways' ? (
        <Callout tone="neutral" icon={<Crown className="size-4" aria-hidden />}>
          <p>{t.special.gatewaysNote}</p>
          {group.permission ? <p className="mt-1 text-12 text-muted-foreground">{group.permission[locale]}</p> : null}
        </Callout>
      ) : null}

      {(related || group.notes) && compact ? (
        <button
          type="button"
          aria-expanded={showRelated}
          onClick={() => setShowRelated((v) => !v)}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-13 font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className={cn('size-4 transition-transform', showRelated && 'rotate-180')} aria-hidden />
          {t.editor.relatedToggle(related?.links.filter((k) => !s.hidden(k)).length ?? 0)}
        </button>
      ) : null}
      {(related || group.notes) && (!compact || showRelated) ? (
        <div className="mt-4 rounded-xl bg-muted/50 px-4 py-3">
          <p className="text-13 leading-relaxed text-muted-foreground">{(group.notes ?? related?.note)?.[locale]}</p>
          {related?.links.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-12 font-semibold text-muted-foreground">{t.editor.related}</span>
              {related.links
                .filter((k) => !s.hidden(k))
                .map((k) => {
                  const g = groupByKey.get(k);
                  if (!g) return null;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => s.go({ group: k, pane: 'editor' })}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-card px-3 text-12 font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:min-h-7"
                    >
                      <Icon name={g.icon} className="size-3.5 text-primary" />
                      {g.title[locale]}
                    </button>
                  );
                })}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

function SubsectionBlock({ group, sub }: { group: SettingsGroup; sub: Subsection }) {
  const s = useStore();
  const { t, locale } = s;
  const bp = useBp();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const main = sub.fields.filter((f) => !f.advanced);
  const advanced = sub.fields.filter((f) => f.advanced);
  const changed = sub.fields.filter((f) => !same(s.draftValue(f), f.default) && !f.readOnly && !f.structured && f.type !== 'secret');

  if (group.key === 'whatsapp_provider' && sub.id === 'credentials' && s.role !== 'owner') {
    return (
      <section data-sub={sub.id} className="scroll-mt-32">
        <SubHead sub={sub} count={sub.fields.length} />
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed bg-card px-4 py-4 text-13 text-muted-foreground">
          <Crown className="size-4 shrink-0" aria-hidden />
          {t.special.credentialsHidden}
        </div>
      </section>
    );
  }

  const row = (f: Field) => (
    <FieldRow
      key={f.key}
      field={f}
      value={s.draftValue(f)}
      saved={s.values[group.key]?.[f.key]}
      onChange={(v) => s.edit(f, v)}
      domId={`f-${group.key}-${f.key.replace(/[^\w-]/g, '_')}`}
      focused={s.focus === f.key}
      onFocus={() => s.setFocus(f.key)}
      onInfo={() => {
        s.setFocus(f.key);
        s.setInspectorTab('field');
        if (bp === 'xl') s.setInspectorOpen(true);
        else s.setSheetOpen(true);
      }}
      flashN={s.flash?.key === f.key ? s.flash.n : undefined}
    />
  );

  return (
    <section data-sub={sub.id} aria-labelledby={`sub-${sub.id}`} className="scroll-mt-32">
      <SubHead
        sub={sub}
        count={sub.fields.length}
        action={
          changed.length > 1 ? (
            <button
              type="button"
              onClick={() => {
                changed.forEach((f) => s.edit(f, f.default));
                s.say(t.editor.resetSectionDone);
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-12 font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {t.editor.resetSection}
            </button>
          ) : null
        }
      />
      {group.key === 'payment_gateways' ? <GatewayStrip sub={sub} /> : null}
      {group.key === 'whatsapp_provider' && sub.id === 'status' ? (
        <WhatsAppStatus sub={sub} />
      ) : (
        <div className="mt-3 rounded-2xl border bg-card p-1.5">
          <div className="grid grid-cols-1 divide-y divide-border/60">{main.map(row)}</div>
          {advanced.length ? (
            <div className={cn(main.length && 'border-t border-border/60', 'px-1.5 pt-1.5')}>
              <button
                type="button"
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced((v) => !v)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-13 font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
              >
                <ChevronDown className={cn('size-4 transition-transform', showAdvanced && 'rotate-180')} aria-hidden />
                {showAdvanced ? t.editor.hideAdvanced : t.editor.advanced(advanced.length)}
              </button>
              {showAdvanced || advanced.some((f) => s.flash?.key === f.key) ? <div className="grid grid-cols-1 divide-y divide-border/60 pb-1">{advanced.map(row)}</div> : null}
            </div>
          ) : null}
          {group.key === 'whatsapp_provider' && sub.id === 'test' ? <WhatsAppTest /> : null}
        </div>
      )}
    </section>
  );
}

function SubHead({ sub, count, action }: { sub: Subsection; count: number; action?: ReactNode }) {
  const { t, locale } = useStore();
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-1">
      <div className="min-w-0">
        <h2 id={`sub-${sub.id}`} className="text-16 font-bold leading-snug">
          {sub.title[locale]}
          <span className="ms-2 text-12 font-medium text-muted-foreground">{t.editor.fieldsCount(count)}</span>
        </h2>
        <p className="mt-0.5 max-w-[68ch] text-13 text-muted-foreground">{sub.description[locale]}</p>
      </div>
      {action}
    </div>
  );
}

function GatewayStrip({ sub }: { sub: Subsection }) {
  const s = useStore();
  const { t, locale } = s;
  const code = sub.fields[0]?.key.split('.')[0] ?? '';
  const idx = GATEWAY_INDEX[code];
  const pmKey = `gateways.${idx}.enabled`;
  const canPay = s.values.payment_methods?.[pmKey] === true;
  const [state, setState] = useState<'idle' | 'testing'>('idle');
  const source = sub.fields.find((f) => f.key.endsWith('.source'));
  const mode = sub.fields.find((f) => f.key.endsWith('.mode'));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
      {source ? <Pill tone={s.values.payment_gateways[source.key] === 'none' ? 'neutral' : 'primary'}>{readable(source, s.values.payment_gateways[source.key], t, locale)}</Pill> : null}
      {mode ? <Pill tone={s.values.payment_gateways[mode.key] === 'live' ? 'success' : 'warning'}>{readable(mode, s.values.payment_gateways[mode.key], t, locale)}</Pill> : null}
      <button
        type="button"
        onClick={() => s.go({ group: 'payment_methods', field: pmKey, pane: 'editor' })}
        className="inline-flex min-h-11 lg:min-h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-12 font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StateDot state={canPay ? 'on' : 'off'} label="" className="size-2" />
        {t.special.customersCanPay}: {canPay ? t.field.on : t.field.off}
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Link2 className="size-3" aria-hidden />
          {t.special.inPaymentMethods}
        </span>
      </button>
      <button
        type="button"
        disabled={state === 'testing'}
        onClick={() => {
          setState('testing');
          window.setTimeout(() => {
            setState('idle');
            s.say(`${sub.title[locale]}: ${t.toast.tested}`);
          }, 900);
        }}
        className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-12 font-semibold text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8"
      >
        {state === 'testing' ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> : <PlugZap className="size-3.5" aria-hidden />}
        {state === 'testing' ? t.special.testing : t.special.testConnection}
      </button>
    </div>
  );
}

function WhatsAppStatus({ sub }: { sub: Subsection }) {
  const s = useStore();
  const { t, locale } = s;
  const [checking, setChecking] = useState(false);
  const v = (k: string) => s.values.whatsapp_provider?.[k];
  const statusField = sub.fields.find((f) => f.key === 'status')!;
  const providerField = sub.fields.find((f) => f.key === 'provider');
  const status = String(v('status'));
  const ok = status === 'working';
  return (
    <div className="mt-3 grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <span className={cn('inline-flex size-12 items-center justify-center rounded-2xl bg-muted', ok ? 'text-success' : 'text-warning-strong')}>
        <CircleCheck className="size-6" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-12 text-muted-foreground">{t.special.waStatus}</p>
        <p className="flex items-center gap-2 text-18 font-bold">
          <StateDot state={ok ? 'on' : 'attention'} label="" />
          {readable(statusField, v('status'), t, locale)}
          {providerField ? <span className="text-13 font-medium text-muted-foreground">· {readable(providerField, v('provider'), t, locale)}</span> : null}
        </p>
        <p className="mt-1 text-12 text-muted-foreground">
          {t.special.lastSuccess}: {v('lastSuccessAt') ? relative(String(v('lastSuccessAt')), locale) : t.special.never} · {t.special.lastError}:{' '}
          {v('lastErrorAt') ? relative(String(v('lastErrorAt')), locale) : t.special.never}
        </p>
      </div>
      <Btn
        onClick={() => {
          setChecking(true);
          window.setTimeout(() => setChecking(false), 800);
        }}
        disabled={checking}
      >
        {checking ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
        {t.special.checkNow}
      </Btn>
    </div>
  );
}

function WhatsAppTest() {
  const s = useStore();
  const { t } = s;
  const [sending, setSending] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border/60 px-3 py-3">
      <Btn
        variant="primary"
        disabled={sending}
        onClick={() => {
          setSending(true);
          window.setTimeout(() => {
            setSending(false);
            s.say(t.toast.testSent);
          }, 900);
        }}
      >
        {sending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden />}
        {sending ? t.special.sending : t.special.sendTest}
      </Btn>
      <span className="text-12 text-muted-foreground">{t.special.testLimit}</span>
    </div>
  );
}

export function PermissionHidden() {
  const { t } = useStore();
  return (
    <div className="mt-8 grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Crown className="size-6" aria-hidden />
      </span>
      <h2 className="mt-3 text-16 font-bold">{t.perm.hiddenTitle}</h2>
      <p className="mt-1 max-w-sm text-13 text-muted-foreground">{t.perm.hiddenBody}</p>
    </div>
  );
}

function SaveBar({ group }: { group: SettingsGroup }) {
  const s = useStore();
  const { t, locale } = s;
  const [nothing, setNothing] = useState(false);
  const dirtyFields = useMemo(() => group.subsections.flatMap((x) => x.fields).filter((f) => f.key in s.draft), [group, s.draft]);
  const n = dirtyFields.length;
  const send = n > 0 && s.needsApproval(group, dirtyFields.map((f) => f.key));
  const meta = s.meta[group.key];
  useEffect(() => setNothing(false), [n]);

  return (
    <div className="z-10 shrink-0 border-t bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:px-6" data-savebar>
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-13" aria-live="polite">
          {n ? (
            <>
              <span className="size-2.5 shrink-0 rounded-full bg-warning" aria-hidden />
              <span className="font-bold">{t.save.unsaved(n)}</span>
              <span className="hidden truncate text-muted-foreground @xl:inline">
                {dirtyFields
                  .slice(0, 3)
                  .map((f) => f.label[locale])
                  .join(locale === 'ar' ? '، ' : ', ')}
              </span>
            </>
          ) : (
            <span className="truncate text-muted-foreground">
              {nothing ? (
                t.save.nothing
              ) : (
                <>
                  {t.save.upToDate} · {t.editor.version(s.versions[group.key])}
                  <span className="hidden @xl:inline">
                    {' '}
                    · {meta.by}, {relative(meta.at, locale)}
                  </span>
                </>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {n ? (
            <Btn variant="ghost" onClick={s.discard}>
              {t.save.discard}
            </Btn>
          ) : null}
          <Btn variant="primary" onClick={() => (n ? s.openReview() : setNothing(true))} data-act="review">
            {send ? t.save.reviewSend : t.save.review}
            {n ? <span className="rounded-full bg-primary-foreground/20 px-1.5 text-11 tabular-nums">{n}</span> : null}
          </Btn>
        </div>
      </div>
    </div>
  );
}
