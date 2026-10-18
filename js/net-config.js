// Optional online-play configuration (edit before publishing if needed).
// v5.9.2: matchmaking runs over several signalling strategies at once (first that reaches the host wins):
//   strategies: Nostr relays (relayUrls), MQTT brokers (mqttUrls), WebTorrent trackers (trackerUrls). null = Trystero defaults.
//   URL overrides: ?strategies=nostr,mqtt  ?relays=…  ?mqtt=…  ?trackers=…  ?turn=turn:HOST:PORT,USER,PASS
// relayUrls: Nostr relays used only for matchmaking/signalling (game data is P2P WebRTC).
// turnConfig: add a TURN server if players behind strict NATs/corporate firewalls cannot connect.
window.IRONFRONT_NET = window.IRONFRONT_NET || {
  appId: 'ironfront-rts-v4',
  strategies: ['nostr', 'mqtt', 'torrent'],
  mqttUrls: null, // Trystero defaults: broker.emqx.io, public.cloud.shiftr.io, broker.hivemq.com, test.mosquitto.org
  trackerUrls: null, // Trystero defaults: open.ftorrent.com, tracker.webtorrent.dev, tracker.openwebtorrent.com, …
  relayUrls: ['wss://nos.lol', 'wss://nostr.mom', 'wss://relay.damus.io', 'wss://relay.primal.net'], // v5.9.1: pinned, known-good relays (Trystero defaults were flaky)
  // TURN relays carry game traffic only when a direct P2P connection is impossible (strict/CGNAT routers, VPNs).
  // v5.9.2 NOTE: the Open Relay public credentials below were discontinued by Metered (sign-up + API key now required) and
  // freestun.net is a best-effort public test server — neither is guaranteed. For reliable play, create a free TURN credential
  // (e.g. Metered 'TURN Server → Credentials', or Cloudflare Realtime TURN) and put it FIRST in this list.
  turnConfig: [
    { urls: ['turn:freestun.net:3478', 'turn:freestun.net:3478?transport=tcp'], username: 'free', credential: 'free' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};
