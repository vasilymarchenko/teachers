import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the Dockerfile's runtime stage: `next build` emits a
  // self-contained `.next/standalone` server instead of relying on a full
  // `node_modules` in the final image.
  output: "standalone",
};

export default nextConfig;
