import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ dev: isDev }),
      },
    ];
  },
};

export default nextConfig;
