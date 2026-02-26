/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externalize native modules from bundling
  serverExternalPackages: ['pdf-parse', '@libsql/client', '@libsql/core'],
  turbopack: {},
};

export default nextConfig;
