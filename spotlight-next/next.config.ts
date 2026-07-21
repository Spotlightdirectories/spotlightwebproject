import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS folder, so Next.js doesn't get confused
  // by a stray package-lock.json sitting higher up in C:\Users\Dell.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
