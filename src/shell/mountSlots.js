/**
 * Load HTML partials into shell slot containers.
 */

async function mountSlot(selector, url) {
  const target = document.querySelector(selector);
  if (!target) {
    throw new Error(`Shell slot not found: ${selector}`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load slot partial ${url}: ${response.status}`);
  }

  target.innerHTML = await response.text();
}

export async function mountSlots(slots) {
  await Promise.all(slots.map(({ selector, url }) => mountSlot(selector, url)));
}
