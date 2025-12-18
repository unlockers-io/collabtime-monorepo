"use client";

import { createBetterAuthClient, stripeClient } from "@repo/auth/client";

const authClient = createBetterAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  plugins: [stripeClient()],
});

const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;

export {
  authClient,
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
};
