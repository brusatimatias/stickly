"use client";

import { createContext, useContext } from "react";
import { FALLBACK_TIME_ZONE } from "@/lib/timezone";

/**
 * The zone the board shows notes in and converts typed days/times from (see
 * src/lib/schedule.ts). Provided by `Board` with the zone the server rendered
 * with, so the server and client renders agree.
 */
const TimeZoneContext = createContext(FALLBACK_TIME_ZONE);

export const TimeZoneProvider = TimeZoneContext.Provider;

export function useBoardTimeZone(): string {
  return useContext(TimeZoneContext);
}
