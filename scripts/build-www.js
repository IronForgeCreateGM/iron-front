// Copies the playable game into www/ (Capacitor's webDir). No bundler needed: the game is plain static files.
// Usage: node scripts/build-www.js   (then: npx cap sync ios)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const ITEMS = ['index.html', 'style.css', 'manifest.json', 'js', 'vendor', 'icons'];
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
for (const it of ITEMS) fs.cpSync(path.join(root, it), path.join(out, it), { recursive: true });
let n = 0, bytes = 0; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), s = fs.statSync(p); if (s.isDirectory()) walk(p); else { n++; bytes += s.size; } } })(out);
console.log(`www/ ready: ${n} files, ${(bytes / 1024).toFixed(0)} KB`);
