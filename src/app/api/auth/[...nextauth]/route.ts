import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { toPublicSession } from "@/lib/publicSession";

type AuthHandler = (req: NextRequest) => Promise<Response>;

/**
 * The session callback puts the Google `accessToken` on the session so server
 * actions can call Calendar through `auth()` (which also refreshes it when it
 * expires). Auth.js serves that same object to the browser at
 * `/api/auth/session`, so strip the server-only fields from that response.
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
