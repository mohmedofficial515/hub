/**
 * @file Slice 7 in a real browser (docs/16 §11, D64 to D66), in `ar` and `en`: Today ranks what to do next with its reasons and Run now starts the task on the real bridge and
 * binary with a scripted model; Ask Claude for more runs /hub:suggest in Ask and a proposal is accepted into a card; the Skills page creates, edits and moves skills, a clash taking
 * another name; and New project from the panel links its folder on the device in the same flow.
 * @description The stack points the team pack and the personal skills folder at temp copies and syncs the plugin only on Sync now (`support/stack.ts`), so nothing writes to the
 * repository or reads `~/.claude`. No real model is called.
 */
import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { text, tool } from '../support/fake-model';
import { view, word, words } from '../support/hub';
import { expect, scriptedEngineAvailable, test } from '../support/scripted-engine';
import { shared } from '../support/state';

const HEADERS = { 'X-Requested-With': 'hub' };
const LONG = { timeout: 90_000, intervals: [500, 1_000, 2_000] };

interface NextItem {
  key: string;
  reasons: string[];
  step?: { index: number };
}

test.describe('Slice 7: suggestions, skills and projects', () => {
  test.skip(!scriptedEngineAvailable(), 'Needs the Claude Code extension on this machine');

  test('Today ranks what to do next with its reasons, Run now starts it, and Ask Claude for more proposes a card', async ({
    engine,
    owner,
    page,
    locale,
    ws,
  }, info) => {
    const chat = words(locale, 'chat');
    const next = (path: string) => word(chat, `panel.next.${path}`);
    const base = `workspaces/${owner.ws}/queue`;
    const limits = await owner.context.patch(`/api/v1/${base}/settings`, {
      data: { timezone: 'UTC', maxConcurrent: 1, perDay: 50, quietHours: null },
      headers: HEADERS,
    });
    expect(limits.ok()).toBe(true);
    await owner.post(`${base}/pause`, { paused: false });

    // A small P0 task that blocks another, and an approved plan whose first step has no task yet.
    const stamp = Date.now();
    const task = await owner.create({
      type: 'task',
      title: `Small fix ${locale} ${stamp}`,
      priority: 'P0',
      detail: { specialty: 'backend', effort: 'S', prompt: 'Fix it' },
    });
    const waiting = await owner.create({
      type: 'task',
      title: `Waits ${locale} ${stamp}`,
      detail: { specialty: 'backend' },
    });
    await owner.post(`workspaces/${ws}/cards/${task.key}/links`, { kind: 'blocks', key: waiting.key });
    const plan = await owner.create({
      type: 'plan',
      title: `Plan ${locale} ${stamp}`,
      body: 'How',
      priority: 'P0',
      detail: { steps: [{ title: `First step ${locale} ${stamp}`, role: 'backend' }] },
    });
    await owner.post(`workspaces/${ws}/plans/${plan.key}/submit-review`);
    await owner.post(`workspaces/${ws}/plans/${plan.key}/approve`);
    const ranked = await owner.get<{ items: NextItem[] }>(`workspaces/${ws}/today/next?limit=5`);
    expect(ranked.items.map((item) => item.key)).toEqual(expect.arrayContaining([task.key, plan.key]));
    expect(ranked.items.find((item) => item.key === task.key)?.reasons).toEqual(['blocks', 'small', 'ready']);

    await page.goto(view(locale, ws, 'today'));
    const list = page.locator('[data-wb-next="page"]');
    await expect(list.getByRole('heading', { name: next('title') })).toBeVisible();
    const item = list.locator(`[data-wb-next-item="${task.key}"]`);
    await expect(item).toContainText(next('why.small'));
    const step = list.locator(`[data-wb-next-item="${plan.key}#0"]`);
    await expect(step.locator('[data-wb-next-step]')).toContainText(plan.key);
    await expect(step.locator('[data-queue-run-now]')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await page.screenshot({ path: info.outputPath(`today-do-next-${locale}.png`), fullPage: true });

    // Run now: one press, With my approval, on the panel's device and folder.
    engine.script(text('Fixed the small thing. '));
    const runNow = item.locator('[data-queue-run-now]');
    await expect(runNow).toBeEnabled({ timeout: 60_000 });
    await runNow.click();
    const runOf = async () =>
      (await owner.get<{ runs: { cardKey: string | null; state: string; mode: string }[] }>(base)).runs.find(
        (run) => run.cardKey === task.key,
      );
    await expect.poll(async () => (await runOf())?.state, LONG).toBe('done');
    expect((await runOf())?.mode).toBe('approval');

    // Ask Claude for more: /hub:suggest in Ask, its proposal waits for Accept, and Accept makes the card.
    const proposedTitle = `Proposed ${locale} ${stamp}`;
    engine.script(
      tool('mcp__hub__propose_suggestions', {
        summary: 'One gap.',
        items: [
          {
            kind: 'task',
            title: proposedTitle,
            why: `${task.key} is done, and nothing covers the follow-up`,
            effort: 'S',
          },
        ],
      }),
      text('The proposal is in the panel. '),
    );
    await list.locator('[data-wb-next-suggest]').click();
    const proposals = page.locator('[data-wb-proposals]');
    await expect(proposals).toBeVisible(LONG);
    await expect(proposals).toContainText(proposedTitle);
    // It ran in Ask: it reads and proposes, and creates nothing (D51, D66).
    await expect(page.locator('[data-wb-mode="ask"]')).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: info.outputPath(`suggest-proposals-${locale}.png`) });
    await proposals.locator('[data-wb-proposal-accept]').click();
    const done = proposals.locator('[data-wb-proposal-done]');
    await expect(done).toBeVisible();
    const key = /[A-Z]{2,6}-\d+/.exec((await done.textContent()) ?? '')?.[0] ?? '';
    expect((await owner.card<{ title: string; createdBy: { via: string } }>(key)).title).toBe(proposedTitle);

    // Leave the project as it was: a ready P0 task would take the filled button from later tests' pages.
    for (const card of [task.key, waiting.key, key]) {
      await owner.post(`workspaces/${ws}/tasks/${card}/cancel`, { reason: 'Slice 7 browser test' });
    }
    await owner.post(`workspaces/${ws}/plans/${plan.key}/abandon`, { reason: 'Slice 7 browser test' });
  });

  test('the Skills page creates and edits a Hub skill, and moves personal ones, a clash under another name', async ({
    page,
    locale,
    ws,
  }, info) => {
    const s = words(locale, 'skills');
    const t = (path: string) => word(s, path);
    const { labRoot } = shared();
    const teamPack = join(labRoot, '.team-pack', 'plugin', 'skills');
    const personal = join(labRoot, '.personal-skills');
    const original = readFileSync(join(personal, `notes-${locale}`, 'SKILL.md'), 'utf8');

    await page.goto(view(locale, ws, 'skills'));
    await expect(page.getByRole('heading', { name: t('title'), level: 1 })).toBeVisible();
    await expect(page.locator('[data-skill="work"]')).toContainText(t('hub.core'));
    await expect(page.locator('[data-skill="work"] [data-skill-edit]')).toHaveCount(0);
    await expect(page.locator('[data-skills-devices]')).toContainText(t('devices.manual'));

    // Move to Hub: asks first, copies, and leaves the original as it was.
    const notes = page.locator(`[data-personal-skill="notes-${locale}"]`);
    await notes.locator('[data-skill-move]').click();
    const move = page.getByRole('dialog');
    await expect(move).toContainText(t('move.both'));
    await expect(move.locator('[data-skill-move-name]')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`skills-move-${locale}.png`) });
    await move.locator('[data-skill-move-confirm]').click();
    await expect(page.locator(`[data-skill="notes-${locale}"]`)).toBeVisible();
    await expect(notes).toContainText(t('personal.inHub'));
    expect(readFileSync(join(teamPack, `notes-${locale}`, 'SKILL.md'), 'utf8')).toContain(
      `name: notes-${locale}`,
    );
    expect(existsSync(join(teamPack, `notes-${locale}`, 'references', 'format.md'))).toBe(true);
    expect(readFileSync(join(personal, `notes-${locale}`, 'SKILL.md'), 'utf8')).toBe(original);

    // A name Hub has: the dialog says so and takes another.
    await page.locator('[data-personal-skill="suggest"] [data-skill-move]').click();
    const clash = page.getByRole('dialog');
    await expect(clash.locator('[data-skill-move-clash]')).toBeVisible();
    await clash.locator('[data-skill-move-name]').fill(`my-suggest-${locale}`);
    await clash.locator('[data-skill-move-confirm]').click();
    await expect(page.locator(`[data-skill="my-suggest-${locale}"]`)).toBeVisible();
    expect(readFileSync(join(teamPack, 'suggest', 'SKILL.md'), 'utf8')).not.toContain('My own way');

    // A new skill, then an edit that keeps the earlier text.
    const name = `tidy-${locale}`;
    await page.locator('[data-skills-new]').click();
    const editor = page.getByRole('dialog');
    await editor.locator('[data-skill-name]').fill(name);
    await editor
      .locator('[data-skill-description]')
      .fill(locale === 'ar' ? 'رتّب المستودع قبل الدمج' : 'Tidy the repo before a merge');
    await editor.locator('[data-skill-body]').fill('Run the formatter, then the linter.');
    await editor.locator('[data-skill-save]').click();
    const row = page.locator(`[data-skill="${name}"]`);
    await expect(row).toBeVisible();
    expect(readFileSync(join(teamPack, name, 'SKILL.md'), 'utf8')).toContain(
      'Run the formatter, then the linter.',
    );
    await row.locator('[data-skill-edit]').click();
    const edit = page.getByRole('dialog');
    await edit.locator('[data-skill-body]').fill('Run the formatter only.');
    await edit.locator('[data-skill-save]').click();
    await expect(edit).toBeHidden();
    await row.locator('[data-skill-read]').click();
    const read = page.getByRole('dialog');
    await expect(read.locator('[data-skill-view]')).toContainText('Run the formatter only.');
    await expect(read.locator('[data-skill-revision]')).toHaveCount(1);
    await page.screenshot({ path: info.outputPath(`skills-read-${locale}.png`) });
    await read
      .getByRole('button', { name: t('view.close') })
      .first()
      .click();
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await page.screenshot({ path: info.outputPath(`skills-page-${locale}.png`), fullPage: true });
  });

  test('New project from the panel links its folder on the device in the same flow', async ({
    engine,
    owner,
    page,
    locale,
    ws,
  }, info) => {
    const w = words(locale, 'workspaces');
    const chat = words(locale, 'chat');
    void engine;
    const letters = Array.from({ length: 3 }, () =>
      String.fromCharCode(65 + Math.floor(Math.random() * 26)),
    ).join('');
    const slug = `side-${locale}-${letters.toLowerCase()}`;
    const folder = realpathSync.native(mkdtempSync(join(tmpdir(), 'hub-e2e-side-')));

    await page.goto(view(locale, ws, 'today'));
    await page.locator('[data-wb-chat-menu]').click();
    const row = page.locator('[data-wb-menu-item="new-project"]');
    await expect(row).toContainText(word(chat, 'panel.pro.menu.newProject'));
    await row.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(word(w, 'wizard.name')).fill(`Side ${letters}`);
    await dialog.getByLabel(word(w, 'wizard.slug')).fill(slug);
    await dialog.getByLabel(word(w, 'wizard.prefix')).fill(`S${letters}`);
    await dialog.getByRole('button', { name: word(w, 'wizard.next') }).click();
    await dialog.getByRole('button', { name: word(w, 'wizard.next') }).click();
    await expect(dialog).toContainText(word(w, 'wizard.stepThree'));
    await expect(dialog).toContainText(word(w, 'wizard.linkNote'));
    await dialog.locator('[data-wizard-folder]').fill(folder);
    await expect(dialog.locator('[data-wizard-link-preview]')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`new-project-link-${locale}.png`) });
    await dialog.locator('[data-wizard-create]').click();

    await expect(page).toHaveURL(new RegExp(`/${locale}/${slug}/today`), { timeout: 30_000 });
    const project = await owner.get<{ repoPaths: string[]; myRoles: string[] }>(`workspaces/${slug}`);
    expect(project.repoPaths).toEqual([folder]);
    expect(project.myRoles).toContain('owner');
    const linked = word(w, 'wizard.linked').replace('{project}', slug).replace('{folder}', folder);
    await expect(page.getByText(linked)).toBeVisible();
    await page.screenshot({ path: info.outputPath(`new-project-today-${locale}.png`) });
  });

  test('Sync devices now gives a connected device the plugin through the real binary, and its skills read as on it', async ({
    engine,
    page,
    locale,
    ws,
  }, info) => {
    const s = words(locale, 'skills');
    await page.goto(view(locale, ws, 'skills'));
    const device = page.locator(`[data-skills-device="${engine.deviceId}"]`);
    await expect(device).toHaveAttribute('data-skills-device-state', 'never');
    await page.locator('[data-skills-sync]').click();
    // The bridge writes the plugin as its marketplace and Claude Code installs that version, in the engine's isolated home.
    await expect(device).toHaveAttribute('data-skills-device-state', 'current', { timeout: 120_000 });
    await expect(device).toContainText(word(s, 'devices.current'));
    await expect(page.locator('[data-skill="suggest"] [data-skill-reach]')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`skills-synced-${locale}.png`) });
  });
});
