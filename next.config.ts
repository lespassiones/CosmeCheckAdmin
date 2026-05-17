import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Admin dashboard must never appear in search results.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // `nodeMiddleware` enables the Node.js runtime for middleware. The flag is
    // supported at runtime in Next.js 15.5 but missing from ExperimentalConfig
    // typings, so we widen the object to bypass the build-time type check.
    ...({ nodeMiddleware: true } as Record<string, unknown>),
    optimizePackageImports: [
      "@supabase/supabase-js",
      "@supabase/ssr",
      "lucide-react",
      "recharts",
    ],
  },
  images: {
    // Catalogue product images come from the public CosmetWiki Supabase
    // storage bucket. Allow any *.supabase.co host so the `next/image`
    // optimizer can fetch them.
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/**" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default config;
