/** Temporary design probe — add ?designDebug=1 to keep Submit disabled for layout review. */

export function isDesignDebug() {
  return new URLSearchParams(window.location.search).get("designDebug") === "1";
}
