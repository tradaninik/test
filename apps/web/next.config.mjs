/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mi/engine', '@mi/food-db'],
  experimental: {
    // PWA support will be wired via a custom manifest + service worker (no extra plugin
    // dependency to keep install lean and stable on Next 15 / React 19).
  },
};

export default nextConfig;
