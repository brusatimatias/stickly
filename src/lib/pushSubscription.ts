/**
 * Validation of the push subscriptions browsers hand over (the JSON form of
 * the Push API's `PushSubscription`). It comes from the client, so nothing in
 * it is trusted: the endpoint is where the server will send requests, hence
 * the allowlist of push services.
 */

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 256;
const BASE64URL = /^[A-Za-z0-9_-]+=*$/;

/**
 * The push services of the browsers that support Web Push (Chrome/Android,
 * Firefox, Safari/iOS, Edge). Matched as the host or a subdomain of it.
 */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

export function isPushServiceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    PUSH_SERVICE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  );
}

function isKey(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= MAX_KEY_LENGTH && BASE64URL.test(value)
  );
}

export function parsePushSubscription(input: unknown): PushSubscriptionInput {
  const { endpoint, keys } = (input ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (
    typeof endpoint !== "string" ||
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    !isPushServiceUrl(endpoint) ||
    !isKey(keys?.p256dh) ||
    !isKey(keys?.auth)
  ) {
    throw new Error("INVALID_PUSH_SUBSCRIPTION");
  }
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/** The endpoint alone, as the client sends it to turn a device off or test it. */
export function parsePushEndpoint(input: unknown): string {
  if (typeof input !== "string" || input.length > MAX_ENDPOINT_LENGTH || !isPushServiceUrl(input)) {
    throw new Error("INVALID_PUSH_SUBSCRIPTION");
  }
  return input;
}
