// v7.9.13 App Store: external and target="_blank" links inside the app's WKWebView (Capacitor).
// A WKWebView ignores target="_blank" (no new tab), so in the App Store app a privacy/support/report/invite link would do nothing.
// In the app (Capacitor native) every _blank or other-site link goes through IF_LINKS.open():
//   - http(s) pages on another site -> Capacitor Browser plugin (in-app Safari sheet with Done) when it is installed,
//     otherwise a same-window navigation, which Capacitor hands to Safari (the game stays where it was);
//   - the game's own pages (privacy.html, support.html) -> same window; both pages have a "← Back to game" link to index.html.
// The web version is unchanged (links still open new tabs). Loaded by index.html, privacy.html and support.html.
(function () {
  function isApp() { try { const C = window.Capacitor; return !!(C && (typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : C.isNative)); } catch (e) { return false; } }
  function abs(href) { try { return new URL(href, location.href).href; } catch (e) { return ''; } }
  function sameSite(u) { try { return new URL(u).origin === location.origin; } catch (e) { return false; } }
  // v7.9.24: the public web game. In the app the page lives at capacitor://localhost/, which means nothing to a friend,
  // so invite links shared from the app point here instead (the friend can play in Safari/any browser, or type the code in their app).
  const WEB = 'https://ironforgecreategm.github.io/iron-front/';
  function gameUrl() { return isApp() ? WEB : location.origin + location.pathname; }
  const L = window.IF_LINKS = { isApp, WEB, gameUrl, opened: [], open(href) {
    const u = abs(href); if (!u || !/^(https?|capacitor|file|ionic):/i.test(u)) return false;
    const B = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
    if (!sameSite(u) && /^https?:/i.test(u) && B && typeof B.open === 'function') {
      try { const p = B.open({ url: u }); L.opened.push({ how: 'browser', url: u }); if (p && p.catch) p.catch(() => location.assign(u)); return true; } catch (e) {}
    }
    L.opened.push({ how: 'same', url: u }); location.assign(u); return true;
  } };
  document.addEventListener('click', ev => {
    if (ev.defaultPrevented || ev.button > 0 || !isApp()) return;
    const a = ev.target && ev.target.closest && ev.target.closest('a[href]'); if (!a) return;
    const h = a.getAttribute('href') || ''; if (!h || h[0] === '#' || /^(javascript|mailto|tel|data|blob):/i.test(h)) return;
    const u = abs(h), blank = (a.getAttribute('target') || '').toLowerCase() === '_blank';
    if (!blank && sameSite(u)) return; // normal in-app link (e.g. privacy -> support, back to game)
    ev.preventDefault(); L.open(u);
  }, true);
})();
