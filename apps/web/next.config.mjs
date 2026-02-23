/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@forgeai/shared"],
  output: "standalone",
};

export default nextConfig;
