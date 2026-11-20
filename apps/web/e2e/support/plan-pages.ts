/**
 * @file Shared by the plan page's browser tests (v5-live-plan): a plan with three phases, and the version's shots (light and dark, 1440 and 390)
 * into `src/components/planning/shots/plan-page-v5/`, each checked for horizontal overflow.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Page } from '@playwright/test';

import { expect, type Rest } from './hub';

const SHOTS = resolve(__dirname, '../../src/components/planning/shots/plan-page-v5');

const phases = [
  { id: 'p0', title: 'Setup', note: 'The owner' },
  { id: 'p1', title: 'Build' },
  { id: 'p2', title: 'Ship' },
];

/** A plan with three phases and five steps, none done. */
export async function aPhasedPlan(owner: Rest, title: string) {
  return owner.create({
    type: 'plan',
    title,
    body: '## Why\n\nSo the journey has a page.',
    detail: {
      phases,
      steps: [
        { title: 'Decide the scope', role: 'owner', size: 'S', phaseId: 'p0' },
        { title: 'Write the contract', role: 'owner', phaseId: 'p0' },
        { title: 'Draw the screens', role: 'designer', phaseId: 'p1' },
        { title: 'Build the page', role: 'frontend', size: 'L', phaseId: 'p1' },
        { title: 'Ship it', role: 'frontend', phaseId: 'p2' },
      ],
    },
  });
}

/** Light and dark, at 1440 and 390, as the version's own shots. */
export async function shoot(page: Page, name: string, locale: string, prepare?: () => Promise<void>) {
  mkdirSync(SHOTS, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), theme === 'dark');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await prepare?.();
      // Colours ease over 120 ms.
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${name} ${width} ${theme} overflows`).toBeLessThanOrEqual(0);
      await page.screenshot({
        path: `${SHOTS}/${name}-${width}-${locale}-${theme}.png`,
        fullPage: width === 390,
      });
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => document.documentElement.classList.toggle('dark', false));
  await page.setViewportSize({ width: 1440, height: 900 });
}
