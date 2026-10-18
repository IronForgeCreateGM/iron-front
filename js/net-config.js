// Optional online-play configuration (edit before publishing if needed).
// relayUrls: Nostr relays used only for matchmaking/signalling (game data is P2P WebRTC).
// turnConfig: add a TURN server if players behind strict NATs/corporate firewalls cannot connect.
window.IRONFRONT_NET = window.IRONFRONT_NET || {
  appId: 'ironfront-rts-v4',
  relayUrls: ['wss://nos.lol', 'wss://nostr.mom', 'wss://relay.damus.io', 'wss://relay.primal.net'], // v5.9.1: pinned, known-good relays (Trystero defaults were flaky)
  // v5.7.3: free public TURN fallback (Open Relay Project) for strict NATs; used only if a direct connection fails.
  turnConfig: [{ urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }],
};
