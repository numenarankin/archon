import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't pick up a parent lockfile.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      // Uploads (PDFs, well logs, images) flow through Server Actions, which
      // buffer the whole request body. The 1MB default is far too small.
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
