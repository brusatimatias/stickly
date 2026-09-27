"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { updateTimeZone } from "@/app/actions/profile";

/**
 * Keeps `User.timeZone` in line with the browser's zone, which the server
 * uses to work out "today" on the board. When they differ (first visit,
 * travel), it stores the new zone and re-renders with it. Renders nothing.
 */
export default function TimeZoneSync({ storedTimeZone }: { storedTimeZone: string | null }) {
  const router = useRouter();

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTimeZone || browserTimeZone === storedTimeZone) return;

    updateTimeZone(browserTimeZone)
      .then(() => router.refresh())
      .catch(() => {
        // Not worth bothering the user: the server keeps its fallback zone.
      });
  }, [storedTimeZone, router]);

  return null;
}
