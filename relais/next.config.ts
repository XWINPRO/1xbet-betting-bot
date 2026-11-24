import type { NextConfig } from "next";

/**
 * Relais — configuration Next.js
 *
 * Cache Components est désactivé volontairement : toutes les pages de
 * l'application dépendent de la session (cookies) et des droits RLS de
 * l'utilisateur ; le rendu dynamique par requête est le modèle adapté.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La géolocalisation n'est autorisée que pour l'application elle-même.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Les pages de suivi publiques ne doivent pas être indexées.
      { source: "/track/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/invite/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
