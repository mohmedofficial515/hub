async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Other sessions edit the lab at the same time; mute Vite's HMR socket so their saves do not reload this frame.
  await ctx.routeWebSocket(/.*/, () => {});
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(String(e)));
  const shot = 'F:/Goteav/hub/apps/lab/web/home/v2-departure-line/shots/';
  const log = [];
  try {
    await p.goto('http://127.0.0.1:7320/lab/frame-web.html#/home/v2-departure-line?lang=ar&theme=light');
    await p.waitForTimeout(2000);
    await p.screenshot({ path: shot + '_empty.png' });
    await p.click('#from-0');
    await p.waitForTimeout(300);
    await p.keyboard.type('CAI');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    log.push('after from focus: ' + (await p.evaluate(() => document.activeElement?.id)));
    await p.keyboard.press('Enter');
    await p.waitForTimeout(300);
    await p.keyboard.type('dub');
    await p.waitForTimeout(200);
    await p.screenshot({ path: shot + '_picker.png' });
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    log.push('after to focus: ' + (await p.evaluate(() => document.activeElement?.id)));
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    log.push('cal focus: ' + (await p.evaluate(() => document.activeElement?.getAttribute('data-day'))));
    await p.keyboard.press('PageDown');
    await p.waitForTimeout(200);
    await p.screenshot({ path: shot + '_cal.png' });
    await p.click('[data-day="2026-12-16"]');
    await p.waitForTimeout(500);
    await p.screenshot({ path: shot + '_return.png' });
    await p.click('[data-day="2026-12-23"]');
    await p.waitForTimeout(500);
    log.push('after return focus: ' + (await p.evaluate(() => document.activeElement?.id)));
    await p.waitForTimeout(1200);
    await p.screenshot({ path: shot + '_filled.png' });
    await p.click('#party');
    await p.waitForTimeout(300);
    await p.click('button[aria-label="زيادة الأطفال"]');
    await p.waitForTimeout(200);
    await p.screenshot({ path: shot + '_party.png' });
    await p.keyboard.press('Escape');
    await p.click('button[type=submit]');
    await p.waitForTimeout(400);
    log.push('error: ' + (await p.evaluate(() => document.getElementById('flight-search-error')?.textContent)));
    log.push('focus: ' + (await p.evaluate(() => document.activeElement?.id)));
    await p.click('#party');
    await p.waitForTimeout(300);
    await p.selectOption('select', '7');
    await p.keyboard.press('Escape');
    await p.click('button[type=submit]');
    await p.waitForTimeout(300);
    log.push('href: ' + (await p.evaluate(() => document.getElementById('flight-search')?.getAttribute('data-href'))));
    await p.screenshot({ path: shot + '_submitted.png' });
  } catch (e) {
    log.push('FAIL ' + String(e).slice(0, 300));
  }
  await ctx.close();
  return { errors, log };
}
