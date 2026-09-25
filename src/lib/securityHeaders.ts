/**
 * Content Security Policy for HTML pages, set per request by `src/proxy.ts`.
 *
 * - Scripts: only those carrying this request's nonce (Next.js adds it to its
 *   own scripts automatically), plus whatever they load (`strict-dynamic`,
 *   e.g. Vercel Analytics). This is what blocks injected scripts (XSS).
 * - Styles: `'unsafe-inline'` because components render inline `style`
 *   attributes (note overlap offsets, dnd-kit transforms, sign-in stickers),
 *   which a nonce can't cover. Style injection is far less dangerous than
 *   script injection.
 * - Images: Google profile pictures are shown directly on the profile page;
 *   avatars can be data URLs.
 * - Forms: the Google sign-in form's server action redirects to Google, and
 *   browsers apply `form-action` to that redirect.
 */
export function buildContentSecurityPolicy({
  nonce,
  isDev,
}: {
  nonce: string;
  isDev: boolean;
}): string {
  const directives = [
    "default-src 'self'",
    // React needs eval in development for its debugging tools, never in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export const STATIC_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];
