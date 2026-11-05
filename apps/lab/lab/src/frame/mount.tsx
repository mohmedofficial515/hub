import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { LocaleProvider } from '@lab/i18n';
import { findVersion, type App } from '../core/registry';
import { dirOf, readMode } from '../core/view';
import { TokensPreview } from './tokens-preview';

const cache = new Map<string, ComponentType>();

function resolve(app: App, page: string, version: string): ComponentType | null {
  if (page === '_tokens') return TokensPreview;
  const key = `${page}/${version}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const load = findVersion(app, page, version)?.load;
  if (!load) return null;
  const Lazy = lazy(load);
  cache.set(key, Lazy);
  return Lazy;
}

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <pre style={{ padding: 24, color: '#b91c1c', whiteSpace: 'pre-wrap', direction: 'ltr' }}>
        {this.state.error.stack ?? String(this.state.error)}
      </pre>
    );
  }
}

const message = (text: string) => (
  <div style={{ padding: 32, fontFamily: 'system-ui', color: '#64748b', direction: 'ltr' }}>{text}</div>
);

export function mount(app: App) {
  const root = createRoot(document.getElementById('root')!);

  const render = () => {
    const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const [page = '_tokens', version = 'preview'] = path.split('/').filter(Boolean);
    const mode = readMode(new URLSearchParams(query));

    const html = document.documentElement;
    html.lang = mode.lang;
    html.dir = dirOf(mode.lang);
    html.classList.toggle('dark', mode.theme === 'dark');
    html.style.colorScheme = mode.theme;

    const View = resolve(app, page, version);
    root.render(
      <LocaleProvider locale={mode.lang}>
        <Boundary key={`${page}/${version}`}>
          <Suspense fallback={message('Loading…')}>
            {View ? <View /> : message(`No page.tsx for ${app}/${page}/${version}`)}
          </Suspense>
        </Boundary>
      </LocaleProvider>,
    );
  };

  window.addEventListener('hashchange', render);
  render();
}
