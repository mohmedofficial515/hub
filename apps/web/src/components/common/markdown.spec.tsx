/**
 * @file `MarkdownView` on imported text: it draws the app's elements, and nothing in the source can inject markup or run (review B2).
 */
import { QueryClient } from '@tanstack/react-query';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApp } from '@/test/render';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => window.location.pathname,
}));

import { createSlugger, headingsOf, MarkdownView, slugify } from './markdown';

describe('MarkdownView', () => {
  it('draws headings and lists, not their markers', () => {
    const { container } = renderWithApp(
      <MarkdownView source={'## الملخص\n\n- أول\n- ثانٍ\n\n---\n\nنص.'} dir="auto" headingOffset={2} />,
    );
    expect(container.querySelector('h4')?.textContent).toBe('الملخص');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('hr')).not.toBeNull();
    expect(container.textContent).not.toMatch(/##|---/);
    expect(container.firstElementChild?.getAttribute('dir')).toBe('rtl');
  });

  it('never creates an element from raw HTML', () => {
    const { container } = renderWithApp(
      <MarkdownView
        source={
          '<script>window.__pwned = 1</script>\n\n<img src=x onerror="window.__pwned = 1">\n\nText <b onclick="x()">bold</b> <iframe src="https://x.test"></iframe>.'
        }
      />,
    );
    expect(container.querySelector('script, img, iframe, b, [onerror], [onclick]')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('draws a Markdown image as its alt text', () => {
    const { container } = renderWithApp(<MarkdownView source={'![the shot](https://x.test/a.png)'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('the shot');
  });

  it('keeps a safe link, and turns a scripted one into its words', () => {
    const { container } = renderWithApp(
      <MarkdownView
        source={
          '[ok](https://x.test) [bad](javascript:alert(1)) [worse](data:text/html,x) [up](JAVASCRIPT:x)'
        }
      />,
    );
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://x.test']);
    expect(links[0]?.getAttribute('rel')).toBe('noreferrer');
    expect(container.textContent).toContain('bad');
    expect(container.textContent).toContain('worse');
  });

  it('does not ask a custom link renderer about a scripted link', () => {
    const asked: string[] = [];
    renderWithApp(
      <MarkdownView
        source={'[bad](javascript:alert(1)) [ok](/a)'}
        renderLink={(href) => {
          asked.push(href);
          return null;
        }}
      />,
    );
    expect(asked).toEqual(['/a']);
  });

  it('an Arabic body that opens with an English word stays right to left, with 5xx and 100 MB whole', () => {
    const { container } = renderWithApp(
      <MarkdownView
        dir="auto"
        source={'Sentry لا يرى أخطاء 5xx عندما يتجاوز الملف 100 MB.\n\n- Sentry يبلّغ عن 5xx'}
      />,
    );
    expect(container.firstElementChild?.getAttribute('dir')).toBe('rtl');
    expect(container.querySelector('p')?.getAttribute('dir')).toBeNull();
    expect([...container.querySelectorAll('bdi')].map((b) => [b.getAttribute('dir'), b.textContent])).toEqual(
      [
        ['ltr', '5xx'],
        ['ltr', '100 MB'],
        ['ltr', '5xx'],
      ],
    );
  });

  it('an English body stays left to right', () => {
    const { container } = renderWithApp(
      <MarkdownView dir="auto" source={'The 5xx rate is up, says «سنتري».'} />,
    );
    expect(container.firstElementChild?.getAttribute('dir')).toBe('ltr');
    expect(container.querySelector('bdi')).toBeNull();
  });

  it('an English paragraph in an Arabic body turns alone, and in a list keeps the bullet', () => {
    const { container } = renderWithApp(
      <MarkdownView
        dir="auto"
        source={
          'فقرة عربية طويلة بما يكفي لتكون الأغلبية في هذا المستند كله.\n\nIt ends with a full stop.\n\n- بند عربي طويل بعض الشيء\n- Ticket with a code'
        }
      />,
    );
    const [arabic, english] = [...container.querySelectorAll('p')];
    expect(arabic?.getAttribute('dir')).toBeNull();
    expect(english?.getAttribute('dir')).toBe('ltr');
    expect(container.querySelector('ul')?.getAttribute('dir')).toBeNull();
    expect(container.querySelector('li:last-child bdi')?.getAttribute('dir')).toBe('ltr');
  });
});

describe('anchors, as the API names them (knowledge-01)', () => {
  it('numbers a repeated heading, keeps `_` and Arabic marks, and the outline says the same', () => {
    const source =
      '## Notes\n\ntext\n\n## Notes\n\n## 3.1 `save_doc`\n\n## الدَّفعُ\n\n### [Link](https://x.test) here';
    const { container } = renderWithApp(<MarkdownView source={source} />);
    const ids = [...container.querySelectorAll('h3, h4')].map((h) => h.id);
    expect(ids).toEqual(['notes', 'notes-1', '31-save_doc', 'الدَّفعُ', 'linkhttpsxtest-here']);
    const outline = headingsOf(source);
    expect(outline.map((h) => h.anchor)).toEqual(ids);
    expect(outline.map((h) => h.text)).toEqual(['Notes', 'Notes', '3.1 save_doc', 'الدَّفعُ', 'Link here']);
  });

  it('matches the API slugger letter for letter', () => {
    const slug = createSlugger();
    expect(slug('  Hello  World ')).toBe('hello--world');
    expect(slug('Hello  World')).toBe('hello--world-1');
    expect(slugify('`save_doc`')).toBe('save_doc');
  });
});

describe('code blocks (knowledge-06)', () => {
  it('names the language, wraps on request, and keeps the copy button off the code', () => {
    const { container, getByRole } = renderWithApp(
      <MarkdownView source={'```bash\npnpm --filter @hub/web dev\n```'} />,
      { locale: 'ar' },
    );
    const frame = container.querySelector('pre')?.parentElement;
    expect(frame?.getAttribute('dir')).toBe('ltr');
    expect(frame?.textContent).toContain('bash');
    const wrap = getByRole('button', { name: 'لفّ الأسطر' });
    expect(wrap.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(wrap);
    expect(wrap.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('pre')?.className).toContain('whitespace-pre-wrap');
  });

  it('calls a Mermaid block a diagram', () => {
    const { container } = renderWithApp(<MarkdownView source={'```mermaid\ngraph TD\n```'} />);
    expect(container.textContent).toContain('Mermaid diagram');
  });

  it('starts an ordered list where the text does', () => {
    const { container } = renderWithApp(<MarkdownView source={'3. third\n4. fourth'} />);
    expect(container.querySelector('ol')?.getAttribute('start')).toBe('3');
    const { container: one } = renderWithApp(<MarkdownView source={'1. first'} />);
    expect(one.querySelector('ol')?.getAttribute('start')).toBeNull();
  });
});

describe('callouts and images (knowledge-07)', () => {
  it('draws GitHub’s warning as a titled note, without its marker', () => {
    const { container } = renderWithApp(<MarkdownView source={'> [!WARNING]\n> نص التحذير'} />, {
      locale: 'ar',
    });
    const note = container.querySelector('aside[role="note"]');
    expect(note?.textContent).toContain('تحذير');
    expect(note?.textContent).toContain('نص التحذير');
    expect(container.textContent).not.toContain('[!WARNING]');
    expect(container.querySelector('blockquote')).toBeNull();
  });

  it('keeps a plain quote a quote', () => {
    const { container } = renderWithApp(<MarkdownView source={'> just a quote'} />);
    expect(container.querySelector('blockquote')?.textContent).toBe('just a quote');
  });

  it('shows an image as a framed stand-in with a link out, never loading it', () => {
    const { container } = renderWithApp(<MarkdownView source={'![the shot](https://x.test/a.png)'} />);
    expect(container.querySelector('img')).toBeNull();
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://x.test/a.png');
    expect(link?.textContent).toBe('Open the image');
    const { container: local } = renderWithApp(<MarkdownView source={'![local](./a.png)'} />);
    expect(local.querySelector('a')).toBeNull();
  });
});

describe('card keys (knowledge-08)', () => {
  const me = {
    id: 'u1',
    email: 'a@x.test',
    displayName: 'A',
    workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles: ['owner'] }],
  };
  const withSession = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['me'], me);
    return client;
  };

  it('links this project’s keys, and leaves code, links and other prefixes alone', () => {
    window.history.replaceState(null, '', '/en/goteav/decisions');
    const { container } = renderWithApp(
      <MarkdownView source={'انظر GTV-12 قبل UTF-8 و `GTV-13` و [GTV-14](https://x.test) و XGTV-15.'} />,
      { locale: 'ar', client: withSession() },
    );
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.textContent)).toEqual(['GTV-12', 'GTV-14']);
    expect(links[0]?.getAttribute('href')).toContain('card=GTV-12');
    expect(links[0]?.closest('bdi')?.getAttribute('dir')).toBe('ltr');
    expect(container.querySelector('code')?.textContent).toBe('GTV-13');
  });

  it('shows keys as words before the session is known', () => {
    const { container } = renderWithApp(<MarkdownView source={'See GTV-12.'} />);
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('tables (knowledge-09)', () => {
  it('turns an English cell in an Arabic table alone, and labels the table without Markdown', () => {
    const { container } = renderWithApp(
      <MarkdownView
        dir="rtl"
        source={
          '| **الأداة** | الوصف |\n|---|---|\n| Sentry | Sentry captures 5xx errors. |\n| أداة | وصف عربي طويل |'
        }
      />,
    );
    const cells = [...container.querySelectorAll('td')];
    expect(cells[1]?.getAttribute('dir')).toBe('ltr');
    expect(cells[3]?.getAttribute('dir')).toBeNull();
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('الأداة, الوصف');
  });
});
