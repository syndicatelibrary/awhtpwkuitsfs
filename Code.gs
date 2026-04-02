// ══════════════════════════════════════════════════════
//  SOUNDSCAPE STATS — Google Apps Script
//  Deploy as: Web App → Execute as: Me → Who has access: Anyone
//
//  Sheet layout (1-indexed columns):
//    A(1)  — row label / track title (human-readable, not used by script)
//    B(2)  — artist name             (human-readable, not used by script)
//    C(3)  — statId  ← the key that matches t.statId in data.js
//    D(4)  — total-views
//    E(5)  — total-full-listens
//    F(6)  — total-saves
//    G(7)  — total-downloads
//    H(8)  — overAll-score           (computed by sheet formula, not written here)
//    I(9)  — (reserved / unused)
//    J(10) — top-viewed              (archived monthly snapshot — written by archiveTopStats)
//    K(11) — top-listened            (archived monthly snapshot)
//    L(12) — top-saved               (archived monthly snapshot)
//    M(13) — top-downloaded          (archived monthly snapshot)
//    N(14) — BEST-SCORE              (podium data — written by archiveTopStats)
//    O(15) — BEST-TRACK
//    P(16) — BEST-ARTIST
//
//  Row 1 is the header row. Data starts at row 2.
// ══════════════════════════════════════════════════════

var SHEET_NAME = 'Stats';   // change if your tab is named differently
var HEADER_ROW = 1;         // row number of the header; data starts at HEADER_ROW + 1

// Column indices (1-based)
var COL_STAT_ID   = 3;   // C
var COL_VIEWS     = 4;   // D
var COL_LISTENS   = 5;   // E
var COL_SAVES     = 6;   // F
var COL_DOWNLOADS = 7;   // G

// ── Field name → column index map ────────────────────
var FIELD_COL = {
  'views':     COL_VIEWS,
  'listens':   COL_LISTENS,
  'saves':     COL_SAVES,
  'downloads': COL_DOWNLOADS
};

// ══════════════════════════════════════════════════════
//  GET — return full sheet as JSON array of objects
// ══════════════════════════════════════════════════════
function doGet(e) {
  try {
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var sheet  = ss.getSheetByName(SHEET_NAME);
    var data   = sheet.getDataRange().getValues();
    var header = data[HEADER_ROW - 1];   // row 1 is headers
    var rows   = [];

    for (var i = HEADER_ROW; i < data.length; i++) {
      var row = data[i];
      // Skip completely empty rows
      if (!row[COL_STAT_ID - 1] || String(row[COL_STAT_ID - 1]).trim() === '') continue;
      var obj = {};
      for (var j = 0; j < header.length; j++) {
        obj[header[j]] = row[j];
      }
      rows.push(obj);
    }

    return ContentService
      .createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ══════════════════════════════════════════════════════
//  POST — handle increment / decrement / batch actions
// ══════════════════════════════════════════════════════
function doPost(e) {
  // Set CORS headers so the browser fetch doesn't get blocked
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = String(payload.action || '').toLowerCase();

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    // ── Build statId → row-number lookup (cached per execution) ──
    var lookup = buildLookup_(sheet);

    // ── Route by action ──────────────────────────────
    if (action === 'increment') {
      applyDelta_(sheet, lookup, payload.trackId, payload.field, 1);

    } else if (action === 'decrement') {
      applyDelta_(sheet, lookup, payload.trackId, payload.field, -1);

    } else if (action === 'batchincrement') {
      // payload.trackIds = array of statIds, payload.field = field name
      var ids = Array.isArray(payload.trackIds) ? payload.trackIds : [];
      ids.forEach(function(id) {
        applyDelta_(sheet, lookup, id, payload.field, 1);
      });

    } else if (action === 'batchdecrement') {
      var ids = Array.isArray(payload.trackIds) ? payload.trackIds : [];
      ids.forEach(function(id) {
        applyDelta_(sheet, lookup, id, payload.field, -1);
      });

    } else {
      output.setContent(JSON.stringify({ error: 'Unknown action: ' + action }));
      return output;
    }

    output.setContent(JSON.stringify({ ok: true }));

  } catch (err) {
    output.setContent(JSON.stringify({ error: err.message }));
  }

  return output;
}

// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════

// Build a map of { statId: rowNumber (1-based) } for the sheet
function buildLookup_(sheet) {
  var col    = sheet.getRange(1, COL_STAT_ID, sheet.getLastRow()).getValues();
  var lookup = {};
  for (var i = HEADER_ROW; i < col.length; i++) {   // skip header row
    var id = String(col[i][0] || '').trim();
    if (id) lookup[id] = i + 1;   // +1 because getValues is 0-indexed, sheet rows are 1-indexed
  }
  return lookup;
}

// Apply +delta to a single cell, clamping to 0 minimum
function applyDelta_(sheet, lookup, trackId, field, delta) {
  if (!trackId || !field) return;
  var colIdx = FIELD_COL[field];
  if (!colIdx) return;   // unknown field — ignore silently

  var rowNum = lookup[String(trackId).trim()];
  if (!rowNum) {
    // statId not found in sheet — could log here if desired
    // Logger.log('statId not found: ' + trackId);
    return;
  }

  var cell    = sheet.getRange(rowNum, colIdx);
  var current = parseInt(cell.getValue()) || 0;
  var next    = Math.max(0, current + delta);   // never go below 0
  cell.setValue(next);
}

// ══════════════════════════════════════════════════════
//  MONTHLY ARCHIVE — run via Time-based trigger
//  Copies current top stats into columns J-M (snapshot)
//  and writes the best-score podium into N-P.
//  Set up: Apps Script → Triggers → archiveTopStats
//          → Time-driven → Month timer → Day 1
// ══════════════════════════════════════════════════════
function archiveTopStats() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  var last  = sheet.getLastRow();
  if (last <= HEADER_ROW) return;

  var dataRange = sheet.getRange(HEADER_ROW + 1, 1, last - HEADER_ROW, 16);
  var data      = dataRange.getValues();

  // Find top values for each stat column
  var topViews  = 0, topListens = 0, topSaves = 0, topDownloads = 0;
  var bestScore = 0, bestTrack  = '', bestArtist = '';

  data.forEach(function(row) {
    var v  = parseInt(row[COL_VIEWS     - 1]) || 0;
    var l  = parseInt(row[COL_LISTENS   - 1]) || 0;
    var s  = parseInt(row[COL_SAVES     - 1]) || 0;
    var d  = parseInt(row[COL_DOWNLOADS - 1]) || 0;
    var sc = parseFloat(row[7]) || 0;   // col H (overAll-score, 0-indexed = 7)

    if (v  > topViews)     topViews     = v;
    if (l  > topListens)   topListens   = l;
    if (s  > topSaves)     topSaves     = s;
    if (d  > topDownloads) topDownloads = d;

    if (sc > bestScore) {
      bestScore  = sc;
      bestTrack  = String(row[0] || '').trim();   // col A = track title
      bestArtist = String(row[1] || '').trim();   // col B = artist
    }
  });

  // Write snapshots back into each row (same value for all — acts as a
  // "high watermark" snapshot that the frontend reads for the top-100 display)
  // You can alternatively store these in a separate archive sheet.
  for (var i = 0; i < data.length; i++) {
    var rowNum = HEADER_ROW + 1 + i;
    sheet.getRange(rowNum, 10).setValue(topViews);      // J — top-viewed
    sheet.getRange(rowNum, 11).setValue(topListens);    // K — top-listened
    sheet.getRange(rowNum, 12).setValue(topSaves);      // L — top-saved
    sheet.getRange(rowNum, 13).setValue(topDownloads);  // M — top-downloaded
    sheet.getRange(rowNum, 14).setValue(bestScore);     // N — BEST-SCORE
    sheet.getRange(rowNum, 15).setValue(bestTrack);     // O — BEST-TRACK
    sheet.getRange(rowNum, 16).setValue(bestArtist);    // P — BEST-ARTIST
  }

  Logger.log('archiveTopStats complete — ' + new Date().toISOString());
}

// ══════════════════════════════════════════════════════
//  SETUP HELPER — run once manually to create the header row
//  Only needed if your sheet doesn't already have headers.
// ══════════════════════════════════════════════════════
function setupHeaders() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  var headers = [
    'title',           // A
    'artist',          // B
    'id',              // C  ← must match statId values in data.js
    'total-views',     // D
    'total-full-listens', // E
    'total-saves',     // F
    'total-downloads', // G
    'overAll-score',   // H
    '',                // I  (reserved)
    'top-viewed',      // J
    'top-listened',    // K
    'top-saved',       // L
    'top-downloaded',  // M
    'BEST-SCORE',      // N
    'BEST-TRACK',      // O
    'BEST-ARTIST'      // P
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  Logger.log('Headers written to row 1.');
}
