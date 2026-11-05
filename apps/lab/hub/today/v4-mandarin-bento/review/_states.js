async (page) => {
  const browser = page.context().browser();
  const base = 'http://localhost:6200/frame-hub.html#/today/v4-mandarin-bento';
  const dir = 'F:/Goteav/redesign/hub/today/v4-mandarin-bento/review/';
  const out = {};
  const open = async (ctx, q) => {
    const p = await ctx.newPage();
    await p.goto(`${base}?${q}`);
    await p.waitForSelector('.mandarin main', { timeout: 20000 });
    await p.waitForTimeout(1000);
    await p.waitForSelector('.mandarin main', { timeout: 20000 });
    return p;
  };

  // 1. folds after the fixes
  for (const [w, h, q, name, mobile] of [
    [1440, 900, 'lang=ar&theme=light', '_v-1440-ar-light', false],
    [390, 844, 'lang=ar&theme=light', '_v-390-ar-light', true],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    try {
      const p = await open(ctx, q);
      await p.screenshot({ path: `${dir}${name}.png`, timeout: 60000 });
    } finally { await ctx.close(); }
  }

  // 2. focus + toast on the solid tiles
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    try {
      const p = await open(ctx, 'lang=en&theme=light');
      await p.keyboard.press('j');
      await p.keyboard.press('j');
      await p.keyboard.press('Enter');
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${dir}_v-focus-row-open.png`, timeout: 60000 });
      await p.evaluate(() => document.getElementById('t-GTV-262')?.focus());
      await p.keyboard.press('k');
      await p.waitForTimeout(200);
      await p.screenshot({ path: `${dir}_v-focus-orange.png`, timeout: 60000 });
      await p.evaluate(() => document.getElementById('t-GTV-258')?.focus());
      await p.keyboard.press('c');
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${dir}_v-toast.png`, timeout: 60000 });
      await p.evaluate(() => document.querySelector('td[tabindex="0"]')?.scrollIntoView({ block: 'center' }));
      await p.evaluate(() => document.querySelector('td[tabindex="0"]')?.focus());
      await p.keyboard.press('ArrowLeft');
      await p.waitForTimeout(200);
      await p.screenshot({ path: `${dir}_v-focus-heat.png`, timeout: 60000 });
    } finally { await ctx.close(); }
  }

  // 3. popover at the tablet edge, in both directions
  for (const [lang, w] of [['ar', 768], ['en', 768], ['ar', 1024]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 1 });
    try {
      const p = await open(ctx, `lang=${lang}&theme=dark`);
      await p.keyboard.press('Shift+?');
      await p.waitForTimeout(300);
      const box = await p.evaluate(() => {
        const r = document.querySelector('[role=switch]')?.closest('[data-radix-popper-content-wrapper] > *')?.getBoundingClientRect();
        return r ? { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), vw: innerWidth, vh: innerHeight } : null;
      });
      out[`popover-${lang}-${w}`] = box;
      if (w === 768) await p.screenshot({ path: `${dir}_v-popover-${lang}.png`, timeout: 60000 });
    } finally { await ctx.close(); }
  }

  // 4. scenarios
  for (const [q, name, w] of [
    ['lang=ar&theme=dark&scenario=frontend', '_v-frontend-ar-dark', 1440],
    ['lang=en&theme=light&scenario=empty', '_v-empty-en-light', 1440],
    ['lang=ar&theme=light&scenario=loading', '_v-loading-ar-light', 1440],
    ['lang=en&theme=dark&scenario=error', '_v-error-en-dark', 1440],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    try {
      const p = await open(ctx, q);
      await p.screenshot({ path: `${dir}${name}.png`, fullPage: true, timeout: 60000 });
      out[name] = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    } finally { await ctx.close(); }
  }
  return out;
}
