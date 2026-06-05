/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@seo-tool/api", "@seo-tool/domain-model", "@seo-tool/shared-config"]
};

export default nextConfig;
