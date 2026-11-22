async (page) => {
  // The data scenarios at 390 and 1440 (ar), the multi-city form, a keyboard tab walk and reduced motion.
  const browser = page.context().browser();
  const out = 'F:/Goteav/hub/apps/lab/web/home/v2-departure-line/shots/';
  const report = [];
  const open = async (w, hash, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, ...opts });
    await ctx.routeWebSocket(/.*/, () => {});
    const p = await ctx.newPage();
    const errors = [];
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    p.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    await p.goto(`http://127.0.0.1:7320/lab/frame-web.html#/home/v2-departure-line?${hash}`);
    await p.waitForTimeout(1600);
    return { ctx, p, errors };
  };
  for (const scenario of ['empty', 'loading', 'error', 'long']) {
    for (const w of [390, 1440]) {
      const { ctx, p, errors } = await open(w, `lang=ar&theme=light&scenario=${scenario}`);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      const text = await p.evaluate(() => ({
        recent: !!document.querySelector('section[aria-labelledby="recent-title"]'),
        busy: !!document.querySelector('[aria-busy="true"]'),
        phone: !!document.querySelector('a[href^="tel:"]'),
        form: !!document.getElementById('flight-search'),
        maintenance: !!document.getElementById('maintenance-title'),
      }));
      if (w === 390 || scenario !== 'long') await p.screenshot({ path: `${out}scenario-${scenario}-${w}.png` });
      if (scenario === 'long' && w === 1440) {
        await p.click('section[aria-labelledby="recent-title"] li button >> nth=6');
        await p.waitForTimeout(1600);
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.screenshot({ path: `${out}scenario-long-multicity-1440.png`, fullPage: false });
      }
      report.push({ scenario, w, overflow, ...text, errors });
      await ctx.close();
    }
  }
  // keyboard: the first stops of the tab order
  {
    const { ctx, p, errors } = await open(1440, 'lang=en&theme=light');
    const order = [];
    for (let i = 0; i < 16; i++) {
      await p.keyboard.press('Tab');
      order.push(await p.evaluate(() => {
        const a = document.activeElement;
        return (a?.id || a?.getAttribute('aria-label') || a?.textContent || '').trim().slice(0, 28);
      }));
    }
    const ring = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth);
    report.push({ tabOrder: order, lastOutline: ring, errors });
    await ctx.close();
  }
  // reduced motion: the arc is drawn at once
  {
    const { ctx, p, errors } = await open(1440, 'lang=en&theme=light', { reducedMotion: 'reduce' });
    await p.click('section[aria-labelledby="recent-title"] li button >> nth=0');
    await p.waitForTimeout(80);
    const len = await p.evaluate(() => {
      const path = document.querySelector('figure svg path[stroke="var(--highlight)"]');
      return path ? getComputedStyle(path).strokeDasharray : 'none';
    });
    report.push({ reducedMotionDash: len, errors });
    await ctx.close();
  }
  return report;
}
