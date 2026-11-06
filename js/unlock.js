'use strict';
// ===== v7.8.5 Full Unlock ($4.99 one-time) — free countries always; locked countries need Full Unlock =====
// Free: USA, Russia, Germany, France. Locked: Brazil, Iran, China, Japan.
// Only the human "You" faction pick is gated. Bots, watch, FFA opponents, and remotes may use any country.
// Native StoreKit fills window.IronIAP later; web shows App Store price (no fake charges). QA: ?unlock=1 / ?unlock=0.
const UNLOCK_LS = 'if_full_unlock';
const UNLOCK_PRICE = '$4.99';
const UNLOCK_FREE = ['usa', 'rus', 'ger', 'fra'];
const UNLOCK_LOCKED = ['bra', 'irn', 'chn', 'jpn'];
const UNLOCK = { owned: false, ready: false, price: UNLOCK_PRICE };

function unlockIsNative() {
  try {
    const C = window.Capacitor;
    return !!(C && (typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : C.isNative));
  } catch (e) { return false; }
}
function unlockReadLS() { try { return localStorage.getItem(UNLOCK_LS) === '1'; } catch (e) { return false; } }
function unlockWriteLS(on) {
  try { if (on) localStorage.setItem(UNLOCK_LS, '1'); else localStorage.removeItem(UNLOCK_LS); } catch (e) {}
}
async function unlockPrefsGet() {
  try {
    const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;
    if (!P || typeof P.get !== 'function') return null;
    const r = await P.get({ key: UNLOCK_LS });
    return r && (r.value === '1' || r.value === 'true');
  } catch (e) { return null; }
}
async function unlockPrefsSet(on) {
  try {
    const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;
    if (!P) return;
    if (on && typeof P.set === 'function') await P.set({ key: UNLOCK_LS, value: '1' });
    else if (!on && typeof P.remove === 'function') await P.remove({ key: UNLOCK_LS });
  } catch (e) {}
}
function unlockOwned() { return !!UNLOCK.owned; }
function unlockFacLocked(id) { return UNLOCK_LOCKED.indexOf(id) >= 0; }
function unlockFacFree(id) { return UNLOCK_FREE.indexOf(id) >= 0; }
/** Human "You" may pick this faction? Bots always yes (pass forHuman=false). */
function unlockFacOk(id, forHuman) {
  if (!id || id === 'rand') return true;
  if (!forHuman) return true;
  if (unlockOwned()) return true;
  return unlockFacFree(id);
}
function unlockFacPool(forHuman) {
  if (!forHuman || unlockOwned()) return (typeof FAC_KEYS !== 'undefined' ? FAC_KEYS.slice() : UNLOCK_FREE.concat(UNLOCK_LOCKED));
  return UNLOCK_FREE.slice();
}
function unlockSetOwned(on, persist) {
  UNLOCK.owned = !!on;
  if (persist !== false) { unlockWriteLS(UNLOCK.owned); unlockPrefsSet(UNLOCK.owned); }
  if (typeof unlockRefreshUI === 'function') unlockRefreshUI();
}
function unlockGrantQA() { unlockSetOwned(true, true); }
function unlockClearQA() { unlockSetOwned(false, true); }

// Bridge the future Swift StoreKit plugin fills. Web never charges.
if (!window.IronIAP) {
  window.IronIAP = {
    async getStatus() { return { owned: unlockOwned(), price: UNLOCK_PRICE, productId: 'ironfront_full_unlock' }; },
    async purchase() {
      if (unlockOwned()) return { ok: true, owned: true, already: true };
      if (unlockIsNative()) return { ok: false, owned: false, reason: 'nostore', message: 'In-app purchase is not wired yet. Coming soon on the App Store.' };
      return { ok: false, owned: false, reason: 'appstore', message: 'Full Unlock ($4.99 one-time) is available on the App Store.' };
    },
    async restore() {
      try {
        if (typeof window.IronIAP._nativeRestore === 'function') {
          const r = await window.IronIAP._nativeRestore();
          if (r && r.owned) unlockSetOwned(true, true);
          return { owned: unlockOwned(), restored: !!(r && r.owned) };
        }
      } catch (e) {}
      // Web / QA: re-read persistence (no App Store receipt yet)
      const pref = await unlockPrefsGet();
      if (pref === true) unlockSetOwned(true, true);
      else if (unlockReadLS()) unlockSetOwned(true, false);
      return { owned: unlockOwned(), restored: unlockOwned() };
    }
  };
}

function unlockCloseOffer() {
  const el = document.getElementById('unlockOffer');
  if (el) el.style.display = 'none';
}
function unlockOffer(fac) {
  let box = document.getElementById('unlockOffer');
  if (!box) {
    box = document.createElement('div');
    box.id = 'unlockOffer';
    box.className = 'screen';
    box.style.display = 'none';
    box.innerHTML = '<div class="panel set" style="max-width:420px">'
      + '<h2>🔒 Full Unlock</h2>'
      + '<p id="unlockOfferBody" style="font-size:14px;line-height:1.45;margin:8px 0 12px"></p>'
      + '<button id="unlockBuyBtn" class="big">Unlock Full Game — ' + UNLOCK_PRICE + '</button>'
      + '<button id="unlockRestoreBtn">Restore purchases</button>'
      + '<button id="unlockOfferClose">Not now</button>'
      + '</div>';
    document.body.appendChild(box);
    document.getElementById('unlockOfferClose').onclick = unlockCloseOffer;
    document.getElementById('unlockBuyBtn').onclick = () => { unlockPurchase(); };
    document.getElementById('unlockRestoreBtn').onclick = () => { unlockRestore(true); };
  }
  const F = (typeof FACTIONS !== 'undefined' && fac && FACTIONS[fac]) ? FACTIONS[fac] : null;
  const name = F ? (F.flag + ' ' + F.n) : 'that country';
  const body = document.getElementById('unlockOfferBody');
  const freeList = UNLOCK_FREE.map(k => (FACTIONS && FACTIONS[k] ? FACTIONS[k].flag + ' ' + FACTIONS[k].n : k)).join(', ');
  const lockedList = UNLOCK_LOCKED.map(k => (FACTIONS && FACTIONS[k] ? FACTIONS[k].flag + ' ' + FACTIONS[k].n : k)).join(', ');
  let msg = `<b>${name}</b> is part of Full Unlock (${UNLOCK_PRICE} one-time, no subscription).`;
  msg += `<br><br>Free countries: ${freeList}.`;
  msg += `<br>Full Unlock also adds: ${lockedList}.`;
  if (!unlockIsNative()) msg += `<br><br>On the web this build does not charge — Full Unlock is sold on the <b>App Store</b>. Use <code>?unlock=1</code> on this device for QA.`;
  else msg += `<br><br>One purchase unlocks every country and every map on this Apple ID.`;
  if (body) body.innerHTML = msg;
  box.style.display = 'flex';
}
async function unlockPurchase() {
  const btn = document.getElementById('unlockBuyBtn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  let r = { ok: false, reason: 'appstore' };
  try { r = await window.IronIAP.purchase(); } catch (e) { r = { ok: false, reason: 'error', message: String(e && e.message || e) }; }
  if (r && r.owned) unlockSetOwned(true, true);
  if (btn) { btn.disabled = false; btn.textContent = 'Unlock Full Game — ' + UNLOCK_PRICE; }
  if (r && r.ok && r.owned) {
    unlockCloseOffer();
    if (typeof uiMsgMenu === 'function') uiMsgMenu('Full Unlock restored on this device.');
    else if (typeof uiMsg === 'function') uiMsg('Full Unlock owned');
    return;
  }
  const why = (r && r.message) || (r && r.reason === 'appstore'
    ? ('Full Unlock (' + UNLOCK_PRICE + ' one-time) is available on the App Store.')
    : 'Purchase unavailable right now.');
  const body = document.getElementById('unlockOfferBody');
  if (body) {
    const note = document.createElement('p');
    note.style.cssText = 'font-size:13px;opacity:.9;margin:8px 0 0;color:#ffd27a';
    note.textContent = why;
    body.appendChild(note);
  } else if (typeof uiMsgMenu === 'function') uiMsgMenu(why);
}
async function unlockRestore(fromOffer) {
  let r = { owned: false };
  try { r = await window.IronIAP.restore(); } catch (e) {}
  if (r && r.owned) unlockSetOwned(true, true);
  const msg = unlockOwned()
    ? 'Full Unlock is active on this device.'
    : (unlockIsNative()
      ? 'No Full Unlock found for this Apple ID.'
      : 'No Full Unlock on this device. On the web, use ?unlock=1 for QA, or buy on the App Store.');
  if (typeof uiMsgMenu === 'function') uiMsgMenu(msg);
  else if (typeof uiMsg === 'function') uiMsg(msg);
  if (fromOffer && unlockOwned()) unlockCloseOffer();
  unlockRefreshUI();
  return unlockOwned();
}

function unlockMarkFacOptions(sel) {
  if (!sel || !sel.options) return;
  for (const opt of sel.options) {
    const v = opt.value;
    if (!v || v === 'rand') continue;
    const F = typeof FACTIONS !== 'undefined' ? FACTIONS[v] : null;
    if (!F) continue;
    const locked = unlockFacLocked(v) && !unlockOwned();
    const base = F.flag + ' ' + F.n;
    opt.textContent = locked ? ('🔒 ' + base) : base;
  }
}
function unlockRefreshUI() {
  const box = document.getElementById('facs');
  if (box) box.querySelectorAll('.fcard').forEach(c => {
    const f = c.dataset.f, locked = unlockFacLocked(f) && !unlockOwned();
    c.classList.toggle('locked', locked);
    let badge = c.querySelector('.ulock');
    if (locked) {
      if (!badge) { badge = document.createElement('div'); badge.className = 'ulock'; badge.textContent = '🔒'; c.appendChild(badge); }
    } else if (badge) badge.remove();
  });
  document.querySelectorAll('#lobby .lf').forEach(unlockMarkFacOptions);
  const st = document.getElementById('unlockStatus');
  if (st) st.textContent = unlockOwned()
    ? 'Full Unlock: owned on this device'
    : ('Full Unlock: ' + UNLOCK_PRICE + ' one-time (no subscription) — free countries USA · Russia · Germany · France');
  const rb = document.getElementById('unlockRestoreSetBtn');
  if (rb) rb.style.display = '';
}
function unlockGuardHumanFac(fac) {
  if (unlockFacOk(fac, true)) return fac;
  return UNLOCK_FREE[0] || 'usa';
}
/** True if the local human row may start with its chosen faction (or rand). */
function unlockHumanRowOk(row) {
  if (!row || row[0] !== 'human') return true;
  return unlockFacOk(row[2], true);
}

async function unlockBoot() {
  // QA URL overrides (device-local persistence)
  try {
    const qs = (typeof QS !== 'undefined') ? QS : new URLSearchParams(location.search);
    if (qs.get('unlock') === '1') unlockGrantQA();
    else if (qs.get('unlock') === '0') unlockClearQA();
    // Automated tests that pick locked human factions (lobbytest / selftest) grant unlock for this session only
    else if (qs.get('lobbytest') || qs.get('selftest') || qs.get('unlocktest')) {
      /* keep persisted state; tests that need locked human use ?unlock=1 explicitly */
    }
  } catch (e) {}
  let owned = unlockReadLS();
  const pref = await unlockPrefsGet();
  if (pref === true) owned = true;
  else if (pref === false && !unlockReadLS()) owned = false;
  // Prefer IronIAP.getStatus when a native plugin replaced the stub
  try {
    if (window.IronIAP && window.IronIAP !== undefined) {
      const st = await window.IronIAP.getStatus();
      if (st && st.owned) owned = true;
    }
  } catch (e) {}
  UNLOCK.owned = !!owned;
  UNLOCK.ready = true;
  unlockRefreshUI();
}
// Kick off after DOM; QS exists once main.js has parsed (script order: unlock after main? — load unlock BEFORE main so MENU hooks can call it)
// Boot is invoked from main.js DOMContentLoaded and also self-runs if document already ready.
function unlockScheduleBoot() {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { unlockBoot(); });
  else unlockBoot();
}
unlockScheduleBoot();
