# Iron Front: shipping to the App Store (iPhone, iPad and Mac)

Status for v7.0: the game is **App Store-ready in structure**. It is not submitted, and no accounts have been created.
Every step below that involves Apple, money or signing in is for Nicholas to do himself.

## 1. What already exists in the repo
| Piece | File | Notes |
|---|---|---|
| PWA manifest | `manifest.json` | Fullscreen, landscape, theme colours, icons 180/192/512 (512 also listed as maskable) |
| Home-screen icon | `icons/icon-180.png` + `<link rel="apple-touch-icon">` | Used by "Add to Home Screen" in Safari |
| Safe areas | `viewport-fit=cover` + `env(safe-area-inset-*)` in `style.css` | The notch and home indicator are respected in the menu, title screen and mobile HUD |
| Capacitor config | `capacitor.config.json` | `webDir: "www"`, appId `com.ironfront.rts` (**change this to your own reverse-DNS id before the first build**) |
| Web bundle step | `scripts/build-www.js` (`npm run build:www`) | Copies `index.html, style.css, manifest.json, js/, vendor/, icons/` into `www/`. There is no bundler; the game is plain static files |
| npm scripts | `package.json` | `cap:add:ios`, `cap:sync`, `cap:open` |

The game runs fully offline: three.js is vendored and there is no CDN. Online play uses WebRTC (Trystero), which WKWebView supports.

## 2. Accounts and costs (Nicholas)
1. **Apple Developer Program**: **$99/year** (USD), at developer.apple.com/programs.
   - Enrol as an *Individual* (your name is shown as the seller) or as an *Organization* (needs a D-U-N-S number).
   - One membership covers iPhone, iPad and Mac.
2. A **Mac with Xcode** (free from the Mac App Store). Capacitor 8 needs a current Xcode.
3. Optional: a support URL and a privacy-policy URL. Both are required in App Store Connect; a simple GitHub Pages page works.
   - The game collects no data. Local high scores stay in `localStorage`.
   - The App Privacy answer is therefore "Data Not Collected". Online play is peer-to-peer and nothing is stored on a server.

## 3. Build steps (on the Mac)
```bash
npm install                 # installs @capacitor/cli, core and ios (^8.5)
npm run build:www           # creates www/
npx cap add ios             # first time only: creates ios/ (Xcode project)
npm run cap:sync            # after every game change: rebuild www/ and copy it into ios/
npm run cap:open            # opens Xcode
```
In Xcode (target **App**):
- **Signing & Capabilities:** pick your Team (from the $99 membership) and set the Bundle Identifier to match `appId`.
- **General → Supported Destinations:** iPhone and iPad. Then add one of these for Mac:
  - **Mac (Designed for iPad)**: easiest, Apple-silicon Macs only, no code changes.
  - **Mac Catalyst**: a real Mac app; also needs a Mac icon set.

  Either way, one universal purchase covers iPhone, iPad and Mac.
- **Deployment Info:**
  - Orientation: landscape left and right on iPhone; all orientations on iPad.
  - Tick *Requires full screen* and *Status bar hidden*.
- **App Icon:** drop a 1024×1024 PNG into `Assets.xcassets/AppIcon`. Xcode 15+ generates the other sizes from it. You can upscale `icons/icon-512.png` or re-render it.
- **Launch screen:** the default storyboard is fine. Set its background colour to `#05080c` so it blends into the title screen.

## 4. Upload and review
1. In App Store Connect, go to **My Apps → +** and create the app: name *Iron Front*, primary category **Games → Strategy**, and your bundle id.
2. In Xcode, run **Product → Archive** with a "Any iOS Device" destination, then **Distribute App → App Store Connect → Upload**.
3. **TestFlight:** add yourself and your brother as internal testers. Test on a real iPhone, a real iPad and a Mac before you submit.
4. **Screenshots:**
   - 6.9" iPhone (1320×2868 or the landscape equivalent) and 13" iPad (2064×2752 or landscape).
   - The repo's `shots/v7_0-*.png` show what to capture, but App Store screenshots must come from the real devices or simulators at those sizes.
5. **Age rating:** expect 9+ for infrequent, mild cartoon or fantasy violence. Answer the questionnaire honestly.
6. **Review notes:**
   - "Single-player works offline. Online play is optional peer-to-peer with a room code; no login is required."
   - Guideline 4.2 (minimum functionality) is not a concern: this is a full native-feeling game, not a wrapped website.

## 5. Things to double-check before submitting
- **Real flags:** the factions use real national flags and names (USA, Russia, China, Iran, Japan, etc.). This is allowed, but avoid real political figures or insignia that could be seen as endorsement. Generic military units are fine.
- **Third-party licences:** three.js (MIT) and Trystero (MIT, see `vendor/TRYSTERO-LICENSE`). Credit them in Settings or the About text.
- **Audio:** all sound is synthesised with WebAudio, so there are no licensed assets. On iOS, sound starts after the first tap; the title screen's "Tap to deploy" handles this.
- **Performance:** Quiet mode (🍃 / M) caps FPS and resolution. Recommend it in the description for older iPhones.
- **Pricing:** free, paid, or free with no IAP. Adding in-app purchases would need StoreKit work and is not planned.
