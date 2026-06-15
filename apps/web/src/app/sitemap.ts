import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/app-url";

const sitemap = (): MetadataRoute.Sitemap => [
  {
    changeFrequency: "monthly",
    priority: 1,
    url: getAppUrl(),
  },
];

export default sitemap;
