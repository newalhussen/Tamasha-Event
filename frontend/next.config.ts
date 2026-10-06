import type { NextConfig } from "next";

// The browser only ever talks to this app. `/api/*` is proxied to the Node.js backend, so the
// session cookie is first-party and client code needs no CORS or backend URL.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
