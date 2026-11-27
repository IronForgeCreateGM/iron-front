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
// v7.9.12 Xcode copy-paste pieces: AppIcon.appiconset (1024 universal iOS + Mac sizes; every PNG exists, matches its slot,
// RGB with no alpha) and a launch screen storyboard in the title-screen colour #05080c.
const ai = 'ios-plugin/AppIcon.appiconset/';
try {
  const cj = JSON.parse(rd(ai + 'Contents.json'));
  if (!cj.images.some(i => i.idiom === 'universal' && i.platform === 'ios' && i.size === '1024x1024')) errs.push('AppIcon: needs the 1024x1024 universal iOS icon');
  for (const i of cj.images) {
    const f = path.join(root, ai + i.filename); if (!fs.existsSync(f)) { errs.push('AppIcon: missing ' + i.filename); continue; }
    const b = fs.readFileSync(f), w = b.readUInt32BE(16), h = b.readUInt32BE(20), ct = b[25], want = parseFloat(i.size) * parseInt(i.scale || '1');
    if (b.toString('ascii', 1, 4) !== 'PNG' || w !== want || h !== want) errs.push(`AppIcon: ${i.filename} is ${w}x${h}, slot wants ${want}`);
    if (ct !== 2) errs.push(`AppIcon: ${i.filename} must be RGB without alpha (PNG colour type ${ct})`);
  }
} catch (e) { errs.push('AppIcon Contents.json: ' + e.message); }
const ls = rd('ios-plugin/LaunchScreen.storyboard');
if (!/launchScreen="YES"/.test(ls) || !/red="0\.0196\d*" green="0\.0313\d*" blue="0\.0470\d*"/.test(ls)) errs.push('LaunchScreen.storyboard must be a launch screen in #05080c');
if (!/"backgroundColor": "#05080c"/.test(rd('capacitor.config.json'))) errs.push('capacitor.config.json ios.backgroundColor should stay #05080c (matches the launch screen)');
// v7.9.28 Info.plist keys for Xcode (ios-plugin/Info-additions.plist): valid plist, export-compliance key set, Mac category,
// orientations that match what the game supports (iPhone landscape only, iPad all four + split view since v7.9.22), the launch
// screen name matches the storyboard, the display name matches capacitor.config.json, and no permission prompts are declared
// (the game asks for none; also check the web code never calls camera/mic/location APIs that would need one).
try {
  const ip = rd('ios-plugin/Info-additions.plist'), keys = {};
  if (!/^<\?xml[\s\S]*<plist version="1.0">\s*<dict>[\s\S]*<\/dict>\s*<\/plist>\s*$/.test(ip)) errs.push('Info-additions.plist is not a plist dict');
  for (const m of ip.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<key>([^<]+)<\/key>\s*(<true\/>|<false\/>|<string>([^<]*)<\/string>|<array>([\s\S]*?)<\/array>)/g))
    keys[m[1]] = m[2] === '<true/>' ? true : m[2] === '<false/>' ? false : m[3] !== undefined ? m[3] : [...m[4].matchAll(/<string>([^<]+)<\/string>/g)].map(x => x[1]);
  const cap = JSON.parse(rd('capacitor.config.json')), eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (keys.ITSAppUsesNonExemptEncryption !== false) errs.push('Info-additions: ITSAppUsesNonExemptEncryption must be NO (matches the listing export-compliance answer)');
  if (keys.LSApplicationCategoryType !== 'public.app-category.strategy-games') errs.push('Info-additions: LSApplicationCategoryType must be public.app-category.strategy-games');
  if (keys.CFBundleDisplayName !== cap.appName) errs.push(`Info-additions: CFBundleDisplayName "${keys.CFBundleDisplayName}" != capacitor appName "${cap.appName}"`);
  if (keys.UILaunchStoryboardName !== 'LaunchScreen' || !fs.existsSync(path.join(root, 'ios-plugin/LaunchScreen.storyboard'))) errs.push('Info-additions: UILaunchStoryboardName must be LaunchScreen (ios-plugin/LaunchScreen.storyboard)');
  if (!eq(keys.UISupportedInterfaceOrientations, ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'])) errs.push('Info-additions: iPhone orientations must be landscape left + right only');
  if (!eq([...(keys['UISupportedInterfaceOrientations~ipad'] || [])].sort(), ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight', 'UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown'])) errs.push('Info-additions: iPad needs all four orientations (portrait HUD since v7.9.22)');
  if (keys.UIRequiresFullScreen !== false) errs.push('Info-additions: UIRequiresFullScreen must be NO (iPad split view is supported)');
  if (keys.UIStatusBarHidden !== true || keys.UIViewControllerBasedStatusBarAppearance !== false) errs.push('Info-additions: status bar must be hidden (UIStatusBarHidden YES + UIViewControllerBasedStatusBarAppearance NO)');
  for (const k of Object.keys(keys)) if (/UsageDescription$/.test(k)) errs.push('Info-additions: unexpected permission prompt ' + k + ' (the game asks for no permissions)');
  for (const f of fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js'))) if (/getUserMedia|geolocation\.|requestTrackingAuthorization|navigator\.bluetooth|DeviceMotionEvent\.requestPermission/.test(rd('js/' + f))) errs.push('js/' + f + ' uses an API that needs a permission prompt (add the Info.plist reason or remove it)');
  if (!/Export compliance[\s\S]*ITSAppUsesNonExemptEncryption[\s\S]*\*\*NO\*\*/.test(md)) errs.push('listing: Export compliance section must give the ITSAppUsesNonExemptEncryption = NO answer');
  if (!/Info-additions\.plist/.test(rd('ios-plugin/README.md'))) errs.push('ios-plugin/README.md must explain Info-additions.plist');
} catch (e) { errs.push('Info-additions.plist: ' + e.message); }
console.log(errs.length ? 'APPSTORE-META FAIL\n' + errs.join('\n') : `APPSTORE-META OK (name ${[...fields.name].length}/30, subtitle ${[...fields.subtitle].length}/30, keywords ${fields.keywords.length}/100, description ${[...fields.description].length}/4000)`);
process.exit(errs.length ? 1 : 0);
