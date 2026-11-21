async (page) => {
  const browser = page.context().browser();
  const base = 'http://localhost:6200/frame-hub.html#/today/v4-mandarin-bento';
  const out = { overflow: {}, clipped: {} };

  const open = async (ctx, q) => {
    const p = await ctx.newPage();
    await p.goto(`${base}?${q}`);
    await p.waitForSelector('.mandarin main', { timeout: 20000 });
    await p.waitForTimeout(900);
    await p.waitForSelector('.mandarin main', { timeout: 20000 });
    return p;
  };

  // overflow + anything sticking out of its tile or the viewport
  for (const w of [360, 390, 600, 768, 900, 1024, 1100, 1280, 1440, 1920]) {
    for (const lang of ['ar', 'en']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      try {
        const p = await open(ctx, `lang=${lang}&theme=light`);
        out.overflow[`${w}-${lang}`] = await p.evaluate(() => {
          const de = document.documentElement;
          const vw = de.clientWidth;
          const bad = [];
          document.querySelectorAll('.mandarin main *').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || el.closest('.sr-only')) return;
            if (r.right > vw + 1 || r.left < -1) bad.push(`${el.tagName}.${String(el.className).slice(0, 36)}`);
          });
          return { sw: de.scrollWidth, cw: vw, bad: bad.slice(0, 4), truncated: [...document.querySelectorAll('.truncate')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 40)) };
        });
      } finally { await ctx.close(); }
    }
  }

  // phone: targets under 44 px that have no hit-area slop
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      const p = await open(ctx, 'lang=ar&theme=light');
      out.targets = await p.evaluate(() => {
        const small = [];
        let n = 0;
        document.querySelectorAll('.mandarin a, .mandarin button, .mandarin [role=switch]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0) return;
          n += 1;
          const after = getComputedStyle(el, '::after');
          const slop = after.content !== 'none' && after.position === 'absolute';
          const h = slop ? Math.max(r.height, parseFloat(after.height) || 0) : r.height;
          if (h < 43.5) small.push({ text: el.textContent.trim().slice(0, 28), h: Math.round(h), inText: !!el.closest('p'), tag: el.tagName });
        });
        return { n, small };
      });
      out.firstAction = await p.evaluate(() => {
        const b = document.querySelector('.tile-ink .tile-paper button:not([data-row-title])').getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height), vh: innerHeight };
      });
    } finally { await ctx.close(); }
  }

  // reduced motion: nothing transforms, the alert pulse is off
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    try {
      const p = await open(ctx, 'lang=en&theme=light');
      out.reduced = await p.evaluate(() => {
        const dots = [...document.querySelectorAll('.mandarin span')].filter((s) => getComputedStyle(s).animationName !== 'none');
        return { animating: dots.length, names: dots.map((d) => getComputedStyle(d).animationName).slice(0, 3) };
      });
    } finally { await ctx.close(); }
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const p = await open(ctx, 'lang=en&theme=light');
      out.motionOn = await p.evaluate(() => {
        const a = [...document.querySelectorAll('.mandarin *')].filter((s) => getComputedStyle(s).animationName !== 'none');
        return a.map((d) => `${getComputedStyle(d).animationName} x${getComputedStyle(d).animationIterationCount}`);
      });
    } finally { await ctx.close(); }
  }

  // load CLS
  for (const [w, h, q] of [[1440, 900, 'lang=ar&theme=light'], [390, 844, 'lang=ar&theme=light']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    try {
      const p = await ctx.newPage();
      await p.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await p.goto(`${base}?${q}`);
      await p.waitForSelector('[data-row]', { timeout: 20000 });
      await p.waitForTimeout(2200);
      out[`cls-${w}`] = await p.evaluate(() => +window.__cls.toFixed(4));
    } finally { await ctx.close(); }
  }

  // numbers agree: numeral = rows = tally = strip sum
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const p = await open(ctx, 'lang=en&theme=light');
      const nums = () => p.evaluate(() => {
        const tile = document.querySelector('#needs-title').closest('section');
        return {
          numeral: Number(tile.querySelector('h2 bdi').textContent),
          rows: tile.querySelectorAll('[data-row]').length,
          marksFull: [...tile.querySelectorAll('header span[aria-hidden] > span')].filter((b) => /bg-/.test(b.className)).length,
          marksHollow: [...tile.querySelectorAll('header span[aria-hidden] > span')].filter((b) => /border/.test(b.className)).length,
          stripSum: [...tile.querySelectorAll('dl dd')].reduce((a, d) => a + Number(d.textContent), 0),
          cover: document.querySelector('header p:last-of-type')?.textContent,
        };
      });
      out.numbers0 = await nums();
      await p.click('.tile-ink .tile-paper button:not([data-row-title])');
      await p.waitForTimeout(500);
      out.numbers1 = await nums();
      // Ctrl+Z with one-key shortcuts off
      await p.keyboard.press('Shift+?');
      await p.waitForTimeout(150);
      await p.click('[role=switch]');
      await p.keyboard.press('Escape');
      await p.waitForTimeout(100);
      await p.keyboard.press('Control+z');
      await p.waitForTimeout(450);
      out.ctrlZWhenOff = await nums();
    } finally { await ctx.close(); }
  }

  // error → r retries
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const p = await open(ctx, 'lang=en&theme=light&scenario=error');
      out.errorBefore = await p.evaluate(() => ({ alert: !!document.querySelector('[role=alert]'), rows: document.querySelectorAll('[data-row]').length, cover: !!document.querySelector('header a') }));
      await p.keyboard.press('r');
      await p.waitForTimeout(400);
      out.errorAfterR = await p.evaluate(() => ({ alert: !!document.querySelector('[role=alert]'), rows: document.querySelectorAll('[data-row]').length }));
    } finally { await ctx.close(); }
  }
  return out;
}
