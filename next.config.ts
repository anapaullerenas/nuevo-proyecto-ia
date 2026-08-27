import type { NextConfig } from "next";

const sharpRuntimeFiles = [
  "./node_modules/sharp/**/*",
  "./node_modules/@img/sharp-linux-x64/**/*",
  "./node_modules/@img/sharp-libvips-linux-x64/**/*",
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingIncludes: {
    "/api/static-generate": ["./assets/fonts/*.ttf", ...sharpRuntimeFiles],
    "/api/static-edit": ["./assets/fonts/*.ttf", ...sharpRuntimeFiles],
    "/api/static-reference-analysis": sharpRuntimeFiles,
  },
};

export default nextConfig;
