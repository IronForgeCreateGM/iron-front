// App Store screenshots at Apple's accepted pixel sizes (checked Nov 20 2026 against App Store Connect "Screenshot specifications"):
//   iphone69  2868x1320  iPhone 6.9" Dynamic Island large (16/17/18 Pro Max)        landscape
//   iphone63  2622x1206  iPhone 6.3" Dynamic Island medium (16/17/18 Pro) — Apple's REQUIRED iPhone size  landscape
//   ipad13    2752x2064  iPad 13" (required if the app runs on iPad)                landscape
//   mac       2880x1800  Mac App Store (16:10), desktop mouse/keyboard layout
// v7.9.15: 5 scenes per device in upload order (8-player Shattered Moon, Volcano battle, base, 8-player Frozen Labyrinth, title); writes the raw PNGs to
// outDir and, with --pack, RGB JPEGs (no alpha, as Apple requires) into appstore/screenshots/<device>/NN-scene.jpg.
// node test/appstore-shots.js [outDir=/workspace/appstore-shots] [--dev=iphone69,mac] [--scene=title,moon] [--pack]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process'), { chromium } = require('playwright-core');
const args = process.argv.slice(2), flag = k => (args.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const ROOT = path.join(__dirname, '..'), OUT = args.find(a => !a.startsWith('--')) || '/workspace/appstore-shots'; fs.mkdirSync(OUT, { recursive: true });
const PACK = args.includes('--pack'), PACKDIR = path.join(ROOT, 'appstore', 'screenshots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const DEV = [['iphone69', { width: 956, height: 440 }, 3, 1], ['iphone63', { width: 874, height: 402 }, 3, 1], ['ipad13', { width: 1376, height: 1032 }, 2, 1], ['mac', { width: 1440, height: 900 }, 2, 0]]
  .filter(d => !flag('dev') || flag('dev').split(',').includes(d[0]));
const S8 = ['usa', 'rus', 'ger', 'fra', 'bra', 'irn', 'chn', 'jpn'];
const SCENES = [
  ['01-moon', { seed: 20261120, map: 'shatteredmoon', peace: 120, slots: S8.map((f, i) => ['hard', 'ABCDEFGH'[i], f]), min: 8, cam: [0.5, 0.5, 30] }],
  ['02-battle', { seed: 943231385, map: 'volcano8', peace: 180, slots: [['hard', 'A', 'usa'], ['hard', 'B', 'bra']], min: 9 }],
  ['03-base', { seed: 61, map: 'classic', slots: [['hard', 'A', 'chn'], ['hard', 'B', 'usa']], min: 6 }],
  ['04-frost', { seed: 1120, map: 'labyrinth', peace: 120, slots: S8.map((f, i) => ['hard', 'ABCDEFGH'[i], f]), min: 9, cam: [0.5, 0.5] }],
  ['05-title', { title: 1 }],
].filter(s => !flag('scene') || flag('scene').split(',').some(k => s[0].includes(k)));
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  let bad = 0;
  for (const [dn, vp, sc, touch] of DEV) for (const [sn, g] of SCENES) {
    const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: sc, hasTouch: !!touch, isMobile: !!touch }); const pg = await ctx.newPage(); const errs = [];
    pg.setDefaultTimeout(240000); pg.on('pageerror', e => errs.push(e.message));
    await pg.route('http://iron.test/**', r => { const u = new URL(r.request().url()); let p = decodeURIComponent(u.pathname.replace('/iron-front/', '/')); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'nf' }); r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    await pg.goto('http://iron.test/iron-front/?q=high' + (g.title ? '&title=1' : '')); await pg.waitForTimeout(2500);
    // store screenshot only: hide the version + "what's new" footer on the title (changes every version, unreadable at store size)
    if (g.title) { await pg.addStyleTag({ content: '.tsFoot{visibility:hidden}' }); await pg.waitForTimeout(2500); }
    else await pg.evaluate(g => { startGame('normal', { seed: g.seed, map: g.map, peace: g.peace, fog: false, slots: buildSlots(g.slots, null, g.map) }); paused = true;
      for (let i = 0; i < 30 * 60 * g.min; i++) stepGame(); G.events.length = 0; paused = false;
      if (g.cam) { jumpTo(g.cam[0] * MW, g.cam[1] * MH, true); if (g.cam[2]) R3.cam.td = R3.cam.d = g.cam[2]; } // v7.9.15: camFocus never existed, so old shots kept the default camera
    }, g);
    await pg.waitForTimeout(3000); const f = path.join(OUT, `${dn}-${sn}.png`); await pg.screenshot({ path: f, timeout: 240000 });
    console.log(`${dn} ${sn} ${vp.width * sc}x${vp.height * sc} pageErrors=${errs.length}${errs.length ? ' ' + errs[0] : ''} -> ${f}`); bad += errs.length; await ctx.close();
    if (PACK && !errs.length) { const d = path.join(PACKDIR, dn); fs.mkdirSync(d, { recursive: true });
      execFileSync('python3', ['-c', 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"JPEG",quality=90,optimize=True,progressive=True)', f, path.join(d, sn + '.jpg')]); } }
  await br.close(); console.log(bad ? 'APPSTORE SHOTS: PAGE ERRORS' : 'APPSTORE SHOTS OK'); process.exit(bad ? 1 : 0); })();
