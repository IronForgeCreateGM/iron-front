// v7.9.23 App Store guideline 1.2: player names go through the chat word filter wherever they are shown
// (online lobby list, chat lines, join/rejoin notices, end-of-game scoreboard, Quick Match aliases, replay names).
// Run: node test/namesafe-test.js
const fs = require('fs'), path = require('path'), vm = require('vm'), root = path.join(__dirname, '..'), errs = [];
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
// browser-like: net.js and chatsafe.js share one global scope (both are plain <script> tags)
const ctx = { console, window: {}, module: undefined }; vm.createContext(ctx);
vm.runInContext(rd('js/chatsafe.js'), ctx); vm.runInContext(rd('js/net.js').replace(/^if \(typeof module[^\n]*$/m, ''), ctx);
const ns = (s, d) => ctx.netSafeName(s, d);
const masked = ['fuckface', 'Sh1tLord', 'b!tch99', 'xX_cunt_Xx', 'nigga', 'Nazi', 'stfu noob'];
const clean = ['Commander42', 'Nick', 'Scunthorpe', 'Titan', 'TankBoss', 'Cocktail', 'Arsenal', 'Dickens'];
for (const s of masked) { const f = ns(s); if (f === s || !/\*\*/.test(f)) errs.push('name not masked: ' + s + ' -> ' + f); if (f.length > 16) errs.push('too long: ' + f); }
for (const s of clean) { const f = ns(s); if (f !== s) errs.push('false positive: ' + s + ' -> ' + f); }
if (ns('<b>x</b>') !== 'bx/b') errs.push('html chars must still be stripped: ' + ns('<b>x</b>'));
if (ns('', 'Host') !== 'Host' || ns(null) !== 'Guest') errs.push('defaults changed');
// node (no chatFilter loaded): netSafeName stays the plain sanitizer (det/net tests unaffected)
const { netSafeName } = require('../js/net.js'); if (netSafeName('fuckface') !== 'fuckface') errs.push('node netSafeName should not depend on chatsafe.js');
// wiring: every name shown in the lobby/chat goes through netSafeName
const onl = rd('js/online.js'), main = rd('js/main.js'), qm = rd('js/quickmatch.js');
if (/String\(d\.name \|\| 'A player'\)/.test(onl)) errs.push('version-mismatch notice must use netSafeName');
if (!/onlChatLine\('\* ' \+ netSafeName\(d\.name, 'A player'\)/.test(onl)) errs.push('version-mismatch notice must use netSafeName');
if (!/ONL\.peers\[pid\] = \{ name: netSafeName\(d\.name\)/.test(onl)) errs.push('host must clean joining names');
if (!/st\.hostName = netSafeName\(st\.hostName/.test(onl)) errs.push('guest must clean host name');
if (!/const n = netSafeName\(d\.n, '\?'\)/.test(onl)) errs.push('guest must clean chat sender names');
if (!/netSafeName\(rn, P\.name\)/.test(main)) errs.push('replay names must be cleaned');
if (!/alias: netSafeName\(/.test(qm)) errs.push('Quick Match aliases must be cleaned');
if (!/P\.name = netSafeName\(d\.names\[i\]/.test(rd('js/net.js'))) errs.push('net start names must be cleaned');
console.log(errs.length ? 'NAMESAFE FAIL\n' + errs.join('\n') : `NAMESAFE OK (${masked.length} masked, ${clean.length} clean, wiring 8)`); process.exit(errs.length ? 1 : 0);
