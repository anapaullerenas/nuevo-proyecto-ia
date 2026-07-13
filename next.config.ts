import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingIncludes: {
    "/api/static-generate": ["./assets/fonts/*.ttf"],
    "/api/static-edit": ["./assets/fonts/*.ttf"],
  },
};

export default nextConfig;
