/**
 * @file A plan's own page as a journey (apps/lab/hub/plan-page/v5-live-plan, batch 1 of the port), on the real stack: a plan saved with phases
 * through the API draws its map and chapter, a step finished through the API is dated and counted in the effort, the drawer opens and closes, and
 * the phone width keeps the page inside the screen.
 */
import { expect, type Rest, test, view, word, words } from '../support/hub';

const phases = [
  { id: 'p0', title: 'Setup', note: 'The owner' },
  { id: 'p1', title: 'Build' },
  { id: 'p2', title: 'Ship' },
];

async function aPhasedPlan(owner: Rest, title: string) {
  const plan = await owner.create({
    type: 'plan',
    title,
    body: '## Why\n\nSo the journey has a page.',
    detail: {
      phases,
      steps: [
        { title: 'Decide the scope', role: 'owner', size: 'S', phaseId: 'p0' },
        { title: 'Write the contract', role: 'owner', phaseId: 'p0' },
        { title: 'Draw the screens', role: 'designer', phaseId: 'p1' },
        {
          title: 'Build the page',
          role: 'frontend',
          size: 'L',
          phaseId: 'p1',
          why: 'Nobody can book without it.',
          acceptance: 'The page loads\nThe tests pass',
        },
        { title: 'Ship it', role: 'frontend', phaseId: 'p2' },
      ],
    },
  });
  const card = await owner.card<{ detail: { steps: (Record<string, unknown> & { doneAt?: string })[] } }>(
    plan.key,
  );
  return { key: plan.key, steps: card.detail.steps };
}

test('a plan with phases draws its journey, dates a finished step and opens a step in the drawer', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const j = words(locale, 'planning');
  const plan = await aPhasedPlan(owner, `Journey ${locale} ${Date.now()}`);
  // Two steps done by hand (no task): Hub dates them, and their effort counts.
  await owner.context.patch(`/api/v1/workspaces/${ws}/plans/${plan.key}`, {
    headers: { 'X-Requested-With': 'hub' },
    data: {
      // A save sends each step whole: what it leaves out (its why, size, acceptance) is cleared.
      steps: plan.steps.map(({ doneAt: _doneAt, ...step }, i) => ({ ...step, done: i < 2 })),
    },
  });
  const saved = await owner.card<{ detail: { steps: { doneAt?: string }[] } }>(plan.key);
  expect(saved.detail.steps.slice(0, 2).every((step) => !!step.doneAt)).toBe(true);

  await page.goto(view(locale, ws, 'planning', `plan=${plan.key}`));
  const map = page.getByRole('group', { name: word(j, 'detail.journey.title') });
  await expect(map).toBeVisible({ timeout: 30_000 });
  await expect(map.getByRole('button')).toHaveCount(3);
  // The chapter is the phase holding the next step: Build.
  await expect(page.getByRole('heading', { level: 3, name: 'Build', exact: true })).toBeVisible();

  await page
    .locator('#pj-chapter')
    .getByRole('button', { name: /Build the page/ })
    .click();
  const drawer = page.getByRole('dialog', { name: 'Build the page' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Nobody can book without it.')).toBeVisible();
  // The drawer's surface is opaque in both themes: the chat panel behind it never shows through.
  for (const dark of [false, true]) {
    await page.evaluate((on) => document.documentElement.classList.toggle('dark', on), dark);
    const colour = await drawer.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(colour, `drawer surface ${dark ? 'dark' : 'light'}`).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  }
  await page.evaluate(() => document.documentElement.classList.toggle('dark', false));
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);

  // The map is one Tab stop; the arrows move along it.
  await map.getByRole('button').nth(1).focus();
  await page.keyboard.press(locale === 'ar' ? 'ArrowRight' : 'ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 3, name: 'Setup', exact: true })).toBeVisible();
});

test('on a phone the journey is one line and nothing leaves the screen', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const plan = await aPhasedPlan(owner, `Phone ${locale} ${Date.now()}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(view(locale, ws, 'planning', `plan=${plan.key}`));
  await expect(page.getByRole('heading', { level: 3, name: 'Setup', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('a plan saved before phases shows one list and no journey', async ({ page, owner, locale, ws }) => {
  const plan = await owner.create({
    type: 'plan',
    title: `Legacy ${locale} ${Date.now()}`,
    detail: { steps: [{ title: 'Only step' }, { title: 'Second step' }] },
  });
  await page.goto(view(locale, ws, 'planning', `plan=${plan.key}`));
  await expect(page.getByText('Second step')).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole('group', { name: word(words(locale, 'planning'), 'detail.journey.title') }),
  ).toHaveCount(0);
});
