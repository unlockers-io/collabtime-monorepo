"use client";

import { createBetterAuthClient } from "@repo/auth/client";

const authClient = createBetterAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

const { signIn, signOut, signUp } = authClient;

export { authClient, signIn, signUp, signOut };
