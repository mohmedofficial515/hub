'use client';

/**
 * @file shortcuts-dialog.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/shell/shortcuts-dialog.tsx. Contract: apps/web/README.md.
 */
import { useId } from 'react';

import { Kbd, Modal, setPreference, usePreference } from '@/components/kit';
import { views } from '@/components/shell/views';
import { useT } from '@/lib/i18n';
import { messages } from '@/lib/i18n';

/** One row per destination, from the registry, so a `g` key can never be missing from this list (review M19). */
const GO_TO = views.filter((v) => v.goKey);

const LIST: { group: 'nav' | 'lists' | 'cards'; keys: [string[], string][] }[] = [
  {
    group: 'nav',
    keys: [
      [['Ctrl K', '/'], 'palette'],
      [['?'], 'help'],
      [['[', ']'], 'sidebar'],
      [['n t'], 'newTask'],
      [['n d'], 'newDecision'],
      [['n n'], 'newNeed'],
      [['n h'], 'newHandoff'],
    ],
  },
  {
    group: 'lists',
    keys: [
      [['j', 'k'], 'move'],
      [['Enter', 'o'], 'open'],
      [['u'], 'undo'],
      [['r'], 'refresh'],
      [['f'], 'timelineFilters'],
      [['e'], 'inboxRead'],
      [['Shift E'], 'inboxReadAll'],
      [['v'], 'tasksView'],
      [['x'], 'redesignPick'],
    ],
  },
  {
    group: 'cards',
    keys: [
      [['c'], 'claim'],
      [['d'], 'decide'],
      [['a'], 'acknowledge'],
      [['w'], 'watch'],
      [['Ctrl Shift C'], 'copyKey'],
      [['Esc'], 'close'],
    ],
  },
];

/** 08 §5.5, §12. Also where single-key shortcuts are turned off (WCAG 2.1.4, review minor). */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT(messages);
  const id = useId();
  const enabled = usePreference('shortcuts');
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t.shortcuts.title}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
          <input
            id={id}
            type="checkbox"
            checked={enabled}
            onChange={(e) => setPreference('shortcuts', e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-primary md:size-4"
          />
          <label htmlFor={id} className="min-w-0 cursor-pointer">
            <span className="block text-body font-medium text-foreground">{t.shortcuts.disable}</span>
            <span className="mt-0.5 block text-body-sm text-muted-foreground">{t.shortcuts.disableHint}</span>
          </label>
        </div>
        <section>
          <h3 className="text-body font-semibold text-foreground">{t.shortcuts.groups.go}</h3>
          <dl className="mt-1.5 flex flex-col">
            {GO_TO.map((view) => (
              <div
                key={view.id}
                className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
              >
                <dt className="min-w-0 text-body-sm text-foreground">{t.nav[view.id]}</dt>
                <dd className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Kbd>{`g ${view.goKey}`}</Kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
        {LIST.map(({ group, keys }) => (
          <section key={group}>
            <h3 className="text-body font-semibold text-foreground">{t.shortcuts.groups[group]}</h3>
            <dl className="mt-1.5 flex flex-col">
              {keys.map(([combo, item]) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
                >
                  <dt className="min-w-0 text-body-sm text-foreground">{t.shortcuts.items[item]}</dt>
                  <dd className="flex shrink-0 flex-wrap justify-end gap-1">
                    {combo.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
