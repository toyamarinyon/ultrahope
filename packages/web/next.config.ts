import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	serverExternalPackages: ["@libsql/isomorphic-ws"],
};

export default nextConfig;
