import { z } from "zod";
import { money, optionalCoord, optionalPhoneField, optionalText, phoneField } from "@/lib/validation/common";

// --- Authentification -------------------------------------------------
export const loginSchema = z.object({
  email: z.email("Adresse e-mail invalide").trim().toLowerCase(),
  password: z.string().min(1, "Mot de passe obligatoire"),
  next: z.string().optional(),
});

export const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Nom trop court").max(120),
  phone: phoneField,
  email: z.email("Adresse e-mail invalide").trim().toLowerCase(),
  password: z.string().min(8, "8 caractères minimum").max(72),
  intent: z.enum(["merchant", "courier", "customer"]).default("merchant"),
  next: z.string().optional(),
});

export const passwordSchema = z
  .object({
    password: z.string().min(8, "8 caractères minimum").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] });

// --- Boutique ---------------------------------------------------------------
export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "3 caractères minimum")
  .max(48, "48 caractères maximum")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lettres minuscules, chiffres et tirets uniquement");

export const createStoreSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(80),
  slug: slugField,
  category: optionalText(60),
  phone: phoneField,
  whatsapp: optionalPhoneField,
  city: optionalText(80),
  address: optionalText(300),
  default_delivery_fee: money.default(0),
});

const hoursDay = z.object({
  day: z.number().int().min(1).max(7),
  closed: z.boolean(),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});

export const storeSettingsSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(80),
  slug: slugField,
  description: optionalText(1000),
  category: optionalText(60),
  phone: optionalPhoneField,
  whatsapp: optionalPhoneField,
  email: z.union([z.literal(""), z.email("Adresse e-mail invalide")]).optional().transform((v) => v || null),
  address: optionalText(300),
  city: optionalText(80),
  lat: optionalCoord,
  lng: optionalCoord,
  logo_path: z.string().nullable().optional(),
  banner_path: z.string().nullable().optional(),
  opening_hours: z.array(hoursDay).max(7),
  delivery_terms: optionalText(2000),
  default_delivery_fee: money,
  accepted_payment_methods: z
    .array(z.enum(["cash_on_delivery", "manual", "orange_money", "mtn_momo", "other"]))
    .min(1, "Choisissez au moins un moyen de paiement"),
  is_published: z.boolean(),
});

export const storeOperationsSchema = z.object({
  courier_max_active_jobs: z.coerce.number().int().min(1).max(10),
  share_courier_phone: z.boolean(),
});

// --- Catalogue --------------------------------------------------------------
export const variantSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, "Nom de variante requis").max(80),
  price: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Prix invalide"),
  available: z.boolean().default(true),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(1, "Nom obligatoire").max(120),
    description: optionalText(3000),
    price: money,
    promo_price: z
      .union([z.number(), z.string()])
      .nullable()
      .optional()
      .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v))),
    category_id: z.string().uuid().nullable().optional().or(z.literal("")).transform((v) => v || null),
    sku: optionalText(60),
    track_stock: z.boolean(),
    stock: z
      .union([z.number(), z.string()])
      .nullable()
      .optional()
      .transform((v) => (v === "" || v === null || v === undefined ? null : Math.trunc(Number(v)))),
    status: z.enum(["active", "inactive", "archived"]),
    images: z.array(z.string().min(1)).max(8),
    variants: z.array(variantSchema).max(30),
  })
  .superRefine((d, ctx) => {
    if (d.promo_price !== null && (!Number.isFinite(d.promo_price) || d.promo_price < 0 || d.promo_price >= d.price)) {
      ctx.addIssue({ code: "custom", path: ["promo_price"], message: "Le prix promotionnel doit être inférieur au prix" });
    }
    if (d.track_stock && (d.stock === null || !Number.isFinite(d.stock) || d.stock < 0)) {
      ctx.addIssue({ code: "custom", path: ["stock"], message: "Indiquez la quantité en stock" });
    }
  });

export const categorySchema = z.object({ name: z.string().trim().min(1, "Nom requis").max(60) });

// --- Clients ------------------------------------------------------------------
export const customerSchema = z.object({
  full_name: z.string().trim().min(1, "Nom obligatoire").max(120),
  phone: phoneField,
  whatsapp: optionalPhoneField,
  email: z.union([z.literal(""), z.email("Adresse e-mail invalide")]).optional().transform((v) => v || null),
  address: optionalText(300),
  lat: optionalCoord,
  lng: optionalCoord,
  notes: optionalText(1000),
});

// --- Commandes ----------------------------------------------------------------
export const orderItemInput = z.object({
  product_id: z.string().uuid().nullable().optional(),
  variant_id: z.string().nullable().optional(),
  name: z.string().trim().max(120).optional(),
  unit_price: z.coerce.number().min(0).max(100_000_000),
  quantity: z.coerce.number().int().min(1, "Quantité minimale : 1").max(999),
});

export const createOrderSchema = z
  .object({
    customer_id: z.string().uuid().nullable().optional(),
    customer: z.object({ name: z.string().trim().max(120), phone: z.string().trim().max(30) }),
    source: z.enum(["storefront", "whatsapp", "manual", "phone", "other"]),
    status: z.enum(["new", "confirmed"]),
    delivery_mode: z.enum(["delivery", "pickup"]),
    delivery_address: optionalText(300),
    delivery_lat: optionalCoord,
    delivery_lng: optionalCoord,
    delivery_fee: money,
    discount: money,
    payment_method: z.enum(["cash_on_delivery", "manual", "orange_money", "mtn_momo", "other"]),
    mark_paid: z.boolean(),
    instructions: optionalText(1000),
    internal_note: optionalText(1000),
    items: z.array(orderItemInput).min(1, "Ajoutez au moins un article").max(100),
  })
  .superRefine((d, ctx) => {
    if (!d.customer_id) {
      if (d.customer.name.length < 2) ctx.addIssue({ code: "custom", path: ["customer", "name"], message: "Nom du client requis" });
      if (d.customer.phone.length < 6) ctx.addIssue({ code: "custom", path: ["customer", "phone"], message: "Téléphone requis" });
    }
    if (d.delivery_mode === "delivery" && !d.delivery_address && !d.customer_id) {
      ctx.addIssue({ code: "custom", path: ["delivery_address"], message: "Adresse de livraison requise" });
    }
    d.items.forEach((item, i) => {
      if (!item.product_id && !item.name) ctx.addIssue({ code: "custom", path: ["items", i, "name"], message: "Nom requis" });
    });
  });

export const orderDetailsSchema = z.object({
  customer_name: z.string().trim().min(2, "Nom trop court").max(120),
  customer_phone: phoneField,
  delivery_mode: z.enum(["delivery", "pickup"]),
  delivery_address: optionalText(300),
  delivery_lat: optionalCoord,
  delivery_lng: optionalCoord,
  delivery_fee: money,
  discount: money,
  payment_method: z.enum(["cash_on_delivery", "manual", "orange_money", "mtn_momo", "other"]),
  instructions: optionalText(1000),
  internal_note: optionalText(1000),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Montant invalide").max(100_000_000),
  method: z.enum(["cash_on_delivery", "manual", "orange_money", "mtn_momo", "other"]),
  provider_reference: optionalText(120),
  notes: optionalText(500),
});

// --- Livreurs -------------------------------------------------------------------
export const courierFormSchema = z.object({
  full_name: z.string().trim().min(2, "Nom trop court").max(120),
  phone: phoneField,
  vehicle_type: z.enum(["moto", "velo", "voiture", "tricycle", "camionnette", "pieton"]).nullable().optional().or(z.literal("")).transform((v) => v || null),
  vehicle_plate: optionalText(30),
  zone: optionalText(120),
  zone_lat: optionalCoord,
  zone_lng: optionalCoord,
  zone_radius_km: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v <= 100), "Rayon invalide (1 à 100 km)"),
  notes: optionalText(1000),
});

export const courierApplicationSchema = z.object({
  full_name: z.string().trim().min(2, "Nom trop court").max(120),
  phone: phoneField,
  vehicle_type: z.enum(["moto", "velo", "voiture", "tricycle", "camionnette", "pieton"], { error: "Choisissez un moyen de transport" }),
  vehicle_plate: optionalText(30),
  zone: z.string().trim().min(2, "Indiquez votre zone de travail").max(120),
  id_document_path: z.string().nullable().optional(),
  accept_terms: z.literal(true, { error: "Vous devez accepter les conditions" }),
});

// --- Livraison ponctuelle ---------------------------------------------------------
export const onDemandSchema = z.object({
  sender: z.object({ name: z.string().trim().min(2, "Nom trop court").max(120), phone: phoneField }),
  pickup: z.object({
    address: z.string().trim().min(3, "Adresse de collecte requise").max(300),
    lat: z.number({ error: "Placez le point de collecte sur la carte" }),
    lng: z.number({ error: "Placez le point de collecte sur la carte" }),
  }),
  recipient: z.object({ name: z.string().trim().min(2, "Nom trop court").max(120), phone: phoneField }),
  dropoff: z.object({
    address: z.string().trim().min(3, "Adresse de destination requise").max(300),
    lat: z.number({ error: "Placez la destination sur la carte" }),
    lng: z.number({ error: "Placez la destination sur la carte" }),
  }),
  package_type: z.enum(["document", "small", "medium", "large", "fragile", "food"], { error: "Choisissez le type de colis" }),
  description: optionalText(500),
  instructions: optionalText(1000),
  payment_method: z.enum(["cash_on_delivery", "orange_money", "mtn_momo", "manual"]),
  payer: z.enum(["sender", "recipient"]),
  collect_amount: money.default(0),
  expected_price: z.number().nonnegative(),
});

// --- Réclamations -----------------------------------------------------------------
export const claimSchema = z.object({
  category: z.enum(["damaged", "late", "not_delivered", "wrong_item", "payment", "behaviour", "address", "unreachable", "other"]),
  description: z.string().trim().min(5, "Décrivez le problème (5 caractères minimum)").max(2000),
  name: z.string().trim().min(2, "Nom trop court").max(120),
  phone: phoneField,
});

// --- Tarification -------------------------------------------------------------------
export const pricingRuleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  base_fee: money,
  per_km_fee: money,
  min_fee: money,
  max_distance_km: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v))),
  rounding: z.coerce.number().int().min(1).max(10000),
  surcharges: z.record(z.string(), z.coerce.number().min(0)),
  is_active: z.boolean(),
});
