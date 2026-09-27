export const FALLBACK_TIME_ZONE = "UTC";
const MAX_TIME_ZONE_LENGTH = 64;

/** Whether `value` is an IANA time zone the runtime knows (e.g. America/Argentina/Buenos_Aires). */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > MAX_TIME_ZONE_LENGTH) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The first valid time zone among `candidates` (in priority order), or UTC. */
export function resolveTimeZone(...candidates: (string | null | undefined)[]): string {
  return candidates.find(isValidTimeZone) ?? FALLBACK_TIME_ZONE;
}

/** The calendar day (yyyy-MM-dd) that `now` falls on in `timeZone`. */
export function getTodayInZone(timeZone: string, now: Date): string {
  // en-CA formats dates as yyyy-MM-dd.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}
