import { describe, expect, test } from "vitest";
import { buildContentSecurityPolicy, STATIC_SECURITY_HEADERS } from "@/lib/securityHeaders";

function directives(csp: string): Record<string, string> {
  return Object.fromEntries(
    csp.split("; ").map((directive) => {
      const [name, ...values] = directive.split(" ");
      return [name, values.join(" ")];
    })
  );
}

describe("buildContentSecurityPolicy", () => {
  test("only allows scripts with this request's nonce in production", () => {
    const csp = directives(buildContentSecurityPolicy({ nonce: "abc123", isDev: false }));

    expect(csp["script-src"]).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp["script-src"]).not.toContain("unsafe-inline");
    expect(csp["script-src"]).not.toContain("unsafe-eval");
    expect(csp["upgrade-insecure-requests"]).toBe("");
  });

  test("adds unsafe-eval only in development and doesn't force https", () => {
    const csp = directives(buildContentSecurityPolicy({ nonce: "abc123", isDev: true }));

    expect(csp["script-src"]).toContain("'unsafe-eval'");
    expect(csp).not.toHaveProperty("upgrade-insecure-requests");
  });

  test("blocks framing and plugins", () => {
    const csp = directives(buildContentSecurityPolicy({ nonce: "n", isDev: false }));

    expect(csp["frame-ancestors"]).toBe("'none'");
    expect(csp["object-src"]).toBe("'none'");
  });

  test("lets the Google sign-in form redirect to Google", () => {
    const csp = directives(buildContentSecurityPolicy({ nonce: "n", isDev: false }));

    expect(csp["form-action"]).toContain("https://accounts.google.com");
  });
});

describe("STATIC_SECURITY_HEADERS", () => {
  test("denies framing and MIME sniffing", () => {
    const headers = Object.fromEntries(STATIC_SECURITY_HEADERS.map((h) => [h.key, h.value]));

    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });
});
