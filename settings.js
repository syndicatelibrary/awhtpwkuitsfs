// ══════════════════════════════════════════════════════
//  SETTINGS.JS — PERSISTENCE + THEMES + APPEARANCE + BRAND
// ══════════════════════════════════════════════════════

// ── Preset themes ──────────────────────────────────────
//  Each theme carries favicon and logo URLs resolved at runtime.
//  • 'default' theme → built-in assets + seasonal calendar overrides.
//  • Any other preset → its own favicon/logo, no seasonal override.
//  • 'custom' theme  → custom accent colours; seasonal override applies.
//  Brand assets are internal-only — not user-editable via the UI.
const THEMES = {
  default: {
    label:   'Default',
    icon:    '◈',
    favicon: 'defaultFav.png',
    logo:    'default.png',
    vars: {
      '--bg':       '#0a0a0a',
      '--surface':  '#111111',
      '--surface2': '#1a1a1a',
      '--surface3': '#222222',
      '--accent':   '#ff0000',
      '--accent2':  '#00e5ff',
      '--text':     '#f0f0f0',
      '--muted':    '#666666',
      '--dim':      '#999999',
      '--border':   'rgba(255,255,255,0.07)',
    }
  },
  midnight: {
    label:   'Midnight',
    icon:    '◉',
    favicon: 'edgerunnerFav.png',
    logo:    'edgerunner.png',
    vars: {
      '--bg':       '#050818',
      '--surface':  '#0d1224',
      '--surface2': '#141b30',
      '--surface3': '#1c2540',
      '--accent':   '#7c3aed',
      '--accent2':  '#38bdf8',
      '--text':     '#e2e8f0',
      '--muted':    '#4a5568',
      '--dim':      '#718096',
      '--border':   'rgba(99,102,241,0.15)',
    }
  },
  forest: {
    label:   'Forest',
    icon:    '◆',
    favicon: 'sakuraFav.png',
    logo:    'sakura.png',
    vars: {
      '--bg':       '#060c08',
      '--surface':  '#0d1610',
      '--surface2': '#132018',
      '--surface3': '#1a2b20',
      '--accent':   '#f59e0b',
      '--accent2':  '#34d399',
      '--text':     '#ecfdf5',
      '--muted':    '#4b6358',
      '--dim':      '#6b8f7a',
      '--border':   'rgba(52,211,153,0.1)',
    }
  },
  rosegold: {
    label:   'Rose Gold',
    icon:    '◇',
    favicon: 'goldenwindFav.png',
    logo:    'goldenwind.png',
    vars: {
      '--bg':       '#0f0a0a',
      '--surface':  '#1a1010',
      '--surface2': '#241616',
      '--surface3': '#2e1c1c',
      '--accent':   '#f43f5e',
      '--accent2':  '#fbbf24',
      '--text':     '#fff1f2',
      '--muted':    '#6b4455',
      '--dim':      '#9d6b7a',
      '--border':   'rgba(244,63,94,0.12)',
    }
  },
  light: {
    label:   'Light',
    icon:    '○',
    favicon: 'mangaFav.png',
    logo:    'manga.png',
    vars: {
      '--bg':       '#f8f8f8',
      '--surface':  '#ffffff',
      '--surface2': '#f0f0f0',
      '--surface3': '#e4e4e4',
      '--accent':   '#e11d48',
      '--accent2':  '#0284c7',
      '--text':     '#0f0f0f',
      '--muted':    '#9ca3af',
      '--dim':      '#6b7280',
      '--border':   'rgba(0,0,0,0.08)',
    }
  },
  custom: {
    label:   'Custom',
    icon:    '✦',
    favicon: '',
    logo:    '',
    vars:    null  // built from user colour picks
  }
};

// ══════════════════════════════════════════════════════
//  CALENDAR EVENTS — seasonal favicon/logo overrides
//  ⚠️  INTERNAL / ADMIN ONLY — edit in source only.
//  Active for 'default' and 'custom' themes when
//  calendarEnabled is true (set in SETTINGS_DEFAULTS).
// ══════════════════════════════════════════════════════
const CALENDAR_EVENTS = [
  {
    key: 'halloween', label: '🎃 Halloween',
    month: 10, dayStart: 25, dayEnd: 31,
    favicon: '', logo: '',
  },
  {
    key: 'christmas', label: '🎄 Christmas',
    month: 12, dayStart: 18, dayEnd: 26,
    favicon: '', logo: '',
  },
  {
    key: 'newyear', label: '🎆 New Year',
    month: 1, dayStart: 1, dayEnd: 2,
    favicon: '', logo: '',
  },
  {
    key: 'valentines', label: "💝 Valentine's Day",
    month: 2, dayStart: 13, dayEnd: 14,
    favicon: '', logo: '',
  },
  {
    key: 'stpatricks', label: "☘️ St. Patrick's",
    month: 3, dayStart: 17, dayEnd: 17,
    favicon: '', logo: '',
  },
];

// ── Defaults ───────────────────────────────────────────
const SETTINGS_DEFAULTS = {
  maxVol:          300,
  defaultVol:      100,
  shuffleDefault:  false,
  repeatDefault:   0,
  fadeDuration:    0.3,
  // ── Theme ──────────────────────────────────────────
  theme:           'default',
  customAccent:    '#ff0000',
  customAccent2:   '#00e5ff',
  // ── Seasonal calendar (internal) ───────────────────
  // Not user-controllable. Set false here to disable app-wide.
  calendarEnabled: true,
  // ── Player bar ─────────────────────────────────────
  playerBgMode:    'default',
  playerBgColor:   '#111111',
  playerBgGrad:    'linear-gradient(135deg,#0a0a0a,#1a1a1a)',
  playerBgImage:   '',
};

// ── Persistence ────────────────────────────────────────
function getSettings() {
  try { return JSON.parse(localStorage.getItem('player_settings') || '{}'); } catch { return {}; }
}
function saveSettings(s) {
  localStorage.setItem('player_settings', JSON.stringify(s));
}

// Merge saved settings over defaults
let playerSettings = Object.assign({}, SETTINGS_DEFAULTS, getSettings());

// calendarEnabled is always driven by source — strip any stale localStorage value.
playerSettings.calendarEnabled = SETTINGS_DEFAULTS.calendarEnabled;

// Strip any previously saved user brand overrides — brand is now source-only.
delete playerSettings.themeBrand;
delete playerSettings.calendarEvents;

// ══════════════════════════════════════════════════════
//  BRAND MANAGER  (internal — source-controlled only)
//
//  Resolution order (highest → lowest priority):
//    1. Calendar event override  — default/custom themes + calendarEnabled
//    2. Theme baseline asset     — THEMES[themeKey].favicon / .logo
//    3. Empty string             — leave index.html originals untouched
// ══════════════════════════════════════════════════════

function _getActiveCalendarEvent() {
  if (!playerSettings.calendarEnabled) return null;
  const t = playerSettings.theme;
  if (t !== 'default' && t !== 'custom') return null;

  const now = new Date(), month = now.getMonth() + 1, day = now.getDate();
  return CALENDAR_EVENTS.find(ev =>
    ev.month === month && day >= ev.dayStart && day <= ev.dayEnd
  ) || null;
}

function _resolveBrand() {
  const themeKey = playerSettings.theme;
  const theme    = THEMES[themeKey] || THEMES.default;

  // Layer 2: theme baseline
  let favicon = theme.favicon || '';
  let logo    = theme.logo    || '';

  // Layer 1: active calendar event (source assets only)
  const activeEv = _getActiveCalendarEvent();
  if (activeEv) {
    if (activeEv.favicon) favicon = activeEv.favicon;
    if (activeEv.logo)    logo    = activeEv.logo;
  }

  return { favicon, logo };
}

function applyBrand() {
  const { favicon, logo } = _resolveBrand();

  if (favicon) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel  = 'icon';
      link.type = 'image/png';
      document.head.appendChild(link);
    }
    link.href = favicon;
  }

  if (logo) {
    const logoImg = document.querySelector('.sidebar-logo img');
    if (logoImg) logoImg.src = logo;
  }
}

// ══════════════════════════════════════════════════════
//  TITLE MANAGER
// ══════════════════════════════════════════════════════
function setTitle(broadPage, specificArea) {
  document.title = specificArea ? `${broadPage} | ${specificArea}` : broadPage;
}

// ══════════════════════════════════════════════════════
//  THEME ENGINE
// ══════════════════════════════════════════════════════
function applyTheme(themeKey, opts = {}) {
  const root = document.documentElement;

  if (themeKey === 'custom') {
    root.style.setProperty('--accent',  opts.accent  || playerSettings.customAccent);
    root.style.setProperty('--accent2', opts.accent2 || playerSettings.customAccent2);
  } else {
    const t = THEMES[themeKey];
    if (!t || !t.vars) return;
    Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  }

  applyPlayerBg();
  applyBrand();
}

function applyPlayerBg() {
  const bar = document.getElementById('playerBar');
  if (!bar) return;
  const mode = playerSettings.playerBgMode;

  bar.style.background      = '';
  bar.style.backgroundImage = '';

  if (mode === 'color') {
    bar.style.background = playerSettings.playerBgColor;
  } else if (mode === 'gradient') {
    bar.style.background = playerSettings.playerBgGrad;
  } else if (mode === 'image' && playerSettings.playerBgImage) {
    bar.style.backgroundImage    = `url(${playerSettings.playerBgImage})`;
    bar.style.backgroundSize     = 'cover';
    bar.style.backgroundPosition = 'center';
  }
}

// ══════════════════════════════════════════════════════
//  SETTINGS UI
// ══════════════════════════════════════════════════════
function initSettingsUI() {
  const maxVolSlider  = document.getElementById('settingsMaxVol');
  const maxVolVal     = document.getElementById('settingsMaxVolVal');
  const defVolSlider  = document.getElementById('settingsDefaultVol');
  const defVolVal     = document.getElementById('settingsDefaultVolVal');
  const shuffleCheck  = document.getElementById('settingsShuffle');
  const repeatSel     = document.getElementById('settingsRepeat');
  const fadeSlider    = document.getElementById('settingsFade');
  const fadeVal       = document.getElementById('settingsFadeVal');

  maxVolSlider.value    = playerSettings.maxVol;
  maxVolVal.textContent = playerSettings.maxVol + '%';
  defVolSlider.value    = playerSettings.defaultVol;
  defVolVal.textContent = playerSettings.defaultVol + '%';
  shuffleCheck.checked  = playerSettings.shuffleDefault;
  repeatSel.value       = playerSettings.repeatDefault;
  fadeSlider.value      = playerSettings.fadeDuration;
  fadeVal.textContent   = playerSettings.fadeDuration.toFixed(2) + 's';

  document.getElementById('volSlider').max = playerSettings.maxVol;

  maxVolSlider.oninput = () => {
    playerSettings.maxVol = parseInt(maxVolSlider.value);
    maxVolVal.textContent = playerSettings.maxVol + '%';
    document.getElementById('volSlider').max = playerSettings.maxVol;
    saveSettings(playerSettings);
    updateVolFill?.();
  };
  defVolSlider.oninput = () => {
    playerSettings.defaultVol = parseInt(defVolSlider.value);
    defVolVal.textContent = playerSettings.defaultVol + '%';
    saveSettings(playerSettings);
  };
  shuffleCheck.onchange = () => {
    playerSettings.shuffleDefault = shuffleCheck.checked;
    saveSettings(playerSettings);
  };
  repeatSel.onchange = () => {
    playerSettings.repeatDefault = parseInt(repeatSel.value);
    saveSettings(playerSettings);
  };
  fadeSlider.oninput = () => {
    const v = parseFloat(fadeSlider.value);
    playerSettings.fadeDuration = v;
    fadeVal.textContent = v.toFixed(2) + 's';
    if (typeof FADE_DURATION !== 'undefined') window.FADE_DURATION = v;
    saveSettings(playerSettings);
  };

  _buildThemePicker();

  const accentPicker  = document.getElementById('settingsAccent');
  const accent2Picker = document.getElementById('settingsAccent2');
  accentPicker.value  = playerSettings.customAccent;
  accent2Picker.value = playerSettings.customAccent2;

  accentPicker.oninput = () => {
    playerSettings.customAccent = accentPicker.value;
    saveSettings(playerSettings);
    if (playerSettings.theme === 'custom') applyTheme('custom');
  };
  accent2Picker.oninput = () => {
    playerSettings.customAccent2 = accent2Picker.value;
    saveSettings(playerSettings);
    if (playerSettings.theme === 'custom') applyTheme('custom');
  };

  _buildPlayerBgUI();

  applyTheme(playerSettings.theme);
  _syncCustomPanelVisibility();
  _syncBgPanels();
}

// ── Theme picker ───────────────────────────────────────
function _buildThemePicker() {
  const container = document.getElementById('settingsThemePicker');
  if (!container) return;
  container.innerHTML = '';

  Object.entries(THEMES).forEach(([key, theme]) => {
    const card = document.createElement('button');
    card.className = 'theme-card' + (playerSettings.theme === key ? ' active' : '');
    card.dataset.theme = key;

    const vars = theme.vars || {
      '--bg':      '#0a0a0a',
      '--accent':  playerSettings.customAccent,
      '--accent2': playerSettings.customAccent2,
    };
    const bg = vars['--bg']      || '#0a0a0a';
    const a1 = vars['--accent']  || playerSettings.customAccent;
    const a2 = vars['--accent2'] || playerSettings.customAccent2;

    card.innerHTML = `
      <span class="theme-swatch" style="background:${bg};">
        <span class="theme-dot" style="background:${a1};"></span>
        <span class="theme-dot" style="background:${a2};"></span>
      </span>
      <span class="theme-icon">${theme.icon}</span>
      <span class="theme-label">${theme.label}</span>
    `;

    card.onclick = () => {
      playerSettings.theme = key;
      saveSettings(playerSettings);
      applyTheme(key);
      container.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      _syncCustomPanelVisibility();
    };

    container.appendChild(card);
  });
}

function _syncCustomPanelVisibility() {
  const panel = document.getElementById('settingsCustomColors');
  if (!panel) return;
  panel.style.display = playerSettings.theme === 'custom' ? 'flex' : 'none';
}

// ── Player background ──────────────────────────────────
function _buildPlayerBgUI() {
  const modeSelect = document.getElementById('settingsBgMode');
  if (!modeSelect) return;

  modeSelect.value = playerSettings.playerBgMode;
  document.getElementById('settingsBgColor').value = playerSettings.playerBgColor;
  document.getElementById('settingsBgGrad').value  = playerSettings.playerBgGrad;
  document.getElementById('settingsBgImage').value = playerSettings.playerBgImage;

  modeSelect.onchange = () => {
    playerSettings.playerBgMode = modeSelect.value;
    saveSettings(playerSettings);
    applyPlayerBg();
    _syncBgPanels();
  };
  document.getElementById('settingsBgColor').oninput = () => {
    playerSettings.playerBgColor = document.getElementById('settingsBgColor').value;
    saveSettings(playerSettings);
    applyPlayerBg();
    showToast('Player background updated');
  };
  document.getElementById('settingsBgGrad').oninput = () => {
    playerSettings.playerBgGrad = document.getElementById('settingsBgGrad').value;
    saveSettings(playerSettings);
    applyPlayerBg();
  };
  document.getElementById('settingsBgGrad').onblur = () => {
    if (document.getElementById('settingsBgGrad').value.trim()) showToast('Gradient applied');
  };
  document.getElementById('settingsBgImageApply').onclick = () => {
    const url = document.getElementById('settingsBgImage').value.trim();
    if (!url) { showToast('Paste an image URL first'); return; }
    const img = new Image();
    img.onload = () => {
      playerSettings.playerBgImage = url;
      saveSettings(playerSettings);
      applyPlayerBg();
      showToast('Player background updated');
    };
    img.onerror = () => showToast('Could not load that image URL');
    img.src = url;
  };

  _syncBgPanels();
}

function _syncBgPanels() {
  const mode = playerSettings.playerBgMode;
  const show = id => { const el = document.getElementById(id); if (el) el.style.display = ''; };
  const hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };

  ['settingsBgColorPanel', 'settingsBgGradPanel', 'settingsBgImagePanel'].forEach(hide);
  if (mode === 'color')    show('settingsBgColorPanel');
  if (mode === 'gradient') show('settingsBgGradPanel');
  if (mode === 'image')    show('settingsBgImagePanel');
}

// ══════════════════════════════════════════════════════
//  SETTINGS HTML INJECTION
// ══════════════════════════════════════════════════════
function renderSettingsHTML() {
  const view = document.getElementById('viewSettings');
  if (!view) return;

  view.innerHTML = `
<div class="settings-view">

  <!-- ── AUDIO ──────────────────────────────────── -->
  <div class="settings-section">
    <h2>Audio</h2>

    <div class="settings-row">
      <div>
        <div class="settings-label">Max Volume</div>
        <div class="settings-sub">Allows boosting above 100% via Web Audio</div>
      </div>
      <div class="settings-slider-wrap">
        <input id="settingsMaxVol" class="settings-slider" type="range" min="100" max="500" step="10">
        <span id="settingsMaxVolVal" class="settings-val">300%</span>
      </div>
    </div>

    <div class="settings-row">
      <div>
        <div class="settings-label">Default Volume</div>
        <div class="settings-sub">Volume level on first load</div>
      </div>
      <div class="settings-slider-wrap">
        <input id="settingsDefaultVol" class="settings-slider" type="range" min="0" max="100" step="5">
        <span id="settingsDefaultVolVal" class="settings-val">100%</span>
      </div>
    </div>

    <div class="settings-row">
      <div>
        <div class="settings-label">Track Fade</div>
        <div class="settings-sub">Crossfade duration when skipping tracks</div>
      </div>
      <div class="settings-slider-wrap">
        <input id="settingsFade" class="settings-slider" type="range" min="0.05" max="1.0" step="0.05">
        <span id="settingsFadeVal" class="settings-val">0.30s</span>
      </div>
    </div>

    <div class="settings-row">
      <div>
        <div class="settings-label">Shuffle by Default</div>
        <div class="settings-sub">Enable shuffle when loading an album</div>
      </div>
      <label class="toggle-wrap">
        <input id="settingsShuffle" type="checkbox">
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
      </label>
    </div>

    <div class="settings-row">
      <div>
        <div class="settings-label">Default Repeat Mode</div>
        <div class="settings-sub">Repeat off / all / one</div>
      </div>
      <select id="settingsRepeat" class="settings-select">
        <option value="0">Off</option>
        <option value="1">Repeat All</option>
        <option value="2">Repeat One</option>
      </select>
    </div>
  </div>

  <!-- ── APPEARANCE — THEMES ────────────────────── -->
  <div class="settings-section">
    <h2>Theme</h2>
    <div id="settingsThemePicker" class="theme-picker"></div>

    <div id="settingsCustomColors" class="custom-colors-row" style="display:none;">
      <div class="color-pick-group">
        <label class="settings-label">Accent 1</label>
        <input id="settingsAccent" type="color" class="color-pick">
      </div>
      <div class="color-pick-group">
        <label class="settings-label">Accent 2</label>
        <input id="settingsAccent2" type="color" class="color-pick">
      </div>
    </div>
  </div>

  <!-- ── APPEARANCE — PLAYER BAR ────────────────── -->
  <div class="settings-section">
    <h2>Player Bar Background</h2>

    <div class="settings-row">
      <div>
        <div class="settings-label">Background Type</div>
        <div class="settings-sub">Override the player bar background</div>
      </div>
      <select id="settingsBgMode" class="settings-select">
        <option value="default">Default (theme)</option>
        <option value="color">Solid Color</option>
        <option value="gradient">Gradient</option>
        <option value="image">Image URL</option>
      </select>
    </div>

    <div id="settingsBgColorPanel" class="settings-sub-panel" style="display:none;">
      <label class="settings-label">Color</label>
      <input id="settingsBgColor" type="color" class="color-pick">
    </div>

    <div id="settingsBgGradPanel" class="settings-sub-panel" style="display:none;">
      <label class="settings-label">CSS Gradient</label>
      <input id="settingsBgGrad" type="text" class="form-input" placeholder="linear-gradient(135deg,#0a0a0a,#1a1a1a)">
    </div>

    <div id="settingsBgImagePanel" class="settings-sub-panel" style="display:none;">
      <label class="settings-label">Image URL</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="settingsBgImage" type="text" class="form-input" placeholder="https://…" style="flex:1;">
        <button id="settingsBgImageApply" class="btn btn-primary" style="font-size:11px;padding:8px 14px;white-space:nowrap;">Apply</button>
      </div>
      <div class="settings-sub" style="margin-top:6px;">Tip: use a wide, dark image for best readability</div>
    </div>
  </div>

</div>
  `;

  initSettingsUI();
}
