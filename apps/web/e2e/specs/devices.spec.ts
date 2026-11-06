/**
 * @file Settings › Devices in a real browser, with a real `hub-bridge` process in a temp home: the approval page, online state, health rows, Revoke cutting the live bridge, and Link saying what happened.
 * @description The bridge's `PATH` is empty and its home is a temp folder, so it cannot reach a real Claude Code, and nothing of the owner's is touched. Runs in `ar` and `en`.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { Page } from '@playwright/test';

import { expect, type Locale, test, view, word, words } from '../support/hub';
import { API_URL } from '../support/ports';

const BRIDGE = resolve(__dirname, '../../../../packages/bridge/bin/hub-bridge.mjs');

interface Started {
  deviceCode: string;
  userCode: string;
}

interface Claimed {
  deviceId: string;
  credential: string;
}

async function startPairing(name: string): Promise<Started> {
  const response = await fetch(`${API_URL}/api/v1/pairing/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, platform: 'win32' }),
  });
  return ((await response.json()) as { data: Started }).data;
}

async function poll(deviceCode: string): Promise<Claimed> {
  const response = await fetch(`${API_URL}/api/v1/pairing/poll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceCode }),
  });
  return ((await response.json()) as { data: Claimed }).data;
}

/** The whole browser step, on the page a device would open. */
async function approveInBrowser(page: Page, locale: Locale, name: string): Promise<Claimed> {
  const started = await startPairing(name);
  const auth = words(locale, 'auth');
  await page.goto(`/${locale}/connect?code=${started.userCode}`);
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByText(started.userCode).first()).toBeVisible();
  await page.getByRole('button', { name: word(auth, 'connect.approve') }).click();
  await expect(page.getByRole('heading', { name: word(auth, 'connect.approvedTitle') })).toBeVisible();
  const claimed = await poll(started.deviceCode);
  expect(claimed.credential).toMatch(/^hub_/);
  await expect(page.locator('body')).not.toContainText(claimed.credential);
  return claimed;
}

function aBridge(claimed: Claimed, config?: object): { home: string; child: ChildProcess } {
  const home = mkdtempSync(join(tmpdir(), 'hub-e2e-device-'));
  mkdirSync(join(home, '.hub'), { recursive: true });
  writeFileSync(
    join(home, '.hub', 'device.json'),
    JSON.stringify({ url: API_URL, deviceId: claimed.deviceId, credential: claimed.credential }),
  );
  const configDir = join(home, 'claude');
  mkdirSync(configDir);
  if (config) writeFileSync(join(configDir, '.claude.json'), JSON.stringify(config));
  const child = spawn(process.execPath, [BRIDGE, 'run'], {
    // Only what Node needs. An inherited APPDATA or Path would lead it to the owner's real Claude Code.
    env: {
      NODE_ENV: 'test',
      PATH: '',
      ...(process.env['SystemRoot'] ? { SystemRoot: process.env['SystemRoot'] } : {}),
      HOME: home,
      USERPROFILE: home,
      CLAUDE_CONFIG_DIR: configDir,
      HUB_BRIDGE_SKIP_LOGIN_START: '1',
    },
    stdio: 'ignore',
  });
  return { home, child };
}

test.describe('Settings › Devices', () => {
  const children: ChildProcess[] = [];
  const homes: string[] = [];

  test.afterEach(() => {
    for (const child of children.splice(0)) child.kill();
    for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
  });

  test('offers the one command, and needs no token to copy', async ({ page, locale, ws }) => {
    const settings = words(locale, 'settings');
    await page.goto(view(locale, ws, 'settings', 'tab=devices'));
    await expect(page.getByRole('heading', { name: word(settings, 'devices.connectTitle') })).toBeVisible();
    await expect(page.getByText('/api/v1/connect/bootstrap', { exact: false }).first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText('hub_');
  });

  test('approve in the browser, see it online with its checks, and Revoke cuts it', async ({
    page,
    locale,
    ws,
  }) => {
    const name = `PC-${locale}-${Date.now()}`;
    const claimed = await approveInBrowser(page, locale, name);
    const { home, child } = aBridge(claimed);
    children.push(child);
    homes.push(home);
    const exited = new Promise<number | null>((done) => child.once('exit', done));

    const settings = words(locale, 'settings');
    await page.goto(view(locale, ws, 'settings', 'tab=devices'));
    const card = page.locator(`[data-row="${claimed.deviceId}"]`);
    await expect(card.getByText(word(settings, 'devices.online'), { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    // An empty PATH and home: this machine honestly has no Claude Code, and the panel says so with the command that fixes it.
    await expect(card.getByText(word(settings, 'devices.checks.claude_found.bad'))).toBeVisible({
      timeout: 60_000,
    });
    await expect(card.getByText('npm install -g @anthropic-ai/claude-code@latest')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(claimed.credential);

    await card.getByRole('button', { name: new RegExp(word(settings, 'devices.revoke')) }).click();
    await page
      .getByRole('button', { name: word(settings, 'devices.revoke'), exact: true })
      .last()
      .click();
    await expect(card).toHaveCount(0);
    expect(await exited).toBe(0);
    const answer = await fetch(`${API_URL}/mcp`, {
      method: 'POST',
      headers: { authorization: `Bearer ${claimed.credential}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(answer.status).toBe(401);
  });

  test('fits a phone and a desktop, in both themes, with a real device on the page', async ({
    page,
    locale,
    ws,
    owner,
  }) => {
    const claimed = await approveInBrowser(page, locale, `SIZES-${locale}-${Date.now()}`);
    const { home, child } = aBridge(claimed);
    children.push(child);
    homes.push(home);
    const settings = words(locale, 'settings');
    await page.goto(view(locale, ws, 'settings', 'tab=devices'));
    const card = page.locator(`[data-row="${claimed.deviceId}"]`);
    await expect(card.getByText(word(settings, 'devices.checks.claude_found.bad'))).toBeVisible({
      timeout: 60_000,
    });
    for (const [width, height] of [
      [390, 844],
      [768, 1024],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
      if (process.env['E2E_SHOTS']) {
        await page.screenshot({
          path: join(process.env['E2E_SHOTS'], `devices-${locale}-${width}.png`),
          fullPage: true,
        });
      }
    }
    await owner.context.delete(`/api/v1/me/devices/${claimed.deviceId}`, {
      headers: { 'X-Requested-With': 'hub' },
    });
  });

  test('Refuse on the approval page gives the device nothing', async ({ page, locale }) => {
    const started = await startPairing(`STRANGER-${locale}`);
    const auth = words(locale, 'auth');
    await page.goto(`/${locale}/connect?code=${started.userCode}`);
    await page.getByRole('button', { name: word(auth, 'connect.deny') }).click();
    await expect(page.getByRole('heading', { name: word(auth, 'connect.deniedTitle') })).toBeVisible();
    expect(await poll(started.deviceCode)).toEqual({ status: 'denied' });
  });

  test('Link says when Hub could not change Claude Code, and leaves its config exactly as it was', async ({
    page,
    locale,
    ws,
    owner,
  }) => {
    const name = `LINK-${locale}-${Date.now()}`;
    const claimed = await approveInBrowser(page, locale, name);
    // `projects` as a list: not the shape expected, so D44 says change nothing.
    const { home, child } = aBridge(claimed, { projects: ['surprise'], keep: 1 });
    children.push(child);
    homes.push(home);
    const folder = join(home, 'repo');
    mkdirSync(folder);
    const configFile = join(home, 'claude', '.claude.json');
    const before = readFileSync(configFile, 'utf8');

    const settings = words(locale, 'settings');
    await page.goto(view(locale, ws, 'settings', 'tab=general'));
    await page.locator('#link-folder').fill(folder);
    await page.locator('#link-device').selectOption(claimed.deviceId);
    await page.getByRole('button', { name: word(settings, 'general.link.action') }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Claude Code' })).toContainText(
      word(settings, 'general.link.shapeUnexpected'),
    );
    expect(readFileSync(configFile, 'utf8')).toBe(before);

    const project = await owner.get<{ repoPaths: string[] }>(`workspaces/${ws}`);
    expect(project.repoPaths).toContain(folder);
    // This test's folder goes away with its temp home, so it must not stay registered.
    await owner.context.patch(`/api/v1/workspaces/${ws}`, {
      data: { repoPaths: project.repoPaths.filter((path) => path !== folder) },
      headers: { 'X-Requested-With': 'hub' },
    });
    await owner.context.delete(`/api/v1/me/devices/${claimed.deviceId}`, {
      headers: { 'X-Requested-With': 'hub' },
    });
  });
});
