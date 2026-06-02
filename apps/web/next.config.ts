import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@seo-tool/domain-model", "@seo-tool/shared-config"],
};

export default nextConfig;
