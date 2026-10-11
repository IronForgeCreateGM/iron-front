// Optional online-play configuration (edit before publishing if needed).
// relayUrls: Nostr relays used only for matchmaking/signalling (game data is P2P WebRTC).
// turnConfig: add a TURN server if players behind strict NATs/corporate firewalls cannot connect.
window.IRONFRONT_NET = window.IRONFRONT_NET || {
  appId: 'ironfront-rts-v4',
  relayUrls: null, // e.g. ['wss://relay.damus.io', 'wss://nos.lol'] — null = Trystero defaults
  turnConfig: null, // e.g. [{ urls: ['turn:turn.example.com:3478'], username: 'u', credential: 'p' }]
};
