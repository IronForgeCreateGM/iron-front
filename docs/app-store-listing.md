# Iron Front — App Store listing draft (for Nicholas to review)

Drafted v7.9.10 (Nov 16, 2026). Nothing here is submitted. Paste into App Store Connect once the MBEP Productions LLC
developer account is open. Character limits are checked by `node test/appstore-meta-test.js` (the text between the
`<!--field:...-->` markers is what gets counted).

## Identity
- **Seller / developer name:** MBEP Productions LLC (shown under the app name; needs the Organization developer account + D-U-N-S).
- **Copyright:** <!--field:copyright-->2026 MBEP Productions LLC<!--/field-->
- **Bundle ID:** still `com.ironfront.rts` in `capacitor.config.json` — change to a reverse-DNS id you own before the first build (suggestion: `com.mbepproductions.ironfront`).
- **SKU (any private id):** `IRONFRONT001`
- **Primary category:** Games → Strategy. **Secondary:** Games → Simulation (optional).
- **Platforms:** one universal app — iPhone, iPad, and Mac (Designed for iPad on Apple-silicon Macs, or Mac Catalyst).
- **Price:** Free, with one non-consumable in-app purchase "Full Unlock" ($4.99). See APP-STORE.md.

## Text fields
**App name (30):** <!--field:name:30-->Iron Front: Real-Time Strategy<!--/field-->

**Subtitle (30):** <!--field:subtitle:30-->Build, battle, command armies<!--/field-->

**Promotional text (170, can change any time without review):**
<!--field:promo:170-->Huge 8-player free-for-all maps, smarter Hard AI and online play with friends. Build your base, mine ore and gas, and crush the enemy command yard.<!--/field-->

**Keywords (100, comma-separated, no spaces needed, don't repeat words from the name):**
<!--field:keywords:100-->rts,base,building,tank,army,war,tactics,command,conquer,skirmish,multiplayer,offline,military,ffa<!--/field-->

**Description (4000):**
<!--field:description:4000-->
Iron Front is a fast, classic real-time strategy game built for touch screens and just as good with a mouse and keyboard on a Mac.

Pick a country, build your base, mine ore and gas, and train an army of infantry, tanks, aircraft and artillery. Scout the map, expand to new resources, and break through the enemy's defences before they break through yours.

EIGHT COUNTRIES, EACH WITH ITS OWN STYLE
USA, Russia, Germany, France, Brazil, Iran, China and Japan each have their own units and strengths — from France's Grand Cannon fortresses to Iran's drone swarms and Japan's Raijin mechs.

BIG BATTLES, YOUR WAY
• Skirmish against Easy, Medium or Hard AI — no internet needed.
• Team games (2v2, 3v3, 4v4) or chaotic 8-player free-for-alls.
• Huge 8-player maps: Shattered Moon, Delta of Kings, Frozen Labyrinth, Rift Canyon and more.
• Endless mode: hold the line against wave after wave.
• Watch the bots fight it out and learn their tactics.
• Save and watch replays of your games.

PLAY WITH FRIENDS
Host a private online game with a room code and invite a friend, or use Quick Match with Game Center. Empty seats can be filled with bots.

MADE FOR EVERY SCREEN
Touch controls designed for iPhone and iPad (tap to build, drag to pan, pinch to zoom), full mouse and keyboard support on Mac, and a Quiet mode that saves battery on older devices.

NO ACCOUNT, NO ADS
Iron Front needs no login and shows no ads. It collects no personal data.

Free to play with USA, Russia, Germany and France on Iron Crossroads and Frostline Pass. A one-time Full Unlock adds every country and every map — no subscription.
<!--/field-->

**What's New (first version):** <!--field:whatsnew:4000-->First App Store release of Iron Front.<!--/field-->

## URLs
- **Support URL (required):** https://ironforgecreategm.github.io/iron-front/support.html
- **Marketing URL (optional):** https://ironforgecreategm.github.io/iron-front/
- **Privacy Policy URL (required):** https://ironforgecreategm.github.io/iron-front/privacy.html

## App Privacy ("nutrition label")
- **Data collection:** "No, we do not collect data from this app." The App Store app never loads Sentry or PostHog
  (both skip `window.Capacitor` native), purchases are handled by Apple, and Game Center data is handled by Apple.
- **Tracking:** No. Privacy manifest: `ios-plugin/PrivacyInfo.xcprivacy` (copy into `ios/App/App/` and add to the App target).
- **Third-party SDKs in the app:** Capacitor (ships its own privacy manifest), three.js and Trystero (JavaScript, no data collection).

## Age rating questionnaire — proposed answers (Nicholas to confirm)
<!-- v7.9.29 -->
Updated Nov 28 2026 for Apple's **current** questionnaire (age ratings 4+ / 9+ / 13+ / 16+ / 18+ since July 2025, with the in-app controls,
capabilities, medical/wellness and violence questions; the social media questions since July 9 2026; and the two descriptors added on
Nov 19 2026, **Shared Location** and **Dating and Relationships**, which every app must answer by **Jan 12 2027**). Checked against App Store
Connect Help "Age ratings values and definitions" and the App Store Connect release notes on Nov 28 2026. The old draft (pre-2025 questions,
"expect 9+") is replaced: under the current rules a war game with tanks, guns and soldiers lands on **13+**.

<!--agerating-->
| Section | Question | Proposed answer | Why |
| --- | --- | --- | --- |
| In-App Controls | Parental Controls | No | Chat is off by default in the App Store app and has a word filter and mute, but there are no parent-facing controls. |
| In-App Controls | Age Assurance | No | No age check (no Declared Age Range API, no ID). See the age-assurance note below. |
| Capabilities | Unrestricted Web Access | No | Only fixed links open (privacy, support, report form) in Safari or the in-app Safari sheet; there is no address bar. |
| Capabilities | User-Generated Content | No | Nothing players make is shared broadly; the map builder is private and not in the app. |
| Capabilities | Social Media | No | No feed, likes, follows or public posts. |
| Capabilities | Messaging and Chat | Yes | Short text chat (140 characters) between the players in one private room; off by default in the app, filtered, mutable, reportable. |
| Capabilities | Shared Location | No | The game never reads or shares real-world location (no location APIs; `test/appstore-meta-test.js` checks js/). |
| Capabilities | Advertising | No | No ads of any kind. |
| Mature Themes | Profanity or Crude Humor | None | Game text has none; chat words are masked by the filter. |
| Mature Themes | Horror/Fear Themes | None | |
| Mature Themes | Alcohol, Tobacco, or Drug Use or References | None | |
| Mature Themes | Dating and Relationships | No | |
| Medical or Wellness | Medical or Treatment Information | None | |
| Medical or Wellness | Health or Wellness Topics | None | |
| Sexuality or Nudity | Mature or Suggestive Themes | Infrequent | Armies under real country names and flags fight each other ("war or political strife"); no real leaders, events or politics. |
| Sexuality or Nudity | Sexual Content or Nudity | None | |
| Sexuality or Nudity | Graphic Sexual Content and Nudity | None | |
| Violence | Cartoon or Fantasy Violence | Frequent | Every match is combat: small stylised units shoot and explode, plus fantasy units (Raijin mechs, Tesla weapons). |
| Violence | Realistic Violence | Infrequent | Soldiers and real-style tanks fight, seen from far above; no blood, gore or close-ups. Do **not** pick Frequent (that is 18+). |
| Violence | Prolonged Graphic or Sadistic Realistic Violence | None | |
| Violence | Guns or Other Weapons | Frequent | Guns, tanks, artillery and missiles are on screen all match. |
| Chance-Based Activities | Gambling | None | |
| Chance-Based Activities | Simulated Gambling | None | |
| Chance-Based Activities | Contests | None | No rankings, leaderboards or prizes (Game Center is only used for Quick Match; no leaderboards). |
| Chance-Based Activities | Loot Boxes | None | The only purchase is the one-time Full Unlock; nothing random is sold. |
<!--/agerating-->

- **Expected rating: 13+** (driven by Frequent cartoon/fantasy violence, Infrequent realistic violence and Frequent guns or other weapons;
  each is listed under 13+). Messaging and chat alone is allowed at 4+. Do not set a higher minimum age by hand; 13+ fits.
- **Regional:** Brazil self-rating about **A12** (messaging and chat, infrequent realistic violence, frequent guns); Korea shows an extra GRAC
  rating for apps in the Games category (expect 12+); Australia only changes ratings for loot boxes / simulated gambling (none here).
- **Age assurance (blocked on the LLC / Xcode):** in places where the law requires it, Apple shares an age range through the
  **Declared Age Range** API and the developer must check it. The game has no accounts and keeps chat off by default, but whether
  MBEP Productions LLC must call the API before turning chat on is a legal call for the LLC; it would be a small Swift plugin later.
- **Review notes:** mention the chat safety (off by default, filter, mute, report), see "App Review notes" below.

## Availability (countries and regions) — proposed
- All regions **except China mainland**: games sold there (paid, or with in-app purchases) need a Chinese game licence (ISBN approval
  number), entered on App Store Connect's **App Compliance** page (moved there Nov 16 2026). The LLC has none, so leave China mainland
  unticked. Hong Kong, Macao and Taiwan do not need it.
- Russia: Apple has not sold paid apps or in-app purchases there since 2022; leave it ticked (free download still works) or untick it,
  either is fine. Iran is not an App Store region.

## Export compliance (encryption) — proposed answer (Nicholas to confirm)
<!-- v7.9.28 -->
- **Answer:** the app uses only **exempt** encryption → `ITSAppUsesNonExemptEncryption` = **NO** (already in `ios-plugin/Info-additions.plist`,
  so App Store Connect and TestFlight stop asking on every upload).
- **Why:** all encryption is the system's own, inside WebKit: HTTPS/WSS to the multiplayer relays, WebRTC (DTLS) between players, and
  WebCrypto (AES-GCM/signatures in the bundled Trystero library) to protect and sign the room handshake. Standard algorithms only, no
  custom crypto, and the app's main purpose is a game, not security or secure messaging. No CCATS / documentation upload expected.
- **France:** the app is not a secure-storage/secure-messaging/security product, so no French declaration is expected.
- This is MBEP Productions LLC's own call under US export rules (Apple's "Overview of export compliance"); if in doubt, answer the
  questionnaire once in App Store Connect and keep the key in step with the answer.

## EU Digital Services Act — trader status (needs the LLC)
- To sell in the EU, App Store Connect asks whether the seller is a **trader**. MBEP Productions LLC sells an in-app purchase, so answer
  **trader**; Apple then shows the LLC's address, phone and email on the EU product page. Needs the LLC's business address, a support
  phone number and a support email (still open; see docs/app-store-readiness.md). Apple can hold EU distribution until this is verified.

## App Review notes (draft)
> Iron Front is a real-time strategy game. No login is required. Single-player Skirmish, Endless and Watch modes work fully offline.
> Online play is optional: "Play Online" hosts a private room with a code (peer-to-peer WebRTC), and "Quick Match" uses Game Center.
> To test the in-app purchase: tap Brazil, Iran, China or Japan in the country picker (or a locked map) to open the Full Unlock sheet;
> Settings → Restore purchases restores it. The app collects no data.
> Lobby chat (private rooms only) is off by default; players turn it on with 💬. Offensive words are masked, 🔇 mutes a player,
> and ⚑ Report a player opens a report form.

## Screenshots
<!-- v7.9.15 -->
Ready-to-upload set (v7.9.15, Nov 20 2026), 5 per device slot in **upload order**. All are RGB JPEGs (no alpha) at sizes App Store
Connect accepts (checked against Apple's "Screenshot specifications" page on Nov 20 2026). Seller shown nowhere in the images;
the listing seller will be MBEP Productions LLC. Regenerate with `node test/appstore-shots.js /workspace/appstore-shots --pack`
(4 slots × 5 scenes, ~10 min); `node test/appstore-shots-meta-test.js` checks sizes, RGB, count (1–10) and that this list is complete.
Apple only *requires* the iPhone 6.3" (medium Dynamic Island) and iPad 13" slots (+ Mac for the Mac app); it scales those down for smaller
devices. Retake on the simulators only if App Review asks for real-device captures.

**iPhone 6.9" display (Dynamic Island, large: 16/17/18 Pro Max)** — 2868 × 1320 landscape — optional; Apple uses it for the big phones
- `appstore/screenshots/iphone69/01-moon.jpg` — Shattered Moon: 8 players fight around the central crater monument (224×224 map).
- `appstore/screenshots/iphone69/02-battle.jpg` — Volcano XL battle: USA vs Brazil at 9:00, lava, walls, the whole front on screen.
- `appstore/screenshots/iphone69/03-base.jpg` — A full China base on Iron Crossroads: refinery, harvesters, infantry, walls, defences.
- `appstore/screenshots/iphone69/04-frost.jpg` — Frozen Labyrinth: 8 players meet at the shared core in the ice maze.
- `appstore/screenshots/iphone69/05-title.jpg` — Title screen: IRON FRONT, the 8 playable countries, Tap to deploy.

**iPhone 6.3" display (Dynamic Island, medium: 16/17/18 Pro)** — 2622 × 1206 landscape — **required** iPhone slot
- `appstore/screenshots/iphone63/01-moon.jpg` — Shattered Moon: 8 players fight around the central crater monument (224×224 map).
- `appstore/screenshots/iphone63/02-battle.jpg` — Volcano XL battle: USA vs Brazil at 9:00, lava, walls, the whole front on screen.
- `appstore/screenshots/iphone63/03-base.jpg` — A full China base on Iron Crossroads: refinery, harvesters, infantry, walls, defences.
- `appstore/screenshots/iphone63/04-frost.jpg` — Frozen Labyrinth: 8 players meet at the shared core in the ice maze.
- `appstore/screenshots/iphone63/05-title.jpg` — Title screen: IRON FRONT, the 8 playable countries, Tap to deploy.

**iPad 13" display** — 2752 × 2064 landscape — **required** (the app runs on iPad)
- `appstore/screenshots/ipad13/01-moon.jpg` — Shattered Moon: 8 players fight around the central crater monument (224×224 map).
- `appstore/screenshots/ipad13/02-battle.jpg` — Volcano XL battle: USA vs Brazil at 9:00, lava, walls, the whole front on screen.
- `appstore/screenshots/ipad13/03-base.jpg` — A full China base on Iron Crossroads: refinery, harvesters, infantry, walls, defences.
- `appstore/screenshots/ipad13/04-frost.jpg` — Frozen Labyrinth: 8 players meet at the shared core in the ice maze.
- `appstore/screenshots/ipad13/05-title.jpg` — Title screen: IRON FRONT, the 8 playable countries, Tap to deploy.

**Mac** — 2880 × 1800 (16:10) — **required** for the Mac app
- `appstore/screenshots/mac/01-moon.jpg` — Shattered Moon: 8 players fight around the central crater monument (224×224 map).
- `appstore/screenshots/mac/02-battle.jpg` — Volcano XL battle: USA vs Brazil at 9:00, lava, walls, the whole front on screen.
- `appstore/screenshots/mac/03-base.jpg` — A full China base on Iron Crossroads: refinery, harvesters, infantry, walls, defences.
- `appstore/screenshots/mac/04-frost.jpg` — Frozen Labyrinth: 8 players meet at the shared core in the ice maze.
- `appstore/screenshots/mac/05-title.jpg` — Title screen: IRON FRONT, the 8 playable countries, Tap to deploy.
