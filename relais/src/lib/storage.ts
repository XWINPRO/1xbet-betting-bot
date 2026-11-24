import { env } from "@/lib/env";

export const BUCKETS = {
  storeAssets: "store-assets",
  deliveryProofs: "delivery-proofs",
  courierDocuments: "courier-documents",
} as const;

/** URL publique d'un fichier du bucket public « store-assets ». */
export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${env.supabaseUrl}/storage/v1/object/public/${BUCKETS.storeAssets}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function fileExtension(file: File): string {
  const fromType: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
  return fromType[file.type] ?? (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 5);
}

export function randomFileName(file: File) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${id}.${fileExtension(file)}`;
}
