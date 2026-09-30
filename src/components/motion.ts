// Whether exit animations will actually play. Without them (reduced motion,
// or no matchMedia at all, as in jsdom) `animationend` never fires, so
// anything waiting for it has to unmount right away.
export function animatesExit() {
  return (
    typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
