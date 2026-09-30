import { useState, type AnimationEvent } from "react";
import { animatesExit } from "@/components/motion";

/**
 * Open/close state for the "new note" and "new draft" forms that keeps the
 * form mounted while its exit animation plays. Spread `transitionProps` on
 * the element that wraps the form.
 */
export function useFormTransition() {
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const isOpen = phase === "open";

  return {
    isMounted: phase !== "closed",
    open: () => setPhase("open"),
    close: () => setPhase(animatesExit() ? "closing" : "closed"),
    transitionProps: {
      className: isOpen ? "animate-form-in" : "animate-form-out pointer-events-none",
      inert: !isOpen,
      onAnimationEnd: (event: AnimationEvent) => {
        if (event.target === event.currentTarget && phase === "closing") setPhase("closed");
      },
    },
  };
}
