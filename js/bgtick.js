// v7.9.20 online polish: a timer that keeps running in a hidden tab (IF_TICK.every(fn, ms) -> { stop() }).
// Browsers throttle setInterval in a hidden tab to once a second and, after ~5 minutes hidden, to once a MINUTE ("intensive throttling"; WebRTC
// connections are exempt, a relay-only WebSocket connection is not). A host on a desktop tab you switched away from then stopped sending
// turns, the relay heartbeat/keep-alive went quiet, and every guest froze or dropped. A dedicated Worker's timer is not throttled, so one tiny
// inline Worker ticks every 100 ms and calls every registered function when it is due. No Worker (or it fails to start) -> a plain setInterval.
(function (W) {
  const subs = []; let wk = null, iv = null, fallbackOn = false;
  function pump() { const now = (W.performance || Date).now(); for (const s of subs.slice()) if (!s.dead && now - s.last >= s.ms - 8) { s.last = now; try { s.fn(); } catch (e) { if (W.console) console.warn('[bgtick]', e && e.message); } } }
  function fallback() { if (wk) { try { wk.terminate(); } catch (e) {} wk = null; } if (!iv) { iv = setInterval(pump, 100); fallbackOn = true; } }
  function start() { if (wk || iv) return; let ok = false;
    try { if (typeof W.Worker === 'function' && typeof W.Blob === 'function' && W.URL && W.URL.createObjectURL && !(W.location && /[?&]bgtick=0/.test(W.location.search))) {
      const u = W.URL.createObjectURL(new W.Blob(['setInterval(function(){postMessage(1)},100)'], { type: 'text/javascript' })); wk = new W.Worker(u); try { W.URL.revokeObjectURL(u); } catch (e) {}
      wk.onmessage = pump; wk.onerror = () => fallback(); ok = true; } } catch (e) { ok = false; }
    if (!ok) fallback(); }
  W.IF_TICK = { every(fn, ms) { const s = { fn, ms: Math.max(100, ms | 0), last: (W.performance || Date).now(), dead: false }; subs.push(s); start(); return { stop() { s.dead = true; const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); } }; },
    mode() { return wk ? 'worker' : iv ? 'interval' : 'idle'; }, count() { return subs.length; } };
})(typeof window !== 'undefined' ? window : globalThis);
