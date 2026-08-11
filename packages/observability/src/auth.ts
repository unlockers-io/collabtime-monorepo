import "./fields";

import { createAuthMiddleware, type BetterAuthInstance } from "evlog/better-auth";

const createIdentify = (auth: BetterAuthInstance, opts?: { exclude?: Array<string> }) =>
  createAuthMiddleware(auth, { exclude: opts?.exclude ?? ["/api/auth/**"] });

export { createIdentify };
