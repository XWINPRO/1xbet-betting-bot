import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const phoneField = z
  .string()
  .trim()
  .min(1, "Numéro obligatoire")
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide" });
      return z.NEVER;
    }
    return n;
  });

export const optionalPhoneField = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide" });
      return z.NEVER;
    }
    return n;
  });

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .optional()
    .transform((v) => (v ? v : null));

export const money = z.coerce.number({ error: "Montant invalide" }).min(0, "Le montant doit être positif").max(100_000_000, "Montant trop élevé");

export const optionalCoord = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
