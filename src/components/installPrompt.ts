"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Chromium's `beforeinstallprompt`: it tells the page the app can be
 * installed, and lets it open the browser's install dialog later from a
 * click. It fires once, early (often on the board, before the profile is
 * open), so it's caught for the whole app by `InstallPromptListener` in the
 * root layout and kept here. Other browsers (Safari, Firefox) never fire it.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = {
  /** The install dialog the browser offered, until it's used. */
  prompt: BeforeInstallPromptEvent | null;
  /** The app was installed during this visit (it still runs in the browser tab). */
  installed: boolean;
};

const INITIAL_STATE: InstallState = { prompt: null, installed: false };
let state = INITIAL_STATE;
const listeners = new Set<() => void>();

function setState(next: Partial<InstallState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL_STATE
  );
}

/** Opens the browser's install dialog. Returns whether the user installed the app. */
export async function promptInstall(event: BeforeInstallPromptEvent): Promise<boolean> {
  // The event can only be used once.
  setState({ prompt: null });
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") setState({ installed: true });
  return outcome === "accepted";
}

export function InstallPromptListener() {
  useEffect(() => {
    // Not prevented: the browser may still offer installing on its own too.
    function onBeforeInstallPrompt(event: Event) {
      setState({ prompt: event as BeforeInstallPromptEvent });
    }
    // Also fires when installing from the browser's menu.
    function onInstalled() {
      setState({ prompt: null, installed: true });
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
