import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * UX, not a security boundary — overview §8.3.
 *
 * (§8.3 calls this "middleware". Next.js 16 renamed the convention to `proxy`;
 * `middleware.ts` still works but warns on every build. Same position in the
 * request pipeline, same reasoning — nothing in §8.3 changes with the name.)
 *
 * This exists so an unauthenticated teacher who opens a bookmarked page lands
 * on the sign-in form instead of on a blank screen. It is **not** what protects
 * data: this layer is not a reliable boundary for direct Server Action and
 * Route Handler invocations (the class of bug behind CVE-2025-29927), so the
 * real check runs where the data is, in `requireUser()` at the entry of every
 * action and every query.
 *
 * Consistent with that, it only looks at whether a session cookie is present —
 * it does not verify it. Verifying here would re-create the boundary in the
 * place the architecture says must not hold it, and would cost a database round
 * trip on every navigation. A cookie that is present but expired gets one
 * redirect from `requireUser()` instead.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - /sign-in            the redirect target itself
     *  - /api/*              Route Handlers, including better-auth's own,
     *                        which must stay reachable while signed out
     *  - /_next/*            build output
     *  - favicon.ico and any path with a file extension (static assets)
     */
    "/((?!sign-in|api|_next|favicon\\.ico|.*\\.[^/]+$).*)",
  ],
};
