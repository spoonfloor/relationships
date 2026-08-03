/** @typedef {"public" | "secret" | "always"} MenuTier */

/**
 * @param {{
 *   moreBtn: HTMLButtonElement | null,
 *   menu: HTMLElement | null,
 *   isComposeMode?: () => boolean,
 * }} dom
 */
export function initAppBarMenu({ moreBtn, menu, isComposeMode }) {
  if (!moreBtn || !menu) return;

  const LONG_PRESS_MS = 500;
  let longPressTimer = null;
  let ignoreNextMoreClick = false;
  let longPressActive = false;

  const menuItems = [...menu.querySelectorAll('[role="menuitem"]')];
  const tieredElements = [...menu.querySelectorAll("[data-menu-tier]")];

  for (const item of menuItems) {
    const tier = item.getAttribute("data-menu-tier");
    if (tier !== "public" && tier !== "secret") {
      throw new Error(
        `App bar menu item must declare data-menu-tier="public" or "secret": ${item.id || item.textContent?.trim()}`
      );
    }
  }

  /** @param {Exclude<MenuTier, "always">} tier */
  function setMenuTier(tier) {
    const inCompose = isComposeMode?.() ?? false;

    for (const item of tieredElements) {
      const itemTier = /** @type {MenuTier} */ (item.getAttribute("data-menu-tier"));
      const matchesTier = itemTier === "always" || itemTier === tier;
      const hideInCompose = item.hasAttribute("data-hide-in-compose") && inCompose;
      item.hidden = !matchesTier || hideInCompose;
    }
  }

  function endLongPressTracking() {
    longPressActive = false;
    document.removeEventListener("pointerup", handleLongPressRelease, true);
  }

  function closeMenu() {
    menu.hidden = true;
    moreBtn.setAttribute("aria-expanded", "false");
    setMenuTier("public");
    endLongPressTracking();
  }

  /** @param {Exclude<MenuTier, "always">} tier */
  function openMenu(tier) {
    setMenuTier(tier);
    menu.hidden = false;
    moreBtn.setAttribute("aria-expanded", "true");
  }

  function openSecretMenu() {
    openMenu("secret");
  }

  /** @param {Node | null} target */
  function findVisibleMenuItem(target) {
    if (!(target instanceof Node)) return null;
    for (const item of menuItems) {
      if (item.hidden) continue;
      if (item === target || item.contains(target)) return item;
    }
    return null;
  }

  /** @param {HTMLElement} item */
  function activateMenuItem(item) {
    closeMenu();
    item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }

  function clearLongPressTimer() {
    if (longPressTimer != null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleLongPressRelease(event) {
    if (!longPressActive || (isComposeMode?.() ?? false)) return;

    const item = findVisibleMenuItem(
      document.elementFromPoint(event.clientX, event.clientY)
    );
    if (item) {
      event.preventDefault();
      activateMenuItem(item);
      return;
    }

    endLongPressTracking();
  }

  function finishLongPress() {
    ignoreNextMoreClick = true;
    longPressActive = true;
    openSecretMenu();
    document.addEventListener("pointerup", handleLongPressRelease, true);
  }

  moreBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (ignoreNextMoreClick) {
      ignoreNextMoreClick = false;
      return;
    }
    if (menu.hidden) {
      if ((isComposeMode?.() ?? false) || event.altKey) openSecretMenu();
      else openMenu("public");
    } else {
      closeMenu();
    }
  });

  moreBtn.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    clearLongPressTimer();
    longPressTimer = window.setTimeout(finishLongPress, LONG_PRESS_MS);
  });

  moreBtn.addEventListener("pointerup", clearLongPressTimer);
  moreBtn.addEventListener("pointercancel", clearLongPressTimer);
  moreBtn.addEventListener("pointerleave", clearLongPressTimer);

  for (const item of menuItems) {
    item.addEventListener("click", () => closeMenu());
  }

  document.addEventListener("click", (event) => {
    if (menu.hidden) return;
    const target = event.target;
    if (target instanceof Node && (menu.contains(target) || moreBtn.contains(target))) return;
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) closeMenu();
  });

  setMenuTier("public");
}
