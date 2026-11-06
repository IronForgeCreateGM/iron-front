// v7.8.5: Full Unlock country gate. Free: usa/rus/ger/fra. Locked: bra/irn/chn/jpn.
// Human picker gated; bots unrestricted. QA ?unlock=1 / ?unlock=0. Restore path. No fake App Store charge on web.
// NODE_PATH=/workspace/pwlib/node_modules node test/unlock-test.js [url]
const { chromium } = require('playwright-core'), path = require('path');
const BASE = process.argv[2] || ('file://' + path.resolve(__dirname, '../index.html'));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  async function page(url, init) {
    const ctx = await br.newContext({ viewport: { width: 1280, height: 800 } });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    if (init) await pg.addInitScript(init);
    await pg.goto(url); await pg.waitForTimeout(2200);
    return { ctx, pg, errs };
  }
  // --- locked by default ---
  {
    const { ctx, pg, errs } = await page(BASE + '?q=low&unlock=0');
    const st = await pg.evaluate(() => ({
      owned: typeof unlockOwned === 'function' && unlockOwned(),
      freeOk: typeof unlockFacOk === 'function' && unlockFacOk('usa', true) && unlockFacOk('fra', true) && unlockFacOk('rus', true) && unlockFacOk('ger', true),
      lockNo: typeof unlockFacOk === 'function' && !unlockFacOk('bra', true) && !unlockFacOk('chn', true) && !unlockFacOk('jpn', true) && !unlockFacOk('irn', true),
      botOk: typeof unlockFacOk === 'function' && unlockFacOk('bra', false) && unlockFacOk('chn', false),
      pool: typeof unlockFacPool === 'function' ? unlockFacPool(true).slice().sort().join(',') : '',
      freePool: typeof UNLOCK_FREE !== 'undefined' ? UNLOCK_FREE.slice().sort().join(',') : '',
      price: typeof UNLOCK_PRICE !== 'undefined' ? UNLOCK_PRICE : '',
      iap: !!(window.IronIAP && typeof IronIAP.purchase === 'function' && typeof IronIAP.restore === 'function' && typeof IronIAP.getStatus === 'function'),
    }));
    ok(!st.owned, 'default/QA clear: not owned ' + JSON.stringify(st.owned));
    ok(st.freeOk, 'free countries selectable for human');
    ok(st.lockNo, 'locked countries blocked for human until unlock');
    ok(st.botOk, 'bots unrestricted (locked countries ok for AI)');
    ok(st.pool === 'fra,ger,rus,usa', 'human free pool = usa/rus/ger/fra got ' + st.pool);
    ok(st.price === '$4.99', 'price $4.99 got ' + st.price);
    ok(st.iap, 'window.IronIAP bridge present');
    // clicking locked fcard opens offer, does not select
    const click = await pg.evaluate(() => {
      const before = MENU.fac;
      const card = document.querySelector('.fcard[data-f="bra"]');
      if (!card) return { err: 'no bra card' };
      card.click();
      const offer = document.getElementById('unlockOffer');
      return { before, after: MENU.fac, offer: !!(offer && offer.style.display === 'flex'), lockedCls: card.classList.contains('locked') };
    });
    ok(click.after === 'usa' || click.after === click.before, 'locked fcard does not change MENU.fac ' + JSON.stringify(click));
    ok(click.offer, 'locked fcard opens unlock offer');
    ok(click.lockedCls, 'bra card has locked class');
    // free fcard works
    const free = await pg.evaluate(() => { document.querySelector('.fcard[data-f="fra"]').click(); return MENU.fac; });
    ok(free === 'fra', 'free fcard selects France got ' + free);
    // buildSlots: human rand stays free; bot can be locked
    const slots = await pg.evaluate(() => {
      const out = [];
      for (let i = 0; i < 40; i++) {
        const s = buildSlots([['human', 'A', 'rand'], ['si', 'B', 'chn']], null, 'classic');
        out.push([s[0].fac, s[1].fac]);
      }
      return {
        humanFree: out.every(p => ['usa', 'rus', 'ger', 'fra'].includes(p[0])),
        botChn: out.every(p => p[1] === 'chn'),
        humanBraBlocked: (() => { const s = buildSlots([['human', 'A', 'bra'], ['si', 'B', 'rus']], null, 'classic'); return ['usa', 'rus', 'ger', 'fra'].includes(s[0].fac); })(),
      };
    });
    ok(slots.humanFree, 'human Random never picks locked without unlock');
    ok(slots.botChn, 'bot China kept');
    ok(slots.humanBraBlocked, 'human explicit bra clamped to free country in buildSlots');
    // web purchase does not fake-charge
    const buy = await pg.evaluate(async () => {
      const r = await IronIAP.purchase();
      return { r, owned: unlockOwned() };
    });
    ok(buy.r && buy.r.ok === false && buy.r.reason === 'appstore', 'web purchase returns appstore (no charge) ' + JSON.stringify(buy.r));
    ok(!buy.owned, 'web purchase left unlock unowned');
    ok(!errs.length, 'no page errors (locked) ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // --- QA unlock=1 ---
  {
    const { ctx, pg, errs } = await page(BASE + '?q=low&unlock=1');
    const st = await pg.evaluate(() => ({
      owned: unlockOwned(),
      braOk: unlockFacOk('bra', true),
      chnOk: unlockFacOk('chn', true),
      ls: localStorage.getItem('if_full_unlock'),
    }));
    ok(st.owned && st.braOk && st.chnOk, 'QA ?unlock=1 grants Full Unlock ' + JSON.stringify(st));
    ok(st.ls === '1', 'persisted if_full_unlock=1');
    const pick = await pg.evaluate(() => { document.querySelector('.fcard[data-f="jpn"]').click(); return MENU.fac; });
    ok(pick === 'jpn', 'unlocked: Japan selectable got ' + pick);
    const slots = await pg.evaluate(() => {
      const s = buildSlots([['human', 'A', 'bra'], ['si', 'B', 'irn']], null, 'classic');
      return [s[0].fac, s[1].fac];
    });
    ok(slots[0] === 'bra' && slots[1] === 'irn', 'unlocked: human Brazil + bot Iran kept ' + JSON.stringify(slots));
    // restore path (already owned)
    const rest = await pg.evaluate(async () => {
      const r = await IronIAP.restore();
      return { r, owned: unlockOwned() };
    });
    ok(rest.owned && rest.r && rest.r.owned, 'restore path keeps owned ' + JSON.stringify(rest));
    ok(!errs.length, 'no page errors (unlocked) ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  // --- QA unlock=0 clears ---
  {
    const { ctx, pg, errs } = await page(BASE + '?q=low&unlock=0');
    const st = await pg.evaluate(() => ({ owned: unlockOwned(), ls: localStorage.getItem('if_full_unlock'), bra: unlockFacOk('bra', true) }));
    ok(!st.owned && st.ls !== '1' && !st.bra, 'QA ?unlock=0 clears ' + JSON.stringify(st));
    // Settings restore button exists
    const has = await pg.evaluate(() => !!(document.getElementById('unlockRestoreSetBtn') && document.getElementById('unlockStatus')));
    ok(has, 'Settings has Restore + status line');
    ok(!errs.length, 'no page errors (clear) ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await br.close();
  console.log(fail ? 'UNLOCK FAIL ' + fail : 'UNLOCK OK');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
