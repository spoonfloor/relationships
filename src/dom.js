export function getDom() {
  return {
    boardEl: document.getElementById("board"),
    statusEl: document.getElementById("status"),
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

    resultsPopupEl: document.getElementById("results-popup"),
    resultsNumGuessesEl: document.getElementById("results-num-guesses"),
    resultsGuessesEl: document.getElementById("results-guesses"),
    resultsCloseBtn: document.getElementById("results-close-btn"),
  };
}

