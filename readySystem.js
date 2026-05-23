// ══════════════════════════════════════════════════════
//  READY SYSTEM  —  readySystem.js
//
//  Fetches ready.txt and populates window.READY_STATE.
//  That's it. No click blocking. No navigation changes.
//  No audio touching. Purely a data loader.
//
//  Visual decoration (CSS classes, badges, glow) is
//  handled entirely by the debug system in aui.js.
//
//  Public:
//    window.READY_STATE        Map<id, bool>
//    window.readySystemLoaded  Promise<void>
//    window._rsActive          bool
//    window.isAlbumReady(id)   bool
//    window.applyReadyStates() decorate cards — wired by aui.js debug system
// ══════════════════════════════════════════════════════

(() => {
  'use strict';

  const _state = new Map();
  let _resolve;

  window.READY_STATE       = _state;
  window._rsActive         = false;
  window.readySystemLoaded = new Promise(r => { _resolve = r; });

  // Safe to call before load — returns false until ready.txt parsed
  window.isAlbumReady = id =>
    window._rsActive && !!id && _state.get(String(id).toLowerCase()) === true;

  // applyReadyStates is a no-op here; aui.js debug system overwrites it
  // after a successful import so both code paths (auto-fetch + manual
  // overlay import) end up calling the same decorator.
  window.applyReadyStates = function () {};

  function _parse(text) {
    let count = 0;
    text.split('\n').forEach(raw => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const eq = line.indexOf('=');
      if (eq === -1) return;
      const id  = line.slice(0, eq).trim().toLowerCase();
      const val = line.slice(eq + 1).trim().toLowerCase();
      if (!id) return;
      _state.set(id, val === 'ready');
      count++;
    });
    return count;
  }

  async function _init() {
    try {
      const r = await fetch('ready.txt?_=' + Date.now());
      if (r.ok) {
        const count = _parse(await r.text());
        if (count > 0) {
          window._rsActive = true;
          console.info('[ReadySystem] ready.txt loaded —',
            [..._state.entries()].filter(([,v])=>v).length, 'ready');
        } else {
          console.info('[ReadySystem] ready.txt empty — inactive');
        }
      } else {
        console.info('[ReadySystem] no ready.txt (' + r.status + ') — inactive');
      }
    } catch (e) {
      console.info('[ReadySystem] fetch skipped — inactive');
    }

    _resolve(); // resolves window.readySystemLoaded
    // aui.js debug system listens on readySystemLoaded and applies visuals
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
