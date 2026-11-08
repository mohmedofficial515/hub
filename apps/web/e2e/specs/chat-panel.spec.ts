/**
 * @file The chat panel on real pages, against the real API, bridge and binary with a scripted model (docs/16 §7, §7.1, §7.2, D54), in `ar` and `en`.
 * @description `pnpm test:e2e:web --grep "chat panel"`. Needs the Claude Code extension on this machine, and the engine's tests skip without it. The layout's tests need no engine.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { audit } from '../support/audit';
import { hold, text, tool } from '../support/fake-model';
import { type Locale, view, word, words } from '../support/hub';
import { expect, scriptedEngineAvailable, test } from '../support/scripted-engine';

const LONG = { timeout: 60_000 };
const panelWords = (locale: Locale) => (words(locale, 'chat') as { panel: never }).panel;

const panel = (page: Page) => page.locator('[data-wb-panel]');
const sheet = (page: Page) => page.locator('[data-card-sheet]');

async function open(page: Page, locale: Locale, ws: string, name = 'today', query = '') {
  await page.goto(view(locale, ws, name, query));
  await expect(panel(page)).toBeVisible();
}

/** Types into the real composer and presses Enter. */
async function say(page: Page, words: string) {
  const input = page.locator('[data-wb-input]');
  await expect(input).toBeEnabled(LONG);
  await input.fill(words);
  await input.press('Enter');
}

const newTask = async (
  owner: { create: (b: Record<string, unknown>) => Promise<{ key: string }> },
  title: string,
) => owner.create({ type: 'task', title, detail: { specialty: 'backend' } });

test.describe('chat panel, on the engine', () => {
  test.skip(!scriptedEngineAvailable(), 'Needs the Claude Code extension on this machine');
  test.setTimeout(150_000);

  test('a message streams on a real page, and its turn line reports what the engine did', async ({
    page,
    engine,
    locale,
    ws,
  }) => {
    await open(page, locale, ws, 'tasks');
    engine.script(
      text('Reading the project now, then I will answer you in full. ', { chunks: 8, delayMs: 400 }),
    );
    await say(page, 'hello from the panel');

    await expect(panel(page).getByRole('log').getByText('hello from the panel')).toBeVisible(LONG);
    const reply = panel(page).locator('[data-wb-reply]').first();
    await expect(reply).toContainText('Reading', LONG);
    // Part of it was on screen before the whole of it arrived.
    const part = await reply.innerText();
    await expect(panel(page).locator('[data-wb-turn]')).toHaveAttribute('data-wb-turn', 'done', LONG);
    await expect(reply).toContainText('answer you in full');
    expect(part.length).toBeGreaterThan(0);

    await panel(page).locator('[data-wb-turn-line]').click();
    await expect(panel(page).locator('[data-wb-turn-detail]')).toBeVisible();
  });

  test('an approval pauses, is reachable by keyboard with a card open, and resumes', async ({
    page,
    engine,
    owner,
    locale,
    ws,
  }) => {
    const task = await newTask(owner, `Push ${locale} ${Date.now()}`);
    await open(page, locale, ws, 'tasks', `card=${task.key}`);
    await expect(sheet(page)).toBeVisible();
    engine.script(
      text('Pushing the branch. '),
      tool('Bash', { command: 'git push origin main', description: 'push' }),
      text('Pushed it. '),
    );
    await say(page, 'push it');

    const approval = panel(page).locator('[data-wb-approval="pending"]');
    await expect(approval).toBeVisible(LONG);
    await expect(approval.locator('code').first()).toHaveText('git push origin main');
    await expect(approval.locator('[data-wb-effect]')).toContainText(
      word(panelWords(locale), 'approval.effects.push'),
    );

    // The strip's pending button lands on the card and never on Allow, so Enter answers nothing.
    await page.locator('[data-wb-pending]').focus();
    await page.keyboard.press('Enter');
    await expect(approval).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(approval).toBeVisible();
    // Tab runs from the card to its answers with a card open: no trap in the sheet.
    const allow = approval.locator('[data-wb-allow]');
    for (let i = 0; i < 6 && !(await allow.evaluate((el) => el === document.activeElement)); i += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(allow).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(panel(page).locator('[data-wb-approval="allowed"]')).toBeVisible(LONG);
    await expect(panel(page).locator('[data-wb-turn]')).toHaveAttribute('data-wb-turn', 'done', LONG);
    await expect(panel(page).getByText('Pushed it.')).toBeVisible();
  });

  test('deny is told to Claude, and the command never runs', async ({ page, engine, locale, ws }) => {
    await open(page, locale, ws);
    engine.script(
      tool('Bash', { command: 'git push origin main', description: 'push' }),
      text('Did not push. '),
    );
    await say(page, 'push it');
    const approval = panel(page).locator('[data-wb-approval="pending"]');
    await expect(approval).toBeVisible(LONG);
    await page.waitForTimeout(450);
    await approval.locator('[data-wb-deny]').click();
    await expect(panel(page).locator('[data-wb-approval="denied"]')).toBeVisible(LONG);
    await expect(panel(page).locator('[data-wb-turn]')).toHaveAttribute('data-wb-turn', 'done', LONG);
  });

  test('a question shows its options, answers on a press, and the turn carries on', async ({
    page,
    engine,
    locale,
    ws,
  }) => {
    await open(page, locale, ws);
    engine.script(
      tool('AskUserQuestion', {
        questions: [
          {
            question: 'Which one?',
            header: 'Pick',
            multiSelect: false,
            options: [
              { label: 'First (Recommended)', description: 'The short way' },
              { label: 'Second', description: 'The long way' },
            ],
          },
        ],
      }),
      text('Going with it. '),
    );
    await say(page, 'ask me');

    const card = panel(page).locator('[data-wb-question][data-wb-waiting]');
    await expect(card).toBeVisible(LONG);
    await expect(card.getByText('The long way')).toBeVisible();
    await expect(card.locator('[data-wb-recommended]')).toContainText('First');
    await page.waitForTimeout(100);
    await card.locator('[data-wb-option="Second"]').click();

    await expect(panel(page).locator('[data-wb-question-status="answered"]')).toContainText('Second', LONG);
    await expect(panel(page).getByText('Going with it.')).toBeVisible(LONG);
  });

  test('a report shows verified apart from claimed, states the limit, and moves the task by itself', async ({
    page,
    engine,
    owner,
    locale,
    ws,
  }) => {
    const task = await newTask(owner, `Report ${locale} ${Date.now()}`);
    await owner.post(`workspaces/${ws}/tasks/${task.key}/claim`);
    await owner.post(`workspaces/${ws}/tasks/${task.key}/start`);
    await open(page, locale, ws, 'tasks', `card=${task.key}`);
    engine.script(
      tool('mcp__hub__report_stage', { protocol: 'work', stage: 'verify', state: 'started' }),
      tool('Bash', { command: 'echo checked', description: 'check' }),
      tool('mcp__hub__report_stage', { protocol: 'work', stage: 'verify', state: 'done' }),
      tool('mcp__hub__report_work', {
        card: task.key,
        summary: 'Did the work.',
        checks: [{ name: 'the check', command: 'echo checked', outcome: 'passed' }],
        notChecked: ['Nothing on a phone.'],
      }),
      text('Reported. '),
    );
    await say(page, `/hub:work ${task.key}`);

    const report = panel(page).locator('[data-wb-report]');
    await expect(report).toHaveAttribute('data-wb-report', 'moved', LONG);
    await expect(report.locator('[data-wb-moved]')).toBeVisible();
    await expect(report.locator('[data-wb-limit]')).toBeVisible();
    await expect(report.getByText('Nothing on a phone.')).toBeVisible();
    await report.locator('[data-wb-checks-toggle]').click();
    await expect(report.locator('[data-wb-check="verified"]')).toBeVisible();
    await expect(panel(page).locator('[data-wb-protocol]')).toBeVisible();
    await expect
      .poll(async () => (await owner.card<{ status: string }>(task.key)).status, LONG)
      .toBe('in_review');
    // The sheet stays open, and its evidence follows the report.
    await expect(sheet(page).locator('[data-wb-evidence]')).toBeVisible(LONG);
  });

  test('an approval, a claimed check and a turn line pass AA in light and dark, with no overflow', async ({
    page,
    engine,
    owner,
    locale,
    ws,
  }) => {
    const task = await newTask(owner, `Contrast ${locale} ${Date.now()}`);
    await owner.post(`workspaces/${ws}/tasks/${task.key}/claim`);
    await owner.post(`workspaces/${ws}/tasks/${task.key}/start`);
    await open(page, locale, ws, 'tasks', `card=${task.key}`);
    engine.script(
      tool('mcp__hub__report_work', {
        card: task.key,
        summary: 'Did the work.',
        checks: [{ name: 'never ran', command: 'echo never', outcome: 'passed' }],
        notChecked: ['Nothing on a phone.'],
      }),
      tool('Bash', { command: 'git push origin main', description: 'push' }),
      text('Pushed it and the words are long enough to show. '),
    );
    await say(page, `report ${task.key}`);
    await expect(panel(page).locator('[data-wb-approval="pending"]')).toBeVisible(LONG);
    await expect(panel(page).locator('[data-wb-check="claimed"]')).toBeVisible();
    for (const dark of [false, true]) {
      await page.evaluate((on) => document.documentElement.classList.toggle('dark', on), dark);
      // Colours ease over 120 ms, and a reading mid-way is of no theme.
      await page.waitForTimeout(400);
      const result = await audit(page);
      expect(result.fails).toEqual([]);
      expect(result.overflow).toBeLessThanOrEqual(0);
    }
    await page.waitForTimeout(450);
    await panel(page).locator('[data-wb-allow]').click();
    await expect(panel(page).locator('[data-wb-turn]')).toHaveAttribute('data-wb-turn', 'done', LONG);
    await panel(page).locator('[data-wb-turn-line]').click();
    for (const dark of [false, true]) {
      await page.evaluate((on) => document.documentElement.classList.toggle('dark', on), dark);
      // Colours ease over 120 ms, and a reading mid-way is of no theme.
      await page.waitForTimeout(400);
      expect((await audit(page)).fails).toEqual([]);
    }
  });

  test('a claimed check stays claimed, and the task stays where it is', async ({
    page,
    engine,
    owner,
    locale,
    ws,
  }) => {
    const task = await newTask(owner, `Claim ${locale} ${Date.now()}`);
    await owner.post(`workspaces/${ws}/tasks/${task.key}/claim`);
    await owner.post(`workspaces/${ws}/tasks/${task.key}/start`);
    await open(page, locale, ws);
    engine.script(
      tool('mcp__hub__report_work', {
        card: task.key,
        summary: 'Did the work.',
        checks: [{ name: 'never ran', command: 'echo never', outcome: 'passed' }],
        notChecked: [],
      }),
      text('Reported. '),
    );
    await say(page, `report ${task.key}`);
    await expect(panel(page).locator('[data-wb-check="claimed"]')).toBeVisible(LONG);
    await expect(panel(page).locator('[data-wb-stays]')).toBeVisible();
    expect((await owner.card<{ status: string }>(task.key)).status).toBe('in_progress');
  });

  test('a doc draft will not save with a flag open, then saves, then restores', async ({
    page,
    engine,
    owner,
    locale,
    ws,
  }) => {
    const folder = mkdtempSync(join(tmpdir(), 'hub-e2e-panel-docs-'));
    const file = `limits-${Date.now()}.md`;
    try {
      writeFileSync(join(folder, file), '# Limits\n\nThe limit is 30 a minute.\n');
      const name = `panel-docs-${locale}-${Date.now()}`;
      const source = await owner.post<{ id: string }>(`workspaces/${ws}/sources`, {
        kind: 'local_path',
        name,
        config: { path: folder, purpose: 'docs' },
      });
      await owner.post(`workspaces/${ws}/sources/${source.id}/run`);
      const docKey = await expect
        .poll(async () => {
          const found = await owner.get<{ key: string; title: string }[]>(
            `workspaces/${ws}/cards?type=doc&q=${encodeURIComponent('Limits')}&limit=20`,
          );
          return found.find((card) => card.title.includes('Limits'))?.key ?? '';
        }, LONG)
        .not.toBe('')
        .then(async () => {
          const found = await owner.get<{ key: string; title: string }[]>(
            `workspaces/${ws}/cards?type=doc&q=${encodeURIComponent('Limits')}&limit=20`,
          );
          return found.find((card) => card.title.includes('Limits'))?.key ?? '';
        });
      const doc = await owner.get<{ baseHash?: string; version?: string; hash?: string; content: string }>(
        `workspaces/${ws}/docs/${docKey}`,
      );
      const flag = 'The limit may rise to 60.';
      await open(page, locale, ws, 'docs', `doc=${docKey}`);
      const version = doc.hash ?? doc.version ?? doc.baseHash;
      engine.script(
        tool('mcp__hub__propose_doc', {
          doc: docKey,
          title: 'Limits',
          reason: 'A new limit',
          baseVersion: version,
          draft: `# Limits\n\nThe limit is 40 a minute.\n${flag}\n`,
          claims: [{ text: flag, status: 'unverified' }],
        }),
        async () => {
          const chats = await owner.get<{ id: string }[]>(`workspaces/${ws}/chats`);
          const latest = chats[0]?.id ?? '';
          for (let i = 0; i < 50; i += 1) {
            const chat = await owner.get<{ messages: { docDrafts: { id: string }[] }[] }>(
              `workspaces/${ws}/chats/${latest}`,
            );
            const draft = chat.messages.at(-1)?.docDrafts[0];
            if (draft) return tool('mcp__hub__save_doc', { draft: draft.id });
            await new Promise((done) => setTimeout(done, 200));
          }
          throw new Error('No draft');
        },
        text('Saved it. '),
      );
      await say(page, `/hub:doc improve ${docKey}`);

      const draft = panel(page).locator('[data-wb-draft="open"]');
      await expect(draft).toBeVisible(LONG);
      await expect(draft.locator('[data-wb-diff-line="add"]').first()).toBeVisible();
      const save = draft.locator('[data-wb-draft-save]');
      await expect(save).toHaveAttribute('data-wb-draft-flags', '1', LONG);
      await expect(save).toBeDisabled();
      expect(readFileSync(join(folder, file), 'utf8')).not.toContain(flag);

      await draft.locator('[data-wb-flag-keep]').click();
      await expect(draft.locator('[data-wb-diff-line="add"]', { hasText: '> Unverified:' })).toBeVisible();
      await expect(save).toBeEnabled();
      await save.click();

      await expect(panel(page).locator('[data-wb-saved]')).toBeVisible(LONG);
      await expect
        .poll(() => readFileSync(join(folder, file), 'utf8'), LONG)
        .toContain(`> Unverified: ${flag}`);

      await panel(page).locator('[data-wb-saved-restore]').click();
      await expect(panel(page).locator('[data-wb-restored]')).toBeVisible(LONG);
      await expect.poll(() => readFileSync(join(folder, file), 'utf8'), LONG).toContain('30 a minute');
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  test('Stop ends a running turn, and what finished stays', async ({ page, engine, locale, ws }) => {
    await open(page, locale, ws);
    engine.script(text('Working on it, and this will take a little while now. '), hold());
    await say(page, 'run for a while');
    await expect(panel(page).getByText('Working on it')).toBeVisible(LONG);
    await panel(page).locator('[data-wb-stop]').click();
    await expect(panel(page).locator('[data-wb-turn]')).toHaveAttribute('data-wb-turn', 'stopped', LONG);
    await expect(panel(page).getByText('Working on it')).toBeVisible();
    await expect(panel(page).locator('[data-wb-send]')).toBeVisible();
  });

  test('offline blocks the composer and says so, and it clears when the device returns', async ({
    page,
    engine,
    locale,
    ws,
  }) => {
    await open(page, locale, ws);
    await expect(page.locator('[data-wb-input]')).toBeEnabled(LONG);
    await engine.goOffline();
    try {
      await expect(panel(page).locator('[data-wb-engine="offline"]')).toBeVisible(LONG);
      await expect(page.locator('[data-wb-input]')).toBeDisabled();
    } finally {
      await engine.goOnline();
    }
    await expect(page.locator('[data-wb-input]')).toBeEnabled(LONG);
  });

  test('signed out says so, offers Check again, and clears through it', async ({
    page,
    engine,
    locale,
    ws,
  }) => {
    await open(page, locale, ws);
    await expect(page.locator('[data-wb-input]')).toBeEnabled(LONG);
    engine.signOut();
    try {
      await page.reload();
      await expect(panel(page).locator('[data-wb-engine="signed_out"]')).toBeVisible(LONG);
      await expect(page.locator('[data-wb-input]')).toBeDisabled();
    } finally {
      engine.signIn();
    }
    await panel(page).locator('[data-wb-engine-check]').click();
    await expect(page.locator('[data-wb-input]')).toBeEnabled(LONG);
  });

  test('the card’s Send to VS Code shows honest words and can copy the prompt', async ({
    page,
    owner,
    locale,
    ws,
    engine,
  }) => {
    void engine;
    const task = await newTask(owner, `VS ${locale} ${Date.now()}`);
    await open(page, locale, ws, 'tasks', `card=${task.key}`);
    await sheet(page).locator('[data-wb-vscode]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-wb-vscode-prompt]')).toContainText(task.key);
    await expect(dialog.getByText(word(panelWords(locale), 'vscode.lead'))).toBeVisible();
    await expect(dialog.locator('[data-wb-vscode-copy]')).toBeVisible();
  });
});

test.describe('chat panel, the layout', () => {
  test('resize, close and reopen survive a reload', async ({ page, locale, ws }) => {
    await open(page, locale, ws);
    const grip = page.locator('[data-wb-resizer]');
    await grip.focus();
    await page.keyboard.press(locale === 'ar' ? 'ArrowRight' : 'ArrowLeft');
    await page.keyboard.press(locale === 'ar' ? 'ArrowRight' : 'ArrowLeft');
    const wide = await panel(page).evaluate((el) => el.getBoundingClientRect().width);
    expect(wide).toBeGreaterThan(440);
    await page.reload();
    await expect(panel(page)).toBeVisible();
    expect(await panel(page).evaluate((el) => el.getBoundingClientRect().width)).toBe(wide);

    await panel(page).locator('[data-wb-close]').click();
    await expect(panel(page)).toBeHidden();
    await expect(page.locator('[data-wb-strip]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-wb-strip]')).toBeVisible();
    await expect(panel(page)).toBeHidden();

    await page.keyboard.press('Control+/');
    await expect(panel(page)).toBeVisible();
    expect(await panel(page).evaluate((el) => el.getBoundingClientRect().width)).toBe(wide);
  });

  test('sheet and panel never overlap, at any width', async ({ page, owner, locale, ws }) => {
    const task = await newTask(owner, `Beside ${locale} ${Date.now()}`);
    for (const width of [1100, 1280, 1366, 1440, 1700]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page, locale, ws, 'tasks', `card=${task.key}`);
      await expect(sheet(page)).toBeVisible();
      // The sheet slides in, so read the boxes once it has settled. A lasting overlap still fails here.
      await expect
        .poll(async () => {
          const a = await sheet(page).evaluate((el) => {
            const box = el.getBoundingClientRect();
            return [box.left, box.right] as const;
          });
          const b = await panel(page).evaluate((el) => {
            const box = el.getBoundingClientRect();
            return [box.left, box.right] as const;
          });
          return a[1] <= b[0] + 1 || b[1] <= a[0] + 1;
        })
        .toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  });

  test('D54: at 1440 the page stays beside them, at 1280 it steps aside with a way back', async ({
    page,
    owner,
    locale,
    ws,
  }) => {
    const task = await newTask(owner, `Fate ${locale} ${Date.now()}`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, locale, ws, 'inbox', `card=${task.key}`);
    await expect(sheet(page)).toBeVisible();
    await expect(page.locator('#main')).toBeVisible();
    await expect(sheet(page).locator('[data-wb-step-back]')).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('#main')).toBeHidden();
    const back = sheet(page).locator('[data-wb-step-back]');
    await expect(back).toBeVisible();
    await back.click();
    await expect(sheet(page)).toBeHidden();
    await expect(page.locator('#main')).toBeVisible();
  });

  test('with the panel closed the page stays beside the card', async ({ page, owner, locale, ws }) => {
    const task = await newTask(owner, `Closed ${locale} ${Date.now()}`);
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, locale, ws, 'tasks', `card=${task.key}`);
    await panel(page).locator('[data-wb-close]').click();
    await expect(panel(page)).toBeHidden();
    await expect(page.locator('#main')).toBeVisible();
    await expect(sheet(page)).toBeVisible();
  });

  test('the sheet is a plain region: no dialog role, focus on its title, Esc only from inside', async ({
    page,
    owner,
    locale,
    ws,
  }) => {
    const task = await newTask(owner, `Region ${locale} ${Date.now()}`);
    await open(page, locale, ws, 'tasks', `card=${task.key}`);
    await expect(sheet(page)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-sheet-title]')).toBeFocused();
    await panel(page).locator('[data-wb-new]').focus();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeVisible();
    await page.locator('[data-sheet-title]').focus();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
  });

  test('F6 moves between the regions, and the skip link reaches the panel', async ({ page, locale, ws }) => {
    await open(page, locale, ws);
    await page.keyboard.press('F6');
    await page.keyboard.press('F6');
    await page.keyboard.press('F6');
    await expect(page.locator(':focus')).toHaveCount(1);
    const inStrip = await page.evaluate(() => !!document.activeElement?.closest('[data-wb-strip]'));
    expect(inStrip).toBe(true);
    await page.locator('[data-wb-skip-panel]').focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest('[data-wb-panel]')))
      .toBe(true);
  });

  test('a phone starts on the page, and the panel is full screen', async ({ page, locale, ws }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(view(locale, ws, 'today'));
    await expect(page.locator('#main')).toBeVisible();
    await expect(panel(page)).toBeHidden();
    await page.locator('[data-wb-phone-toggle]').click();
    await expect(panel(page)).toBeVisible();
    const box = await panel(page).evaluate((el) => el.getBoundingClientRect().width);
    expect(box).toBeGreaterThanOrEqual(375);
  });

  test('the lab’s own page has no panel', async ({ page, locale, ws }) => {
    await page.goto(view(locale, ws, 'gallery'));
    await expect(page.locator('#main')).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('[data-wb-strip]')).toHaveCount(0);
  });

  test('Tooltips: full by default, compact from settings, never on a phone by itself', async ({
    page,
    locale,
    ws,
  }) => {
    await open(page, locale, ws);
    await page.locator('[data-wb-mode="plan"]').hover();
    const tip = page.locator('[data-wb-tipbox]');
    await expect(tip).toBeVisible();
    await expect(tip.locator('[data-wb-tiplevel="full"]')).toBeVisible();
    // Review 2026-11-08 B1: the mode tips once held only their shortcut.
    await expect(tip).toContainText(word(words(locale, 'chat'), 'tips.items.mode:plan.what'));
    await page.mouse.move(0, 0);
    await panel(page).locator('[data-wb-chat-menu]').click();
    await page.locator('[data-wb-menu-item="settings"]').click();
    await page
      .locator('[data-wb-settings] button', { hasText: word(panelWords(locale), 'pro.settings.tipCompact') })
      .click();
    await page.locator('[data-wb-settings-done]').click();
    await page.locator('[data-wb-mode="ask"]').hover();
    await expect(tip.locator('[data-wb-tiplevel="compact"]')).toBeVisible();
  });
});
