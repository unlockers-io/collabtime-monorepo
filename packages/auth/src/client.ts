// Re-export client functions from better-auth
import { createAuthClient } from "better-auth/react";

export { createAuthClient as createBetterAuthClient } from "better-auth/react";
export { stripeClient } from "@better-auth/stripe/client";

type AuthClient = ReturnType<typeof createAuthClient>;

export type { AuthClient };
