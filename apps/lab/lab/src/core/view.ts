import type { Locale } from '@lab/i18n';

export type Theme = 'light' | 'dark';

/** Viewport + mode shared by the gallery and the frames. */
export interface ViewMode {
  lang: Locale;
  theme: Theme;
}

export const dirOf = (lang: Locale) => (lang === 'ar' ? 'rtl' : 'ltr');

export function readMode(params: URLSearchParams): ViewMode {
  return {
    lang: params.get('lang') === 'en' || params.get('dir') === 'ltr' ? 'en' : 'ar',
    theme: params.get('theme') === 'dark' ? 'dark' : 'light',
  };
}

/** Data scenarios a version may support (read with `scenarioFromHash()` in its mocks). */
export const SCENARIOS = ['default', 'empty', 'loading', 'frozen', 'topup-pending', 'topup-done', 'topup-failed', 'frontend', 'long', 'error'];

/** Frame hash: `#/<page>/<version>?lang=ar&theme=dark&scenario=empty` */
export function frameHash(page: string, version: string, mode: ViewMode & { scenario?: string }) {
  const scenario = mode.scenario && mode.scenario !== 'default' ? `&scenario=${mode.scenario}` : '';
  return `#/${page}/${version}?lang=${mode.lang}&theme=${mode.theme}${scenario}`;
}
