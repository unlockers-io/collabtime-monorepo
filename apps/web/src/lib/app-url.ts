import { getEnv } from "@/lib/env";

// Canonical base URL — WEB_APP_URL in prod (set on Vercel), portless dev URL as
// fallback. Mirrors the resolution used for outbound links in invitation-actions.ts.
const getAppUrl = (): string => getEnv("WEB_APP_URL") ?? "https://collabtime.web.localhost";

export { getAppUrl };
