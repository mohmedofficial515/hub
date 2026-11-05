/**
 * @file `MarkdownView` on imported text: it draws the app's elements, and nothing in the source can inject markup or run (review B2).
 */
import { describe, expect, it } from 'vitest';

import { renderWithApp } from '@/test/render';

import { MarkdownView } from './markdown';

describe('MarkdownView', () => {
  it('draws headings and lists, not their markers', () => {
    const { container } = renderWithApp(
      <MarkdownView source={'## الملخص\n\n- أول\n- ثانٍ\n\n---\n\nنص.'} dir="auto" headingOffset={2} />,
    );
    expect(container.querySelector('h4')?.textContent).toBe('الملخص');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('hr')).not.toBeNull();
    expect(container.textContent).not.toMatch(/##|---/);
    expect(container.firstElementChild?.getAttribute('dir')).toBe('auto');
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
});
