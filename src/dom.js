export function getDom() {
  return {
    boardEl: document.getElementById("board"),
    statusEl: document.getElementById("status"),
    foundEl: document.getElementById("foundGroups"),

    newGameBtn: document.getElementById("newGameBtn"),
    shuffleBtn: document.getElementById("shuffleBtn"),
    clearBtn: document.getElementById("clearBtn"),
    submitBtn: document.getElementById("submitBtn"),

    hintCategoryBtn: document.getElementById("hintCategoryBtn"),
    hintWordBtn: document.getElementById("hintWordBtn"),

    paletteChipsEl: document.getElementById("paletteChips"),
    puzzleSelect: document.getElementById("puzzleSelect"),
  };
}

