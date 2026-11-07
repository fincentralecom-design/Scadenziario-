/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Su Netlify (NETLIFY=true durante la build) i dati vengono salvati in Netlify Blobs.
  env: { STORAGE_DRIVER: process.env.STORAGE_DRIVER || (process.env.NETLIFY ? "netlify-blobs" : "") },
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};
export default nextConfig;
