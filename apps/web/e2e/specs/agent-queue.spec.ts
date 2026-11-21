/**
 * @file The gate of docs/16 §12 step 5, on the real bridge and binary with a scripted model: a scheduled run survives a restart, and an approval pauses it. Also the browser check of the queue page in `ar` and `en`.
 * @description The API is stopped before the run's time and started after it, on the same database, so the run is a missed run when the machine is back. It must start by itself once the device reconnects, pause on `git push` for the owner, reach the inbox, hold its folder, and finish only after Allow. No model call is made; the run's words go to the scripted model.
 */
import { restartApi } from '../support/api-restart';
import { text, tool } from '../support/fake-model';
import { view, word, words } from '../support/hub';
import { expect, scriptedEngineAvailable, test } from '../support/scripted-engine';

test.skip(!scriptedEngineAvailable(), 'Needs the Claude Code extension on this machine');

const LONG = { timeout: 120_000, intervals: [500] };
const HEADERS = { 'X-Requested-With': 'hub' };

interface Run {
  id: string;
  state: string;
  chatId: string | null;
  waitingOn: { command: string } | null;
  runAt: string | null;
}

test.describe('the agent queue (docs/16 §9)', () => {
  test.setTimeout(300_000);

  test('a scheduled run survives a restart, an approval pauses it, and the page shows both', async ({
    engine,
    owner,
    page,
    locale,
    ws,
  }, info) => {
    const q = words(locale, 'queue');
    const base = `workspaces/${owner.ws}/queue`;
    const read = async (id: string) =>
      (await owner.get<{ runs: Run[] }>(base)).runs.find((run) => run.id === id)!;
    const limits = await owner.context.patch(`/api/v1/${base}/settings`, {
      data: { timezone: 'UTC', maxConcurrent: 1, perDay: 50, quietHours: null },
      headers: HEADERS,
    });
    expect(limits.ok()).toBe(true);
    await owner.post(`${base}/pause`, { paused: false });

    engine.script(
      text('Pushing the branch now. '),
      tool('Bash', { command: 'git push origin main', description: 'push' }),
      text('Pushed. '),
    );
    // Times are to the minute: the next minute at least 20 s away, in UTC.
    const due = new Date(Math.ceil((Date.now() + 20_000) / 60_000) * 60_000);
    const iso = due.toISOString();
    const run = await owner.post<Run>(`${base}/runs`, {
      source: 'prompt',
      prompt: 'Push the queue gate branch',
      device: engine.deviceId,
      folder: engine.folder,
      when: { kind: 'once', date: iso.slice(0, 10), time: iso.slice(11, 16) },
    });
    expect(run.state).toBe('scheduled');
    expect(run.runAt).toBe(iso);

    // The machine goes away before the time and is back after it.
    await restartApi(Math.max(0, due.getTime() - Date.now()) + 5_000);
    expect(Date.now()).toBeGreaterThan(due.getTime());

    // A missed run starts by itself once the device reconnects, and pauses on the push.
    await expect.poll(async () => (await read(run.id)).state, LONG).toBe('waiting');
    const waiting = await read(run.id);
    expect(waiting.waitingOn?.command).toBe('git push origin main');
    const inbox = await owner.get<{ data?: { i18nKey?: string } }[]>(`workspaces/${owner.ws}/inbox`);
    expect(JSON.stringify(inbox)).toContain('run_waiting');

    // The page, in this project's language.
    await page.goto(view(locale, ws, 'queue'));
    const section = page.locator('[data-queue-section="waiting"]');
    await expect(section).toContainText(word(q, 'sections.waiting'));
    await expect(section).toContainText('git push origin main');
    await expect(section.getByRole('button', { name: word(q, 'actions.answer') })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await page.screenshot({ path: info.outputPath(`queue-waiting-${locale}.png`), fullPage: true });

    // It holds its folder: a second run in the same folder waits, and says why.
    const second = await owner.post<Run & { hold: string | null }>(`${base}/runs`, {
      source: 'prompt',
      prompt: 'Lint the queue gate branch',
      device: engine.deviceId,
      folder: engine.folder,
      when: { kind: 'now' },
    });
    expect(['concurrency', 'folder_busy']).toContain(second.hold);
    await owner.post(`${base}/runs/${second.id}/cancel`);

    // Allow, and it finishes. Nothing about it completes a card by itself.
    const chat = await owner.get<{ messages: { approvals: { id: string; status: string }[] }[] }>(
      `workspaces/${owner.ws}/chats/${waiting.chatId}`,
    );
    const approval = chat.messages
      .flatMap((message) => message.approvals)
      .find((a) => a.status === 'pending')!;
    await owner.post(`workspaces/${owner.ws}/chats/${waiting.chatId}/approvals/${approval.id}`, {
      decision: 'allow',
    });
    await expect.poll(async () => (await read(run.id)).state, LONG).toBe('done');
    await page.reload();
    const recent = page.locator('[data-queue-section="recent"]');
    await expect(recent).toContainText(word(q, 'sections.recent'));
    await expect(recent.locator(`[data-queue-run="${run.id}"]`)).toBeVisible();
    await page.screenshot({ path: info.outputPath(`queue-recent-${locale}.png`), fullPage: true });
  });

  test('Schedule pressed on a task in a fresh browser runs it automatically, and the push waits in its summary (D58, review B1)', async ({
    engine,
    owner,
    page,
    locale,
    ws,
  }, info) => {
    const q = words(locale, 'queue');
    const base = `workspaces/${owner.ws}/queue`;
    const limits = await owner.context.patch(`/api/v1/${base}/settings`, {
      data: { timezone: 'UTC', maxConcurrent: 1, perDay: 50, quietHours: null },
      headers: HEADERS,
    });
    expect(limits.ok()).toBe(true);
    await owner.post(`${base}/pause`, { paused: false });
    const task = await owner.create({
      type: 'task',
      title: `Ship automatically ${locale} ${Date.now()}`,
      detail: { specialty: 'backend' },
    });
    engine.script(
      text('Fixing it now. '),
      tool('Bash', { command: 'git push origin main', description: 'Publish the fix' }),
      text('Done. The push waits for the owner. '),
    );

    // A fresh profile: no device or folder was ever picked by hand, so the panel's own fallbacks decide (B1).
    await page.goto(view(locale, ws, 'tasks', `card=${task.key}`));
    const schedule = page.locator('[data-card-sheet] [data-queue-schedule]');
    await expect(schedule).toBeEnabled({ timeout: 60_000 });
    await schedule.click();
    const dialog = page.locator('[data-queue-dialog]');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(word(q, 'dialog.when')).selectOption('now');
    await dialog.getByLabel(word(q, 'dialog.mode')).selectOption('automatic');
    await dialog.getByLabel(word(q, 'dialog.folder')).selectOption(engine.folder);
    await page.screenshot({ path: info.outputPath(`queue-dialog-automatic-${locale}.png`) });
    await page.locator('[data-queue-save]').click();

    const runOf = async () =>
      (
        await owner.get<{
          runs: (Run & {
            mode: string;
            cardKey: string | null;
            decisions: { kind: string; command: string }[];
          })[];
        }>(base)
      ).runs.find((each) => each.cardKey === task.key);
    await expect.poll(async () => (await runOf())?.state, LONG).toBe('done');
    const done = (await runOf())!;
    expect(done.mode).toBe('automatic');
    expect(done.decisions).toEqual([
      expect.objectContaining({ kind: 'skipped', command: 'git push origin main' }),
    ]);
    // Nothing waited on the owner.
    const inbox = await owner.get<unknown[]>(`workspaces/${owner.ws}/inbox`);
    expect(JSON.stringify(inbox)).not.toContain(done.chatId ?? 'none');

    await page.goto(view(locale, ws, 'queue'));
    const row = page.locator(`[data-queue-run="${done.id}"]`);
    await expect(row).toContainText(word(q, 'meta.automatic'));
    const decisions = row.locator('[data-run-decisions]');
    await expect(decisions).toContainText(word(q, 'decisions.title'));
    await expect(decisions.locator('[data-run-decision="skipped"]')).toContainText('git push origin main');
    await expect(decisions.getByRole('button', { name: word(q, 'decisions.runIt') })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await page.screenshot({ path: info.outputPath(`queue-automatic-${locale}.png`), fullPage: true });
  });
});
