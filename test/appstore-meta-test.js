// v7.9.10 App Store metadata check: listing draft fields fit Apple's limits, the privacy manifest says "no tracking,
// no data collected", and the privacy/support pages name the seller and link support. Run: node test/appstore-meta-test.js
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), errs = [];
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const md = rd('docs/app-store-listing.md'), fields = {};
for (const m of md.matchAll(/<!--field:(\w+)(?::(\d+))?-->([\s\S]*?)<!--\/field-->/g)) {
  const [, k, lim, raw] = m, v = raw.trim(); fields[k] = v;
  if (!v) errs.push(`listing field ${k} is empty`);
  if (lim && [...v].length > +lim) errs.push(`listing field ${k}: ${[...v].length} chars > ${lim}`);
}
for (const k of ['name', 'subtitle', 'promo', 'keywords', 'description', 'copyright']) if (!(k in fields)) errs.push('listing field missing: ' + k);
if (fields.keywords) {
  if (/,\s/.test(fields.keywords)) errs.push('keywords: no spaces after commas (wastes characters)');
  const nameWords = new Set((fields.name || '').toLowerCase().split(/[^a-z]+/).filter(Boolean));
  for (const w of fields.keywords.split(',')) if (nameWords.has(w.toLowerCase())) errs.push('keyword repeats a word from the app name: ' + w);
}
if (!/MBEP Productions LLC/.test(fields.copyright || '')) errs.push('copyright should name MBEP Productions LLC');
const pm = rd('ios-plugin/PrivacyInfo.xcprivacy');
if (!/^<\?xml[\s\S]*<plist version="1.0">[\s\S]*<\/plist>\s*$/.test(pm)) errs.push('PrivacyInfo.xcprivacy is not a plist');
if (!/<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(pm)) errs.push('NSPrivacyTracking must be false');
if (!/<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/.test(pm)) errs.push('NSPrivacyCollectedDataTypes must be empty');
const priv = rd('privacy.html'), sup = rd('support.html');
if (!priv.includes('MBEP Productions LLC')) errs.push('privacy.html must name MBEP Productions LLC');
if (!priv.includes('support.html')) errs.push('privacy.html should link the support page');
if (!sup.includes('github.com/IronForgeCreateGM/iron-front/issues') || !sup.includes('privacy.html')) errs.push('support.html needs the issues link and privacy link');
if (!/Restore purchases/.test(sup)) errs.push('support.html should explain Restore purchases');
// the App Store app must never load the analytics / crash SDKs (matches the "Data Not Collected" answer)
for (const f of ['js/analytics.js', 'js/sentry.js']) if (!/native\s*\|\|/.test(rd(f)) && !/\|\|\s*native/.test(rd(f))) errs.push(f + ' must skip the native app');
if (!rd('scripts/build-www.js').includes("'support.html'")) errs.push('build-www must copy support.html');
const html = rd('index.html'); if (!/MBEP Productions LLC/.test(html) || !/href="support\.html"/.test(html)) errs.push('Settings credits should show © MBEP Productions LLC and a Support link');
console.log(errs.length ? 'APPSTORE-META FAIL\n' + errs.join('\n') : `APPSTORE-META OK (name ${[...fields.name].length}/30, subtitle ${[...fields.subtitle].length}/30, keywords ${fields.keywords.length}/100, description ${[...fields.description].length}/4000)`);
process.exit(errs.length ? 1 : 0);
