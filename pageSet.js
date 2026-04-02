// ══════════════════════════════════════════════════════
//  TITLE MANAGER
// ══════════════════════════════════════════════════════
function setTitle(broadPage, specificArea) {
  document.title = specificArea ? `${broadPage} | ${specificArea}` : broadPage;
}
