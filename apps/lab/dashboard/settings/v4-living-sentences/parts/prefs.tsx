/**
 * "My preferences": three paragraphs written in the first person, applied the moment a token changes (no Save). PrefEffects applies
 * theme and language through the frame URL (the lab's own switches), and colour, font and size on <html>.
 */
import { useEffect, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { PREFERENCES } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { useBook } from './store';
import { PREF_DOCS, same } from './model';
import { SubsectionBlock } from './body';
import { GroupIcon } from './icons';
import { btn } from './ui';

export function PrefsPage() {
  const book = useBook();
  const { t, locale } = book;
  return (
    <div className="max-w-[46rem]">
      <h1 className="text-32 font-black leading-tight">{t.ui.prefsTitle}</h1>
      <p className="mt-4 text-17 leading-[1.9] text-muted-foreground">{t.ui.prefsLede}</p>
      <div className="mt-12 grid gap-14">
        {PREF_DOCS.map((doc) => {
          const tab = PREFERENCES.find((p) => `prefs:${p.id}` === doc.key)!;
          const fields = doc.subsections[0].fields;
          const resettable = fields.filter((f) => !same(book.get(doc.key, f.key), f.default)).map((f) => f.key);
          return (
            <section key={doc.key} aria-labelledby={`h-${doc.key}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id={`h-${doc.key}`} className="flex items-center gap-2.5 text-22 font-extrabold">
                  <GroupIcon name={tab.icon} className="size-5 text-primary" />
                  {tab.title[locale]}
                </h2>
                <div className="flex items-center gap-2">
                  <Applied at={book.appliedAt(doc.key)} />
                  {resettable.length ? (
                    <button type="button" className={btn('quiet', 'sm')} onClick={() => book.resetFields(doc.key, resettable)}>
                      <RotateCcw className="size-3.5" aria-hidden />
                      {t.ui.resetPara}
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-14 text-muted-foreground">{tab.description[locale]}</p>
              <SubsectionBlock doc={doc} sub={doc.subsections[0]} headingLevel={2} />
              {doc.key === 'prefs:appearance' ? <p className="mt-3 text-13 text-muted-foreground">{t.ui.frameNote}</p> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Applied({ at }: { at?: number }) {
  const { t } = useBook();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!at) return;
    setShow(true);
    const id = window.setTimeout(() => setShow(false), 2200);
    return () => window.clearTimeout(id);
  }, [at]);
  return (
    <span role="status" className={cn('inline-flex items-center gap-1 text-13 font-semibold text-success-soft-foreground transition-opacity motion-reduce:transition-none', show ? 'opacity-100' : 'opacity-0')}>
      {show ? (
        <>
          <Check className="size-4" aria-hidden />
          {t.ui.applied}
        </>
      ) : null}
    </span>
  );
}

const SIZES: Record<string, string> = { sm: '14px', base: '16px', lg: '18px', xl: '20px' };

/** Applies the appearance preferences instantly. */
export function PrefEffects() {
  const { get } = useBook();
  const theme = String(get('prefs:appearance', 'theme'));
  const language = String(get('prefs:appearance', 'language'));
  const color = String(get('prefs:appearance', 'colorTheme'));
  const custom = String(get('prefs:appearance', 'customColor') ?? '');
  const font = String(get('prefs:appearance', 'fontFamily'));
  const size = String(get('prefs:appearance', 'fontSize'));

  useEffect(() => {
    const want = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
    const [path, query = ''] = location.hash.split('?');
    const sp = new URLSearchParams(query);
    if (sp.get('theme') === want && (sp.get('lang') ?? 'ar') === language) return;
    sp.set('theme', want);
    sp.set('lang', language);
    location.hash = `${path.replace(/^#/, '')}?${sp.toString()}`;
  }, [theme, language]);

  useEffect(() => {
    const html = document.documentElement;
    const opt = PREFERENCES[0].fields.find((f) => f.key === 'colorTheme')?.options?.find((o) => o.value === color);
    const value = color === 'custom' ? custom : color === 'teal' ? '' : (opt?.hint ?? '');
    if (value) {
      html.style.setProperty('--primary', value);
      html.style.setProperty('--ring', value);
      if (!html.classList.contains('dark')) html.style.setProperty('--primary-text', value);
      else html.style.setProperty('--primary-foreground', 'oklch(0.99 0 0)');
    }
    html.style.setProperty('--font-family-base', `"${font}", "Cairo", sans-serif`);
    html.style.fontSize = SIZES[size] ?? '';
    return () => {
      for (const p of ['--primary', '--ring', '--primary-text', '--primary-foreground', '--font-family-base']) html.style.removeProperty(p);
      html.style.fontSize = '';
    };
  }, [color, custom, font, size, theme]);
  return null;
}
