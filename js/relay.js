'use strict';
// v7.6.3: WebSocket relay fallback. A Trystero-like strategy ('relay') that carries lobby + lockstep messages through
// public MQTT-over-WebSocket brokers instead of a WebRTC data channel. Used when two players' networks cannot open a
// direct connection (strict/CGNAT routers, VPNs, mobile carriers, UDP blocked) and no TURN relay gets through.
// It connects to several brokers at once and de-duplicates, so one broker being down or slow does not matter.
// Guests stay silent for conf.startDelay ms so a working direct WebRTC connection wins first.
// public:public@ = MQTT username/password (shiftr.io's public instance runs on port 443, so it also gets through strict firewalls)
const RELAY_BROKERS = ['wss://public:public@public.cloud.shiftr.io', 'wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
function mqttWs(url, onMsg, onState) { // minimal MQTT 3.1.1 client over WebSocket, QoS 0 only
  const enc = new TextEncoder(), dec = new TextDecoder(); let ws, buf = new Uint8Array(0), up = false, closed = false, pid = 1, ka = null; const subs = [];
  const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const len = n => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return o; };
  const pkt = (h, body) => { const u = new Uint8Array(1 + len(body.length).length + body.length); const L = len(body.length); u[0] = h; u.set(L, 1); u.set(body, 1 + L.length); return u; };
  const send = u => { try { if (ws && ws.readyState === 1) { ws.send(u); return true; } } catch (e) {} return false; };
  const subscribe = t => { subs.push(t); if (up) send(pkt(0x82, [pid >> 8, pid++ & 255, ...str(t), 0])); };
  const publish = (t, s) => { if (!up) return false; if (typeof globalThis !== 'undefined' && globalThis.__relayDrop && Math.random() < globalThis.__relayDrop) return true; /* test hook: simulated loss */ const p = enc.encode(s), tb = str(t), body = new Uint8Array(tb.length + p.length); body.set(tb); body.set(p, tb.length); return send(pkt(0x30, body)); };
  const parse = () => { for (;;) { if (buf.length < 2) return; let m = 1, n = 0, i = 1, d; do { if (i >= buf.length) return; d = buf[i++]; n += (d & 127) * m; m *= 128; } while (d & 128);
      if (buf.length < i + n) return; const h = buf[0], b = buf.subarray(i, i + n); buf = buf.slice(i + n);
      if ((h & 0xf0) === 0x20) { up = true; for (const t of subs) send(pkt(0x82, [pid >> 8, pid++ & 255, ...str(t), 0])); onState && onState('up'); }
      else if ((h & 0xf0) === 0x30) { const tl = (b[0] << 8) | b[1], t = dec.decode(b.subarray(2, 2 + tl)); let o = 2 + tl; if (h & 6) o += 2; try { onMsg(t, dec.decode(b.subarray(o))); } catch (e) { console.warn('relay msg', e); } } } };
  const cm = /^(wss?:\/\/)([^:@\/]+):([^@\/]*)@(.*)$/.exec(url), user = cm ? decodeURIComponent(cm[2]) : null, pass = cm ? decodeURIComponent(cm[3]) : null, wsUrl = cm ? cm[1] + cm[4] : url;
  const open = () => { if (closed) return; try { ws = new WebSocket(wsUrl, 'mqtt'); } catch (e) { onState && onState('fail'); return; } ws.binaryType = 'arraybuffer';
    ws.onopen = () => { const id = 'if' + Math.random().toString(36).slice(2, 12); const body = user != null ? [...str('MQTT'), 4, 0xc2, 0, 30, ...str(id), ...str(user), ...str(pass)] : [...str('MQTT'), 4, 2, 0, 30, ...str(id)]; send(pkt(0x10, body));
      clearInterval(ka); ka = setInterval(() => send(new Uint8Array([0xc0, 0])), 20000); };
    ws.onmessage = e => { const u = new Uint8Array(e.data), nb = new Uint8Array(buf.length + u.length); nb.set(buf); nb.set(u, buf.length); buf = nb; parse(); };
    ws.onclose = () => { up = false; buf = new Uint8Array(0); clearInterval(ka); onState && onState('down'); if (!closed) setTimeout(open, 3000); };
    ws.onerror = () => {}; };
  open();
  return { subscribe, publish, isUp: () => up, close() { closed = true; clearInterval(ka); try { send(new Uint8Array([0xe0, 0])); ws && ws.close(); } catch (e) {} } };
}
function relayTrystero(brokers) {
  const selfId = Math.random().toString(36).slice(2, 12);
  return { selfId, brokers: brokers || RELAY_BROKERS, state: {}, joinRoom(conf, roomId) {
    const self = this, base = 'ironfront/' + (conf.appId || 'if') + '/' + roomId + '/', acts = {}, peers = {}, room = { onPeerJoin: null, onPeerLeave: null };
    let closed = false, seq = 0, active = !(conf.startDelay > 0);
    // Reliable, ordered delivery on top of QoS-0 MQTT (lockstep needs it, like a WebRTC data channel):
    // each message stream (broadcast '*' or 'p' = to one peer) is numbered; receivers deliver in order, buffer gaps and NACK them; senders keep the last 2000.
    const out = {}, inS = {}; const stream = k => out[k] || (out[k] = { n: 0, buf: new Map() });
    const deliver = m => { const isNew = !peers[m.f]; peers[m.f] = Date.now(); if (isNew && room.onPeerJoin) room.onPeerJoin(m.f);
      if (m.t === 'msg' && acts[m.n] && acts[m.n].onMessage) acts[m.n].onMessage(m.d, { peerId: m.f }); };
    const nack = st => { st.timer = null; if ((!st.pend.size && !(st.hi >= st.exp)) || closed) return; if (Date.now() - st.gapT > 15000) { st.exp = Math.min(...st.pend.keys()); st.gapT = Date.now(); drain(st); if (!st.pend.size) { st.hi = 0; return; } } // give up on a gap that has not moved for 15 s
      const top = Math.max(st.hi || 0, ...st.pend.keys()) + (st.pend.has(st.hi) ? 0 : 1), l = []; for (let i = st.exp; i < top && l.length < 300; i++) if (!st.pend.has(i)) l.push(i);
      post({ t: 'nack', to: st.f, k: st.k, l }); st.timer = setTimeout(() => nack(st), 500); };
    const drain = st => { while (st.pend.has(st.exp)) { const m = st.pend.get(st.exp); st.pend.delete(st.exp); st.exp++; st.gapT = Date.now(); deliver(m); } if (!st.pend.size && !(st.hi >= st.exp)) { clearTimeout(st.timer); st.timer = null; } };
    const onSeq = m => { const key = m.f + '|' + m.k; let st = inS[key]; if (!st) st = inS[key] = { f: m.f, k: m.k, exp: m.k === 'p' ? 1 : m.s, pend: new Map(), timer: null, gapT: 0 };
      if (m.s < st.exp || st.pend.has(m.s)) return; if (m.s === st.exp) { st.exp++; st.gapT = Date.now(); deliver(m); drain(st); return; }
      st.pend.set(m.s, m); if (!st.timer) { if (!st.gapT) st.gapT = Date.now(); st.timer = setTimeout(() => nack(st), 300); } };
    const onMsg = (topic, s) => { if (closed || !active) return; let m; try { m = JSON.parse(s); } catch (e) { return; } if (!m || m.f === selfId || (m.to && m.to !== selfId)) return;
      if (m.t === 'bye') { if (peers[m.f]) { delete peers[m.f]; room.onPeerLeave && room.onPeerLeave(m.f); } return; }
      if (m.t === 'nack') { const o = out[m.k === '*' ? '*' : m.f]; if (o) for (const i of (m.l || []).slice(0, 300)) { const r = o.buf.get(i); if (r) pub(base + 'p/' + m.f, r); } return; }
      if (m.s != null) { onSeq(m); return; }
      if (m.w != null && !inS[m.f + '|*']) inS[m.f + '|*'] = { f: m.f, k: '*', exp: m.w + 1, pend: new Map(), timer: null, gapT: 0 };
      // tail-loss detection: hb/hi carry the sender's latest seq for '*' (w) and for its stream to us (pw[selfId])
      const tail = (k, n) => { const st = inS[m.f + '|' + k]; if (n == null) return; if (!st) { if (k === 'p' && n > 0) { inS[m.f + '|p'] = { f: m.f, k: 'p', exp: 1, pend: new Map(), timer: null, gapT: Date.now(), hi: n }; tail2(inS[m.f + '|p']); } return; } if (n >= st.exp) { st.hi = Math.max(st.hi || 0, n); tail2(st); } };
      const tail2 = st => { if (!st.timer) { if (!st.gapT) st.gapT = Date.now(); st.timer = setTimeout(() => nack(st), 300); } };
      if (m.t === 'hb' || m.t === 'hi') { tail('*', m.w); tail('p', m.pw && m.pw[selfId]); }
      const isNew = !peers[m.f]; peers[m.f] = Date.now(); if (isNew && room.onPeerJoin) room.onPeerJoin(m.f);
      if (m.t === 'hi') post({ t: 'hb', to: m.f }); };
    const cons = self.brokers.map(u => mqttWs(u, onMsg, st => { self.state[u] = st; if (st === 'up' && active && !closed) post({ t: 'hi' }); }));
    cons.forEach(c => { c.subscribe(base + 'all'); c.subscribe(base + 'p/' + selfId); });
    const pub = (t, str) => { let ok = false; for (const c of cons) ok = c.publish(t, str) || ok; return ok; };
    const post = m => { if (closed && m.t !== 'bye') return; m.f = selfId; m.i = ++seq; if (m.t === 'hi' || m.t === 'hb') { m.w = out['*'] ? out['*'].n : 0; m.pw = {}; for (const k in out) if (k !== '*') m.pw[k] = out[k].n; } if (m.t === 'msg') { const k = m.to ? m.to : '*', o = stream(k); m.k = m.to ? 'p' : '*'; m.s = ++o.n; const str = JSON.stringify(m); o.buf.set(m.s, str); if (o.buf.size > 2000) o.buf.delete(o.buf.keys().next().value); return pub(base + (m.to ? 'p/' + m.to : 'all'), str); }
      return pub(base + (m.to ? 'p/' + m.to : 'all'), JSON.stringify(m)); };
    const go = () => { if (closed) return; active = true; post({ t: 'hi' }); };
    if (!active) setTimeout(go, conf.startDelay);
    const iv = setInterval(() => { if (closed || !active) return; post({ t: 'hb' }); for (const p in peers) if (Date.now() - peers[p] > 12000) { delete peers[p]; room.onPeerLeave && room.onPeerLeave(p); } }, 2000);
    if (typeof addEventListener === 'function') addEventListener('pagehide', () => { if (!closed && active) post({ t: 'bye' }); });
    room.makeAction = n => (acts[n] = { onMessage: null, send: (d, o) => post({ t: 'msg', n, d, to: o && o.target }) });
    room.getPeers = () => Object.assign({}, peers); room.brokersUp = () => cons.filter(c => c.isUp()).length;
    room.activate = go; room.isActive = () => active;
    room.leave = () => { if (closed) return; if (active) post({ t: 'bye' }); closed = true; clearInterval(iv); for (const k in inS) clearTimeout(inS[k].timer); setTimeout(() => cons.forEach(c => c.close()), 200); };
    return room; } };
}
if (typeof module !== 'undefined') module.exports = { mqttWs, relayTrystero, RELAY_BROKERS };
