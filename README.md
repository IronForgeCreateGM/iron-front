# Iron Front — browser RTS (v4.1)

Original real-time strategy game in plain HTML5/WebGL (Three.js vendored). No build step.

## Play offline
Open `index.html` in Chrome or Safari (double-click works — no server needed).
Pick a preset or set up to 4 slots (Human / Chief SI / Chief / Easy / Medium / Hard / Closed), teams, factions and colours (Blue, Red, Yellow, Green), then **DEPLOY**.

## Play online with friends
Online play is peer-to-peer (WebRTC). Matchmaking/signalling uses public Nostr relays via the vendored
[Trystero](https://github.com/dmotz/trystero) library; no game server is needed. It must be served over **https**
(e.g. GitHub Pages) — `file://` pages cannot reliably reach peers.

1. Everyone opens the **same published URL** (same version — the lobby rejects mismatched builds).
2. Host: click **Play Online**, type a name, click **🌐 Host online game**. A room code and a share link (`…/index.html?room=ABCDE`) appear.
3. Host sets the slots (up to 8 on *Volcano Crown XL (4v4)*): `Human (you)` for themself, `Human (remote)` for each friend, AI types or `Closed` for the rest; teams, factions, colours.
4. Friends open the share link (or type the code and click **Join**). They are auto-seated in the next `Human (remote)` slot, can pick their faction (faction cards), and press **Ready**. Lobby chat is available.
5. When all remote players are ready, the host clicks **START ONLINE**.

In game (v5.5 netcode): deterministic lockstep through the host. Input delay adapts per player from measured
ping (≈100–150 ms on good links, more for a far-away player only as much as needed); inputs and turns are batched
(about half the messages of v5.4) and the game speeds up/slows down slightly to absorb jitter instead of freezing.
If a player lags, everyone sees “Waiting for …”; after 20 s of silence the host gives that slot to AI. A player who
disconnects can **re-open the room link** during the match to take their slot back (the game is re-simulated to the
present on their machine). A state hash is compared every second; on a mismatch the host automatically resyncs that
player from the command log. If the host disconnects, the others continue offline against AI. For 4+ players, let
the player with the best connection host. Pause (Esc) opens the menu without pausing others; it also has **Surrender**.

Troubleshooting: if friends can't connect (strict NAT / corporate firewall), add a TURN server in `js/net-config.js`
(`turnConfig`). You can also choose other Nostr relays there (`relayUrls`) or via the URL: `?room=CODE&relays=nos.lol,relay.damus.io`.
Local test without network: open two tabs of the same served page with `?transport=local` (BroadcastChannel).

## Publish on GitHub Pages
The repo root is the site root (`index.html`, relative paths, `.nojekyll`). Steps:
1. Create a GitHub repository and push this folder (`git remote add origin … && git push -u origin main`).
2. Repository → Settings → Pages → *Deploy from a branch* → `main` / `(root)` → Save.
3. Share `https://<user>.github.io/<repo>/` (after the first deploy, ~1 min).
The `test/` folder is harmless on Pages; delete it from a release branch if you prefer.

## Tests (node 20+)
- `node test/sim-test.js` — headless sims incl. Easy first-attack ≥ 8 min check
- `node test/net-test.js [minutes]` — lockstep determinism (multi-peer fake transport, replay ×2, disconnect, negative control)
- `node --experimental-websocket test/online-e2e.js` with `MODE=local` — two real Chrome tabs through the online lobby
- `bash test/batch.sh si 10` — Chief SI vs Hard win rate

## 📱 Mobile (v6.1)
Phones are auto-detected (coarse pointer + small screen); toggle with **📱 Touch controls** on the home screen (or `?mobile=1` / `?mobile=0`). Play in landscape.
- **Camera:** drag empty ground to pan (with glide), pinch to zoom, tap the minimap to jump.
- **Build:** the card bar at the bottom has tabs 🏗 Structures, 🛡 Defenses, 🪖 Infantry, 🚙 Vehicles, ✈ Aircraft. Tap a card to build or queue it. When a structure is finished, a ghost appears: drag it to a green spot, then tap ✓ (✗ cancels). For walls, tap the Wall card, drag a line on the ground, then tap ✗ when done. Long-press a card for its info; long-press a queued card to cancel one.
- **Army:** tap a unit to select it, and double-tap to select every unit of that type on screen. Buttons: ⚔ Army, 💤 Idle, 👥 Type, ⬚ Box (drag to box-select). Tap the ground to attack-move there; tap an enemy to attack it. ✋ Stop, ⚓ Hold, 🏠 Home (retreat), 🚩 Rally (then tap the ground).
- **🤖 Helpers** (on by default, all toggleable; they only give orders to your own units): auto-rebuild lost harvesters, new units go to the rally point, idle units engage nearby enemies, optional auto-repair, and ⚡ +Power (one tap builds and places a Power Plant when power is low).
- Can be installed to the Home Screen (PWA manifest). Online play: if iOS drops the connection while the app is in the background, tap **Rejoin** within ~20 s to get your seat back.
