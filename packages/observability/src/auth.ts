import "./fields";

import { createAuthMiddleware, type BetterAuthInstance } from "evlog/better-auth";

// Identity in request middleware — not betterAuth() config — so no auth-config hooks are required.
const createIdentify = (auth: BetterAuthInstance, opts?: { exclude?: Array<string> }) =>
  createAuthMiddleware(auth, { exclude: opts?.exclude ?? ["/api/auth/**"] });

export { createIdentify };
