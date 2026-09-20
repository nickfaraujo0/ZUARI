import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos (several per submission) and documents are posted through server actions.
  experimental: { serverActions: { bodySizeLimit: "40mb" } },
};

export default nextConfig;
