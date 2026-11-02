import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Everything is read live from the local Python backend, so pages render on request.
  async redirects() {
    return [{ source: "/read", destination: "/read/act/1", permanent: false }];
  },
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
