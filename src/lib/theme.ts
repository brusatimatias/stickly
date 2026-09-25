export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE_NAME = "THEME";

export function isTheme(value: string | undefined): value is Theme {
  return THEMES.includes(value as Theme);
}

/**
 * The theme a toggle click should switch to. `current` is the explicit choice
 * stored in the cookie (null when the user never picked one, in which case
 * the page follows the OS preference, so that's what gets flipped).
 */
export function getNextTheme(current: Theme | null, systemPrefersDark: boolean): Theme {
  const effective = current ?? (systemPrefersDark ? "dark" : "light");
  return effective === "dark" ? "light" : "dark";
}
