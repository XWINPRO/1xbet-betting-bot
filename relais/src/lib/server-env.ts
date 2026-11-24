import "server-only";

/** Configuration réservée au serveur (jamais envoyée au navigateur). */
export const serverEnv = {
  geocodingUrl: (process.env.GEOCODING_URL ?? "").replace(/\/$/, ""),
  geocodingContact: process.env.GEOCODING_CONTACT ?? "",
  routingUrl: (process.env.ROUTING_URL ?? "").replace(/\/$/, ""),
  whatsappToken: process.env.WHATSAPP_CLOUD_API_TOKEN ?? "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
} as const;

export const mapServices = {
  geocoding: Boolean(serverEnv.geocodingUrl),
  routing: Boolean(serverEnv.routingUrl),
};
