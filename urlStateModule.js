// ══════════════════════════════════════════════════════
//  URL STATE — Deep Linking
//  Drop this file in and add <script src="url-state.js">
//  AFTER aui.js. No changes to existing code needed.
//
//  Supported URL patterns (hash-based, works on static hosting):
//
//    /#                              → home
//    /#discover                      → discover view
//    /#search                        → search view
//    /#settings                      → settings view
//    /#library/released              → full released list
//    /#library/unreleased            → full unreleased list
//    /#library/all                   → all albums
//    /#artist/Kanye+West             → artist page
//    /#album/blonde                  → album page
//    /#album/blonde/03               → album page, track 3 highlighted (0-based origIdx)
//    /#playlist/pl_1234567890        → playlist view (own playlists only)
//    /#profile                       → own profile
// ══════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Encode / decode helpers ──────────────────────────
  function encodeSegment(str) {
    // Use + for spaces (readable in address bar), encode everything else
    return encodeURIComponent(str).replace(/%20/g, '+');
  }
  function decodeSegment(str) {
    return decodeURIComponent((str || '').replace(/\+/g, '%20'));
  }

  // ── Build a hash string from an app state descriptor ──
  // state: { view, artist?, albumId?, origIdx?, playlistId?, libraryType? }
  function buildHash(state) {
    switch (state.view) {
      case 'discover':  return '#discover';
      case 'search':    return '#search';
      case 'settings':  return '#settings';
      case 'profile':   return '#profile';
      case 'fullReleased':   return '#library/released';
      case 'fullUnreleased': return '#library/unreleased';
      case 'fullAllAlbums':  return '#library/all';
      case 'artist':
        return '#artist/' + encodeSegment(state.artist || '');
      case 'album':
        if (state.origIdx !== undefined && state.origIdx !== null)
          return '#album/' + encodeSegment(state.albumId) + '/' + state.origIdx;
        return '#album/' + encodeSegment(state.albumId);
      case 'playlist':
        return '#playlist/' + encodeSegment(state.playlistId);
      default:
        return '#'; // home
    }
  }

  // ── Parse the current window.location.hash into a state ──
  function parseHash(hash) {
    const raw = (hash || '').replace(/^#\/?/, '').trim();
    if (!raw) return { view: 'home' };

    const parts = raw.split('/');
    const seg0 = decodeSegment(parts[0]);

    switch (seg0) {
      case 'discover':  return { view: 'discover' };
      case 'search':    return { view: 'search' };
      case 'settings':  return { view: 'settings' };
      case 'profile':   return { view: 'profile' };
      case 'library': {
        const sub = decodeSegment(parts[1]);
        if (sub === 'unreleased') return { view: 'fullUnreleased' };
        if (sub === 'all')        return { view: 'fullAllAlbums' };
        return { view: 'fullReleased' };
      }
      case 'artist':
        return { view: 'artist', artist: decodeSegment(parts[1]) };
      case 'album': {
        const albumId = decodeSegment(parts[1]);
        const origIdx = parts[2] !== undefined ? parseInt(parts[2], 10) : null;
        return { view: 'album', albumId, origIdx };
      }
      case 'playlist':
        return { view: 'playlist', playlistId: decodeSegment(parts[1]) };
      default:
        return { view: 'home' };
    }
  }

  // ── Push a new hash without triggering our own hashchange handler ──
  let _suppressNext = false;
  function pushHash(state) {
    const newHash = buildHash(state);
    if (window.location.hash === newHash) return; // already there
    _suppressNext = true;
    history.pushState(state, '', newHash);
  }

  // ── Intercept the existing nav functions ────────────────
  // We wrap each function so the URL updates whenever the
  // app navigates, without touching your existing logic.

  function wrap(fnName, getState) {
    const original = window[fnName];
    if (typeof original !== 'function') return;
    window[fnName] = function (...args) {
      const result = original.apply(this, args);
      // Only push if this call is a real user navigation (push=true or push undefined)
      // push is always the last boolean argument in your functions
      const pushArg = args[args.length - 1];
      const isPush = pushArg !== false; // default is true when not supplied
      if (isPush) {
        try { pushHash(getState(...args)); } catch (_) {}
      }
      return result;
    };
  }

  // Wait until aui.js has fully initialised before wrapping
  function installWraps() {
    wrap('openAlbum', (id) => ({ view: 'album', albumId: id }));
    wrap('openArtist', (artistName) => ({ view: 'artist', artist: artistName }));
    wrap('openPlaylistView', (playlistId) => ({ view: 'playlist', playlistId }));
    wrap('openOwnProfile', () => ({ view: 'profile' }));
    wrap('openFullList', (type) => {
      if (type === 'allAlbums') return { view: 'fullAllAlbums' };
      if (type === 'unreleased') return { view: 'fullUnreleased' };
      return { view: 'fullReleased' };
    });

    // showView covers discover / search / settings / home
    const originalShowView = window.showView;
    if (typeof originalShowView === 'function') {
      window.showView = function (id, push = true) {
        const result = originalShowView.call(this, id, push);
        if (push) {
          const simple = ['home', 'discover', 'search', 'settings'];
          if (simple.includes(id)) {
            try { pushHash({ view: id }); } catch (_) {}
          }
        }
        return result;
      };
    }
  }

  // ── Restore state from a parsed hash object ──────────
  function restoreState(state) {
    switch (state.view) {
      case 'home':
        window.showView?.('home', false);
        break;
      case 'discover':
        window.showView?.('discover', false);
        window.renderDiscover?.();
        break;
      case 'search':
        window.showView?.('search', false);
        // Restore saved query after a tick so the search module wires up first
        setTimeout(() => {
          try {
            const saved = sessionStorage.getItem('searchQuery');
            const inp = document.getElementById('globalSearch');
            if (saved && inp) {
              inp.value = saved;
              inp.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } catch (_) {}
        }, 50);
        break;
      case 'settings':
        window.showView?.('settings', false);
        break;
      case 'profile':
        // Need a user session; fall back to home if not logged in
        if (window.getCurrentUser?.()) {
          window.renderOwnProfile?.();
          window.showView?.('profile', false);
        } else {
          window.showView?.('home', false);
        }
        break;
      case 'fullReleased':
        window.openFullList?.('released', false);
        break;
      case 'fullUnreleased':
        window.openFullList?.('unreleased', false);
        break;
      case 'fullAllAlbums':
        window.openFullList?.('allAlbums', false);
        break;
      case 'artist':
        if (state.artist) window.openArtist?.(state.artist, false);
        else window.showView?.('home', false);
        break;
      case 'album':
        if (state.albumId) {
          window.openAlbum?.(state.albumId, false);
          // Optionally scroll to / highlight a specific track
          if (state.origIdx !== null && !isNaN(state.origIdx)) {
            requestAnimationFrame(() => highlightTrack(state.albumId, state.origIdx));
          }
        } else {
          window.showView?.('home', false);
        }
        break;
      case 'playlist':
        if (state.playlistId && window.getCurrentUser?.()) {
          window.openPlaylistView?.(state.playlistId, false);
        } else {
          window.showView?.('home', false);
        }
        break;
      default:
        window.showView?.('home', false);
    }
  }

  // ── Highlight a specific track row after album opens ──
  function highlightTrack(albumId, origIdx) {
    const rows = document.querySelectorAll('.track-row');
    rows.forEach(row => {
      if (row.dataset.albumId === albumId && parseInt(row.dataset.origIdx) === origIdx) {
        row.style.background = 'var(--surface3, #2a2a2a)';
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { row.style.background = ''; }, 1800);
      }
    });
  }

  // ── Share helper — exposed globally ──────────────────
  // Call getShareUrl() from anywhere to get the current shareable link.
  // Or pass a state object to build a specific link.
  window.getShareUrl = function (state) {
    const base = window.location.origin + window.location.pathname;
    if (state) return base + buildHash(state);
    return base + (window.location.hash || '#');
  };

  // Convenience: copy current page URL to clipboard + toast
  window.copyShareUrl = function (state) {
    const url = window.getShareUrl(state);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        window.showToast?.('Link copied ✓');
      }).catch(() => {
        _fallbackCopy(url);
      });
    } else {
      _fallbackCopy(url);
    }
  };

  function _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); window.showToast?.('Link copied ✓'); }
    catch (_) { window.showToast?.('Copy failed — ' + text); }
    document.body.removeChild(ta);
  }

  // ── Handle browser back/forward ───────────────────────
  window.addEventListener('popstate', (e) => {
    if (_suppressNext) { _suppressNext = false; return; }
    const state = e.state || parseHash(window.location.hash);
    restoreState(state);
  });

  // ── Boot ──────────────────────────────────────────────
  // On first load: read the hash and navigate to it.
  // If no hash, the app loads normally.
  function boot() {
    installWraps();

    const hash = window.location.hash;
    if (hash && hash !== '#') {
      const state = parseHash(hash);
      // Small delay so the app's own DOMContentLoaded init finishes first
      setTimeout(() => restoreState(state), 120);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
