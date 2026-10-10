'use strict';
// ===== Synthesized sound effects (WebAudio, no assets) =====
const AU = { ctx: null, last: {}, muted: false, vol: 0.45 };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; AU.ctx = new C();
    AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.vol;
    const comp = AU.ctx.createDynamicsCompressor(); AU.master.connect(comp); comp.connect(AU.ctx.destination);
    const len = AU.ctx.sampleRate; AU.noise = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate); const d = AU.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AU.ctx = null; }
}
function _env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function _noise(t, dur, type, f0, f1, peak, q) {
  const c = AU.ctx, s = c.createBufferSource(); s.buffer = AU.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); if (q) f.Q.value = q;
  const g = c.createGain(); _env(g, t, 0.005, peak, dur); s.connect(f); f.connect(g); g.connect(AU.bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function _tone(t, type, f0, f1, dur, peak) {
  const c = AU.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); _env(g, t, 0.005, peak, dur); o.connect(g); g.connect(AU.bus); o.start(t); o.stop(t + dur + 0.05);
}
function sfx(name, x, y) {
  if (!AU.ctx || AU.muted || typeof R3 === 'undefined') return;
  const now = AU.ctx.currentTime; if (AU.last[name] && now - AU.last[name] < 0.06) return; AU.last[name] = now;
  let v = 1; if (x != null) { const d = Math.hypot(x - R3.cam.x, y - R3.cam.y - 4); v = Math.max(0, 1 - d / 28); if (v < 0.05) return; }
  AU.bus = AU.ctx.createGain(); AU.bus.gain.value = v; AU.bus.connect(AU.master);
  const t = now;
  switch (name) {
    case 'rifle': _noise(t, 0.06, 'highpass', 1800, 0, 0.35); break;
    case 'cannon': _noise(t, 0.35, 'lowpass', 900, 150, 0.8); _tone(t, 'sine', 110, 40, 0.3, 0.6); break;
    case 'arty': _noise(t, 0.5, 'lowpass', 600, 100, 0.9); _tone(t, 'sine', 70, 30, 0.45, 0.7); break;
    case 'rocket': _noise(t, 0.4, 'bandpass', 2500, 400, 0.5, 2); break;
    case 'flak': _noise(t, 0.08, 'bandpass', 900, 0, 0.5, 1); _noise(t + 0.09, 0.08, 'bandpass', 800, 0, 0.4, 1); break;
    case 'boom': _noise(t, 0.6, 'lowpass', 900, 120, 0.8); break;
    case 'boomBig': _noise(t, 1.3, 'lowpass', 700, 60, 1.0); _tone(t, 'sine', 60, 25, 1.0, 0.8); break;
    case 'die': _noise(t, 0.12, 'bandpass', 600, 300, 0.25, 1); break;
    case 'click': _tone(t, 'square', 900, 0, 0.03, 0.15); break;
    case 'error': _tone(t, 'square', 180, 140, 0.18, 0.2); break;
    case 'place': _tone(t, 'sine', 160, 60, 0.3, 0.6); _noise(t, 0.3, 'lowpass', 500, 0, 0.3); break;
    case 'ready': _tone(t, 'sine', 660, 0, 0.12, 0.3); _tone(t + 0.13, 'sine', 990, 0, 0.18, 0.3); break;
    case 'unit': _tone(t, 'triangle', 520, 780, 0.15, 0.25); break;
    case 'ack': _tone(t, 'triangle', 700, 900, 0.06, 0.18); break;
    case 'alert': _tone(t, 'sawtooth', 440, 0, 0.15, 0.15); _tone(t + 0.2, 'sawtooth', 440, 0, 0.15, 0.15); break;
  }
}
