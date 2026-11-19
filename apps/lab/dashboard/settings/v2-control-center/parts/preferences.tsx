/**
 * My preferences: the three tabs in one compact panel that applies every change at once (no save bar, no
 * versions), beside a live preview of the dashboard drawn with the chosen theme, colour, font, layout, table and
 * notification options. The preview uses its own colours on purpose: it shows the viewer's choice, not the frame's.
 */
import { useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Bell, Check, Columns3, Mail, MonitorSmartphone, Palette, RotateCcw, Search, Table2, Volume2 } from 'lucide-react';
import { cn } from '@lab/utils';
import { PREFERENCES, type Field, type FieldValue, type PreferenceTab } from '@lab/mocks/settings';
import { FieldControl, useFieldId } from './controls';
import { fill, num } from './format';
import { same } from './model';
import { useStore, type PrefTab } from './store';
import { Btn, Pill, Segmented } from './ui';

const TAB_ICON = { appearance: Palette, tables: Table2, notifications: Bell } as const;

export function PreferencesPanel() {
  const { t, locale, route, go, prefs, setPref } = useStore();
  const reduce = useReducedMotion();
  const tabId: PrefTab = route.tab ?? 'appearance';
  const tab = PREFERENCES.find((p) => p.id === tabId) ?? PREFERENCES[0];
  const [pulse, setPulse] = useState(0);

  const apply = (key: string, value: FieldValue) => {
    setPref(key, value);
    setPulse((p) => p + 1);
  };

  const visible = tab.fields.filter((f) => {
    if (f.key === 'customColor') return prefs.colorTheme === 'custom';
    if (f.key === 'sidebarBgColor') return prefs.sidebarCustomBg === true;
    return true;
  });
  const changed = tab.fields.filter((f) => !same(prefs[f.key], f.default));

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <section aria-labelledby="prefs-title" className="min-w-0 rounded-3xl border border-border bg-card">
        <header className="grid gap-4 px-4 pt-5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="prefs-title" className="text-20 font-extrabold">
                {t.prefs.title}
              </h2>
              <p className="mt-0.5 max-w-[60ch] text-13 leading-relaxed text-muted-foreground">{t.prefs.lead}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-12 font-semibold text-success-soft-foreground" aria-live="polite">
              <motion.span
                key={pulse}
                initial={reduce || pulse === 0 ? false : { scale: 0.6, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className="grid size-5 place-items-center rounded-full bg-success/15"
              >
                <Check className="size-3.5" aria-hidden />
              </motion.span>
              {t.prefs.applied}
            </span>
          </div>
          <Segmented<PrefTab>
            label={t.prefs.title}
            value={tabId}
            stretch
            onChange={(v) => go({ view: 'prefs', tab: v }, { replace: true })}
            options={PREFERENCES.map((p) => {
              const IconCmp = TAB_ICON[p.id];
              return {
                value: p.id,
                label: (
                  <>
                    <IconCmp className="size-4" aria-hidden />
                    {p.title[locale]}
                  </>
                ),
              };
            })}
          />
          <p className="text-13 leading-relaxed text-muted-foreground">{tab.description[locale]}</p>
        </header>
        <div className="mt-2 divide-y divide-border/70">
          {visible.map((field) => (
            <PrefRow key={field.key} field={field} value={prefs[field.key] ?? null} onChange={(v) => apply(field.key, v)} />
          ))}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
          <span className="text-12 text-muted-foreground">{changed.length ? fill(t.group.sectionChanged, { n: num(locale, changed.length) }) : t.group.allDefault}</span>
          <Btn
            variant="quiet"
            size="sm"
            disabled={!changed.length}
            onClick={() => {
              for (const f of tab.fields) setPref(f.key, f.default);
              setPulse((p) => p + 1);
            }}
          >
            <RotateCcw />
            {fill(t.prefs.resetTab, { tab: tab.title[locale] })}
          </Btn>
        </footer>
      </section>
      <Preview tab={tab} />
    </div>
  );
}

function PrefRow({ field, value, onChange }: { field: Field; value: FieldValue; onChange: (v: FieldValue) => void }) {
  const { t, locale } = useStore();
  const id = useFieldId(`pref-${field.key}`);
  const wide = field.key === 'colorTheme' || field.key === 'fontFamily' || field.type === 'multi-enum';
  return (
    <div className={cn('grid gap-3 px-4 py-4 sm:px-5', !wide && 'md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-14 font-bold">
            {field.label[locale]}
          </label>
          {field.proposedOptions?.length ? <Pill tone="info">{`${t.field.proposed} · ${field.proposalId} · ${field.priority}`}</Pill> : null}
        </div>
        <p className="mt-0.5 text-13 leading-relaxed text-muted-foreground">{field.help[locale]}</p>
        {field.note ? <p className="mt-1 text-12 text-info-soft-foreground">{field.note[locale]}</p> : null}
      </div>
      <div className={cn('min-w-0', !wide && 'md:justify-self-end')}>
        {field.key === 'colorTheme' ? (
          <Swatches field={field} value={String(value)} onChange={onChange} />
        ) : field.key === 'fontFamily' ? (
          <Fonts field={field} value={String(value)} onChange={onChange} />
        ) : (
          <FieldControl field={field} value={value} onChange={onChange} id={id} />
        )}
      </div>
    </div>
  );
}

function Swatches({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  const { locale } = useStore();
  return (
    <div role="radiogroup" aria-label={field.label[locale]} className="flex flex-wrap gap-2">
      {(field.options ?? []).map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-xl border px-2.5 text-13 font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-10',
              on ? 'border-foreground/40 bg-muted' : 'border-border hover:bg-muted/60',
            )}
          >
            <span
              aria-hidden
              className="grid size-5 place-items-center rounded-full ring-1 ring-black/10"
              style={{ background: o.hint ?? 'conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)' }}
            >
              {on ? <Check className="size-3 text-white" strokeWidth={3} /> : null}
            </span>
            {o.label[locale]}
          </button>
        );
      })}
    </div>
  );
}

function Fonts({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  const { locale } = useStore();
  return (
    <div role="radiogroup" aria-label={field.label[locale]} className="grid gap-2 sm:grid-cols-2">
      {(field.options ?? []).map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 text-start outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
              on ? 'border-foreground/40 bg-muted' : 'border-border hover:bg-muted/60',
            )}
          >
            <span className="grid">
              <span className="text-16 font-semibold" style={{ fontFamily: `'${o.value}', sans-serif` }}>
                أبجد هوز · Aa
              </span>
              <span className="text-12 text-muted-foreground" dir="ltr">
                {o.label[locale]}
              </span>
            </span>
            {on ? <Check className="size-4 shrink-0" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

// ─── Live preview ───────────────────────────────────────────────────────────

const LIGHT = { bg: '#f6f7f9', card: '#ffffff', fg: '#1e2533', muted: '#667085', border: '#e4e7ec', side: '#e9ecf1', sideFg: '#344054', stripe: '#f4f6f8' };
const DARK = { bg: '#171d29', card: '#212938', fg: '#f2f4f7', muted: '#a3acbb', border: 'rgba(255,255,255,0.1)', side: '#0f1a2e', sideFg: '#c5cbd6', stripe: 'rgba(255,255,255,0.04)' };
const SIZES: Record<string, number> = { sm: 0.92, base: 1, lg: 1.08, xl: 1.16 };
const ROW_H: Record<string, number> = { comfortable: 40, standard: 33, compact: 27 };

function Preview({ tab }: { tab: PreferenceTab }) {
  const { t, prefs } = useStore();
  const frameDark = document.documentElement.classList.contains('dark');
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && frameDark);
  const c = dark ? DARK : LIGHT;
  const colorField = PREFERENCES[0].fields.find((f) => f.key === 'colorTheme');
  const primary = prefs.colorTheme === 'custom' && /^#[0-9a-f]{6}$/i.test(String(prefs.customColor)) ? String(prefs.customColor) : colorField?.options?.find((o) => o.value === prefs.colorTheme)?.hint ?? '#2e7a82';
  const scale = SIZES[String(prefs.fontSize)] ?? 1;
  const layout = String(prefs.layout);
  const style = String(prefs.layoutStyle);
  const radius = style === 'classic' ? 4 : style === 'modern' ? 10 : 14;
  const sideW = layout === 'no-sidebar' ? 0 : layout === 'compact' ? 34 : 70;
  const side = prefs.sidebarCustomBg === true ? String(prefs.sidebarBgColor) : c.side;
  const rowH = ROW_H[String(prefs['tableSettings.density'])] ?? 33;
  const striped = prefs['tableSettings.striped'] === true;
  const rows = Math.min(Number(prefs['tableSettings.pageSize']) || 4, 4);
  const channels = [
    ['notifications.email', Mail],
    ['notifications.push', MonitorSmartphone],
    ['notifications.inApp', Bell],
    ['notifications.sound', Volume2],
  ] as const;
  const onChannels = channels.filter(([k]) => prefs[k] === true);

  const card: CSSProperties = {
    background: c.card,
    border: style === 'floating' ? 'none' : `1px solid ${c.border}`,
    borderRadius: radius,
    boxShadow: style === 'floating' ? (dark ? '0 6px 18px rgba(0,0,0,.35)' : '0 6px 18px rgba(16,24,40,.08)') : 'none',
  };

  return (
    <aside aria-labelledby="preview-title" className="rounded-3xl border border-border bg-card p-4 xl:sticky xl:top-6">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="preview-title" className="text-15 font-extrabold">
          {t.prefs.preview}
        </h2>
        <span className="text-12 text-muted-foreground">{t.prefs.previewLead}</span>
      </div>
      <div
        aria-hidden
        className="mt-3 overflow-hidden rounded-2xl"
        style={{ background: c.bg, color: c.fg, fontFamily: `'${String(prefs.fontFamily)}', sans-serif`, fontSize: 12 * scale, border: `1px solid ${c.border}` }}
      >
        <div className="flex min-h-72">
          {sideW ? (
            <div className="flex shrink-0 flex-col gap-2 p-2 transition-all" style={{ width: sideW, background: side }}>
              <span className="h-2.5 rounded-full" style={{ background: primary, width: sideW > 40 ? '70%' : '100%' }} />
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="h-2 rounded-full" style={{ background: i === 1 ? primary : c.sideFg, opacity: i === 1 ? 0.9 : 0.25 }} />
              ))}
            </div>
          ) : null}
          <div className="grid min-w-0 flex-1 content-start gap-2.5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold" style={{ fontSize: '1.15em' }}>
                {t.prefs.previewTitle}
              </span>
              <span className="rounded-md px-2 py-1 font-semibold text-white" style={{ background: primary, borderRadius: Math.max(radius - 4, 3), fontSize: '0.9em' }}>
                {t.prefs.previewAction}
              </span>
            </div>
            {tab.id === 'notifications' ? (
              <div className="grid gap-2">
                <div className="flex items-start gap-2 p-2.5" style={card}>
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-white" style={{ background: primary }}>
                    <Bell className="size-3" />
                  </span>
                  <span className="grid">
                    <span className="font-bold">{t.prefs.previewNotif}</span>
                    <span style={{ color: c.muted }}>{t.prefs.previewNotifBody}</span>
                  </span>
                </div>
                <div className="p-2.5" style={card}>
                  <span style={{ color: c.muted }}>{t.prefs.previewChannels}</span>
                  {onChannels.length ? (
                    <div className="mt-1.5 flex gap-1.5">
                      {onChannels.map(([k, IconCmp]) => (
                        <span key={k} className="grid size-7 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${primary} 14%, transparent)`, color: primary }}>
                          <IconCmp className="size-3.5" />
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 font-semibold">{t.prefs.previewMuted}</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="p-2.5" style={card}>
                      <span className="block" style={{ color: c.muted, fontSize: '0.85em' }}>
                        {t.prefs.previewKpi}
                      </span>
                      <span className="font-extrabold tabular-nums" style={{ fontSize: '1.4em', color: i === 0 ? primary : c.fg }}>
                        {i === 0 ? '128' : '1,250'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="overflow-hidden" style={card}>
                  {prefs['tableSettings.showGlobalFilter'] || prefs['tableSettings.showColumnVisibility'] ? (
                    <div className="flex items-center gap-2 p-2" style={{ borderBottom: `1px solid ${c.border}` }}>
                      {prefs['tableSettings.showGlobalFilter'] ? (
                        <span className="flex flex-1 items-center gap-1 rounded-md px-1.5 py-1" style={{ border: `1px solid ${c.border}`, color: c.muted }}>
                          <Search className="size-3" />
                          {t.prefs.previewSearch}
                        </span>
                      ) : (
                        <span className="flex-1" />
                      )}
                      {prefs['tableSettings.showColumnVisibility'] ? (
                        <span className="flex items-center gap-1 rounded-md px-1.5 py-1" style={{ border: `1px solid ${c.border}`, color: c.muted }}>
                          <Columns3 className="size-3" />
                          {t.prefs.previewColumns}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {t.prefs.previewRows.slice(0, rows).map((row, i) => (
                    <div
                      key={row}
                      className="flex items-center gap-2 px-2"
                      style={{ height: rowH * scale, background: striped && i % 2 ? c.stripe : 'transparent', borderTop: i ? `1px solid ${c.border}` : 'none' }}
                    >
                      {prefs['tableSettings.showRowSelection'] ? <span className="size-3 shrink-0 rounded-sm" style={{ border: `1.5px solid ${c.muted}` }} /> : null}
                      <span className="min-w-0 flex-1 truncate">{row}</span>
                      {prefs['tableSettings.showColumnResize'] ? <span className="h-3 w-px" style={{ background: c.border }} /> : null}
                      <span className="rounded-full px-1.5 font-semibold" style={{ background: `color-mix(in oklab, ${primary} 12%, transparent)`, color: primary, fontSize: '0.85em' }}>
                        {i % 2 ? '✓' : '•'}
                      </span>
                    </div>
                  ))}
                  <div className="px-2 py-1.5" style={{ borderTop: `1px solid ${c.border}`, color: c.muted, fontSize: '0.85em' }}>
                    {fill(t.prefs.previewPage, { n: String(prefs['tableSettings.pageSize']) })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {prefs.theme === 'system' ? (
        <p className="mt-1 px-1">
          <Pill tone="info">{t.prefs.proposedOption}</Pill>
        </p>
      ) : null}
    </aside>
  );
}
