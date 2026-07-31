/**
 * @param {string} title
 */
export function slugFromTitle(title) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "puzzle";
}

/**
 * @param {string} base
 * @param {Iterable<string>} existingIds
 */
export function uniqueSlug(base, existingIds) {
  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
