/** @typedef {"public" | "secret" | "always"} MenuTier */

/**
 * @param {{
 *   moreBtn: HTMLButtonElement | null,
 *   menu: HTMLElement | null,
 *   isComposeMode?: () => boolean,
 *   syncMenuItemAvailability?: () => void,
 * }} dom
 */
export function initAppBarMenu({ moreBtn, menu, isComposeMode, syncMenuItemAvailability }) {
  if (!moreBtn || !menu) return;

  const LONG_PRESS_MS = 500;
  let longPressTimer = null;
  let suppressNextClick = false;
  let menuOpenedByTouch = false;

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
      const hideInCompose =
        inCompose && tier !== "secret" && item.hasAttribute("data-hide-in-compose");
      item.hidden = !matchesTier || hideInCompose;
    }

    for (const item of menuItems) {
      if (!item.hasAttribute("data-unavailable-in-compose")) continue;
      const unavailable = inCompose;
      item.disabled = unavailable;
      item.toggleAttribute("aria-disabled", unavailable);
    }

    syncMenuItemAvailability?.();
  }

  function clearLongPressTimer() {
    if (longPressTimer != null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function closeMenu() {
    menu.hidden = true;
    moreBtn.setAttribute("aria-expanded", "false");
    setMenuTier("public");
    menuOpenedByTouch = false;
    clearLongPressTimer();
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

  function isTouchUi() {
    return window.matchMedia("(pointer: coarse)").matches;
  }

  function finishLongPress() {
    longPressTimer = null;
    suppressNextClick = true;
    menuOpenedByTouch = true;
    openSecretMenu();
  }

  moreBtn.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  menu.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  moreBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (menu.hidden) {
      if ((isComposeMode?.() ?? false) || event.altKey) openSecretMenu();
      else openMenu("public");
      menuOpenedByTouch = false;
      return;
    }

    if (!isTouchUi() && !menuOpenedByTouch) {
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
