import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/auth";

// Mounting point for better-auth. There are no sign-in screens yet (T-006);
// this exists so the wiring is exercised rather than assumed.
export const { GET, POST } = toNextJsHandler((request: Request) =>
  getAuth().handler(request),
);
