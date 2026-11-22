async (page) => {
  // 390 / 768 / 1440 x ar / en x light / dark: full-page capture of the first visit, then the same view after picking
  // the first recent search (the arc drawn). Reports horizontal overflow, console errors and elements wider than the
  // viewport. Runs in its own context with Vite's HMR socket muted (other sessions save into the lab meanwhile).
  const browser = page.context().browser();
  const out = 'F:/Goteav/hub/apps/lab/web/home/v2-departure-line/shots/';
  const report = [];
  for (const w of [390, 768, 1440]) {
    for (const lang of ['ar', 'en']) {
      for (const theme of ['light', 'dark']) {
        const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : w === 768 ? 1024 : 900 } });
        await ctx.routeWebSocket(/.*/, () => {});
        const p = await ctx.newPage();
        const errors = [];
        p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
        p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
        const name = `${w}-${lang === 'ar' ? 'rtl' : 'ltr'}-${theme}`;
        try {
          await p.goto(`http://127.0.0.1:7320/lab/frame-web.html#/home/v2-departure-line?lang=${lang}&theme=${theme}`);
          await p.waitForTimeout(1800);
          const metrics = await p.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            const wide = [...document.querySelectorAll('.gv-home *')]
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed';
              })
              .slice(0, 5)
              .map((el) => el.tagName + '.' + String(el.className).slice(0, 60));
            return { overflow: document.documentElement.scrollWidth > vw, wide };
          });
          await p.screenshot({ path: out + name + '.png', fullPage: true });
          await p.click('section[aria-labelledby="recent-title"] li button >> nth=0');
          await p.waitForTimeout(1500);
          await p.evaluate(() => window.scrollTo(0, 0));
          await p.waitForTimeout(200);
          await p.screenshot({ path: out + name + '-filled.png' });
          report.push({ name, ...metrics, errors });
        } catch (e) {
          report.push({ name, fail: String(e).slice(0, 200), errors });
        }
        await ctx.close();
      }
    }
  }
  return report;
}
