/**
 * @file The page matrix of apps/web/README.md § Tests: 390, 768, 1440 × light, dark, on every page in its language, measured: no horizontal overflow and
 * no AA failure on rendered text, once the page's content has arrived (never a fixed delay). Slow, so it runs on request: `E2E_MATRIX=1 pnpm test:e2e:web --grep matrix`.
 * `E2E_MATRIX_PAGES=redesign,releases` narrows it. Results go to `test-results/matrix.jsonl`.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test, view } from '../support/hub';

const OUT = resolve(__dirname, '../../test-results/matrix.jsonl');
const ALL = ['today', 'inbox', 'planning', 'timeline', 'tasks', 'decisions', 'needs', 'handoffs', 'redesign'];
const MORE = ['releases', 'docs', 'ask', 'onboarding', 'members', 'settings'];
const PAGES = process.env['E2E_MATRIX_PAGES']?.split(',') ?? [...ALL, ...MORE];
const SIZES = [390, 768, 1440];
const THEMES = ['light', 'dark'] as const;

/** Content has arrived: the title is there, no skeleton is left, and the network has been quiet. The stream does not count. */
async function contentArrived(page: Page) {
  await page.locator('h1').first().waitFor({ timeout: 60_000 });
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"], .animate-pulse, [data-skeleton]'),
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
  );
}

/** Overflow and AA contrast on rendered text, composited against the nearest opaque background. */
const audit = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    type Rgb = { r: number; g: number; b: number; a: number };
    const rgb = (colour: string): Rgb => {
      if (!canvas) return { r: 0, g: 0, b: 0, a: 1 };
      canvas.clearRect(0, 0, 1, 1);
      canvas.fillStyle = colour;
      canvas.fillRect(0, 0, 1, 1);
      const data = canvas.getImageData(0, 0, 1, 1).data;
      return { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0, a: (data[3] ?? 0) / 255 };
    };
    const lum = ({ r, g, b }: Rgb) => {
      const part = (value: number) => {
        const v = value / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * part(r) + 0.7152 * part(g) + 0.0722 * part(b);
    };
    const over = (top: Rgb, under: Rgb): Rgb => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    });
    const background = (element: Element) => {
      const stack: Rgb[] = [];
      for (let e: Element | null = element; e; e = e.parentElement) {
        const colour = rgb(getComputedStyle(e).backgroundColor);
        if (colour.a > 0) {
          stack.push(colour);
          if (colour.a === 1) break;
        }
      }
      let out: Rgb = { r: 255, g: 255, b: 255, a: 1 };
      const last = stack[stack.length - 1];
      if (last?.a === 1) out = stack.pop() ?? out;
      while (stack.length > 0) out = over(stack.pop() as Rgb, out);
      return out;
    };
    const fails: string[] = [];
    let nodes = 0;
    let lowest = 99;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      const element = text.parentElement;
      if (!text.textContent?.trim() || !element) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (element.closest('[hidden],[aria-hidden=true],.sr-only,option,script,style,[disabled]')) continue;
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const under = background(element);
      const fore = over(rgb(style.color), under);
      const [a, b] = [lum(fore), lum(under)];
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      nodes += 1;
      lowest = Math.min(lowest, ratio);
      const px = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      if (ratio < (px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5)) {
        fails.push(`${text.textContent.trim().slice(0, 40)} ${ratio.toFixed(2)}`);
      }
    }
    const doc = document.documentElement;
    return {
      overflow: doc.scrollWidth - doc.clientWidth,
      nodes,
      lowest: Number(lowest.toFixed(2)),
      fails: fails.slice(0, 6),
    };
  });

test.describe('page matrix', () => {
  test.skip(!process.env['E2E_MATRIX'], 'Set E2E_MATRIX=1 to run it.');

  for (const name of PAGES) {
    test(`matrix ${name}`, async ({ page, locale, ws }) => {
      test.setTimeout(240_000);
      mkdirSync(dirname(OUT), { recursive: true });
      const problems: string[] = [];
      for (const theme of THEMES) {
        await page.emulateMedia({ colorScheme: theme });
        for (const width of SIZES) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(view(locale, ws, name));
          await contentArrived(page);
          await page.evaluate((dark) => {
            document.documentElement.classList.toggle('dark', dark);
          }, theme === 'dark');
          const result = await audit(page);
          appendFileSync(OUT, `${JSON.stringify({ name, locale, theme, width, ...result })}\n`);
          if (result.overflow > 0 || result.fails.length > 0 || result.nodes === 0) {
            problems.push(`${width} ${theme}: ${JSON.stringify(result)}`);
          }
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
