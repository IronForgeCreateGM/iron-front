# Iron Front — App Store readiness checklist (iPhone + iPad + Mac, one universal app)

Kept by the nightly runs. Ranked: top of "Left" = next thing to do. Seller: **MBEP Productions LLC** (being formed).
Last updated: v7.9.12, Wed Nov 18, 2026 (nightly; v7.9.11 went live 12:18 AM PT). Full how-to: APP-STORE.md (has uncommitted IAP edits — leave them).

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

## Left (unblocked — nightly can do these, in order)
1. **External links in the app:** `target="_blank"` links (privacy/support/report) inside WKWebView — make sure they open
   (Capacitor Browser or same-window) and there's a way back. Review-rejection risk if a link does nothing.
2. **Refresh App Store screenshots** with v7.9.x (huge maps, new lobby) at 2868x1320 / 2752x2064 / 2880x1800 and pick the best 5.
3. **First-run onboarding:** a short "how to play" (build power → refinery → barracks → attack) for brand-new players, skippable.
4. **iPad/Mac layout pass:** check menus/HUD at iPad portrait + Stage Manager sizes and Mac window resizing; rotation on iPad.
5. **Private-room host migration + hidden-desktop-tab host stall** (online polish).
6. **Test debt:** `test/reach-test.js` (v5.7.3) is stale vs the v7.9.7 lobby (fails the same on live 5c737fb and v7.9.11) — rewrite
   for the new lobby; `test/recon-browser-test.js` fails on live base too. Gate scripts must start `python3 -m http.server 8765`
   for privacy/reach (the 11/17 gate didn't, so both showed exit=1 from connection refused).

## Blocked on the LLC / Apple Developer account (Nicholas)
- Apple Developer Program as an **Organization** (MBEP Productions LLC, D-U-N-S number, $99/yr).
- Final bundle id (change `appId` in `capacitor.config.json`), Xcode signing, App Store Connect app record.
- In-App Purchase product `ironfront_full_unlock` setup + StoreKit sandbox testing (uncommitted IAP work stays untouched until then).
- Game Center capability + two-iPhone Quick Match test (GAME-CENTER.md).
- First real Xcode build/compile of the Swift plugins (needs a Mac; no `ios/` project in the repo yet), TestFlight, submission.
- Confirm age-rating answers and listing text in `docs/app-store-listing.md`.
- A support/report email for MBEP Productions LLC (player reports currently go to GitHub issues; Apple prefers a direct contact).
- Optional later: show player names through the word filter in the lobby list and in-game (chat lines already are).
