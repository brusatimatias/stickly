/**
 * What kind of device and app window the page is running in. Browser only:
 * call from effects or event handlers, never while server rendering.
 */

export function isIOS(): boolean {
  // iPadOS reports itself as a Mac, but Macs have no touch screen.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1)
  );
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/** Opened from the home screen icon (installed), not in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}
