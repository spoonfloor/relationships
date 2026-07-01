/**
 * @param {{ moreBtn: HTMLButtonElement | null, menu: HTMLElement | null }} dom
 */
export function initAppBarMenu({ moreBtn, menu }) {
  if (!moreBtn || !menu) return;

  const menuItems = menu.querySelectorAll('[role="menuitem"]');

  function closeMenu() {
    menu.hidden = true;
    moreBtn.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    menu.hidden = false;
    moreBtn.setAttribute("aria-expanded", "true");
  }

  moreBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu.hidden) openMenu();
    else closeMenu();
  });

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
}
