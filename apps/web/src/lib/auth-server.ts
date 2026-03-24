import { createAuth, type Auth } from "@repo/auth/server";
import { prisma } from "@repo/db";
import { nextCookies } from "better-auth/next-js";

// Lazily initialized auth instance to avoid build-time errors
// when environment variables aren't available
let _auth: Auth | null = null;

const getAuthConfig = () => ({
  betterAuth: {
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    url: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    webAppUrl: process.env.WEB_APP_URL ?? "http://localhost:3000",
  },
  // nextCookies() must be last — lets better-auth read cookies in RSC/Server Actions
  extraPlugins: [nextCookies()],
});

/**
 * Get the auth instance (lazily initialized).
 */
const getAuth = (): Auth => {
  if (!_auth) {
    _auth = createAuth(prisma, getAuthConfig());
  }
  return _auth;
};

// Proxy for backwards compatibility with existing imports
const auth = new Proxy({} as Auth, {
  get(_, prop) {
    const instance = getAuth();
    const value = instance[prop as keyof Auth];
    if (typeof value === "function") {
      return (value as (...args: Array<unknown>) => unknown).bind(instance);
    }
    return value;
  },
});

export { auth, getAuth };
