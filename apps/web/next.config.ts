import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["collabtime.web.localhost"],
  experimental: {
    viewTransition: true,
  },
  reactCompiler: true,
};

export default nextConfig;
