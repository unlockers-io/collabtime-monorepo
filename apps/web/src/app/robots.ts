import { origins } from "@repo/identity";
import type { MetadataRoute } from "next";

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
  sitemap: `${origins.web}/sitemap.xml`,
});

export default robots;
