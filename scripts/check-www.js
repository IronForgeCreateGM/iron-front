// v7.7.2 App Store bundle check: run after `npm run build:www` (or via `npm run check:www`, which builds first).
// Verifies that www/ is self-contained for the iPhone/iPad/Mac app: every local file index.html loads exists in www/,
// no script/stylesheet comes from the internet, the version strings agree, and the private map-builder key is not in the bundle.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), www = path.join(root, 'www'), errs = [], warn = [];
if (!fs.existsSync(path.join(www, 'index.html'))) { console.log('CHECK-WWW FAIL: www/index.html missing (run npm run build:www)'); process.exit(1); }
const html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]);
for (const r of refs) {
  if (/^(https?:)?\/\//.test(r)) { if (/<script[^>]+src="https?:|<link[^>]+rel="stylesheet"[^>]+href="https?:/.test(html.slice(Math.max(0, html.indexOf(r) - 80), html.indexOf(r) + r.length))) errs.push('remote script/stylesheet: ' + r); else warn.push('remote link (fine if it is a normal web link): ' + r); continue; }
  if (/^(mailto|data|javascript):/.test(r)) continue;
  const f = path.join(www, decodeURIComponent(r.split('?')[0])); if (!fs.existsSync(f)) errs.push('missing in www/: ' + r);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, net = (fs.readFileSync(path.join(www, 'js/net.js'), 'utf8').match(/NET_VERSION = 'v([\d.]+)'/) || [])[1];
const tf = (html.match(/<div class="tsFoot"><span>v([\d.]+)</) || [])[1], sub = (html.match(/Real-time strategy · v([\d.]+)/) || [])[1];
const vj = fs.existsSync(path.join(root, 'version.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8')).v.replace(/^v/, '') : pkg;
for (const [k, v] of [['js/net.js NET_VERSION', net], ['index.html title footer', tf], ['index.html subtitle', sub], ['version.json', vj]]) if (v !== pkg) errs.push(`version mismatch: package.json ${pkg} vs ${k} ${v}`);
const key = fs.existsSync('/workspace/.mapbuilder-key') ? fs.readFileSync('/workspace/.mapbuilder-key', 'utf8').trim() : '';
let n = 0, bytes = 0; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), s = fs.statSync(p); if (s.isDirectory()) walk(p); else { n++; bytes += s.size; if (key && /\.(js|html|json|css)$/.test(f) && fs.readFileSync(p, 'utf8').includes(key)) errs.push('map-builder key found in ' + path.relative(www, p)); } } })(www);
for (const f of ['icons/icon-1024.png', 'privacy.html', 'manifest.json']) if (!fs.existsSync(path.join(www, f)) && !fs.existsSync(path.join(root, f))) errs.push('App Store piece missing: ' + f);
warn.forEach(w => console.log('NOTE ' + w));
console.log(`www/: ${n} files, ${(bytes / 1048576).toFixed(1)} MB, ${refs.length} references checked, version ${pkg}`);
console.log(errs.length ? 'CHECK-WWW FAIL\n' + errs.join('\n') : 'CHECK-WWW OK'); process.exit(errs.length ? 1 : 0);
