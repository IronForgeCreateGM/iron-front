# Iron Front — App Store readiness checklist (iPhone + iPad + Mac, one universal app)

Kept by the nightly runs. Ranked: top of "Left" = next thing to do. Seller: **MBEP Productions LLC** (being formed).
Last updated: v7.9.18, Sat Nov 21, 2026 (v7.9.17 live Nov 21). Full how-to: APP-STORE.md (has uncommitted IAP edits — leave them).

## Done
- [x] Game runs fully offline (three.js vendored, no CDN); `npm run check:www` checks the app bundle is self-contained (v7.7.2).
- [x] Capacitor shell config (`capacitor.config.json`, `scripts/build-www.js`, npm scripts) (v7.6.x).
- [x] Safe areas / notch / home indicator (`viewport-fit=cover`, `env(safe-area-inset-*)`), touch controls, landscape.
- [x] App pauses + mutes offline games when backgrounded (v7.7.3); screen wake lock during matches (v7.8.2).
- [x] 1024 px app icon (`icons/icon-1024.png`, RGB no alpha) + 180/192/512 icons (v7.6.8).
- [x] Screenshot script for iPhone 6.9", iPad 13", Mac (`test/appstore-shots.js`) (v7.6.8 / v7.7.4).
- [x] Privacy policy page (`privacy.html`); Sentry + PostHog never load in the App Store app, no session recording, no IP (v7.7.4/5).
- [x] Account-free play (no login anywhere; online is optional).
- [x] Phone performance on the 224x224 maps (v7.9.9).
- [x] Online auto-reconnect (v7.9.8); Quick Match host migration (v7.9.5).
- [x] **v7.9.10:** privacy manifest `ios-plugin/PrivacyInfo.xcprivacy` (no tracking, no collected data); support page `support.html`
      (Support URL); privacy policy names MBEP Productions LLC, adds Game Center + children notes and a date; Settings shows
      © 2026 MBEP Productions LLC + support link; listing draft `docs/app-store-listing.md` (name, subtitle, promo, keywords,
      description, URLs, App Privacy answers, age-rating answers, review notes); `check:www` + `test/appstore-meta-test.js` guard them.
- [x] **v7.9.11:** lobby chat safety (guideline 1.2): word filter (masks insults/slurs incl. l33t and spaced spellings; host filters
      before relaying), 🔇 per-player mute (saved on device, Unmute all), 💬 chat on/off (OFF by default in the App Store app),
      ⚑ Report a player → `support.html#report`. `js/chatsafe.js`; tests `test/chatsafe-test.js`, `test/chatsafe-browser-test.js`.
- [x] **v7.9.12:** Xcode copy-paste pieces in `ios-plugin/` (see `ios-plugin/README.md`): `AppIcon.appiconset/` (1024 universal iOS
      icon + Mac Catalyst sizes 16–1024, RGB no alpha) and `LaunchScreen.storyboard` (plain #05080c = title screen + web view
      colour, no white flash, no text/logo). `test/appstore-meta-test.js` checks every icon matches its slot; `check:www` checks presence.
- [x] **v7.9.13:** external links in the app: WKWebView ignores `target="_blank"`, so `js/extlinks.js` (loaded by index/privacy/support)
      routes every `_blank` or other-site link in the App Store app (Capacitor native) through `IF_LINKS.open()`: other sites → Capacitor
      Browser plugin (in-app Safari sheet with Done) if installed, else same window (Capacitor hands other hosts to Safari); privacy/support
      → same window, and both pages now have a "← Back to game" link at the top (href `index.html`). Web version unchanged (new tabs).
      `test/extlinks-test.js`; `check:www` checks the back links + helper. Xcode step: `npm i @capacitor/browser && npx cap sync ios` (optional).
- [x] **v7.9.14:** iPhone smoothness pass (render only, sim/AI/balance untouched): phones draw the terrain in frustum-culled pieces on
      every map (normal maps keep full 4 verts/tile; ~38% fewer triangles per frame mid-game), Mobile preset no longer allocates
      full-size bloom/FXAA targets (render-target pixels 1.52M -> 0.57M), dynamic resolution 1.5 -> 1.25 -> 1.0 when the phone
      can't hold its 30 fps cap for 3 s (steps back up after 20 s; `?dynres=0` for QA), WebAudio unlock retried on touchend/pointerup
      (iOS won't start audio on touchstart) and resumed from iOS 'interrupted'. `test/v7914-mobile-perf-test.js`.
- [x] **v7.9.15:** App Store screenshots refreshed and committed, ready to upload: `appstore/screenshots/{iphone63,iphone69,ipad13,mac}/`
      5 each in upload order (8-player Shattered Moon, Volcano XL battle, full base, 8-player Frozen Labyrinth, title with the 8 flags),
      RGB JPEG at 2622x1206 (iPhone 6.3", Apple's required iPhone slot since the 2026 spec), 2868x1320 (6.9"), 2752x2064 (iPad 13"),
      2880x1800 (Mac). Sizes checked against Apple's App Store Connect "Screenshot specifications" page on Nov 20 2026. Listed with
      captions in `docs/app-store-listing.md` → Screenshots. `test/appstore-shots.js` rewritten (4 slots, 5 scenes, `--pack`, the
      camera now really moves — the old `camFocus` call never existed); `test/appstore-shots-meta-test.js` checks sizes/RGB/count/listing.
- [x] **v7.9.16:** first-run onboarding: `js/howto.js` shows 5 short "How to play" cards (build your base → power then
      money → make an army → move and attack → win) on the first launch, right under the title screen. Skip / Esc any time,
      Back/Next or arrow keys, remembered on the device only (`localStorage.ifHowtoSeen`, no account, no network, offline).
      Touch wording when the mobile UI is on or the pointer is coarse, mouse/keyboard wording on Mac/desktop. Fits iPhone
      landscape/portrait, iPad and Mac windows inside the safe areas with 44 pt buttons. Re-open from ❓ How to play on the
      menu or pause screen. Not shown for deep links (?room=) or automated runs; `?howto=1` forces it, `?howto=0` never.
      `test/howto-test.js`; `check:www` checks it is loaded. UI only (no sim/AI/replay change).
- [x] **v7.9.17:** iPhone landscape "Game vs bots" setup fixed (CSS only): the left column (map, peace time, quick setup) was as wide as
      its longest preset row, which squeezed the seat table to 0-14 px per column; it now stays at 38% and wraps (44 px preset buttons), and the
      table gets 28/1/.72/1.4/.8 columns (readable on iPhone 17 Pro 874x402 and iPhone SE 667x375). iPad/Mac sizes untouched.
      `test/setup-layout-test.js` checks 8 device sizes. Before/after shots were saved by the nightly run.
- [x] **v7.9.18:** iPad/Mac layout pass, setup screens (CSS only): the Quick-setup preset row never wrapped, so on every Mac window
      (900-1440 px wide), iPad split/slide-over and iPhone portrait it made the left column as wide as all presets together: the seat
      table was pushed out of the panel (Mac), the Map dropdown ran past the edge (iPad 1/2, 1/3, iPhone portrait). Left column can now
      shrink, presets wrap, dropdowns stay inside. Also: the controls hint no longer sits on the Infantry/Vehicles/Aircraft tabs in short
      Mac windows; the iPad/iPhone portrait in-match overlay now says "Rotate your iPhone or iPad to landscape" (was "phone").
      `test/setup-layout-test.js` now checks 10 sizes incl. panel containment. iPad landscape/11"/Stage Manager menus, online lobby,
      Settings and the touch HUD were checked and looked fine. Match play on iPad is landscape-only (portrait shows the rotate screen);
      for Xcode set iPad orientations to landscape + "Requires full screen" or accept portrait showing that screen.

## Left (unblocked — nightly can do these, in order)
1. **iPad/Mac layout pass (mostly DONE v7.9.17/18):** setup screens fixed. Still open: Mac desktop HUD below ~700 px window height (build grid shows 2 rows, scrolls), portrait play on iPad (decision: landscape-only or a real portrait HUD).
2. **Private-room host migration + hidden-desktop-tab host stall** (online polish).
3. **Test debt:** `test/reach-test.js` (v5.7.3) is stale vs the v7.9.7 lobby (fails the same on live 5c737fb and v7.9.11) — rewrite
   for the new lobby; `test/recon-browser-test.js` fails on live base too. Gate scripts must start `python3 -m http.server 8765`
   for privacy/reach (the 11/17 gate didn't, so both showed exit=1 from connection refused).
4. **Report a player from inside an online lobby** opens support.html in the same window (leaves the lobby). Optional: with the
   Capacitor Browser plugin, open the public https support page in the in-app sheet instead so the lobby stays connected.

## Blocked on the LLC / Apple Developer account (Nicholas)
- Apple Developer Program as an **Organization** (MBEP Productions LLC, D-U-N-S number, $99/yr).
- Final bundle id (change `appId` in `capacitor.config.json`), Xcode signing, App Store Connect app record.
- In-App Purchase product `ironfront_full_unlock` setup + StoreKit sandbox testing (uncommitted IAP work stays untouched until then).
- Game Center capability + two-iPhone Quick Match test (GAME-CENTER.md).
- First real Xcode build/compile of the Swift plugins (needs a Mac; no `ios/` project in the repo yet), TestFlight, submission.
- Confirm age-rating answers and listing text in `docs/app-store-listing.md`; upload the `appstore/screenshots/` set (needs the App Store Connect record).
- Optional: an App Preview video (15–30 s) per slot — needs the app record; can be recorded from the simulator later.
- A support/report email for MBEP Productions LLC (player reports currently go to GitHub issues; Apple prefers a direct contact).
- Optional later: show player names through the word filter in the lobby list and in-game (chat lines already are).
