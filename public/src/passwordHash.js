/** @param {string} text */
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** @param {string} a @param {string} b */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** @param {string} password @param {string} expectedHash */
export async function passwordMatchesHash(password, expectedHash) {
  if (!expectedHash) return false;
  const actualHash = await sha256Hex(password);
  return timingSafeEqual(actualHash, expectedHash);
}
