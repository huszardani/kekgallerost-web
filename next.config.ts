import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          destination: "/index.html"
        },
        {
          source: "/allasok",
          destination: "/allasok/index.html"
        },
        {
          source: "/allasok/:slug",
          destination: "/allasok/:slug/index.html"
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
