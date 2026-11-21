async (page) => {
  const browser = page.context().browser();
  const base = 'http://localhost:6200/frame-hub.html#/today/v4-mandarin-bento';
  const out = {};
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const p = await ctx.newPage();
    await p.goto(`${base}?lang=en&theme=light`);
    await p.waitForSelector('[data-row]', { timeout: 20000 });
    await p.waitForTimeout(800);

    const active = () => p.evaluate(() => {
      const a = document.activeElement;
      return { tag: a?.tagName, id: a?.id, text: (a?.textContent || '').trim().slice(0, 40), focusVisible: a?.matches(':focus-visible') };
    });
    const numeral = () => p.evaluate(() => document.querySelector('#needs-title')?.textContent);
    const rows = () => p.evaluate(() => [...document.querySelectorAll('[data-row-title]')].map((r) => r.id));

    // ── j / k move through rows
    await p.keyboard.press('j');
    out.j1 = await active();
    await p.keyboard.press('j');
    out.j2 = await active();
    await p.keyboard.press('k');
    out.k1 = await active();

    // ── Enter and o open / close the focused row inline
    await p.keyboard.press('Enter');
    out.enterExpanded = await p.evaluate(() => document.activeElement?.getAttribute('aria-expanded'));
    out.panelVisible = await p.evaluate(() => !!document.getElementById('d-GTV-219'));
    await p.keyboard.press('o');
    out.oCollapsed = await p.evaluate(() => document.activeElement?.getAttribute('aria-expanded'));

    // ── the primary action, by keyboard, on the lead row → focus moves to the next row
    out.before = await numeral();
    await p.keyboard.press('Tab');
    out.tabToAction = await active();
    await p.keyboard.press('Enter');
    await p.waitForTimeout(450);
    out.afterAction = await active();
    out.numeralAfter = await numeral();
    out.toast = await p.evaluate(() => document.querySelector('[role=status][aria-live]')?.textContent?.trim());
    out.leadNow = await p.evaluate(() => document.querySelector('.tile-ink .tile-paper [data-row-title]')?.id);
    out.primaryCount = await p.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /bg-primary/.test(b.className)).length);

    // ── toast outlives 12 s while keyboard focus stays in the list
    await p.waitForTimeout(12500);
    out.toastAfter12s = await p.evaluate(() => !!document.querySelector('[role=status][aria-live] .tile-invert'));

    // ── u undoes, focus comes back to the restored row
    await p.keyboard.press('u');
    await p.waitForTimeout(450);
    out.afterUndo = await active();
    out.numeralAfterUndo = await numeral();
    out.toastGone = await p.evaluate(() => !document.querySelector('[role=status][aria-live] .tile-invert'));

    // ── resolve every row in the list: when empty, focus lands on the heading
    for (let i = 0; i < 7; i++) {
      await p.evaluate(() => {
        const b = document.querySelector('#needs-title')?.closest('section')?.querySelector('[data-row] button:not([data-row-title])');
        b?.focus();
      });
      await p.keyboard.press('Enter');
      await p.waitForTimeout(280);
    }
    out.emptyHeading = await active();
    out.needsTone = await p.evaluate(() => document.querySelector('#needs-title')?.closest('section')?.className.split(' ')[0]);
    await p.keyboard.press('u');
    await p.waitForTimeout(300);
    out.undoFromEmpty = await active();

    // ── claim with c, focus moves on; c on a blocked row answers in words
    await p.evaluate(() => document.getElementById('t-GTV-258')?.focus());
    await p.keyboard.press('c');
    await p.waitForTimeout(450);
    out.afterClaim = await active();
    out.claimToast = await p.evaluate(() => document.querySelector('[role=status][aria-live]')?.textContent?.trim());
    out.focusChip = await p.evaluate(() => [...document.querySelectorAll('#team-title')].length && [...document.querySelectorAll('table a')].some((a) => a.textContent.includes('GTV-258')));
    await p.keyboard.press('c'); // now on the blocked GTV-249
    await p.waitForTimeout(300);
    out.blockedToast = await p.evaluate(() => document.querySelector('[role=status][aria-live]')?.textContent?.trim());
    out.blockedStillThere = await p.evaluate(() => !!document.getElementById('t-GTV-249'));

    // ── refresh keeps layout and scroll
    await p.evaluate(() => window.scrollTo(0, 1600));
    await p.waitForTimeout(100);
    const b4 = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, y: scrollY, rows: document.querySelectorAll('[data-row]').length }));
    await p.keyboard.press('r');
    await p.waitForTimeout(250);
    const during = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, y: scrollY, rows: document.querySelectorAll('[data-row]').length, busy: document.querySelector('main')?.getAttribute('aria-busy') }));
    await p.waitForTimeout(1000);
    const after = await p.evaluate(() => ({ h: document.documentElement.scrollHeight, y: scrollY, busy: document.querySelector('main')?.getAttribute('aria-busy') }));
    out.refresh = { b4, during, after };
    await p.evaluate(() => window.scrollTo(0, 0));

    // ── the off switch: j stops, Ctrl+Z keeps working, the preference persists
    await p.keyboard.press('Shift+?');
    await p.waitForTimeout(200);
    out.helpOpen = await p.evaluate(() => !!document.querySelector('[role=switch]'));
    await p.click('[role=switch]');
    out.switchState = await p.evaluate(() => document.querySelector('[role=switch]')?.getAttribute('aria-checked'));
    await p.keyboard.press('Escape');
    await p.evaluate(() => document.getElementById('t-GTV-249')?.focus());
    await p.keyboard.press('j');
    out.jWhenOff = await active();
    out.keyStored = await p.evaluate(() => localStorage.getItem('hub.today.shortcuts'));
    await p.evaluate(() => localStorage.removeItem('hub.today.shortcuts'));

    // ── keys never fire inside a field
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const q = await ctx2.newPage();
      await q.goto(`${base}?lang=en&theme=light`);
      await q.waitForSelector('[data-row]', { timeout: 20000 });
      await q.evaluate(() => {
        const i = document.createElement('input');
        i.id = 'probe';
        document.body.append(i);
        i.focus();
      });
      await q.keyboard.type('jkru');
      out.inputValue = await q.evaluate(() => document.getElementById('probe').value);
      out.inputStillFocused = await q.evaluate(() => document.activeElement?.id);
      out.notBusy = await q.evaluate(() => document.querySelector('main')?.getAttribute('aria-busy'));
    } finally {
      await ctx2.close();
    }

    // ── toast timing without keyboard focus: gone after 10 s and not before
    const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const q = await ctx3.newPage();
      await q.goto(`${base}?lang=en&theme=light`);
      await q.waitForSelector('[data-row]', { timeout: 20000 });
      await q.waitForTimeout(500);
      await q.click('.tile-ink .tile-paper button:not([data-row-title])');
      await q.mouse.move(5, 5);
      await q.waitForTimeout(8500);
      out.mouseToastAt8_5s = await q.evaluate(() => !!document.querySelector('[role=status][aria-live] .tile-invert'));
      await q.waitForTimeout(3000);
      out.mouseToastAt11_5s = await q.evaluate(() => !!document.querySelector('[role=status][aria-live] .tile-invert'));
    } finally {
      await ctx3.close();
    }
  } catch (e) {
    out.error = String(e).slice(0, 400);
  } finally {
    await ctx.close();
  }
  return out;
}
