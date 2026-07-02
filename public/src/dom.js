export function getDom() {
  return {
    boardEl: document.getElementById("board"),
    statusEl: document.getElementById("status"),
    puzzleTitleEl: document.getElementById("puzzle-title"),
    appBarMoreBtn: document.getElementById("app-bar-more-btn"),
    appBarMenu: document.getElementById("app-bar-menu"),
    choosePuzzleBtn: document.getElementById("choose-puzzle-btn"),
    editPuzzleBtn: document.getElementById("edit-puzzle-btn"),
    ctaStackPlay: document.getElementById("cta-stack-play"),
    ctaStackEdit: document.getElementById("cta-stack-edit"),
    saveExitBtn: document.getElementById("saveExitBtn"),
    saveBtn: document.getElementById("saveBtn"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    vignetteEl: document.getElementById("vignette"),
    foundEl: document.getElementById("foundGroups"),
    guessesEl: document.getElementById("guesses"),
    mostRecentGuessEl: document.getElementById("most-recent-guess"),

    newGameBtn: document.getElementById("newGameBtn"),
    shuffleBtn: document.getElementById("shuffleBtn"),
    clearBtn: document.getElementById("clearBtn"),
    submitBtn: document.getElementById("submitBtn"),

    hintCategoryBtn: document.getElementById("hintCategoryBtn"),
    hintWordBtn: document.getElementById("hintWordBtn"),

    paletteChipsEl: document.getElementById("paletteChips"),
    puzzleSelect: document.getElementById("puzzleSelect"),

    glossaryBtn: document.getElementById("glossaryBtn"),
    glossaryTooltip: document.getElementById("glossary-tooltip"),
  };
}
