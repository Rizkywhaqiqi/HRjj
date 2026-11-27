import type { NextConfig } from "next";
import {
  securityHeaders,
  htmlCsp,
  privateHeaders,
} from "./src/core/http/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const production = process.env.NODE_ENV === "production";
    const htmlPaths = [
      "/",
      "/login",
      "/ganti-password",
      "/dashboard/:path*",
      "/employees/:path*",
      "/contracts/:path*",
      "/letters/:path*",
      "/reports/:path*",
      "/settings/:path*",
      "/master-data/:path*",
    ];
    return [
      { source: "/:path*", headers: securityHeaders(production) },
      ...htmlPaths.map((source) => ({
        source,
        headers: [
          ...privateHeaders,
          { key: "Content-Security-Policy", value: htmlCsp(production) },
        ],
      })),
      { source: "/api/:path*", headers: privateHeaders },
    ];
  },
  allowedDevOrigins: ["192.168.68.143"],
  cacheComponents: true,
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
