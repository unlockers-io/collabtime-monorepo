import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/constants";

const sitemap = (): MetadataRoute.Sitemap => [
  {
    changeFrequency: "monthly",
    priority: 1,
    url: SITE_URL,
  },
];

export default sitemap;
