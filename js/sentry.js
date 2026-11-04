'use strict';
// v7.7.4 crash/error reporting (Sentry). Errors only: no tracing, no session replay, no personal data (sendDefaultPii false,
// no user, no IP (sdk.settings.infer_ip 'never', so Sentry does not take it from the connection either), URLs lose their query strings). The SDK comes from Sentry's CDN and only loads on the live site
// (https://ironforgecreategm.github.io, environment "production"), or on another http(s) host when the page has ?sentry=1
// (environment "dev"). It never loads from file:// (local zip), inside the App Store app, under test automation (navigator.webdriver,
// unless ?sentry=1) or with ?sentry=0. If the CDN or Sentry is blocked or offline, nothing happens and the game is unaffected.
// The private map builder: ?key=... is stripped from every URL and 64-hex hashes are redacted before anything is sent.
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return; // node tests
  const DSN = 'https://d84238c36e8e1add74292236449ab719@o4512368931700736.ingest.us.sentry.io/4512368936484864';
  const SDK = 'https://browser.sentry-cdn.com/11.10.0/bundle.min.js', SRI = 'sha384-O/8YQaGGVy/n9jIUzcOiaiJVm4t5+JMNiK/zOa0fWvlSld+FquXemEcwJxQ3x/Lr';
  const D = window.IF_DIAG = { on: false, ready: false, sent: 0, q: [], recovered() {} };
  let ver = '';
  try {
    const cs = document.currentScript, m = cs && /[?&]v=([\d.]+)/.exec(cs.src); ver = m ? m[1] : '';
    const q = new URLSearchParams(location.search), opt = q.get('sentry'), prod = location.hostname === 'ironforgecreategm.github.io';
    const native = !!(window.Capacitor && (typeof window.Capacitor.isNativePlatform === 'function' ? window.Capacitor.isNativePlatform() : true));
    if (!/^https?:$/.test(location.protocol) || native || opt === '0') return;
    if (opt !== '1' && (!prod || navigator.webdriver)) return;
    D.on = true; D.env = prod ? 'production' : 'dev';
  } catch (e) { return; }
  // errors thrown before the SDK has loaded are kept (max 10) and sent once it is ready
  const early = ev => { if (!D.ready && D.q.length < 10) D.q.push(ev.reason || ev.error || ev.message); };
  addEventListener('error', early); addEventListener('unhandledrejection', early);
  const scrub = s => s
    .replace(/(https?:\/\/[^\s"'?#\\]*)\?[^\s"'#\\]*/g, '$1') // drop query strings (map builder ?key=, room codes, debug flags)
    .replace(/([?&]key=)[^&#\s"'\\]*/gi, '$1[redacted]')
    .replace(/\b[0-9a-f]{64}\b/gi, '[redacted]');
  function ctx() {
    const t = {};
    try {
      if (typeof G !== 'undefined' && G && G.opts) {
        const o = G.opts, cm = o.cmap;
        t.mode = G.replay ? 'replay' : (typeof NET !== 'undefined' && NET.online) ? 'multiplayer' : o.mode === 'endless' ? 'endless' : 'skirmish';
        t.map = o.map === 'custom' ? (cm && /^feat-/.test(cm.id || '') ? cm.id : 'custom') : String(o.map || 'classic'); // private builder maps are only 'custom'
        if (G.spectate) t.spectate = 'yes';
      } else t.mode = 'menu';
      if (typeof ONL !== 'undefined' && ONL && ONL.strategy) { t.mp_transport = ONL.strategy; t.mp_relay = ONL.strategy === 'relay' ? 'yes' : 'no'; }
      if (typeof ERR !== 'undefined' && ERR) t.recovered_errors = String(ERR.n | 0);
    } catch (e) {}
    return t;
  }
  function init() {
    try {
      const S = window.Sentry; if (!S || !S.init) return;
      if (!ver && typeof NET_VERSION !== 'undefined') ver = String(NET_VERSION).replace(/^v/, '');
      S.init({
        dsn: DSN, release: 'iron-front@' + (ver || 'unknown'), environment: D.env,
        sendDefaultPii: false, dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false }, tracesSampleRate: 0, maxBreadcrumbs: 30, allowUrls: [location.origin],
        integrations: defs => defs.filter(i => !/^(Replay|ReplayCanvas|Feedback|BrowserTracing|BrowserSession|Breadcrumbs)$/.test(i.name)).concat(S.breadcrumbsIntegration ? [S.breadcrumbsIntegration({ console: false })] : []),
        beforeBreadcrumb: b => { try { return JSON.parse(scrub(JSON.stringify(b))); } catch (e) { return null; } },
        beforeSend(ev) {
          try {
            if (++D.sent > 25) return null; // per page load cap
            delete ev.user; ev.sdk = Object.assign({}, ev.sdk, { settings: { infer_ip: 'never' } }); if (ev.request) { delete ev.request.cookies; if (ev.request.headers) delete ev.request.headers.Referer; }
            ev.tags = Object.assign({}, ev.tags, ctx());
            return JSON.parse(scrub(JSON.stringify(ev)));
          } catch (e) { return null; }
        }
      });
      D.ready = true; removeEventListener('error', early); removeEventListener('unhandledrejection', early);
      for (const e of D.q.splice(0)) S.captureException(e);
      // the game loop catches its own errors (safeErr in main.js) so they never reach window.onerror; report those too
      D.recovered = (where, e) => { try { if (typeof ERR !== 'undefined' && ERR.n > 5 && (e && e.message || String(e)) === D.lastRec) return; D.lastRec = e && e.message || String(e);
        S.withScope(sc => { sc.setTag('recovered', where); sc.setLevel('warning'); S.captureException(e instanceof Error ? e : new Error(where + ': ' + e)); }); } catch (x) {} };
    } catch (e) {}
  }
  function load() {
    try {
      const s = document.createElement('script'); s.src = SDK; s.crossOrigin = 'anonymous'; s.integrity = SRI; s.async = true;
      s.onload = init; s.onerror = () => { D.on = false; }; // blocked / offline: stay silent
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }
  load();
})();
