// ══════════════════════════════════════════════════════
//  GOOGLE SHEETS STATS API
// ══════════════════════════════════════════════════════
const STATS_API = "https://script.google.com/macros/s/AKfycby1Drle0bacJbYFk6xs-JcakshugKX6YeTkhG8F6Utn2otIGxwhbV_rYa3AQuRi_Q0/exec";
const STATS_POST_API = STATS_API;

// ── Sheet data cache (fetch/parse only) ──────────────
let sheetData    = null;
let statsLoaded  = false;
let statsLoading = false;

async function fetchSheetData() {
  if (statsLoading) return sheetData;
  if (statsLoaded)  return sheetData;
  statsLoading = true;
  try {
    const res  = await fetch(STATS_API + '?t=' + Date.now());
    const json = await res.json();
    if      (Array.isArray(json))            sheetData = json;
    else if (json && Array.isArray(json.data))   sheetData = json.data;
    else if (json && Array.isArray(json.values)) sheetData = json.values;
    else sheetData = [];
    statsLoaded = true;
  } catch (e) {
    console.warn('Stats fetch failed:', e);
    sheetData   = [];
    statsLoaded = false; // allow retry on next call
  }
  statsLoading = false;
  return sheetData;
}

function parseSheet(rows) {
  if (!rows || !rows.length) return { trackRows: [], topViewed: [], topListened: [], topSaved: [], topDownloaded: [], podium: [] };
  const isObj = typeof rows[0] === 'object' && !Array.isArray(rows[0]);
  let dataRows = rows;
  if (!isObj) {
    const first = rows[0];
    if (isNaN(parseFloat(first[3])) && String(first[0]).toLowerCase().includes('title')) {
      dataRows = rows.slice(1);
    }
  }
  const trackRows = [], topViewed = [], topListened = [], topSaved = [], topDownloaded = [], podium = [];
  dataRows.forEach(row => {
    if (!row) return;
    if (isObj) {
      const id = String(row['id'] || row['c'] || row['C'] || '').trim();
      if (id && id !== 'id') {
        trackRows.push({
          trackId:   id,
          views:     parseInt(row['total-views']          || row['D'] || 0) || 0,
          listens:   parseInt(row['total-full-listens']   || row['E'] || 0) || 0,
          saves:     parseInt(row['total-saves']          || row['F'] || 0) || 0,
          downloads: parseInt(row['total-downloads']      || row['G'] || 0) || 0,
          score:     parseFloat(row['overAll-score']      || row['H'] || 0) || 0,
        });
      }
      const tv = parseInt(row['top-viewed']     || row['J'] || 0) || 0;
      const tl = parseInt(row['top-listened']   || row['K'] || 0) || 0;
      const ts = parseInt(row['top-saved']      || row['L'] || 0) || 0;
      const td = parseInt(row['top-downloaded'] || row['M'] || 0) || 0;
      if (tv) topViewed.push(tv);
      if (tl) topListened.push(tl);
      if (ts) topSaved.push(ts);
      if (td) topDownloaded.push(td);
      const bs = parseFloat(row['BEST-SCORE'] || row['N'] || 0) || 0;
      const bt = String(row['BEST-TRACK']     || row['O'] || '').trim();
      const ba = String(row['BEST-ARTIST']    || row['P'] || '').trim();
      if (bs && bt) podium.push({ score: bs, trackName: bt, artistName: ba });
    } else {
      const id = String(row[2] || '').trim();
      if (id && id !== 'id') {
        trackRows.push({
          trackId:   id,
          views:     parseInt(row[3])   || 0,
          listens:   parseInt(row[4])   || 0,
          saves:     parseInt(row[5])   || 0,
          downloads: parseInt(row[6])   || 0,
          score:     parseFloat(row[7]) || 0,
        });
      }
      const tv = parseInt(row[9])  || 0;
      const tl = parseInt(row[10]) || 0;
      const ts = parseInt(row[11]) || 0;
      const td = parseInt(row[12]) || 0;
      if (tv) topViewed.push(tv);
      if (tl) topListened.push(tl);
      if (ts) topSaved.push(ts);
      if (td) topDownloaded.push(td);
      const bs = parseFloat(row[13]) || 0;
      const bt = String(row[14] || '').trim();
      const ba = String(row[15] || '').trim();
      if (bs && bt) podium.push({ score: bs, trackName: bt, artistName: ba });
    }
  });
  return { trackRows, topViewed, topListened, topSaved, topDownloaded, podium };
}

function buildStatsLookup(trackRows) {
  const lookup = {};
  trackRows.forEach(r => { if (r.trackId) lookup[r.trackId] = r; });
  return lookup;
}

// ── Album counts from data.js type field ─────────────
function countAlbumsByType() {
  let released = 0, unreleased = 0;
  for (const album of ALBUMS) {
    if      (album.type === 'released')   released++;
    else if (album.type === 'unreleased') unreleased++;
  }
  return { released, unreleased };
}

// ── Span rendering (fully isolated, retries if DOM not ready) ──
function applyAlbumCountSpans() {
  const counts    = countAlbumsByType();
  const relSpan   = document.getElementById('releasedCountSpan');
  const unrelSpan = document.getElementById('unreleasedCountSpan');
  if (relSpan)   relSpan.textContent   = `${counts.released} albums`;
  if (unrelSpan) unrelSpan.textContent = `${counts.unreleased} albums`;
  return !!(relSpan && unrelSpan);
}

// Call this once on init — retries if spans aren't in DOM yet
function initAlbumCountSpans() {
  if (!applyAlbumCountSpans()) {
    const interval = setInterval(() => {
      if (applyAlbumCountSpans()) clearInterval(interval);
    }, 200);
    // Give up after 5s so we don't loop forever
    setTimeout(() => clearInterval(interval), 5000);
  }
}

// ── Track lookup helpers ──────────────────────────────
function findTrackByStatId(statId) {
  for (const album of ALBUMS) {
    for (let i = 0; i < album.tracks.length; i++) {
      const t = album.tracks[i];
      if (t.statId && t.statId === statId) return { track: t, album, origIdx: i };
    }
  }
  return null;
}

function findTrackByName(trackName, artistName) {
  // Pass 1: artist-scoped
  for (const album of ALBUMS) {
    if (artistName && !album.artist.toLowerCase().includes(artistName.toLowerCase()) &&
      !(album.primaryArtist || '').toLowerCase().includes(artistName.toLowerCase())) continue;
    for (let i = 0; i < album.tracks.length; i++) {
      const t = album.tracks[i];
      if (t.name.toLowerCase().includes(trackName.toLowerCase()) ||
        trackName.toLowerCase().includes(t.name.toLowerCase())) {
        return { track: t, album, origIdx: i };
      }
    }
  }
  // Pass 2: global fallback
  for (const album of ALBUMS) {
    for (let i = 0; i < album.tracks.length; i++) {
      const t = album.tracks[i];
      if (t.name.toLowerCase().includes(trackName.toLowerCase()) ||
        trackName.toLowerCase().includes(t.name.toLowerCase())) {
        return { track: t, album, origIdx: i };
      }
    }
  }
  return null;
}

// ── Retry queue ───────────────────────────────────────
// Posts that fail (network error, offline) are stored here and
// retried on the next successful connection / page load.
const _STAT_QUEUE_KEY = 'stat_retry_queue';

function _queueLoad() {
  try { return JSON.parse(localStorage.getItem(_STAT_QUEUE_KEY) || '[]'); } catch { return []; }
}
function _queueSave(q) {
  try { localStorage.setItem(_STAT_QUEUE_KEY, JSON.stringify(q.slice(-50))); } catch {} // cap at 50
}
function _queueAdd(payload) {
  const q = _queueLoad();
  q.push(payload);
  _queueSave(q);
}

async function _flushStatQueue() {
  const q = _queueLoad();
  if (!q.length) return;
  const remaining = [];
  for (const payload of q) {
    try {
      const res = await fetch(STATS_POST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) remaining.push(payload); // server error — keep for retry
    } catch {
      remaining.push(payload); // network error — keep for retry
    }
  }
  _queueSave(remaining);
}

// ── Core post helper ──────────────────────────────────
async function _postStat(payload) {
  if (!payload.trackId && !payload.trackIds) return;
  try {
    const res = await fetch(STATS_POST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.warn('[Stats] Post failed, queued for retry:', e.message);
    _queueAdd(payload);
  }
}

function postStatIncrement(statId, field) {
  if (!statId) return;
  return _postStat({ action: 'increment', trackId: statId, field });
}

function postStatDecrement(statId, field) {
  if (!statId) return;
  return _postStat({ action: 'decrement', trackId: statId, field });
}

// ── View recording ─────────────────────────────────────
// Deduplicated per-session only (sessionStorage resets on tab close).
// This means a new browser session counts as a fresh view, which is correct.
function _sessionStatGet(type, statId) {
  if (!statId) return false;
  try { return sessionStorage.getItem(`ss_${type}_${statId}`) === '1'; } catch { return false; }
}
function _sessionStatSet(type, statId) {
  if (!statId) return;
  try { sessionStorage.setItem(`ss_${type}_${statId}`, '1'); } catch {}
}

function recordTrackView(statId) {
  if (!statId) return;
  // No user gate — views are anonymous (counts every session, not every load)
  if (_sessionStatGet('v', statId)) return;
  _sessionStatSet('v', statId);
  postStatIncrement(statId, 'views');
}

// ── Listen recording ───────────────────────────────────
// Listens count every completion — no dedup. The statId is captured when
// playback starts so that a track-change before 90% doesn't misfire.
// Duration is re-confirmed from loadedmetadata (the reliable source) via
// onTrackPlayStart — NOT from audio.play().then() where duration may be NaN.
let _listenStatId = null;

function onTrackPlayStart(statId, duration) {
  // Only arm if we have a real duration. This is called from loadedmetadata
  // in audioEngine.js where the duration is guaranteed to be valid.
  if (!statId || !duration || duration < 1 || isNaN(duration)) return;
  _listenStatId = statId;
}

function onTrackFullListenComplete() {
  if (!_listenStatId) return;
  const statId = _listenStatId;
  _listenStatId = null; // clear immediately so a second 90% crossing doesn't double-fire
  postStatIncrement(statId, 'listens');
}

// ── Download recording ─────────────────────────────────
// Every download press counts — no dedup by design.
function recordTrackDownload(statId) {
  if (!statId) return;
  postStatIncrement(statId, 'downloads');
}

// ── Favorite / save dedup guard ────────────────────────
// Prevents rapid double-taps from firing two opposing increments.
// Key: `fav_{statId}`, value: last action ('inc'|'dec'), stored in sessionStorage.
function _recordFavChange(statId, action) {
  if (!statId) return;
  const key = `fav_last_${statId}`;
  try {
    const last = sessionStorage.getItem(key);
    if (last === action) return; // same action fired twice — skip
    sessionStorage.setItem(key, action);
  } catch {}
  if (action === 'inc') postStatIncrement(statId, 'saves');
  else                  postStatDecrement(statId, 'saves');
}

// ── Album save — single batched request ───────────────
// Instead of one fetch per track, sends a single batch payload.
function postAlbumSaveStat(albumId, action) {
  const album = ALBUMS.find(a => a.id === albumId);
  if (!album) return;
  const statIds = album.tracks.map(t => t.statId).filter(Boolean);
  if (!statIds.length) return;
  // Use batch action so the Apps Script can handle it in one call
  _postStat({ action: action === 'inc' ? 'batchIncrement' : 'batchDecrement', trackIds: statIds, field: 'saves' });
}

// hasDownloaded kept for external callers that may reference it
function hasDownloaded(statId) { return false; }

// ── Main load + render (sheets data only, no span logic) ──
async function loadAndRenderStats() {
  const rows   = await fetchSheetData();
  const parsed = parseSheet(rows);
  renderPodium(parsed.podium);
  renderTop100Preview(parsed);
}

// ── Podium ────────────────────────────────────────────
function renderPodium(podiumRows) {
  const podiumRow = document.getElementById('podiumRow');
  if (!podiumRow) return;
  const top3 = [...podiumRows].sort((a, b) => b.score - a.score).slice(0, 3);
  if (!top3.length) { podiumRow.innerHTML = '<div style="color:var(--muted);font-family:\'Space Mono\',monospace;font-size:12px;">No score data available yet</div>'; return; }
  const classes = ['gold', 'silver', 'bronze'];
  const labels  = ['BEST SCORE', '2nd PLACE', '3rd PLACE'];
  const order   = top3.length >= 3 ? [1, 0, 2] : top3.map((_, i) => i);
  podiumRow.innerHTML = '';
  order.forEach(idx => {
    if (idx >= top3.length) return;
    const item = top3[idx];
    const info = findTrackByName(item.trackName, item.artistName);
    const card = document.createElement('div');
    card.className = `podium-card ${classes[idx]}`;
    card.innerHTML = `<div class="podium-cover-wrapper"><img class="podium-cover" src="${info ? info.album.cover : ''}" onerror="this.style.background='#222'"/></div><div class="podium-rank">${labels[idx]}</div><div class="podium-track">${item.trackName}</div><div class="podium-artist">${item.artistName}</div><div class="podium-score">${item.score.toFixed ? item.score.toFixed(1) : item.score}</div>`;
    if (info) { card.style.cursor = 'pointer'; card.addEventListener('click', () => openAlbum(info.album.id)); }
    podiumRow.appendChild(card);
  });
}

// ── Top 100 preview grid ──────────────────────────────
function renderTop100Preview(parsed) {
  const grid = document.getElementById('top100Grid');
  if (!grid) return;
  const byViews     = [...parsed.trackRows].filter(r => r.views     > 0).sort((a, b) => b.views     - a.views    ).slice(0, 6);
  const byListens   = [...parsed.trackRows].filter(r => r.listens   > 0).sort((a, b) => b.listens   - a.listens  ).slice(0, 6);
  const bySaves     = [...parsed.trackRows].filter(r => r.saves     > 0).sort((a, b) => b.saves     - a.saves    ).slice(0, 6);
  const byDownloads = [...parsed.trackRows].filter(r => r.downloads > 0).sort((a, b) => b.downloads - a.downloads).slice(0, 6);
  const categories  = [
    { key: 'views',     label: 'Top Viewed',     icon: 'fa-eye',        color: '#00e5ff', rows: byViews     },
    { key: 'listens',   label: 'Top Listened',   icon: 'fa-headphones', color: '#a259ff', rows: byListens   },
    { key: 'saves',     label: 'Top Saved',      icon: 'fa-heart',      color: '#ff6b6b', rows: bySaves     },
    { key: 'downloads', label: 'Top Downloaded', icon: 'fa-download',   color: '#51cf66', rows: byDownloads },
  ];
  grid.innerHTML = '';
  categories.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'top100-card';
    card.innerHTML = `<div class="top100-card-header"><div class="top100-card-title" style="color:${cat.color}"><i class="fas ${cat.icon}"></i>${cat.label}</div></div><div class="top100-list" id="top100list_${cat.key}"></div>`;
    grid.appendChild(card);
    const list = document.getElementById(`top100list_${cat.key}`);
    if (!cat.rows.length) { list.innerHTML = '<div style="padding:12px 14px;color:var(--muted);font-family:\'Space Mono\',monospace;font-size:11px;">No data yet — archived each month!</div>'; return; }
    cat.rows.forEach((item, i) => {
      const info     = findTrackByStatId(item.trackId);
      const numClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
      const val      = item[cat.key];
      const valStr   = val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : val >= 1000 ? (val / 1000).toFixed(1) + 'k' : String(val);
      const row      = document.createElement('div');
      row.className  = 'top100-row' + (info ? '' : ' top100-row--unresolved');
      row.innerHTML  = `
        <div class="top100-num ${numClass}">${i + 1}</div>
        <img class="top100-art" src="${info ? info.album.cover : ''}" onerror="this.style.background='#2a2a2a'"/>
        <div class="top100-info">
          <div class="top100-name">${info ? info.track.name : `<span class="stat-unresolved-id">${item.trackId}</span>`}</div>
          <div class="top100-sub">${info ? info.album.artist : '<span class="stat-unresolved-hint">no match in library</span>'}</div>
        </div>
        <div class="top100-val" style="color:${cat.color}">${valStr}</div>`;
      if (info) row.addEventListener('click', () => playAlbumFromTrack(info.album.id, info.origIdx));
      list.appendChild(row);
    });
  });
}

// ── Full stats overlay ────────────────────────────────
let currentFSTab = 'best';
function openFullStats()  { document.getElementById('fullStatsOverlay').classList.add('open');    switchFSTab('best'); }
function closeFullStats() { document.getElementById('fullStatsOverlay').classList.remove('open'); }

function switchFSTab(tab) {
  currentFSTab = tab;
  document.querySelectorAll('.fstab').forEach(b => b.classList.remove('active'));
  const tabOrder = ['best', 'views', 'listens', 'saves', 'downloads'];
  const tabs     = document.querySelectorAll('.fstab');
  const idx      = tabOrder.indexOf(tab);
  if (tabs[idx]) tabs[idx].classList.add('active');
  renderFSTab(tab);
}

async function renderFSTab(tab) {
  const body = document.getElementById('fullStatsBody');
  body.innerHTML = '<div class="fs-loading"><span class="stats-dot"></span>Loading…</div>';
  const rows   = await fetchSheetData();
  const parsed = parseSheet(rows);
  body.innerHTML = '';
  if (tab === 'best') {
    const top3      = [...parsed.podium].sort((a, b) => b.score - a.score).slice(0, 3);
    const podiumDiv = document.createElement('div'); podiumDiv.className = 'fs-podium';
    const inner     = document.createElement('div'); inner.style.cssText = 'display:flex;gap:10px;margin-bottom:20px;';
    podiumDiv.appendChild(inner); body.appendChild(podiumDiv);
    const classes = ['gold', 'silver', 'bronze'];
    const labels  = ['BEST SCORE', '2nd PLACE', '3rd PLACE'];
    top3.forEach((item, idx) => {
      const info = findTrackByName(item.trackName, item.artistName);
      const card = document.createElement('div'); card.className = `podium-card ${classes[idx]}`; card.style.flex = '1';
      card.innerHTML = `<div class="podium-cover-wrapper"><img class="podium-cover" src="${info ? info.album.cover : ''}" onerror="this.style.background='#222'"/></div><div class="podium-rank">${labels[idx]}</div><div class="podium-track">${item.trackName}</div><div class="podium-artist">${item.artistName}</div><div class="podium-score">${item.score.toFixed ? item.score.toFixed(1) : item.score}</div>`;
      if (info) { card.style.cursor = 'pointer'; card.addEventListener('click', () => { closeFullStats(); openAlbum(info.album.id); }); }
      inner.appendChild(card);
    });
    const sorted = [...parsed.trackRows].filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    if (!sorted.length) { body.innerHTML += '<div class="fs-empty">No score data available</div>'; return; }
    sorted.forEach((item, i) => renderFSRow(body, item, i, 'score', item.score.toFixed ? item.score.toFixed(1) : String(item.score)));
  } else {
    const sorted = [...parsed.trackRows].filter(r => r[tab] > 0).sort((a, b) => b[tab] - a[tab]);
    if (!sorted.length) { body.innerHTML = '<div class="fs-empty">No data available</div>'; return; }
    sorted.forEach((item, i) => {
      const v = item[tab];
      const s = v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v);
      renderFSRow(body, item, i, tab, s);
    });
  }
}

function renderFSRow(container, item, i, key, displayVal) {
  const info      = findTrackByStatId(item.trackId);
  const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
  const row       = document.createElement('div');
  row.className   = 'fs-row' + (info ? '' : ' fs-row--unresolved');
  row.innerHTML   = `
    <div class="fs-rank ${rankClass}">${i + 1}</div>
    <img class="fs-art" src="${info ? info.album.cover : ''}" onerror="this.style.background='#2a2a2a'"/>
    <div class="fs-info">
      <div class="fs-name">${info ? info.track.name : `<span class="stat-unresolved-id">${item.trackId}</span>`}${!info ? ' <span class="stat-unresolved-badge">no match</span>' : ''}</div>
      <div class="fs-sub">${info ? info.album.artist : '<span class="stat-unresolved-hint">not yet in library</span>'}${info ? ' · ' + info.album.title : ''}</div>
    </div>
    <div class="fs-val">${displayVal}</div>`;
  if (info) row.addEventListener('click', () => { closeFullStats(); openAlbum(info.album.id); });
  container.appendChild(row);
}