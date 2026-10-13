import { canonicalUrl } from "@repo/portless-env/apps";

import { getEnv } from "@/lib/env";

const getAppUrl = (): string => getEnv("WEB_APP_URL") ?? canonicalUrl("web");

export { getAppUrl };
