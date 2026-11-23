async (page) => {
  // Every home-steps version at 390 / 1440 x ar / en x light / dark: scrolls the section into view, waits for its
  // entrance, captures the section, and reports overflow, shadows and console errors. Own context, HMR socket muted.
  const browser = page.context().browser();
  const versions = ['v2-boarding-pass', 'v3-flight-path', 'v4-departures-board', 'v5-live-preview'];
  const report = [];
  for (const v of versions) {
    const out = `F:/Goteav/hub/apps/lab/web/home-steps/${v}/shots/`;
    for (const w of [390, 1440]) {
      for (const lang of ['ar', 'en']) {
        for (const theme of ['light', 'dark']) {
          const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
          await ctx.routeWebSocket(/.*/, () => {});
          const p = await ctx.newPage();
          const errors = [];
          p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
          p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
          const name = `${w}-${lang === 'ar' ? 'rtl' : 'ltr'}-${theme}`;
          try {
            await p.goto(`http://127.0.0.1:7320/lab/frame-web.html#/home-steps/${v}?lang=${lang}&theme=${theme}`);
            await p.waitForSelector('section[aria-labelledby="steps-title"]', { timeout: 15000 });
            const sec = p.locator('section[aria-labelledby="steps-title"]');
            // scroll through the section so scroll-linked versions finish their route
            const box = await sec.boundingBox();
            for (let y = 0; y <= box.y + box.height; y += 120) {
              await p.evaluate((yy) => window.scrollTo(0, yy), y);
              await p.waitForTimeout(40);
            }
            await sec.scrollIntoViewIfNeeded();
            await p.waitForTimeout(2600);
            const metrics = await p.evaluate(() => {
              const vw = document.documentElement.clientWidth;
              const shadows = [...document.querySelectorAll('.gv-home *')].filter((el) => getComputedStyle(el).boxShadow !== 'none').length;
              return { overflow: document.documentElement.scrollWidth > vw, shadows };
            });
            await sec.screenshot({ path: out + name + '.png' });
            report.push({ v, name, ...metrics, errors });
          } catch (e) {
            report.push({ v, name, failed: String(e).slice(0, 200), errors });
          }
          await ctx.close();
        }
      }
    }
  }
  return report.filter((r) => r.failed || r.overflow || r.shadows || r.errors.length).concat([{ total: report.length }]);
}
