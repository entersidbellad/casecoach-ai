/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externalize native modules from bundling
  serverExternalPackages: ['pdf-parse'],
  turbopack: {},
};

export default nextConfig;
