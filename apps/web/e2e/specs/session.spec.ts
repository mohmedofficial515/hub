/**
 * @file The session outlives its 15-minute access cookie (review B1). A page URL never sees the refresh cookie, so `hub_session` is what
 * middleware reads. Each test signs in for itself: a parallel refresh of a shared session counts as token reuse and revokes it.
 */
import { type Browser, type BrowserContext, type Page } from '@playwright/test';

import { expect, type Locale, test, view } from '../support/hub';
import { WEB_URL } from '../support/ports';
import { OWNER } from '../support/stack';

async function signedIn(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: WEB_URL, viewport: { width: 1440, height: 900 } });
  const response = await context.request.post('/api/v1/auth/sign-in', {
    data: { email: OWNER.email, password: OWNER.password },
    headers: { 'X-Requested-With': 'hub' },
  });
  expect(response.ok()).toBe(true);
  return context;
}

function watch(page: Page) {
  const seen = { refreshes: 0, signIns: 0 };
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/auth/refresh')) seen.refreshes += 1;
    if (request.isNavigationRequest() && /\/sign-in(\?|$)/.test(request.url())) seen.signIns += 1;
  });
  return seen;
}

const settled = (page: Page) => page.waitForTimeout(1500);
const heading = (page: Page) => page.getByRole('heading', { level: 1 }).first();
const onPage = (locale: Locale, ws: string, name: string) => new RegExp(`/${locale}/${ws}/${name}$`);
const has = async (context: BrowserContext, name: string) =>
  (await context.cookies()).some((cookie) => cookie.name === name);

test('with the access cookie gone, a reload stays on the page after exactly one refresh', async ({
  browser,
  locale,
  ws,
}) => {
  const context = await signedIn(browser);
  try {
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'hub_session')?.path).toBe('/');
    expect(cookies.find((c) => c.name === 'hub_refresh')?.path).toBe('/api/v1/auth/refresh');

    const page = await context.newPage();
    await page.goto(view(locale, ws, 'tasks'));
    await heading(page).waitFor();

    await context.clearCookies({ name: 'hub_access' });
    const seen = watch(page);
    await page.reload();
    await heading(page).waitFor();
    await settled(page);

    expect(page.url()).toMatch(onPage(locale, ws, 'tasks'));
    expect(seen.refreshes).toBe(1);
    expect(seen.signIns).toBe(0);
    expect(await has(context, 'hub_access')).toBe(true);
  } finally {
    await context.close();
  }
});

test('a session from before the marker works while it has an access cookie, and gets the marker', async ({
  browser,
  locale,
  ws,
}) => {
  const context = await signedIn(browser);
  try {
    await context.clearCookies({ name: 'hub_session' });
    const page = await context.newPage();
    await page.goto(view(locale, ws, 'tasks'));
    await heading(page).waitFor();
    expect(page.url()).toMatch(onPage(locale, ws, 'tasks'));

    // Its next refresh hands it the marker, so it never meets the case below.
    const refreshed = await context.request.post('/api/v1/auth/refresh', {
      headers: { 'X-Requested-With': 'hub' },
    });
    expect(refreshed.ok()).toBe(true);
    expect(await has(context, 'hub_session')).toBe(true);
  } finally {
    await context.close();
  }
});

test('a session from before the marker with only its refresh cookie signs in once, with no loop', async ({
  browser,
  locale,
  ws,
}) => {
  const context = await signedIn(browser);
  try {
    await context.clearCookies({ name: 'hub_session' });
    await context.clearCookies({ name: 'hub_access' });
    const page = await context.newPage();
    const seen = watch(page);
    await page.goto(view(locale, ws, 'tasks'));
    await page.locator('input[type="password"]').waitFor();
    await settled(page);
    expect(page.url()).toContain(`/${locale}/sign-in?next=`);
    expect(seen.signIns).toBe(1);

    await page.locator('input[autocomplete="username"]').fill(OWNER.email);
    await page.locator('input[type="password"]').fill(OWNER.password);
    await page.locator('input[type="password"]').press('Enter');
    await page.waitForURL(onPage(locale, ws, 'tasks'));
    await heading(page).waitFor();
    expect(await has(context, 'hub_session')).toBe(true);
  } finally {
    await context.close();
  }
});

test('a marker with a dead session goes to sign-in once and stays there', async ({ browser, locale, ws }) => {
  const context = await signedIn(browser);
  try {
    await context.clearCookies({ name: 'hub_access' });
    await context.clearCookies({ name: 'hub_refresh' });
    const page = await context.newPage();
    const seen = watch(page);
    await page.goto(view(locale, ws, 'tasks'));
    await page.locator('input[type="password"]').waitFor();
    await settled(page);
    expect(page.url()).toContain(`/${locale}/sign-in?next=`);
    expect(seen.signIns).toBe(1);
    expect(await has(context, 'hub_session')).toBe(false);
  } finally {
    await context.close();
  }
});
