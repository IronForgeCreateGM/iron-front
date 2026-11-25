// v7.9.26 App Store: make the game feel like an app, not a web page, inside the app's WKWebView (iPhone, iPad, Mac).
// In a WKWebView (Capacitor) the browser's own page gestures are still there unless the page turns them off:
//   - right-click / two-finger click on Mac (and iPad with a trackpad) on the menus, side bar or HUD opens the web view's menu
//     (Reload, Back, Inspect Element, Copy Image, Look Up). "Reload" restarts the app mid-match;
//   - long-press on iPhone/iPad (when the touch UI is off, e.g. iPad with a keyboard) brings up the text loupe / image callout;
//   - dragging a flag/icon image drags a ghost copy out of the window (Mac/iPad drag and drop);
//   - trackpad pinch (Mac/iPad) and double-tap zoom the whole page when the touch UI is off (mobile.js only blocks it when it is on).
// In the app only, this file turns those off everywhere except text boxes (player name, room code, chat), which keep
// copy/paste/select. It only calls preventDefault (never stops propagation), so the game's own right-click orders, double-click
// select and camera zoom keep working. The web version is unchanged (browsers keep their normal menus).
// Loaded early by index.html. ?appfeel=0 turns it off for QA.
(function () {
  function isApp() { try { const C = window.Capacitor; return !!(C && (typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : C.isNative)); } catch (e) { return false; } }
  let off = false; try { off = new URLSearchParams(location.search).get('appfeel') === '0'; } catch (e) {}
  const on = isApp() && !off;
  function editable(t) {
    for (let e = t; e && e.nodeType === 1; e = e.parentElement) {
      const n = e.tagName; if (n === 'TEXTAREA' || n === 'SELECT') return true;
      if (n === 'INPUT') return !/^(button|submit|reset|checkbox|radio|range|color|file|image)$/i.test(e.type || 'text');
      if (e.isContentEditable) return true;
    }
    return false;
  }
  const A = window.IF_APPFEEL = { on, blocked: { contextmenu: 0, dragstart: 0, selectstart: 0, gesture: 0, dblclick: 0 } };
  if (!on) return;
  document.documentElement.classList.add('inapp');
  const st = document.createElement('style');
  st.textContent = 'html.inapp,html.inapp body,html.inapp *{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}' +
    'html.inapp img,html.inapp a,html.inapp canvas{-webkit-user-drag:none}' +
    'html.inapp input,html.inapp textarea,html.inapp [contenteditable="true"]{-webkit-touch-callout:default;-webkit-user-select:text;user-select:text}';
  (document.head || document.documentElement).appendChild(st);
  function block(kind, keepText) { return ev => { if (keepText && editable(ev.target)) return; if (ev.cancelable !== false) ev.preventDefault(); A.blocked[kind]++; }; }
  document.addEventListener('contextmenu', block('contextmenu', true), true);
  document.addEventListener('dragstart', block('dragstart', true), true);
  document.addEventListener('selectstart', block('selectstart', true), true);
  ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, block('gesture', false), { capture: true, passive: false }));
  document.addEventListener('dblclick', block('dblclick', true), { capture: true, passive: false });
})();
