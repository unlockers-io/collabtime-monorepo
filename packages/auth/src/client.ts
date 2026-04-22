// Re-export client functions from better-auth
import type { createAuthClient } from "better-auth/react";

export { createAuthClient as createBetterAuthClient } from "better-auth/react";

type AuthClient = ReturnType<typeof createAuthClient>;

export type { AuthClient };
