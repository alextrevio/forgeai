import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@forgeai/shared"],
  output: "standalone",
};

export default withSentryConfig(nextConfig, {
  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_WEB,
  // Only upload source maps in CI with auth token present
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Automatically tree-shake Sentry logger statements
  disableLogger: true,
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
  // Skips source map upload if no auth token (local dev)
  ...(process.env.SENTRY_AUTH_TOKEN ? {} : { dryRun: true }),
});
