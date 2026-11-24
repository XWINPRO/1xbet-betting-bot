import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${env.appName} — Livreur`,
    short_name: env.appName,
    description: "Espace livreur : courses, navigation et suivi GPS.",
    start_url: "/courier",
    display: "standalone",
    background_color: "#F4F5F7",
    theme_color: "#17202C",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
