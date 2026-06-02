import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@seo/domain-model", "@seo/shared-config"],
};

export default nextConfig;
