import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["collabtime.web.localhost"],
  reactCompiler: true,
  transpilePackages: ["@repo/ui"],
};

export default nextConfig;
