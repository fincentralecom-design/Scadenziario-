import { randomBytes } from "node:crypto";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Su Netlify (NETLIFY=true durante la build) i dati vengono salvati in Netlify Blobs.
  env: {
    STORAGE_DRIVER: process.env.STORAGE_DRIVER || (process.env.NETLIFY ? "netlify-blobs" : ""),
    // Chiave casuale generata a ogni pubblicazione: usata solo se CRON_SECRET non è impostata.
    // (È usata solo da codice lato server; impostare CRON_SECRET la rende stabile.)
    BUILD_SECRET: randomBytes(32).toString("base64url"),
  },
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};
export default nextConfig;
