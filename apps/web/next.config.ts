import type { NextConfig } from "next";

/**
 * The admin dashboard (contract §16.1 #6). A static export: nginx serves it at /admin/ on the
 * API's host, so it calls the API on the same origin and needs no CORS (deploy/nginx-maqar.conf).
 */
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/admin",
  trailingSlash: true,
  images: { unoptimized: true },
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
