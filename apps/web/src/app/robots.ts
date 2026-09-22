import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/constants";

const robots = (): MetadataRoute.Robots => ({
  rules: {
    allow: "/",
    disallow: [
      "/monitoring",
      "/api/",
      "/settings",
      "/login",
      "/register",
      "/recover",
      "/reset-password",
    ],
    userAgent: "*",
  },
  sitemap: `${SITE_URL}/sitemap.xml`,
});

export default robots;
