import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data files in /data are read on the server at request time.
  outputFileTracingIncludes: { "/api/**": ["./data/**/*"] },
};

export default nextConfig;
