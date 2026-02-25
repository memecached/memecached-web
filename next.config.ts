import type { NextConfig } from "next";

const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: cloudfrontDomain
      ? [{ protocol: "https", hostname: cloudfrontDomain }]
      : [],
  },
};

export default nextConfig;
