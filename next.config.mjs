/** @type {import('next').NextConfig} */
const nextConfig = {
  // Data now lives in Neon Postgres, accessed via @neondatabase/serverless
  // (pure JS, no native binary and no bundled .db file to trace).
};

export default nextConfig;
