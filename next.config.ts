import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next 16 blocks cross-origin dev resources by default. Allow local loopback
  // so the dev server works whether opened via localhost or 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
