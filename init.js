// ══════════════════════════════════════════════════════
//  INIT.JS — SAFE FULL INITIALIZATION
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Show home FIRST, before urlStateModule runs ──
  // urlStateModule boots 120ms after DOMContentLoaded and may redirect away,
  // but we still want the home view painted immediately on a blank load.
  try {
    showView?.('home');
    pushNav?.(() => showView?.('home'));
  } catch (e) {
    console.warn('[init] showView/pushNav error:', e);
  }

  // ── 2. UI Bootstrap ──
  try { cleanInactive?.();        } catch (e) { console.warn('[init] cleanInactive:', e); }
  try { renderTopbarRight?.();    } catch (e) { console.warn('[init] renderTopbarRight:', e); }
  try { renderSidebarLibrary?.(); } catch (e) { console.warn('[init] renderSidebarLibrary:', e); }
  try { renderSettingsHTML?.();   } catch (e) { console.warn('[init] renderSettingsHTML:', e); }

  // Discover is only rendered when its view is actually opened (renderDiscover is
  // called inside showView → discover), so no need to call it eagerly here.

  // ── 3. Album counts ──
  try { initAlbumCountSpans?.(); } catch (e) { console.warn('[init] initAlbumCountSpans:', e); }

  // ── 4. Sheet stats (async, non-blocking) ──
  // Also flush any stat posts that failed last session (offline / network error).
  _flushStatQueue?.().catch(() => {});
  loadAndRenderStats?.().catch(e =>
    console.warn('[init] Stats load error:', e)
  );

  // ── 5. Search query persistence wiring ──
  // Wire the global search input to save its value to sessionStorage so that
  // refreshing while on the search view (/#search) restores the last query.
  try {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput && !searchInput._persistWired) {
      searchInput._persistWired = true;

      // Always start empty — prevent any browser/password-manager autofill
      // from pre-populating the field on page load.
      searchInput.value = '';

      // The input is born `readonly` (set in HTML) so autofill has no target.
      // Lift readonly the instant the user focuses so typing works normally.
      searchInput.addEventListener('focus', () => {
        searchInput.removeAttribute('readonly');
      }, { once: true });

      searchInput.addEventListener('input', () => {
        try { sessionStorage.setItem('searchQuery', searchInput.value); } catch (_) {}
      });
    }
  } catch (e) { console.warn('[init] search persistence wire:', e); }

  // ── 6. Apply saved player settings ──
  try {
    const volSlider = document.getElementById('volSlider');

    if (volSlider && typeof playerSettings !== 'undefined') {
      volSlider.max   = playerSettings.maxVol     ?? 100;
      volSlider.value = playerSettings.defaultVol ?? 50;
      updateVolFill?.();

      window.shuffleOn  = playerSettings.shuffleDefault ?? false;
      window.repeatMode = playerSettings.repeatDefault  ?? 0;

      if (window.shuffleOn) {
        document.getElementById('btnRandom')?.classList.add('active');
      }

      if (window.repeatMode === 1) {
        document.getElementById('btnRepeat')?.classList.add('active');
      } else if (window.repeatMode === 2) {
        document.getElementById('btnRepeat')?.classList.add('active');
        const repeatIcon = document.getElementById('repeatIcon');
        if (repeatIcon) repeatIcon.className = 'fas fa-redo-alt';
      }
    }
  } catch (e) {
    console.warn('[init] Player settings error:', e);
  }

  // ── 7. Pre-warm audio engine ──
  // Uses ALBUMS (the global defined in data.js), not the old window.albums alias.
  setTimeout(() => {
    try {
      if (!Array.isArray(window.ALBUMS)) return;

      const first = window.ALBUMS.find(a =>
        Array.isArray(a.tracks) &&
        a.tracks.some(t => t.file && t.file !== '#')
      );

      if (first && typeof loadAlbum === 'function') {
        loadAlbum(first, 0, false);
      }
    } catch (e) {
      console.warn('[init] Prewarm audio error:', e);
    }
  }, 0);

  // ── 8. Keyboard shortcuts ──
  const volSlider = document.getElementById('volSlider');

  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay?.();
        break;
      case 'ArrowRight':
        if (e.shiftKey) { e.preventDefault(); nextTrack?.(); }
        break;
      case 'ArrowLeft':
        if (e.shiftKey) { e.preventDefault(); prevTrack?.(); }
        break;
      case 'ArrowUp':
        if (e.shiftKey && volSlider) {
          e.preventDefault();
          volSlider.value = Math.min(
            parseInt(volSlider.max   || 100),
            parseInt(volSlider.value || 0) + 10
          );
          applyVolume?.();
        }
        break;
      case 'ArrowDown':
        if (e.shiftKey && volSlider) {
          e.preventDefault();
          volSlider.value = Math.max(
            0,
            parseInt(volSlider.value || 0) - 10
          );
          applyVolume?.();
        }
        break;
      case 'KeyM':
        if (volSlider) {
          volSlider.value = parseInt(volSlider.value) > 0
            ? (volSlider._savedVol = volSlider.value, 0)
            : (volSlider._savedVol ?? playerSettings?.defaultVol ?? 50);
          applyVolume?.();
        }
        break;
    }
  });

  // ── 9. Media Session API ──
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play',          () => togglePlay?.());
    navigator.mediaSession.setActionHandler('pause',         () => togglePlay?.());
    navigator.mediaSession.setActionHandler('nexttrack',     () => nextTrack?.());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack?.());
  }

  // ── 10. Safe loadTrack wrapper ──
  // Patches loadTrack after DOMContentLoaded so Media Session metadata stays
  // in sync without the audioEngine having to know about the navigator API.
  if (typeof loadTrack === 'function' && !loadTrack._mediaPatched) {
    const _origLoadTrack = loadTrack;

    window.loadTrack = function(idx) {
      _origLoadTrack(idx);

      const t = window.flatList?.[idx];
      if (t && 'mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title:   t.name,
          artist:  t.artist,
          album:   t.albumTitle,
          artwork: [{ src: t.cover, sizes: '512x512', type: 'image/jpeg' }]
        });
      }
    };

    window.loadTrack._mediaPatched = true;
  }

  // ── 11. Check for interrupted download (retry overlay) ──
  try { checkDownloadRetry?.(); } catch (e) { console.warn('[init] checkDownloadRetry:', e); }

  // ── 12. Guard against page unload mid-download ──
  window.addEventListener('beforeunload', () => {
    // If a download is active the pending key is already set in sessionStorage.
    // Nothing else needed — the retry overlay reads it on next load.
  });

});