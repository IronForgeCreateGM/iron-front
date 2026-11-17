# Iron Front — App Store readiness checklist (iPhone + iPad + Mac, one universal app)

Kept by the nightly runs. Ranked: top of "Left" = next thing to do. Seller: **MBEP Productions LLC** (being formed).
Last updated: v7.9.11, Tue Nov 17, 2026 (nightly; v7.9.10 is live). Full how-to: APP-STORE.md (has uncommitted IAP edits — leave them).

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

## Left (unblocked — nightly can do these, in order)
1. **[in progress, v7.9.11] Lobby chat safety (guideline 1.2):** the online lobby has free-text chat. Add a per-player mute/hide-chat toggle (and a
   simple word filter) or hide chat in the App Store app; then set the age-rating "Messaging and chat" answer accordingly.
2. **Launch screen + icon set files:** ship a ready `LaunchScreen` background colour note / storyboard snippet (#05080c) and an
   `AppIcon.appiconset/Contents.json` (single 1024 universal + Mac sizes if Catalyst) in `ios-plugin/` so Xcode setup is copy-paste.
3. **Refresh App Store screenshots** with v7.9.x (huge maps, new lobby) at 2868x1320 / 2752x2064 / 2880x1800 and pick the best 5.
4. **First-run onboarding:** a short "how to play" (build power → refinery → barracks → attack) for brand-new players, skippable.
5. **iPad/Mac layout pass:** check menus/HUD at iPad portrait + Stage Manager sizes and Mac window resizing; rotation on iPad.
6. **Private-room host migration + hidden-desktop-tab host stall** (online polish).
7. **External links in the app:** `target="_blank"` links (privacy/support) inside WKWebView — make sure they open (Capacitor Browser or same-window).

## Blocked on the LLC / Apple Developer account (Nicholas)
- Apple Developer Program as an **Organization** (MBEP Productions LLC, D-U-N-S number, $99/yr).
- Final bundle id (change `appId` in `capacitor.config.json`), Xcode signing, App Store Connect app record.
- In-App Purchase product `ironfront_full_unlock` setup + StoreKit sandbox testing (uncommitted IAP work stays untouched until then).
- Game Center capability + two-iPhone Quick Match test (GAME-CENTER.md).
- First real Xcode build/compile of the Swift plugins (needs a Mac; no `ios/` project in the repo yet), TestFlight, submission.
- Confirm age-rating answers and listing text in `docs/app-store-listing.md`.
