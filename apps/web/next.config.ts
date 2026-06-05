import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@seo-tool/api", "@seo-tool/domain-model", "@seo-tool/shared-config"],
};

export default nextConfig;
