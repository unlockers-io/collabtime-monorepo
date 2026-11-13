import { origins } from "@repo/identity";
import type { MetadataRoute } from "next";

const sitemap = (): MetadataRoute.Sitemap => [
  {
    changeFrequency: "monthly",
    priority: 1,
    url: origins.web,
  },
];

export default sitemap;
