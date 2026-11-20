// v7.9.15 App Store screenshot set check: appstore/screenshots/<device>/*.jpg exist (1-10 per device, Apple's limit), every
// image is exactly an accepted App Store Connect size for its slot, baseline/progressive JPEG with 3 channels (RGB, no alpha),
// and the listing draft names every file. Run: node test/appstore-shots-meta-test.js
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), dir = path.join(root, 'appstore', 'screenshots'), errs = [];
const SIZES = { iphone69: [[2868, 1320], [2796, 1290], [2736, 1260]], iphone63: [[2622, 1206], [2556, 1179]], ipad13: [[2752, 2064], [2732, 2048]], mac: [[2880, 1800], [2560, 1600], [1440, 900], [1280, 800]] };
function jpegInfo(b) { // walk JPEG markers to the SOF segment: height, width, component count
  if (b[0] !== 0xFF || b[1] !== 0xD8) return null; let i = 2;
  while (i < b.length) { if (b[i] !== 0xFF) return null; const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if ((m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) || (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), comps: b[i + 9] };
    i += 2 + len; } return null; }
const md = fs.readFileSync(path.join(root, 'docs/app-store-listing.md'), 'utf8'); let total = 0;
for (const [dev, ok] of Object.entries(SIZES)) {
  const d = path.join(dir, dev), files = fs.existsSync(d) ? fs.readdirSync(d).filter(f => /\.(jpe?g|png)$/i.test(f)).sort() : [];
  if (files.length < 1 || files.length > 10) errs.push(`${dev}: ${files.length} screenshots (App Store needs 1-10)`);
  for (const f of files) { total++; const b = fs.readFileSync(path.join(d, f)), inf = jpegInfo(b);
    if (!inf) { errs.push(`${dev}/${f}: not a readable JPEG`); continue; }
    if (!ok.some(([w, h]) => w === inf.w && h === inf.h)) errs.push(`${dev}/${f}: ${inf.w}x${inf.h} is not an accepted ${dev} size`);
    if (inf.comps !== 3) errs.push(`${dev}/${f}: ${inf.comps} channels (must be RGB, no alpha)`);
    if (b.length > 8 * 1048576) errs.push(`${dev}/${f}: ${(b.length / 1048576).toFixed(1)} MB is too big for the repo`);
    if (!md.includes(`appstore/screenshots/${dev}/${f}`)) errs.push(`docs/app-store-listing.md does not list appstore/screenshots/${dev}/${f}`); }
}
if (fs.readFileSync(path.join(root, 'scripts/build-www.js'), 'utf8').includes("'appstore'")) errs.push('appstore/ screenshots must not be copied into the app bundle');
console.log(errs.length ? 'APPSTORE SHOTS META FAIL\n' + errs.join('\n') : `APPSTORE SHOTS META OK (${total} screenshots, 4 device slots)`); process.exit(errs.length ? 1 : 0);
