import { portlessUrl } from "@repo/portless-env";
import { loopbackUrl } from "@repo/portless-env/apps";

export const webUrl =
  process.env.WEB_APP_URL ??
  (process.env.CI ? loopbackUrl("web", "localhost") : portlessUrl("web"));
