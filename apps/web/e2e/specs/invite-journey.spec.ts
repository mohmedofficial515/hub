/**
 * @file The friend's invite journey as it happens on the owner's machine (docs/16 D43, D68, D69), in `ar` and `en`: Hub behind a stand-in
 * for `tailscale serve` (HTTPS on a `*.ts.net` name, `Host` the bind address, `x-forwarded-*` set), mail through an authenticated SMTP
 * login to a local test server. The owner invites and sees Copy, WhatsApp, Email, where the mail went and the Tailscale step; the friend
 * opens the link from the email, is held to 12 characters, joins with Secure cookies, lands in the project and signs in again; with TOTP
 * required another friend enrols and signs in through the code; the owner's own browser is told it is someone else; a new link stops the old
 * one; a revoked link says so; and Settings › System sends a test email. The API runs with the tailnet address only inside this file.
 */
import { type Browser, type BrowserContext, chromium, type Page } from '@playwright/test';

import { apiEnv, restartApi } from '../support/api-restart';
import { expect, type Locale, test, word, words } from '../support/hub';
import { WEB_PORT } from '../support/ports';
import { type CapturedMail, startTestSmtp, type TestSmtp } from '../support/smtp-server';
import { OWNER } from '../support/stack';
import { startTailnetProxy, type TailnetProxy } from '../support/tailnet-proxy';
import { nextStep, totpCode } from '../support/totp';

const NAME = 'hub-e2e.tail0000.ts.net';
const PORT = Number(process.env['E2E_PROXY_PORT'] ?? 7389);
const SMTP_LOGIN = { user: 'hub-e2e@gmail.test', pass: 'e2e app password' };
const FRIEND_PASSWORD = 'friend passphrase 2026';

let proxy: TailnetProxy;
let smtp: TestSmtp;
let tailnet: Browser;
let original: NodeJS.ProcessEnv | undefined;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  smtp = await startTestSmtp(SMTP_LOGIN);
  proxy = await startTailnetProxy(NAME, PORT, WEB_PORT);
  original = apiEnv();
  // What the owner's `.env` says once Hub is published and Gmail is set up, pointed at throwaway servers.
  await restartApi(0, {
    ...original,
    HUB_PUBLIC_URL: proxy.url,
    HUB_API_PUBLIC_URL: proxy.url,
    MAIL_PROVIDER: 'smtp',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtp.port),
    SMTP_SECURE: 'false',
    SMTP_USER: SMTP_LOGIN.user,
    SMTP_PASS: SMTP_LOGIN.pass,
    MAIL_FROM: `Hub <${SMTP_LOGIN.user}>`,
  });
  tailnet = await chromium.launch({ args: [proxy.resolverRule] });
});

test.afterAll(async () => {
  await tailnet?.close();
  if (original) await restartApi(0, original);
  await proxy?.close();
  await smtp?.close();
});

/** A device on the tailnet, with its own address there, as `tailscale serve` reports it. */
const device = (address: string): Promise<BrowserContext> =>
  tailnet.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'x-e2e-device': address },
  });

const net = (locale: Locale, n: number) => `100.64.${locale === 'ar' ? 1 : 2}.${n}`;
const atTailnet = (path: string) => new RegExp(`^${proxy.url.replaceAll('.', '\\.')}${path}`);
/** The friend reads the page in their own language: the link carries the project's. */
const inLocale = (link: string, locale: Locale) => link.replace(/\/(ar|en)\/invite\//, `/${locale}/invite/`);

async function signIn(page: Page, locale: Locale, email: string, password: string) {
  const auth = words(locale, 'auth');
  await page.goto(`${proxy.url}/${locale}/sign-in`);
  await page.getByLabel(word(auth, 'signIn.email')).fill(email);
  await page.getByLabel(word(auth, 'signIn.password'), { exact: true }).fill(password);
  await page.getByRole('button', { name: word(auth, 'signIn.submit') }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'));
}

async function mailTo(address: string): Promise<CapturedMail> {
  await expect
    .poll(() => smtp.mails.some((mail) => mail.to.includes(address)), { timeout: 15_000 })
    .toBe(true);
  return smtp.mails.filter((mail) => mail.to.includes(address)).at(-1) as CapturedMail;
}

/** A call from inside the page: Node's own requests cannot resolve the tailnet name, the browser can. */
async function api(page: Page, method: string, path: string, body?: unknown) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(`/api/v1/${path}`, {
        method,
        headers: { 'X-Requested-With': 'hub', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      return { status: response.status, body: (text ? JSON.parse(text) : null) as unknown };
    },
    { method, path, body },
  );
}

const linkIn = (mail: CapturedMail) => /https:\/\/\S+\/invite\/[\w-]+/.exec(mail.text)?.[0] ?? '';

/** Invites `email` from Members and answers the link the dialog shows once. */
async function invite(page: Page, locale: Locale, ws: string, email: string, role: string) {
  const members = words(locale, 'members');
  await page.goto(`${proxy.url}/${locale}/${ws}/members`);
  await page
    .getByRole('button', { name: word(members, 'invite') })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#invite-email').fill(email);
  await dialog.getByRole('checkbox', { name: word(words(locale, 'kit'), `roles.${role}`) }).check();
  await dialog.getByRole('button', { name: word(members, 'inviteDialog.send') }).click();
  await expect(
    dialog.getByRole('heading', { name: word(members, 'inviteDialog.createdTitle') }),
  ).toBeVisible();
  return (await dialog.locator('code').first().textContent())?.trim() ?? '';
}

test('the owner invites over the tailnet, the friend joins from the email and signs in again', async ({
  locale,
  ws,
}, info) => {
  const members = words(locale, 'members');
  const auth = words(locale, 'auth');
  const owner = await device(net(locale, 1));
  const page = await owner.newPage();
  await signIn(page, locale, OWNER.email, OWNER.password);
  await page.waitForURL(atTailnet(`/${locale}/`));
  for (const cookie of await owner.cookies()) {
    if (cookie.name.startsWith('hub_')) expect([cookie.name, cookie.secure]).toEqual([cookie.name, true]);
  }

  const email = `friend-${locale}-${Date.now()}@e2e.test`;
  const link = await invite(page, locale, ws, email, 'backend');
  expect(link.startsWith(`${proxy.url}/`)).toBe(true);
  const dialog = page.getByRole('dialog');
  // Where the email went: a server on this machine, which the page calls the local test inbox.
  await expect(dialog.locator('[data-mail="local"]')).toBeVisible();
  await expect(dialog.getByRole('button', { name: word(members, 'once.copy') })).toBeVisible();
  const whatsapp = decodeURIComponent(
    (await dialog
      .getByRole('link', { name: word(members, 'inviteLink.whatsapp'), exact: true })
      .getAttribute('href')) ?? '',
  );
  expect(whatsapp).toContain(link);
  expect(whatsapp).toContain('hub-e2e');
  const draft =
    (await dialog
      .getByRole('link', { name: word(members, 'inviteLink.email'), exact: true })
      .getAttribute('href')) ?? '';
  expect(draft.startsWith(`mailto:${email}?`)).toBe(true);
  await expect(dialog.getByRole('heading', { name: word(members, 'inviteLink.tailnetTitle') })).toBeVisible();
  await expect(dialog.getByText('hub-e2e', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: word(members, 'inviteLink.tailnetOpen') })).toHaveAttribute(
    'href',
    'https://login.tailscale.com/admin/machines',
  );
  await page.screenshot({ path: info.outputPath(`invite-created-${locale}.png`) });
  await dialog.getByRole('button', { name: word(members, 'once.done') }).click();

  // The email arrived through the SMTP login, with the link and how to reach Hub on the tailnet.
  const mail = await mailTo(email);
  expect(mail.user).toBe(SMTP_LOGIN.user);
  expect(linkIn(mail)).toBe(link);
  expect(mail.text).toContain('https://tailscale.com/download');
  expect(mail.text).toContain('hub-e2e');

  // The friend, on their own device, opens the link from the email.
  const friend = await device(net(locale, 2));
  const join = await friend.newPage();
  await join.goto(inLocale(linkIn(mail), locale));
  await join.getByLabel(word(auth, 'invite.name')).fill('Friend');
  await expect(join.getByText(word(auth, 'password.hint'))).toBeVisible();
  await join.getByLabel(word(auth, 'password.new'), { exact: true }).fill('elevenchars');
  await join.getByLabel(word(auth, 'password.confirm')).fill('elevenchars');
  await join.getByRole('button', { name: word(auth, 'invite.submit') }).click();
  await expect(join.getByText(word(auth, 'errors.passwordShort'))).toBeVisible();
  await join.getByLabel(word(auth, 'password.new'), { exact: true }).fill(FRIEND_PASSWORD);
  await join.getByLabel(word(auth, 'password.confirm')).fill(FRIEND_PASSWORD);
  await join.screenshot({ path: info.outputPath(`invite-join-${locale}.png`) });
  await join.getByRole('button', { name: word(auth, 'invite.submit') }).click();
  await join.waitForURL(`${proxy.url}/${locale}/${ws}/onboarding`);
  const cookies = (await friend.cookies())
    .filter((cookie) => cookie.name.startsWith('hub_'))
    .map((cookie) => [cookie.name, cookie.secure, cookie.domain])
    .sort();
  expect(cookies).toEqual([
    ['hub_access', true, NAME],
    ['hub_refresh', true, NAME],
    ['hub_session', true, NAME],
  ]);
  const me = (await api(join, 'GET', 'auth/me')).body as {
    data: { workspaces: { slug: string; roles: string[] }[] };
  };
  expect(me.data.workspaces.find((w) => w.slug === ws)?.roles).toEqual(['backend']);

  // Later: signed out, and in again through the sign-in page, still at the tailnet address.
  expect((await api(join, 'POST', 'auth/sign-out')).status).toBe(204);
  await signIn(join, locale, email, FRIEND_PASSWORD);
  await join.waitForURL(atTailnet(`/${locale}/${ws}/`));

  // The owner's list says Joined, below the team.
  await page.goto(`${proxy.url}/${locale}/${ws}/members`);
  const earlier = page.getByRole('region', { name: word(members, 'invites.earlierTitle') });
  await expect(earlier.locator('li', { hasText: email })).toHaveAttribute('data-status', 'accepted');
  await owner.close();
  await friend.close();
});

test('with TOTP required, the new member enrols at once and later signs in through the code', async ({
  locale,
  ws,
}) => {
  const auth = words(locale, 'auth');
  const owner = await device(net(locale, 3));
  const page = await owner.newPage();
  await signIn(page, locale, OWNER.email, OWNER.password);
  await page.waitForURL(atTailnet(`/${locale}/`));
  const totpRoles = async (roles: string[]) =>
    (await api(page, 'PUT', `workspaces/${ws}/settings/security.totp_required_roles`, { value: roles }))
      .status;
  expect(await totpRoles(['qa'])).toBe(200);
  try {
    const email = `careful-${locale}-${Date.now()}@e2e.test`;
    await invite(page, locale, ws, email, 'qa');
    const friend = await device(net(locale, 4));
    const join = await friend.newPage();
    await join.goto(inLocale(linkIn(await mailTo(email)), locale));
    await join.getByLabel(word(auth, 'invite.name')).fill('Careful');
    await join.getByLabel(word(auth, 'password.new'), { exact: true }).fill(FRIEND_PASSWORD);
    await join.getByLabel(word(auth, 'password.confirm')).fill(FRIEND_PASSWORD);
    await join.getByRole('button', { name: word(auth, 'invite.submit') }).click();

    // Every project route answers totp_setup_required until they enrol, so the page goes to the setup.
    await join.waitForURL(/\/totp\?setup=1/);
    await expect(join.getByRole('heading', { name: word(auth, 'totp.setupTitle') })).toBeVisible();
    const secret = ((await join.locator('code').first().textContent()) ?? '').trim();
    await join.getByLabel(word(auth, 'totp.codeLabel')).fill(totpCode(secret));
    await join.getByRole('button', { name: word(auth, 'totp.confirm') }).click();
    await join.getByRole('button', { name: word(auth, 'totp.saved') }).click();
    await join.waitForURL(atTailnet(`/${locale}/${ws}/`));

    expect((await api(join, 'POST', 'auth/sign-out')).status).toBe(204);
    // The API refuses a code twice, so the next sign-in waits for the next one.
    await nextStep();
    await signIn(join, locale, email, FRIEND_PASSWORD);
    await join.waitForURL(/\/totp/);
    await join.getByLabel(word(auth, 'totp.codeLabel')).fill(totpCode(secret));
    await join.getByRole('button', { name: word(auth, 'totp.submit') }).click();
    await join.waitForURL(atTailnet(`/${locale}/${ws}/`));
    await friend.close();
  } finally {
    await totpRoles([]);
    await owner.close();
  }
});

test('the owner’s own browser is told it is someone else; a new link stops the old; revoked says so; a test email', async ({
  locale,
  ws,
}, info) => {
  const members = words(locale, 'members');
  const auth = words(locale, 'auth');
  const settings = words(locale, 'settings');
  const owner = await device(net(locale, 5));
  const page = await owner.newPage();
  await signIn(page, locale, OWNER.email, OWNER.password);
  await page.waitForURL(atTailnet(`/${locale}/`));

  const email = `later-${locale}-${Date.now()}@e2e.test`;
  const first = await invite(page, locale, ws, email, 'designer');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: word(members, 'once.done') })
    .click();

  // The owner tries the link in their own browser: nothing is created, and the page says why.
  const mine = await owner.newPage();
  await mine.goto(inLocale(first, locale));
  await expect(mine.getByRole('heading', { name: word(auth, 'invite.otherTitle') })).toBeVisible();
  await expect(mine.getByText(email)).toBeVisible();
  await expect(mine.getByRole('button', { name: word(auth, 'invite.submit') })).toHaveCount(0);
  await mine.screenshot({ path: info.outputPath(`invite-other-account-${locale}.png`) });
  await mine.close();

  // A new link: the old one stops working at once.
  await page
    .locator('li[data-status="pending"]', { hasText: email })
    .getByRole('button', { name: word(members, 'invites.resendLabel').replace('{email}', email) })
    .click();
  const renewed = page.getByRole('dialog');
  await expect(renewed.getByRole('heading', { name: word(members, 'invites.resendTitle') })).toBeVisible();
  const second = ((await renewed.locator('code').first().textContent()) ?? '').trim();
  expect(second).not.toBe(first);
  await renewed.getByRole('button', { name: word(members, 'once.done') }).click();
  const stranger = await device(net(locale, 6));
  const look = await stranger.newPage();
  await look.goto(inLocale(first, locale));
  await expect(look.getByRole('heading', { name: word(auth, 'invite.invalid') })).toBeVisible();

  // Revoked: the link says so, and the list keeps the row as revoked.
  await page
    .locator('li[data-status="pending"]', { hasText: email })
    .getByRole('button', { name: `${word(members, 'invites.revoke')}: ${email}` })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: word(members, 'invites.revoke'), exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: word(members, 'invites.earlierTitle') })
      .locator('li', { hasText: email }),
  ).toHaveAttribute('data-status', 'revoked');
  await look.goto(inLocale(second, locale));
  await expect(look.getByRole('heading', { name: word(auth, 'invite.revoked') })).toBeVisible();
  await stranger.close();

  // Settings › System › Mail: where mail goes, and a test email to the owner's own address through the login.
  await page.goto(`${proxy.url}/${locale}/${ws}/settings?tab=system`);
  const section = page.locator('[data-mail-mode="local"]');
  await expect(section.getByText(word(settings, 'mail.mode.local'))).toBeVisible();
  const before = smtp.mails.length;
  await section.getByRole('button', { name: word(settings, 'mail.test') }).click();
  await expect(section.getByRole('status')).toBeVisible();
  await expect.poll(() => smtp.mails.length).toBe(before + 1);
  expect(smtp.mails.at(-1)).toMatchObject({ to: [OWNER.email], user: SMTP_LOGIN.user });
  await page.screenshot({ path: info.outputPath(`settings-mail-${locale}.png`), fullPage: true });
  await owner.close();
});
