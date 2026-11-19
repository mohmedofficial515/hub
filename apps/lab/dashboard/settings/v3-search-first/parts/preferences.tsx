// My preferences: this browser only, applied at once (no Save). Reached from the scope switch or from search.

import { RotateCcw, Zap } from 'lucide-react';
import { PREFERENCES, type Field } from '@lab/mocks/settings';
import { useLocale, useT } from '@lab/i18n';
import { messages } from '../i18n';
import { FieldRow } from './field-row';
import { formatValue, loc } from './format';
import { iconFor } from './icons';
import { prefGroupKey } from './model';
import type { Route } from './route';
import { useStore } from './store';
import { Badge, Btn, IconTile } from './ui';

/** A field that only matters when another one has a value. */
const DEPENDS: Record<string, (get: (key: string) => unknown) => boolean> = {
  customColor: (get) => get('colorTheme') === 'custom',
  sidebarBgColor: (get) => get('sidebarCustomBg') === true,
};

export function PreferencesPage({ route }: { route: Extract<Route, { view: 'prefs' }> }) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6">
      <header className="pt-6 sm:pt-10">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1 basis-72">
            <h1 className="text-26 font-extrabold leading-tight sm:text-32">{t.prefs.title}</h1>
            <p className="mt-2 max-w-2xl text-14 leading-relaxed text-muted-foreground">{t.prefs.lead}</p>
          </div>
          <Btn
            onClick={() => {
              store.resetPrefs();
              store.toast(t.toasts.prefsReset);
            }}
          >
            <RotateCcw aria-hidden className="size-4" />
            {t.prefs.reset}
          </Btn>
        </div>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-13 font-semibold">
          <Zap aria-hidden className="size-4 text-primary dark:text-foreground" />
          {t.prefs.instant}
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-10">
        {PREFERENCES.map((tab) => {
          const groupKey = prefGroupKey(tab.id);
          const get = (key: string) => store.value(groupKey, key);
          const fields = tab.fields.filter((f) => !DEPENDS[f.key] || DEPENDS[f.key](get));
          return (
            <section key={tab.id} aria-labelledby={`pref-${tab.id}`}>
              <div className="mb-3 flex items-start gap-3 px-1">
                <IconTile icon={iconFor(tab.icon)} />
                <div className="min-w-0">
                  <h2 id={`pref-${tab.id}`} className="text-18 font-bold">
                    {loc(tab.title, locale)}
                  </h2>
                  <p className="mt-0.5 text-13 leading-relaxed text-muted-foreground">{loc(tab.description, locale)}</p>
                </div>
                {tab.id === 'notifications' && (
                  <Badge tone="warning" className="ms-auto mt-1">
                    {t.prefs.notEnforced}
                  </Badge>
                )}
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {fields.map((f: Field) => {
                  const v = store.value(groupKey, f.key);
                  return (
                    <FieldRow
                      key={f.key}
                      field={f}
                      value={v}
                      saved={v}
                      instant
                      onChange={(next) => {
                        store.setPref(groupKey, f.key, next);
                        store.toast(t.toasts.applied(loc(f.label, locale), formatValue(f, next, locale, t)));
                      }}
                      pinId={`pref.${tab.id}.${f.key}`}
                      route={{ view: 'prefs', field: f.key }}
                      highlight={route.field === f.key}
                      tokens={[]}
                      canSeeSecrets={false}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
