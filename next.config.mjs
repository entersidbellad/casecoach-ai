/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externalize native modules from bundling
  serverExternalPackages: ['better-sqlite3', 'pdf-parse'],
  turbopack: {},
};

export default nextConfig;
