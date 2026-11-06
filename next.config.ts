import type { NextConfig } from "next";

/**
 * Content Security Policy: solo risorse del sito; i moduli possono
 * reindirizzare solo verso Supabase Auth e Google (accesso studenti).
 * 'unsafe-inline' per gli script è richiesto dal rendering di Next.js
 * senza nonce; 'unsafe-eval' solo in sviluppo.
 */
function contentSecurityPolicy() {
  let supabase = "";
  try {
    supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {}
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}`,
    `form-action 'self'${supabase ? ` ${supabase}` : ""} https://accounts.google.com`,
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

/** Informativa privacy ufficiale della scuola: /privacy rimanda lì (link usato anche da Google OAuth). */
const SCHOOL_PRIVACY_URL = "https://liceovoltacomo.edu.it/privacy-policy/";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/privacy", destination: SCHOOL_PRIVACY_URL, permanent: false }];
  },
  /* config options here */
  // cartella di build separata per i test end-to-end (npm run test:auth)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
