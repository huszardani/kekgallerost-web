import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          destination: "/index.html"
        },
        {
          source: "/jogi-dokumentumok",
          destination: "/jogi-dokumentumok/index.html"
        }
      ]
    };
  }
};

export default nextConfig;
