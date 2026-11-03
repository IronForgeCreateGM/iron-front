'use strict';
// v7.7.4 anonymous gameplay analytics (PostHog, project "Iron Front"). Only these custom events are sent: menu_view, game_start,
// game_end, mp_connect, each with the game version. No autocapture, no pageviews, no session recording, no exception capture (Sentry
// does errors, js/sentry.js), no person profiles (never identify), no IP (project setting), no names/chat/room codes/saved maps, and
// URLs lose their query strings. Same gating as js/sentry.js: loads only on https://ironforgecreategm.github.io ("production"), or on
// another http(s) host with ?analytics=1 ("dev"); never from file://, inside the App Store app, under test automation, with
// ?analytics=0 or with Do Not Track on. If the CDN or PostHog is blocked or offline, events are dropped silently.
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return; // node tests
  const KEY = 'phc_qpz6k4a4y8EjhsZQFCrKmLBZH7Lfg2DnbvJA7Xzoie8Q', HOST = 'https://us.i.posthog.com';
  const SDK = 'https://cdn.jsdelivr.net/npm/posthog-js@1.445.1/dist/array.js', SRI = 'sha384-p3n9Zwatev83g7Fdq2Onq+/pD9cAfk6ZOUedBycMN438bcWluMlZU36Epky5tiHb';
  const A = window.IF_AN = { on: false, ready: false, q: [], gameStart() {}, gameEnd() {}, mpConnect() {} };
  let ver = '';
  try {
    const cs = document.currentScript, m = cs && /[?&]v=([\d.]+)/.exec(cs.src); ver = m ? m[1] : '';
    const q = new URLSearchParams(location.search), opt = q.get('analytics'), prod = location.hostname === 'ironforgecreategm.github.io';
    const native = !!(window.Capacitor && (typeof window.Capacitor.isNativePlatform === 'function' ? window.Capacitor.isNativePlatform() : true));
    const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
    if (!/^https?:$/.test(location.protocol) || native || opt === '0' || dnt) return;
    if (opt !== '1' && (!prod || navigator.webdriver)) return;
    A.on = true; A.env = prod ? 'production' : 'dev';
  } catch (e) { return; }
  const scrub = s => s
    .replace(/(https?:\/\/[^\s"'?#\\]*)\?[^\s"'#\\]*/g, '$1')
    .replace(/([?&]key=)[^&#\s"'\\]*/gi, '$1[redacted]')
    .replace(/\b[0-9a-f]{64}\b/gi, '[redacted]');
  function send(name, props, beacon) {
    const p = Object.assign({ version: ver || (typeof NET_VERSION !== 'undefined' ? String(NET_VERSION).replace(/^v/, '') : 'unknown'), env: A.env }, props);
    if (!A.ready) { if (A.q.length < 20) A.q.push([name, p]); return; }
    try { window.posthog.capture(name, p, beacon ? { transport: 'sendBeacon' } : undefined); } catch (e) {}
  }
  const DIFF = d => ({ easy: 'Easy', normal: 'Medium', medium: 'Medium', hard: 'Hard', si: 'Hard', si2: 'Hard', chief: 'Hard' })[d] || 'Other';
  function info() {
    const o = G.opts || {}, cm = o.cmap, P = G.players[typeof ME !== 'undefined' ? ME : 0] || {}, pl = G.players.filter(x => !x.horde);
    const ai = [...new Set(pl.filter(x => x.ai).map(x => DIFF(x.diff)))];
    return {
      mode: G.replay ? 'replay' : (typeof NET !== 'undefined' && NET.online) ? 'multiplayer' : o.mode === 'endless' ? 'endless' : G.spectate ? 'spectate' : 'skirmish',
      map: o.map === 'custom' ? (cm && /^feat-/.test(cm.id || '') ? cm.id : 'custom') : String(o.map || 'classic'), // private Map Builder maps are only 'custom'
      difficulty: ai.length === 1 ? ai[0] : ai.length ? 'Mixed' : 'None', faction: String(P.fac || ''),
      player_count: pl.length, human_count: pl.filter(x => !x.ai).length
    };
  }
  let startFor = null, endFor = null;
  A.gameStart = () => { try { startFor = G; endFor = null; send('game_start', info()); } catch (e) {} };
  A.gameEnd = (quit, beacon) => {
    try {
      if (!G || startFor !== G || endFor === G) return; endFor = G; const i = info();
      const res = quit ? 'quit' : G.watch ? 'watched' : G.over === 'victory' ? 'win' : 'loss';
      send('game_end', { result: res, duration_s: Math.round(G.time || 0), difficulty: i.difficulty, faction: i.faction, map: i.map, mode: i.mode, wave: G.end && G.end.wave || undefined }, beacon);
    } catch (e) {}
  };
  A.mpConnect = (ok, transport, reason) => { try { send('mp_connect', { success: !!ok, transport: transport === 'relay' ? 'relay' : 'direct', signalling: transport === 'relay' ? undefined : transport, reason: reason || undefined, role: typeof ONL !== 'undefined' && ONL.host ? 'host' : 'join' }); } catch (e) {} };
  // leaving the page mid-game (Quit to menu reloads the page, closing the tab) = quit
  addEventListener('pagehide', () => { try { if (typeof started !== 'undefined' && started && G && !G.over) A.gameEnd(true, true); } catch (e) {} });
  function init() {
    try {
      const ph = window.posthog; if (!ph || !ph.init) return;
      ph.init(KEY, {
        api_host: HOST, persistence: 'localStorage', person_profiles: 'identified_only', ip: false, respect_dnt: true,
        autocapture: false, capture_pageview: false, capture_pageleave: false, capture_dead_clicks: false, capture_heatmaps: false,
        disable_session_recording: true, capture_exceptions: false, capture_performance: false, disable_surveys: true,
        // hardening: no remote code at all — no site apps, web experiments, toolbar, surveys, recorder or remote-config scripts can load
        disable_external_dependency_loading: true, opt_in_site_apps: false, disable_web_experiments: true, disable_conversations: true, disable_product_tours: true, enable_recording_console_log: false, advanced_disable_flags: true, advanced_disable_feature_flags: true, advanced_disable_decide: true,
        save_referrer: false, property_denylist: ['$referrer', '$referring_domain', '$initial_referrer', '$initial_referring_domain'],
        sanitize_properties(p) { try { delete p.$ip; return JSON.parse(scrub(JSON.stringify(p))); } catch (e) { return {}; } }, // URLs lose query strings and ?key=
        before_send(ev) { try { if (!ev) return ev; delete ev.$set; delete ev.$set_once; if (ev.properties) delete ev.properties.$ip; return JSON.parse(scrub(JSON.stringify(ev))); } catch (e) { return null; } },
        loaded() { A.ready = true; for (const [n, p] of A.q.splice(0)) { try { ph.capture(n, p); } catch (e) {} } }
      });
    } catch (e) {}
  }
  function load() {
    try {
      const s = document.createElement('script'); s.src = SDK; s.crossOrigin = 'anonymous'; s.integrity = SRI; s.async = true;
      s.onload = init; s.onerror = () => { A.on = false; A.q.length = 0; };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }
  addEventListener('load', () => { try { if (!(typeof started !== 'undefined' && started)) send('menu_view', { screen: 'home' }); } catch (e) {} });
  load();
})();
