async (page) => {
  const browser = page.context().browser();
  const base = 'http://localhost:6200/frame-hub.html#/today/v4-mandarin-bento';
  const results = {};

  const audit = () => {
    const parse = (c) => {
      const m = /rgba?\(([^)]+)\)/.exec(c);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const bgOf = (el) => {
      const stack = [];
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; }
      }
      let out = { r: 255, g: 255, b: 255, a: 1 };
      for (const c of stack.reverse()) out = over(c, out);
      return out;
    };
    const tileOf = (el) => {
      const t = el.closest('.tile-paper, .tile-ink, .tile-orange, .tile-green, .tile-invert');
      return t ? [...t.classList].find((k) => k.startsWith('tile-')) : 'page';
    };
    const walker = document.createTreeWalker(document.querySelector('.mandarin'), NodeFilter.SHOW_TEXT);
    const fails = [], near = [];
    let n = 0, min = 99, sizes = {};
    const perTile = {};
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.trim();
      if (!text) continue;
      const el = node.parentElement;
      const cs = getComputedStyle(el);
      if (el.closest('.sr-only') || cs.display === 'none' || cs.visibility === 'hidden') continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const fg = parse(cs.color);
      if (!fg) { fails.push({ text: text.slice(0, 30), color: cs.color, note: 'unparsed' }); continue; }
      const bg = bgOf(el);
      let opacity = 1;
      for (let a = el; a; a = a.parentElement) opacity *= Number(getComputedStyle(a).opacity);
      const ratio = cr(over({ ...fg, a: fg.a * opacity }, bg), bg);
      n += 1;
      const px = parseFloat(cs.fontSize);
      sizes[px] = (sizes[px] || 0) + 1;
      const tile = tileOf(el);
      perTile[tile] = Math.min(perTile[tile] ?? 99, ratio);
      if (el.closest('button[disabled]')) continue;
      min = Math.min(min, ratio);
      const rec = { text: text.slice(0, 28), ratio: +ratio.toFixed(2), px, tile, fg: cs.color };
      if (ratio < 4.5) fails.push(rec);
      else if (ratio < 4.8) near.push(rec);
    }
    return { n, min: +min.toFixed(2), fails, near, sizes, perTile: Object.fromEntries(Object.entries(perTile).map(([k, v]) => [k, +v.toFixed(2)])) };
  };

  for (const [lang, theme] of [['ar', 'light'], ['ar', 'dark'], ['en', 'light'], ['en', 'dark']]) {
    for (const scenario of ['default', 'frontend', 'empty', 'loading']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      try {
        const p = await ctx.newPage();
        const s = scenario === 'default' ? '' : `&scenario=${scenario}`;
        await p.goto(`${base}?lang=${lang}&theme=${theme}${s}`);
        await p.waitForSelector('.mandarin main', { timeout: 20000 });
        await p.waitForTimeout(800);
        results[`${lang}-${theme}-${scenario}`] = await p.evaluate(audit);
      } catch (e) {
        results[`${lang}-${theme}-${scenario}`] = { error: String(e).slice(0, 160) };
      } finally {
        await ctx.close();
      }
    }
  }
  return results;
}
