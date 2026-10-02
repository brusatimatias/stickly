import { useLayoutEffect, type RefObject } from "react";

/**
 * Keeps `--vv-top` and `--vv-height` on `ref`'s element in step with the
 * visual viewport, the part of the page the on-screen keyboard leaves
 * visible. iOS Safari doesn't shrink the layout viewport for the keyboard
 * (and ignores `interactive-widget`), so a `fixed` panel sized with `dvh`
 * ends up under it; the full-screen chat on phones uses these instead.
 *
 * Written to the DOM, not state: it changes on every frame while the
 * keyboard slides in, and nothing else needs to re-render for it.
 */
export function useVisualViewportBox(ref: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const element = ref.current;
    const viewport = window.visualViewport;
    if (!active || !element || !viewport) return;

    function update() {
      element!.style.setProperty("--vv-top", `${viewport!.offsetTop}px`);
      element!.style.setProperty("--vv-height", `${viewport!.height}px`);
    }
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [ref, active]);
}
