import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  // Avoid Turbopack inferring wrong workspace root (multiple lockfiles)
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
