import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { toPublicSession } from "@/lib/publicSession";

type AuthHandler = (req: NextRequest) => Promise<Response>;

/**
 * Auth.js serves the session object to the browser at `/api/auth/session`.
 * The session holds no secrets today (Google tokens live encrypted on `User`,
 * see src/lib/googleCalendar.ts), but server-only fields must never leak, so
 * they're stripped from that response as a safeguard.
 */
function withPublicSession(handler: AuthHandler): AuthHandler {
  return async (req) => {
    const response = await handler(req);
    const isSessionEndpoint = req.nextUrl.pathname.endsWith("/session");
    const isJson = response.headers.get("content-type")?.includes("application/json");
    if (!isSessionEndpoint || !isJson) {
      return response;
    }

    const body = toPublicSession(await response.json());
    // Keep Set-Cookie (the session endpoint rolls the session cookie) but drop
    // the length of the original body.
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(JSON.stringify(body), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

export const GET = withPublicSession(handlers.GET);
export const POST = withPublicSession(handlers.POST);
