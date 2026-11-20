/**
 * @file The plan's form edits phases (v5-live-plan, batch 1 follow-up) on the throwaway stack: rename, add, and remove one that a step uses by moving
 * that step in the same save. Shots go to `src/components/planning/shots/plan-page-v5/`.
 */
import { expect, test, view, word, words } from '../support/hub';
import { aPhasedPlan, shoot } from '../support/plan-pages';

test('the plan’s form edits phases: rename, add, and remove one in use by moving its steps', async ({
  page,
  owner,
  locale,
  ws,
}) => {
  const l = words(locale, 'planning');
  const plan = await aPhasedPlan(owner, `Phases ${locale} ${Date.now()}`);
  await page.goto(view(locale, ws, 'planning', `plan=${plan.key}&action=edit`));
  const first = page.getByRole('textbox', {
    name: word(l, 'plan.phaseTitle').replace('{n}', '0'),
    exact: true,
  });
  await expect(first).toBeVisible({ timeout: 30_000 });
  await first.fill('Start');
  await page.getByRole('button', { name: word(l, 'plan.addPhase') }).click();
  await shoot(page, 'phases-form', locale, async () => {
    await page.locator('[data-phase-row]').first().scrollIntoViewIfNeeded();
  });

  // Ship (phase 2) holds step 5: removing it asks where that step goes.
  await page.locator('[data-phase-row]').nth(2).getByRole('button').last().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox').selectOption('p1');
  await shoot(page, 'phases-remove', locale);
  await dialog.getByRole('button', { name: word(l, 'plan.removePhaseConfirm') }).click();
  await expect(dialog).toHaveCount(0);
  // The new phase, still untitled, gets a title before the save.
  await page.locator('[data-phase-row]').last().getByRole('textbox').first().fill('Polish');
  await page.getByRole('button', { name: word(l, 'edit.save'), exact: true }).click();

  await expect
    .poll(async () =>
      (await owner.card<{ detail: { phases: { title: string }[] } }>(plan.key)).detail.phases.map(
        (p) => p.title,
      ),
    )
    .toEqual(['Start', 'Build', 'Polish']);
  const saved = await owner.card<{ detail: { steps: { phaseId?: string }[] } }>(plan.key);
  expect(saved.detail.steps.map((s) => s.phaseId)).toEqual(['p0', 'p0', 'p1', 'p1', 'p1']);
});
