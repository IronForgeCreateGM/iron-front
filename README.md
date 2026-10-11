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
2. Host: type a name, click **🌐 Host online game**. A room code and a share link (`…/index.html?room=ABCDE`) appear.
3. Host sets the 4 slots: `Human (you)` for themself, `Human (remote)` for each friend, AI types or `Closed` for the rest; teams, factions, colours.
4. Friends open the share link (or type the code and click **Join**). They are auto-seated in the next `Human (remote)` slot, can pick their faction (faction cards), and press **Ready**. Lobby chat is available.
5. When all remote players are ready, the host clicks **START ONLINE**.

In game: the simulation runs in deterministic lockstep (commands execute 4 ticks ≈ 133 ms after you issue them).
If a player lags, everyone sees “Waiting for …”. If a player disconnects, their slot is taken over by a Medium AI;
if the host disconnects, the others continue offline against AI. Pause (Esc) opens the menu without pausing others; it
also has **Surrender**. A state hash is compared every second — a desync shows a warning.

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
