// v7.9.11 App Store guideline 1.2 (user-generated content) for the online lobby chat:
//  - word filter: insults/slurs are masked (f***) on every line shown, and the host filters before relaying
//  - per-player mute: the 🔇 button on a chat line hides that player's messages (saved on this device)
//  - chat on/off: the 💬 button turns lobby chat off entirely (OFF by default in the App Store app, ON on the web)
//  - report: the ⚑ Report link opens the support page's "Report a player" section
// Pure helpers (chatFilter / chatIsBad) run in node too (test/chatsafe-test.js). No sim/AI/net-protocol change.
const CHAT_SUB = ['fuck', 'fck', 'cunt', 'nigg', 'niga', 'fagot', 'faggot', 'whore', 'bitch', 'motherf', 'kike', 'retard', 'asshole', 'shit', 'pussy', 'wanker', 'tranny', 'wetback', 'cocksuck', 'dickhead', 'bullshit', 'jackass', 'dumbass', 'slut'];
const CHAT_EXACT = ['fuk', 'fuks', 'fuking', 'fukin', 'fuker', 'ass', 'arse', 'dick', 'dicks', 'cock', 'cocks', 'tits', 'titties', 'twat', 'wank', 'jizz', 'cum', 'porn', 'rape', 'raped', 'rapist', 'raping', 'spic', 'chink', 'gook', 'dyke', 'fag', 'fags', 'kys', 'nazi', 'nazis', 'hitler', 'bastard', 'bastards', 'prick', 'stfu', 'gtfo', 'wtf', 'milf', 'coon', 'homo'];
const CHAT_OK = ['scunthorpe', 'shitake', 'shiitake', 'snigger', 'sniggers', 'sniggering', 'retardant', 'retardants', 'cocktail', 'cocktails', 'cockpit', 'cockpits', 'assess', 'assessed', 'assessment', 'passes', 'classes', 'masses', 'bypasses', 'glasses', 'fukushima', 'therapist', 'grape', 'drape', 'scrape', 'cumulative', 'document', 'circumstance', 'dickens', 'dickson', 'hancock', 'peacock', 'woodcock', 'shuttlecock', 'hitchcock', 'babcock', 'cockatoo', 'cockroach', 'titanic', 'titan', 'titans', 'homogeneous', 'raccoon', 'raccoons', 'cocoon', 'spicy', 'arsenal', 'nazir'];
const CHAT_LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '€': 'e' };
function chatNorm(w) { let s = String(w).toLowerCase().replace(/[0-9@$!|+€]/g, c => CHAT_LEET[c] || c).replace(/[^a-z]/g, ''); return s; }
function chatIsBad(w) {
  const n = chatNorm(w); if (!n || CHAT_OK.includes(n)) return false;
  const c = n.replace(/(.)\1+/g, '$1'); // fuuuck -> fuck, shiiit -> shit
  for (const v of [n, c]) {
    if (CHAT_EXACT.includes(v) || CHAT_EXACT.includes(v.replace(/s$/, ''))) return true;
    for (const b of CHAT_SUB) if (v.includes(b) || v.includes(b.replace(/(.)\1+/g, '$1'))) return true;
  }
  return false;
}
function chatFilter(t) {
  t = String(t == null ? '' : t);
  // words (letters, digits and the usual look-alike symbols); spaced/dotted spellings like "f u c k" / "f.u.c.k" are joined first
  t = t.replace(/\b(?:[A-Za-z0-9@$](?:[ ._\-*]+|$)){3,}/g, run => { const j = run.replace(/[ ._\-*]+/g, ''); return chatIsBad(j) ? j[0] + '*'.repeat(Math.max(2, j.length - 1)) + (/\s$/.test(run) ? ' ' : '') : run; });
  return t.replace(/[A-Za-z0-9@$!|+€']+/g, w => chatIsBad(w) ? w[0] + '*'.repeat(Math.max(2, w.length - 1)) : w);
}
// ---- browser-side settings (localStorage) ----
const CHAT = { muted: null };
function chatStore() { try { return window.localStorage; } catch (e) { return null; } }
function chatNative() { try { return typeof unlockIsNative === 'function' && !!unlockIsNative(); } catch (e) { return false; } }
function chatEnabled() { const ls = chatStore(), v = ls && ls.getItem('if_chat'); if (v === 'on') return true; if (v === 'off') return false; return !chatNative(); }
function chatSetEnabled(on) { const ls = chatStore(); if (ls) ls.setItem('if_chat', on ? 'on' : 'off'); chatApplyUi(); }
function chatMuted() { if (CHAT.muted) return CHAT.muted; let a = []; try { a = JSON.parse((chatStore() || { getItem: () => null }).getItem('if_chatMute') || '[]'); } catch (e) { a = []; } CHAT.muted = new Set(Array.isArray(a) ? a.map(x => String(x).toLowerCase()).slice(0, 60) : []); return CHAT.muted; }
function chatSaveMuted() { const ls = chatStore(); if (ls) ls.setItem('if_chatMute', JSON.stringify([...chatMuted()].slice(-60))); }
function chatIsMuted(name) { return chatMuted().has(String(name || '').toLowerCase()); }
function chatMute(name, on) {
  const k = String(name || '').toLowerCase(); if (!k) return; if (on === false) chatMuted().delete(k); else chatMuted().add(k); chatSaveMuted();
  if (typeof document === 'undefined') return;
  document.querySelectorAll('#chatLog .chatLine').forEach(d => { if (d.dataset.from === k) d.style.display = on === false ? '' : 'none'; });
  chatApplyUi();
}
// adds one line to #chatLog. `from` = sender name for player messages (null for "* system" lines)
function chatAddLine(t, from) {
  const e = typeof document !== 'undefined' && document.getElementById('chatLog'); if (!e) return false;
  if (from != null && (!chatEnabled() || chatIsMuted(from))) return false;
  const d = document.createElement('div'); d.className = 'chatLine';
  if (from != null) {
    d.dataset.from = String(from).toLowerCase();
    const isMe = typeof ONL !== 'undefined' && ONL.name && String(ONL.name).toLowerCase() === d.dataset.from;
    if (!isMe) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chatMute'; b.textContent = '🔇'; b.title = 'Mute ' + chatFilter(from) + ' (hide their messages)'; b.onclick = ev => { ev.stopPropagation(); chatMute(from, true); }; d.appendChild(b); }
  }
  d.appendChild(document.createTextNode(chatFilter(t))); e.appendChild(d); e.scrollTop = 1e9; return true;
}
function chatApplyUi() {
  if (typeof document === 'undefined') return;
  const on = chatEnabled(), tg = document.getElementById('chatToggle'), inp = document.getElementById('chatIn'), log = document.getElementById('chatLog'), mu = document.getElementById('chatMutedN');
  if (tg) { tg.textContent = on ? '💬 Chat on' : '🔕 Chat off'; tg.classList.toggle('off', !on); tg.title = on ? 'Turn lobby chat off (hides all player messages)' : 'Turn lobby chat on'; }
  if (inp) { inp.disabled = !on; inp.placeholder = on ? 'Chat… (Enter) — be kind' : 'Chat is off'; }
  if (log) { log.classList.toggle('chatOff', !on); log.querySelectorAll('.chatLine').forEach(d => { if (d.dataset.from) d.style.display = (on && !chatIsMuted(d.dataset.from)) ? '' : 'none'; }); }
  const n = chatMuted().size; if (mu) { mu.style.display = n ? '' : 'none'; mu.textContent = `Unmute all (${n})`; }
}
function chatInitUi() {
  if (typeof document === 'undefined') return;
  const tg = document.getElementById('chatToggle'); if (tg) tg.onclick = () => chatSetEnabled(!chatEnabled());
  const mu = document.getElementById('chatMutedN'); if (mu) mu.onclick = () => { chatMuted().clear(); chatSaveMuted(); chatApplyUi(); };
  chatApplyUi();
}
if (typeof module !== 'undefined' && module.exports) module.exports = { chatFilter, chatIsBad, chatNorm };
