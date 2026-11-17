// v7.9.11 lobby chat safety (App Store guideline 1.2): word filter unit checks + wiring checks. Run: node test/chatsafe-test.js
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), errs = [];
const { chatFilter } = require('../js/chatsafe.js');
const masked = ['you fucking noob', 'f u c k you', 'sh1t', 'b!tch', 'F.U.C.K', 'shiiiit', 'a55hole', 'stfu', 'nigga', 'cunt'];
const clean = ['gg wp', 'Hellgate rush', 'class assassin', 'assess the passage', 'Scunthorpe', 'cocktail', 'Fukushima', 'therapist', 'go to hell', 'nice tank 123', 'Titans on the cannons', 'spicy raccoon', 'Commander42: lol'];
for (const s of masked) { const f = chatFilter(s); if (f === s || !/\*\*/.test(f)) errs.push('not masked: ' + s + ' -> ' + f); }
for (const s of clean) { const f = chatFilter(s); if (f !== s) errs.push('false positive: ' + s + ' -> ' + f); }
const rd = f => fs.readFileSync(path.join(root, f), 'utf8'), html = rd('index.html'), onl = rd('js/online.js'), sup = rd('support.html');
if (!/<script src="js\/chatsafe\.js[^"]*"><\/script>\s*<script src="js\/online\.js/.test(html)) errs.push('index.html must load js/chatsafe.js right before js/online.js');
for (const id of ['chatToggle', 'chatMutedN', 'chatReport']) if (!html.includes(`id="${id}"`)) errs.push('lobby chat tool missing: #' + id);
if (!/href="support\.html#report"/.test(html) || !/id="report"/.test(sup)) errs.push('Report link must go to support.html#report');
if (!/onlChatClean\(m\); onlChatLine\(n \+ ': ' \+ f, n\); ONL\.acts\.chat\(\{ m: f, n \}\)/.test(onl)) errs.push('host must filter chat before relaying');
if (!/chatAddLine\(t, from\)/.test(onl)) errs.push('chat lines must go through chatAddLine');
console.log(errs.length ? 'CHATSAFE FAIL\n' + errs.join('\n') : `CHATSAFE OK (${masked.length} masked, ${clean.length} clean)`); process.exit(errs.length ? 1 : 0);
