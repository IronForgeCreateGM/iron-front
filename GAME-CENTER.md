# Game Center Quick Match (iPhone app) — v7.7.7

**Status:** the game side is done and tested in `js/quickmatch.js` and `test/quickmatch-test.js`, using a fake Game Center that matches 3 browser "phones". The native Swift bridge is written in `ios-plugin/` but has **not been compiled or run yet**. There is no `ios/` Xcode project in the repo, so the bridge needs your Mac and two real iPhones. The web version is unchanged: the Quick Match button only shows inside the iPhone app.

## What the player sees
The Online menu shows one button, **⚡ Quick Match (Game Center)**. When a player taps it:
1. Game Center signs them in. Apple shows its own sheet the first time.
2. Game Center looks for 2-8 players on the **same game version**.
3. When 2 or more are found, a **30-second countdown** starts. More players can still join during it, and the screen shows how many Hard bots will fill the empty seats.
4. The match starts when the countdown ends or 8 players have joined:
   - 2-4 players: the "classic" map with 4 seats.
   - 5-8 players: Volcano with 8 seats.
   - It's free-for-all. Empty seats become **Hard** bots.
5. If someone leaves:
   - **Before the start:** a new host is picked automatically and the countdown gets 10 extra seconds. If only one player is left, the game goes back to searching.
   - **A player leaves during the match:** a bot takes over their seat. This is the same as room games.
   - **The host leaves during the match:** everyone else keeps playing offline against bots. This is also the same as room games.

**Security:** every message from another phone goes through the same v7.7.6 checks as room games: size caps, rate limits, host-only messages, and start/command validation.

**Privacy:** Game Center connects phones peer-to-peer, and Apple's relay servers are used when a direct connection isn't possible. The game never sees anyone's IP address. However, Apple does not promise a relay-only connection, so the "hide my IP" option from room games can't be guaranteed here.

## Your steps (Mac + Xcode)
1. **Create the iOS project** (one time). In the repo folder run:
   `npm install`, then `npm run cap:add:ios`, then `npm run cap:sync`
2. Run `npm run cap:open` to open Xcode.
3. **Add the plugin files:**
   - Drag `ios-plugin/IronGameCenterPlugin.swift` and `ios-plugin/IronViewController.swift` into the **App** group in Xcode.
   - Tick "Copy items if needed" and target **App**.
4. **Point the app at the new controller:**
   - Open `App/Main.storyboard` and select the *Bridge View Controller*.
   - In the Identity inspector, set **Custom Class** to `IronViewController` and Module to `App`.
5. **Turn on Game Center in Xcode:**
   - Click the App target, then **Signing & Capabilities**.
   - Pick your Team.
   - Click **+ Capability**, then **Game Center**.
6. **Turn on Game Center in App Store Connect:**
   - Open **App Store Connect → Apps → Iron Front** (bundle id `com.ironfront.rts`).
   - Under the app's **Game Center** section, make sure Game Center is enabled. No leaderboards or achievements are needed.
   - If the app record doesn't exist yet, create it first with that bundle id.
   - In the Apple Developer site under Identifiers, check that `com.ironfront.rts` has Game Center ticked. It usually turns on automatically in step 5.
7. **Make test accounts.** You need two different Apple IDs, one per iPhone. Sandbox testers from App Store Connect → Users and Access → Sandbox work, as do two real Apple IDs. On each phone, sign in under **Settings → Game Center**.
8. **Build to both iPhones** from Xcode, or use TestFlight.

## What needs two real iPhones (the simulator can't do real matchmaking)
Test each of these on both phones:
- [ ] Both phones tap Quick Match and find each other. The countdown shows on both and says "2 players found · starting in …s · 2 Hard bots fill the empty seats".
- [ ] The match starts on the same map with the same players on both phones. Play 2-3 minutes with no "desync" message.
- [ ] Close the app on the **guest** mid-match. The host should see "… disconnected — AI takes over".
- [ ] Close the app on the **host** mid-match. The guest should see "Host disconnected — continuing offline vs AI".
- [ ] Tap Cancel during the countdown. The other phone goes back to "looking for more players…".
- [ ] Background the app for 10 s mid-match and come back. Note what happens; GKMatch may drop the player, and that's OK as long as nothing breaks.
- [ ] With a 3rd phone, if you have one: join during a countdown that's already running.
- [ ] Both phones must be on the same app build. Different builds never get matched, by design.

If something fails, tell me what the screen said. Most native issues will be in `ios-plugin/IronGameCenterPlugin.swift`.
