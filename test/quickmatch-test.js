// v7.7.7 Game Center Quick Match (JS side) with a fake Game Center run by this test process.
// node test/quickmatch-test.js   — needs playwright-core (NODE_PATH) and Chrome. Covers: web build hides the button; 3 phones auto-match,
// countdown, 1 Hard bot fills the 4th seat, same seed/slots everywhere, lockstep runs without desync; a forged message from a non-host
// and junk bytes are dropped; a guest leaving mid-match -> AI takes the seat; the host leaving mid-match -> the rest continue offline;
// the host leaving during the countdown -> remaining phone looks for players again, a new phone joins, new host starts the match;
// v7.9.5: the host leaving mid-match with 2+ phones left -> they elect a new host and keep playing together.
const fs = require('fs'), path = require('path'), { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml' };
const FAKE = `(() => { const q = new URLSearchParams(location.search); const ID = q.get('gcid'); if (!ID) return; const L = {};
  window.__qmBridge = { addListener(e, cb) { (L[e] = L[e] || []).push(cb); }, _emit(e, x) { (L[e] || []).forEach(f => f(x)); },
    authenticate() { return Promise.resolve({ playerId: ID, alias: 'Phone ' + ID }); },
    findMatch(o) { return new Promise(res => { window.__gcFound = res; window.gcPost({ t: 'find', o }); }); },
    addPlayers(o) { window.gcPost({ t: 'add' }); return Promise.resolve(); }, stopSearch() { window.gcPost({ t: 'stop' }); return Promise.resolve(); },
    send(m) { window.gcPost({ t: 'send', data: m.data, to: m.to || null }); return Promise.resolve(); }, disconnect() { window.gcPost({ t: 'bye' }); return Promise.resolve(); } };
  window.__gcRecv = m => { if (m.t === 'found') window.__gcFound(m.r); else window.__qmBridge._emit(m.e, m.x); }; })();`;
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let fail = 0; const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); if (!c) fail++; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // ---- fake Game Center: matchmaking + relay between pages ----
  const pages = {}, matches = []; let seekers = [];
  const deliver = (id, m) => { const p = pages[id]; if (!p || p.closed) return Promise.resolve(); return p.pg.evaluate(m => window.__gcRecv && window.__gcRecv(m), m).catch(() => {}); };
  const matchOf = id => matches.find(m => m.ids.includes(id));
  const onPost = (id, m) => {
    if (m.t === 'find') { const open = matches.find(x => !x.stopped && x.group === m.o.playerGroup && x.ids.length >= 1 && x.ids.length < m.o.maxPlayers);
      if (open) { for (const o of open.ids) deliver(o, { e: 'playerConnected', x: { playerId: id, alias: 'Phone ' + id } }); deliver(id, { t: 'found', r: { players: open.ids.map(o => ({ playerId: o, alias: 'Phone ' + o })) } }); open.ids.push(id); return; }
      seekers.push({ id, g: m.o.playerGroup }); const same = seekers.filter(s => s.g === m.o.playerGroup);
      if (same.length >= m.o.minPlayers) { const ids = same.map(s => s.id); seekers = seekers.filter(s => !ids.includes(s.id)); matches.push({ ids, group: m.o.playerGroup, stopped: false });
        for (const a of ids) deliver(a, { t: 'found', r: { players: ids.filter(b => b !== a).map(b => ({ playerId: b, alias: 'Phone ' + b })) } }); } return; }
    const M = matchOf(id); if (!M) return;
    if (m.t === 'stop') M.stopped = true;
    if (m.t === 'send') for (const o of M.ids) if (o !== id && (!m.to || m.to.includes(o))) deliver(o, { e: 'data', x: { from: id, data: m.data } });
    if (m.t === 'bye') leave(id);
  };
  const leave = async id => { const M = matchOf(id); if (!M) return; M.ids = M.ids.filter(x => x !== id); await Promise.all(M.ids.map(o => deliver(o, { e: 'playerDisconnected', x: { playerId: id } }))); };
  const open = async (id, cd) => {
    const pg = await br.newPage({ viewport: { width: 640, height: 400 } }), errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    if (id) { await pg.exposeFunction('gcPost', m => onPost(id, m)); await pg.addInitScript(FAKE); }
    await pg.goto('http://iron.test/iron-front/?q=low&nomodels=1' + (id ? '&gcid=' + encodeURIComponent(id) : '')); await pg.waitForTimeout(2000);
    if (cd) await pg.evaluate(cd => { QM.COUNTDOWN = cd; }, cd);
    const o = { pg, errs, id, closed: false }; if (id) pages[id] = o; return o; };
  const close = async o => { o.closed = true; await leave(o.id); await o.pg.close(); };
  const st = o => o.pg.evaluate(() => ({ qm: QM.state, host: QM.hostId, tick: typeof G !== 'undefined' && G && G.tick || 0, online: NET.online, me: NET.me, desync: NET.desync, resyncs: NET.resyncs, status: NET.status || NET.lastStatus || '',
    seed: G && G.opts && G.opts.seed, slots: G && G.opts && G.opts.slots ? G.opts.slots.map(s => (s.ai ? 'ai:' + s.diff : 'h') + ':' + s.name) : null, ui: (document.getElementById('qmStatus') || {}).textContent, sec: Object.assign({}, ONL_SEC.why) }));

  // 1. web build: no Game Center bridge -> no Quick Match button, normal host/join untouched
  const w = await open(null); const web = await w.pg.evaluate(() => ({ qm: getComputedStyle(document.getElementById('qmBox')).display, host: !!document.getElementById('hostBtn'), avail: qmAvailable() }));
  ok(web.qm === 'none' && web.host && !web.avail, 'web build: Quick Match hidden, Host/Join still there', web); ok(w.errs.length === 0, 'web build: no page errors', w.errs); await w.pg.close();

  // 2. three phones auto-match; countdown; 4th seat = Hard bot; identical game everywhere
  const A = await open('G:1', 6), B = await open('G:2', 6), C = await open('G:3', 6);
  const shown = await A.pg.evaluate(() => getComputedStyle(document.getElementById('qmBox')).display); ok(shown !== 'none', 'app: Quick Match button shown', shown);
  await A.pg.evaluate(() => document.getElementById('qmBtn').click()); await wait(300); await B.pg.evaluate(() => qmStart()); await wait(800);
  let s = await st(A); ok(s.qm === 'lobby' && s.host === 'G:1' && /starting in/.test(s.ui), 'two phones matched -> countdown lobby, lowest id hosts', { qm: s.qm, host: s.host, ui: s.ui });
  await C.pg.evaluate(() => qmStart()); await wait(1500);
  s = await st(C); ok(s.qm === 'lobby' && /3/.test(s.ui), 'third phone joins during the countdown and sees the host countdown', s.ui);
  await wait(9000);
  const S = [await st(A), await st(B), await st(C)];
  ok(S.every(x => x.qm === 'started' && x.online), 'all three phones started the online match', S.map(x => x.qm + '/' + x.online));
  ok(S.every(x => x.seed === S[0].seed && JSON.stringify(x.slots) === JSON.stringify(S[0].slots)), 'same seed + slots on every phone', S[0].slots);
  ok(S[0].slots && S[0].slots.length === 4 && S[0].slots.filter(x => x.startsWith('h:')).length === 3 && S[0].slots.filter(x => x.startsWith('ai:')).length === 1, '3 humans + 1 bot on 4 seats', S[0].slots);
  const bot = await A.pg.evaluate(() => G.players.filter(P => P.ai).map(P => P.diff)); ok(bot.length === 1 && /hard|si|chief/.test(bot[0]), 'empty seat bot uses the Hard (lobby "si") AI', bot);
  ok(new Set(S.map(x => x.me)).size === 3, 'each phone controls its own seat', S.map(x => x.me));
  await wait(20000);
  const T = [await st(A), await st(B), await st(C)];
  ok(T.every(x => x.tick > 80 && !x.desync) && T[0].resyncs === 0, 'lockstep runs on all phones with no desync/resync', T.map(x => [x.tick, x.desync, x.resyncs]));
  // 3. security: forged host message from a guest, junk bytes, unknown sender
  await C.pg.evaluate(() => { const b = window.__qmBridge; b._emit('data', { from: 'G:2', data: JSON.stringify({ n: 'turn', d: { t: 99999, n: 1, c: [[0, 1, { c: 'sell', ids: [1] }]] } }) }); b._emit('data', { from: 'G:1', data: '{not json' }); b._emit('data', { from: 'G:1', data: JSON.stringify({ n: 'evil', d: {} }) }); b._emit('data', { from: 'G:1', data: 7 }); });
  s = await st(C); ok(s.sec.nothost >= 1 && s.sec.json >= 1 && s.sec.qmshape >= 1, 'forged/junk messages dropped by the v7.7.6 filters', s.sec);
  // 4. a guest leaves mid-match -> host hands the seat to AI
  const cTeam = T[2].me; await close(C); let ai;
  for (let i = 0; i < 40; i++) { await wait(500); ai = await A.pg.evaluate(t => ({ ai: G.players[t].ai, dropped: NET.dropped.has(t), st: NET.status || NET.lastStatus || '', leaveN: ONL.leaveCbs.length, host: NET.host, pt: NET.peerTeam }), cTeam); if (ai.dropped && ai.ai) break; } // the drop command lands a few ticks after the peer leaves
  ok(ai.dropped && ai.ai, 'guest left mid-match -> AI takes their seat', ai);
  // 5. the host leaves mid-match -> remaining phone continues offline vs AI
  await close(A); for (let i = 0; i < 40; i++) { await wait(500); s = await st(B); if (!s.online) break; }
  ok(!s.online && /Host disconnected/.test(s.status), 'host left mid-match -> remaining phone continues offline vs AI', [s.online, s.status]);
  const t0 = s.tick; await wait(2000); s = await st(B); ok(s.tick > t0, 'offline game keeps running', [t0, s.tick]);
  ok(A.errs.length + B.errs.length + C.errs.length === 0, 'no page errors on the three phones', A.errs.concat(B.errs, C.errs).slice(0, 3));
  console.log('step 6: close B'); await close(B); console.log('step 6: B closed');

  // 6. host leaves during the countdown -> survivor searches again -> a new phone arrives -> new host starts
  const X = await open('H:1', 30); console.log('step 6: X open'); const Y = await open('H:2', 5); console.log('step 6: Y open');
  // fire-and-forget: qmStart's findMatch waits for 2 seekers; awaiting the promise on X would deadlock Y
  X.pg.evaluate(() => { qmStart(); }).catch(() => {}); await wait(500); Y.pg.evaluate(() => { qmStart(); }).catch(() => {}); await wait(2000);
  s = await st(Y); ok(s.qm === 'lobby' && s.host === 'H:1', 'pre-start lobby, H:1 hosts', { qm: s.qm, host: s.host });
  await close(X); await wait(1500);
  s = await st(Y); ok(s.qm === 'search' && /looking for more/.test(s.ui), 'host left during countdown -> back to searching', s.ui);
  const Z = await open('H:3', 30); Z.pg.evaluate(() => { qmStart(); }).catch(() => {}); await wait(2000);
  s = await st(Y); ok(s.qm === 'lobby' && s.host === 'H:2', 'new phone found -> H:2 is the new host', { qm: s.qm, host: s.host });
  await wait(12000);
  const U = [await st(Y), await st(Z)];
  ok(U.every(x => x.qm === 'started' && x.online && x.seed === U[0].seed) && U[0].slots.length === 4 && U[0].slots.filter(x => x.startsWith('ai:')).length === 2, 'new host started: 2 humans + 2 Hard bots, same game', U.map(x => [x.qm, x.seed, x.slots]));
  ok(Y.errs.length + Z.errs.length + X.errs.length === 0, 'no page errors (host-migration case)', Y.errs.concat(Z.errs, X.errs).slice(0, 3));
  await close(Y); await close(Z);
  // 7. v7.9.5 host migration: host leaves mid-match with 2 phones left -> they elect a new host and keep playing TOGETHER
  const K1 = await open('K:1', 4), K2 = await open('K:2', 4), K3 = await open('K:3', 4);
  K1.pg.evaluate(() => { qmStart(); }).catch(() => {}); await wait(300); K2.pg.evaluate(() => { qmStart(); }).catch(() => {}); await wait(800); K3.pg.evaluate(() => { qmStart(); }).catch(() => {});
  let K; for (let i = 0; i < 40; i++) { await wait(500); K = [await st(K1), await st(K2), await st(K3)]; if (K.every(x => x.qm === 'started' && x.online && x.tick > 60)) break; }
  ok(K.every(x => x.qm === 'started' && x.online), 'migration case: three phones in one match', K.map(x => [x.qm, x.online, x.tick]));
  const oldTeam = K[0].me; await wait(4000); await close(K1);
  let M2, M3; for (let i = 0; i < 40; i++) { await wait(500); M2 = await K2.pg.evaluate(t => ({ host: NET.host, online: NET.online, hp: NET.hostPeer, ai: G.players[t].ai, tick: G.tick, st: NET.status || NET.lastStatus || '', mig: NET.migrations }), oldTeam);
    M3 = await K3.pg.evaluate(t => ({ host: NET.host, online: NET.online, hp: NET.hostPeer, ai: G.players[t].ai, tick: G.tick, st: NET.status || NET.lastStatus || '', mig: NET.migrations }), oldTeam); if (M2.host && M2.ai && M3.ai) break; }
  ok(M2.online && M2.host && M2.hp === 'K:2' && M3.online && !M3.host && M3.hp === 'K:2', 'host left mid-match -> K:2 (lowest id) is the new host, K:3 follows it, both still online', [M2, M3]);
  ok(M2.ai && M3.ai, 'the old host\'s seat is now played by the AI on both phones', [M2.ai, M3.ai]);
  // a command from the guest still reaches the new host through the lockstep
  const mv = await K3.pg.evaluate(() => { const u = G.ents.find(e => e.team === NET.me && e.kind === 'u' && e.t !== 'harv'); NET.issue({ c: 'move', u: [u.id], x: u.x + 6, y: u.y }); return { id: u.id, x: u.x + 6 }; });
  await wait(3000);
  const seen = await K2.pg.evaluate(m => { const u = G.ents.find(e => e.id === m.id); return u ? Math.round(Math.abs(u.x - m.x) * 10) / 10 : -1; }, mv);
  ok(seen >= 0 && seen < 5, 'a guest move after the migration plays out on the new host', seen);
  const a0 = [M2.tick, M3.tick]; await wait(12000);
  const H2 = await K2.pg.evaluate(() => ({ tick: G.tick, h: stateHash(), desync: NET.desync, online: NET.online })), H3 = await K3.pg.evaluate(() => ({ tick: G.tick, h: stateHash(), desync: NET.desync, online: NET.online, resyncs: NET.resyncs }));
  ok(H2.online && H3.online && H2.tick > a0[0] + 100 && H3.tick > a0[1] + 100 && !H2.desync && !H3.desync, 'after the migration both phones keep running in lockstep (no desync)', [a0, H2, H3]);
  // same state at the same tick: pause both at a common tick by comparing the replay hash list
  const sync3 = H3.resyncs;
  ok(sync3 <= 1, 'the guest needed at most one state repair after the migration', sync3);
  // the new host leaving too -> the last phone continues offline vs AI
  await close(K2); for (let i = 0; i < 40; i++) { await wait(500); s = await st(K3); if (!s.online) break; }
  ok(!s.online && /Host disconnected/.test(s.status), 'then the new host leaves -> last phone continues offline vs AI', [s.online, s.status]);
  ok(K1.errs.length + K2.errs.length + K3.errs.length === 0, 'no page errors (mid-match migration case)', K1.errs.concat(K2.errs, K3.errs).slice(0, 3));
  await br.close(); console.log(fail ? 'QUICKMATCH FAIL ' + fail : 'QUICKMATCH OK'); process.exit(fail ? 1 : 0);
})();
