/**
 * @file The plan page's live layer (v5-live-plan, batch 2) on the real bridge and binary with a scripted model, on the throwaway stack. A queued run
 * on a plan step reports its stages through `report_stage` and pauses on a push: the page shows Claude's card on that step with its stages, the
 * halo on its phase, the chapter on that phase and the approval box, and Approve on the page answers the run's own approval, after which the run
 * finishes and the feed says so. Shots go to `src/components/planning/shots/plan-page-v5/`.
 */
import { text, tool } from '../support/fake-model';
import { view, word, words } from '../support/hub';
import { aPhasedPlan, shoot } from '../support/plan-pages';
import { expect, scriptedEngineAvailable, test } from '../support/scripted-engine';

const LONG = { timeout: 120_000, intervals: [500] };
const HEADERS = { 'X-Requested-With': 'hub' };

test.describe('the plan page, live with Claude', () => {
  test.skip(!scriptedEngineAvailable(), 'Needs the Claude Code extension on this machine');
  test.setTimeout(300_000);

  test('a run on a step shows its stages and halo, Approve answers its approval, and the feed says it finished', async ({
    engine,
    owner,
    page,
    locale,
    ws,
  }) => {
    const l = words(locale, 'planning');
    const base = `workspaces/${owner.ws}/queue`;
    const limits = await owner.context.patch(`/api/v1/${base}/settings`, {
      data: { timezone: 'UTC', maxConcurrent: 1, perDay: 50, quietHours: null },
      headers: HEADERS,
    });
    expect(limits.ok()).toBe(true);
    await owner.post(`${base}/pause`, { paused: false });
    const plan = await aPhasedPlan(owner, `Live ${locale} ${Date.now()}`);

    engine.script(
      tool('mcp__hub__report_stage', { protocol: 'work', stage: 'understand', state: 'started' }),
      tool('mcp__hub__report_stage', {
        protocol: 'work',
        stage: 'understand',
        state: 'done',
        note: 'Read the plan and step 3',
      }),
      tool('mcp__hub__report_stage', {
        protocol: 'work',
        stage: 'execute',
        state: 'started',
        note: 'Publishing the screens',
      }),
      tool('Bash', { command: 'git push origin main', description: 'Publish the screens' }),
      tool('mcp__hub__report_stage', { protocol: 'work', stage: 'execute', state: 'done' }),
      text('Done. '),
    );
    const run = await owner.post<{ id: string }>(`${base}/runs`, {
      source: 'plan_step',
      cardKey: plan.key,
      planStep: 2,
      device: engine.deviceId,
      folder: engine.folder,
      when: { kind: 'now' },
    });
    const read = async () =>
      (await owner.get<{ runs: { id: string; state: string }[] }>(base)).runs.find((r) => r.id === run.id)!;
    await expect.poll(async () => (await read()).state, LONG).toBe('waiting');

    await page.goto(view(locale, ws, 'planning', `plan=${plan.key}`));
    const claude = page.locator('[data-pj-claude="waiting"]');
    // The first page of a fresh production build can take a while on a loaded machine.
    await expect(claude).toBeVisible({ timeout: 60_000 });
    const stages = claude.getByRole('list', { name: word(l, 'detail.liveRun.stagesLabel') });
    await expect(stages).toContainText(
      `${word(l, 'detail.liveRun.stageNames.understand')}: ${word(l, 'detail.liveRun.stageState.done')}`,
    );
    await expect(stages).toContainText(
      `${word(l, 'detail.liveRun.stageNames.execute')}: ${word(l, 'detail.liveRun.stageState.started')}`,
    );
    const box = claude.locator('[data-pj-waiting="approval"]');
    await expect(box).toContainText('git push origin main');
    // The halo is on Build, the phase holding step 3, and the chapter followed it there.
    await expect(page.locator('[data-pj-halo]')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 3, name: 'Build', exact: true })).toBeVisible();
    await expect(page.locator('[data-pj-live-row]')).toHaveCount(1);
    await shoot(page, 'live-approval', locale);

    await box.getByRole('button', { name: word(l, 'detail.liveRun.approve') }).click();
    await expect.poll(async () => (await read()).state, LONG).toBe('done');
    await expect(page.locator('[data-pj-claude]')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('[data-pj-feed-kind="ended"]')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('[data-pj-feed-kind="approved"]')).toHaveCount(0);
    await shoot(page, 'live-after', locale);
  });
});
