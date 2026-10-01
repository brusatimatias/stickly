/**
 * This browser's side of push notifications: the service worker, the
 * permission and the subscription. Kept apart from the component so tests can
 * replace it (jsdom has none of these APIs).
 */

export type PushDeviceState =
  | { kind: "unsupported" }
  /** iOS only delivers push to apps added to the home screen. */
  | { kind: "needsInstall" }
  /** The user blocked notifications for the site; only the browser settings can undo it. */
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on"; subscription: PushSubscription };

const SERVICE_WORKER_URL = "/sw.js";

function isIOS(): boolean {
  // iPadOS reports itself as a Mac, but Macs have no touch screen.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" });
  // Subscribing needs an active worker, which a first registration doesn't have yet.
  return navigator.serviceWorker.ready;
}

export async function getPushDeviceState(): Promise<PushDeviceState> {
  if (!isSupported()) {
    return { kind: isIOS() && !isStandalone() ? "needsInstall" : "unsupported" };
  }
  if (Notification.permission === "denied") {
    return { kind: "denied" };
  }
  const subscription = await (await getRegistration()).pushManager.getSubscription();
  return subscription && Notification.permission === "granted"
    ? { kind: "on", subscription }
    : { kind: "off" };
}

/** The VAPID public key (base64url) as the Push API wants it. */
function toApplicationServerKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/**
 * Asks for permission (must run from a click: Safari ignores it otherwise)
 * and subscribes this browser. Returns the new state, "denied"/"off" when the
 * user said no or dismissed the prompt.
 */
export async function enablePush(vapidPublicKey: string): Promise<PushDeviceState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { kind: permission === "denied" ? "denied" : "off" };
  }
  const registration = await getRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toApplicationServerKey(vapidPublicKey),
    }));
  return { kind: "on", subscription };
}

/**
 * This browser's subscription, if it has one, without registering anything.
 * Used on sign out, so the next person using the browser doesn't get the
 * previous user's notifications.
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}
