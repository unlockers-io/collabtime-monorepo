import type { MetadataRoute } from "next";

import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

const manifest = (): MetadataRoute.Manifest => ({
  background_color: "#0a0a0a",
  description: APP_DESCRIPTION,
  display: "standalone",
  icons: [
    {
      sizes: "any",
      src: "/icon.svg",
      type: "image/svg+xml",
    },
  ],
  name: APP_NAME,
  short_name: APP_NAME,
  start_url: "/",
  theme_color: "#0a0a0a",
});

export default manifest;
