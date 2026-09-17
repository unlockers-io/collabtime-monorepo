import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/app-url";

const robots = (): MetadataRoute.Robots => {
  const baseUrl = getAppUrl();

  return {
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
    sitemap: `${baseUrl}/sitemap.xml`,
  };
};

export default robots;
