/**
 * Configuration publique (exposée au navigateur). Les références à
 * process.env.NEXT_PUBLIC_* doivent rester littérales pour être injectées
 * au moment du build.
 */
function parseCenter(value: string | undefined): [number, number] {
  const [lat, lng] = (value ?? "").split(",").map((v) => Number.parseFloat(v.trim()));
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return [4.0511, 9.7679]; // Douala
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, ""),
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Relais",
  defaultCountryCode: (process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "237").replace(/\D/g, ""),
  mapCenter: parseCenter(process.env.NEXT_PUBLIC_DEFAULT_MAP_CENTER),
  timezone: process.env.NEXT_PUBLIC_TIMEZONE || "Africa/Douala",
  tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution:
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
} as const;

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseKey);
}
