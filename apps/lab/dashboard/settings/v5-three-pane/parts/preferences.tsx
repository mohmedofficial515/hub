import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CircleCheck, MonitorSmartphone, RotateCcw } from 'lucide-react';
import { PREFERENCES } from '@lab/mocks/settings';
import { BackBtn, Crumbs } from './editor';
import { FieldRow } from './field-row';
import { same, type PrefTabId } from './lib';
import { useStore } from './store';
import { Btn, Icon, useBp } from './ui';

/** Personal preferences: their own form, instant (never mixed with the explicit Save of organisation groups). */
export function PreferencesEditor({ tabId }: { tabId: PrefTabId }) {
  const s = useStore();
  const { t, locale } = s;
  const bp = useBp();
  const reduce = useReducedMotion();
  const tab = PREFERENCES.find((x) => x.id === tabId)!;
  const [applied, setApplied] = useState<string | null>(null);
  const changed = tab.fields.filter((f) => !same(s.prefValue(tabId, f), f.default));

  useEffect(() => {
    if (!s.prefApplied?.startsWith(`${tabId}.`)) return;
    setApplied(s.prefApplied);
    const id = window.setTimeout(() => setApplied(null), 2400);
    return () => window.clearTimeout(id);
  }, [s.prefApplied, tabId]);

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="z-10 flex min-h-[3.25rem] shrink-0 items-center gap-2 border-b bg-background/95 px-4 py-1 md:px-6">
        {bp === 'sm' || bp === 'md' ? <BackBtn label={t.editor.back} onClick={() => s.go({ pane: 'list' })} /> : null}
        <div className="min-w-0 flex-1">
          <Crumbs items={[{ label: t.editor.breadcrumbRoot, onClick: () => s.go({ group: null, section: null, pane: 'home' }) }, { label: t.prefs.title, onClick: () => s.go({ section: 'prefs', pane: 'list' }) }, { label: tab.title[locale] }]} />
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 text-12 text-muted-foreground sm:inline-flex" aria-live="polite">
          {applied ? (
            <>
              <CircleCheck className="size-4 text-success" aria-hidden />
              {t.save.applied}
            </>
          ) : (
            <>
              <MonitorSmartphone className="size-4" aria-hidden />
              {t.save.instant}
            </>
          )}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <motion.div
          key={tabId}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: locale === 'ar' ? -18 : 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.2 }}
          className="mx-auto w-full max-w-4xl px-4 pb-10 pt-5 md:px-6"
        >
          <header className="flex items-start gap-4">
            <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary sm:inline-flex">
              <Icon name={tab.icon} className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 id="v5-pane-title" tabIndex={-1} className="text-22 font-extrabold leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-26">{tab.title[locale]}</h1>
              <p className="mt-1.5 max-w-[60ch] text-14 text-muted-foreground">{t.prefs.lead}</p>
            </div>
          </header>
          <div className="mt-6 rounded-2xl border bg-card p-1.5">
            <div className="grid grid-cols-1 divide-y divide-border/60">
              {tab.fields.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  value={s.prefValue(tabId, f)}
                  onChange={(v) => s.setPref(tabId, f, v)}
                  domId={`p-${tabId}-${f.key.replace(/[^\w-]/g, '_')}`}
                  focused={s.focus === f.key}
                  onFocus={() => s.setFocus(f.key)}
                  flashN={s.flash?.key === f.key ? s.flash.n : undefined}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-12 text-muted-foreground sm:hidden" aria-live="polite">
              {applied ? t.save.applied : t.save.instant}
            </p>
            <Btn variant="ghost" disabled={!changed.length} onClick={() => changed.forEach((f) => s.setPref(tabId, f, f.default))}>
              <RotateCcw className="size-4" aria-hidden />
              {t.save.resetTab}
            </Btn>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
