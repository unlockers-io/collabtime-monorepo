import { getEnv } from "@/lib/env";

// Canonical base URL — WEB_APP_URL in prod, localhost in dev. Mirrors the
// resolution used for outbound links in invitation-actions.ts.
const getAppUrl = (): string => getEnv("WEB_APP_URL") ?? "http://localhost:3000";

export { getAppUrl };
