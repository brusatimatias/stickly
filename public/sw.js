// Stickly's service worker: only shows the push notifications the server
// sends (see src/lib/webPush.ts) and opens the app when one is tapped. No
// caching or offline support on purpose.

self.addEventListener("install", () => {
  // Nothing to precache: take over from an older version right away.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Show something anyway: browsers penalize a push without a notification.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Stickly", {
      body: payload.body,
      icon: "/icon/192",
      tag: payload.tag,
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin);

  event.waitUntil(
    (async () => {
      // Reuse an open Stickly window instead of opening another one.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === url.origin);
      if (existing) {
        try {
          await existing.focus();
          if (existing.url !== url.href) {
            await existing.navigate(url.href);
          }
          return;
        } catch {
          // navigate() fails for a window this worker doesn't control yet.
        }
      }
      await self.clients.openWindow(url.href);
    })()
  );
});
