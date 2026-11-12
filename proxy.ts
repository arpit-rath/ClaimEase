import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, isValidAccessToken, safeNextPath } from "@/lib/server/app-gate";

/**
 * Team passcode gate for every page and API route.
 *   - "/" is the passcode page; once unlocked it forwards to the app.
 *   - Locked pages redirect to "/?next=<page>".
 *   - Locked API calls get 401 JSON in the usual error shape.
 * Routes that spend money (e.g. Gemini in /api/extract) also check the cookie themselves.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const unlocked = isValidAccessToken(request.cookies.get(ACCESS_COOKIE)?.value, process.env.APP_PASSWORD);

  if (pathname === "/api/unlock") return NextResponse.next();

  if (pathname === "/") {
    if (!unlocked) return NextResponse.next();
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (unlocked) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Enter the team passcode first." } },
      { status: 401 },
    );
  }

  const gate = new URL("/", request.url);
  gate.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(gate);
}

export const config = {
  // Everything except Next's static files and the app icon.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)"],
};
