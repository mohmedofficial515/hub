import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '@lab/i18n';
import { EMAIL_SCENARIOS, fixtureFor, type EmailScenario } from './fixtures';
import { renderEmail, type Dict } from './render';
import { baseStrings, mergeStrings } from './strings';
import logoOnDark from './assets/logo-on-dark.png?url';
import logoOnLight from './assets/logo-on-light.png?url';

/** Gmail hides everything after this many bytes behind "View entire message". */
const GMAIL_CLIP = 102 * 1024;

export interface EmailVersion {
  layout: string;
  body: string;
  subject: string;
  /** `import.meta.glob('./partials/*.hbs', …)` of the version. */
  partials: Record<string, string>;
  messages: Record<'ar' | 'en', Dict>;
  /** Extra context, e.g. the hosted hero image. */
  context?: Dict;
  /** Owner switches of the version, shown as buttons and passed as booleans (default on). */
  toggles?: { key: string; label: string }[];
  /** Data scenarios of a template other than the booking confirmation; the first is the default. */
  fixtures?: Record<string, (lang: 'ar' | 'en') => Dict>;
}

const partialNames = (glob: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(glob).map(([path, raw]) => [path.split('/').pop()!.replace('.hbs', ''), raw]),
  );

const readHash = (key: string) => new URLSearchParams(location.hash.split('?')[1] ?? '').get(key);

/**
 * Renders a version's real `.hbs` files inside an isolated iframe, as a mail client would.
 * Dark mode swaps the `prefers-color-scheme` query on or off, so the gallery toggle decides, not
 * the OS. No web fonts are loaded on purpose: Gmail and Outlook drop them too.
 */
export function EmailPreview({ version }: { version: EmailVersion }) {
  const lang = useLocale();
  const dark = readHash('theme') === 'dark';
  const scenarios: string[] = version.fixtures ? Object.keys(version.fixtures) : EMAIL_SCENARIOS;
  const [scenario, setScenario] = useState<string>(() => {
    const raw = readHash('scenario');
    return raw && scenarios.includes(raw) ? raw : scenarios[0]!;
  });
  const [imagesOn, setImagesOn] = useState(readHash('images') !== 'off');
  const [off, setOff] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((version.toggles ?? []).map(({ key }) => [key, readHash(key) === 'off'])),
  );
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(900);

  const { subject, html } = useMemo(() => {
    const payload = {
      ...(version.fixtures?.[scenario]?.(lang) ?? fixtureFor(scenario as EmailScenario, lang)),
      logoOnDark: new URL(logoOnDark, location.href).href,
      logoOnLight: new URL(logoOnLight, location.href).href,
      ...version.context,
      ...Object.fromEntries((version.toggles ?? []).map(({ key }) => [key, !off[key]])),
    };
    return renderEmail(
      {
        layout: version.layout,
        body: version.body,
        subject: version.subject,
        partials: partialNames(version.partials),
        strings: mergeStrings(baseStrings[lang], version.messages[lang]),
      },
      lang,
      payload,
    );
  }, [version, lang, scenario, off]);

  const doc = useMemo(() => {
    let out = html.replace(/\(prefers-color-scheme:\s*dark\)/g, dark ? 'all' : 'not all');
    if (!imagesOn) {
      // What a client with images blocked shows: alt text and solid fallback colours.
      out = out
        .replace(/<img([^>]*?)\ssrc="[^"]*"/g, '<img$1 src=""')
        .replace(/background-image:[^;"]*;?/g, '');
    }
    return out;
  }, [html, dark, imagesOn]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => {
      const h = el.contentDocument?.documentElement.scrollHeight;
      if (h) setHeight(h);
    };
    el.addEventListener('load', measure);
    const timer = setInterval(measure, 500);
    return () => {
      el.removeEventListener('load', measure);
      clearInterval(timer);
    };
  }, []);

  const bytes = new Blob([html]).size;
  const chip = (active: boolean) => ({
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    background: active ? '#1f325c' : '#fff',
    color: active ? '#fff' : '#334155',
    font: '12px system-ui',
    cursor: 'pointer',
  });

  return (
    <div style={{ minHeight: '100vh', background: dark ? '#000' : '#fff' }}>
      <div
        data-lab-chrome
        dir="ltr"
        style={{
          padding: '10px 16px',
          background: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
          font: '12px system-ui',
          color: '#475569',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <strong dir="auto" style={{ color: '#0f172a', fontSize: 13, flexBasis: '100%' }}>
          {subject}
        </strong>
        {scenarios.map((name) => (
          <button key={name} type="button" onClick={() => setScenario(name)} style={chip(scenario === name)}>
            {name}
          </button>
        ))}
        <button type="button" onClick={() => setImagesOn((v) => !v)} style={chip(!imagesOn)}>
          images {imagesOn ? 'on' : 'off'}
        </button>
        {(version.toggles ?? []).map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setOff((v) => ({ ...v, [key]: !v[key] }))} style={chip(Boolean(off[key]))}>
            {label} {off[key] ? 'off' : 'on'}
          </button>
        ))}
        <span style={{ color: bytes > GMAIL_CLIP ? '#b91c1c' : '#64748b' }}>
          {(bytes / 1024).toFixed(1)} KB of the 102 KB Gmail limit
        </span>
      </div>
      <iframe
        ref={frame}
        title="email"
        srcDoc={doc}
        style={{ display: 'block', width: '100%', height, border: 0 }}
      />
    </div>
  );
}
