import { getEnv } from "@/lib/env";

const getAppUrl = (): string => getEnv("WEB_APP_URL") ?? "https://collabtime.web.localhost";

export { getAppUrl };
