import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    // Imagens próprias são convertidas para WebP no upload e servidas por /api/media
    unoptimized: true,
  },
  serverExternalPackages: ["sharp", "sanitize-html"],
};

export default nextConfig;
