// Navigation and staging helpers shared by the overview, search and group pages.
import { useMemo } from 'react';
import type { Field, FieldValue } from '@lab/mocks/settings';
import type { Messages } from '../i18n';
import { formatValue, groupOf, L, type ValueWords } from './data';
import type { Check } from './readiness';
import { useSettings } from './store';

export function valueWords(t: Messages): ValueWords {
  return { on: t.control.on, off: t.control.off, notSet: t.control.notSet, items: t.field.items };
}

export function useFmt() {
  const { t, lang } = useSettings();
  return useMemo(() => {
    const words = valueWords(t);
    return (field: Field, value: FieldValue | undefined) => formatValue(field, value, lang, words);
  }, [t, lang]);
}

export function useNav() {
  const { dispatch, t, lang } = useSettings();
  return useMemo(
    () => ({
      overview: () => {
        dispatch({ type: 'go', view: 'overview' });
        scrollTop();
      },
      preferences: () => {
        dispatch({ type: 'go', view: 'preferences' });
        scrollTop();
      },
      group: (key: string, focus?: string) => {
        dispatch({ type: 'go', view: 'group', group: key, focus: focus ?? null });
        if (!focus) scrollTop();
      },
      /** Stage a rule's recommended values in the group draft, open the group and its review sheet. */
      apply: (check: Check) => {
        if (!check.recommend?.length) return;
        const values = Object.fromEntries(check.recommend.map((r) => [r.field, r.value]));
        dispatch({ type: 'stage', group: check.group, values });
        dispatch({ type: 'go', view: 'group', group: check.group, focus: check.field, sheet: 'review' });
        dispatch({ type: 'toast', text: t.check.staged(L(groupOf(check.group)?.title, lang)) });
      },
    }),
    [dispatch, t, lang],
  );
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}
