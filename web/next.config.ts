import type { NextConfig } from "next";

// Parse backend URL from env to extract hostname and port for remotePatterns
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function parseBackendPatterns(url: string) {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.replace(":", "") as "http" | "https";
    const hostname = parsed.hostname;
    const port = parsed.port;
    return [{ protocol, hostname, port, pathname: "/uploads/**" }];
  } catch {
    // Fallback if URL parsing fails
    return [
      { protocol: "http" as const, hostname: "localhost", port: "4000", pathname: "/uploads/**" },
      { protocol: "http" as const, hostname: "127.0.0.1", port: "4000", pathname: "/uploads/**" },
    ];
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    qualities: [60, 75, 90],
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      // Backend dynamique (depuis NEXT_PUBLIC_API_URL)
      ...parseBackendPatterns(apiUrl),
      // Toujours autoriser localhost en dev
      { protocol: "http", hostname: "localhost", port: "4000", pathname: "/uploads/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "4000", pathname: "/uploads/**" },
      // Images de démonstration
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      // Images produits tiers
      { protocol: "https", hostname: "omron-healthcare.com", pathname: "/**" },
      { protocol: "https", hostname: "www.omron-healthcare.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "www.beurer.com", pathname: "/**" },
      { protocol: "https", hostname: "pim.beurer.com", pathname: "/**" },
      { protocol: "https", hostname: "www.rossmax.com", pathname: "/**" },
    ],
  },
  // Origines autorisées pour le dev réseau local (configurable via ALLOWED_DEV_ORIGINS)
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((s) => s.trim())
    : [
        "localhost",
        "127.0.0.1",
      ],
};

export default nextConfig;
