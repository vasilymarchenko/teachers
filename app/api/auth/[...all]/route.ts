import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/auth";

// Mounting point for better-auth: every endpoint it defines is served from
// here. `proxy.ts` deliberately does not cover `/api`, so what is mounted is
// reachable while signed out — which is why `lib/auth/auth.ts` turns off the
// endpoints this app has no screen for. The sign-in form itself does not come
// through here; it calls `auth.api.signInEmail()` from a Server Action.
export const { GET, POST } = toNextJsHandler((request: Request) =>
  getAuth().handler(request),
);
