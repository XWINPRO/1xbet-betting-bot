import type { Database } from "@/types/database";

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
export type RpcReturn<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Returns"];

export type Profile = Tables<"profiles">;
export type Store = Tables<"stores">;
export type Product = Tables<"products">;
export type ProductCategory = Tables<"product_categories">;
export type Customer = Tables<"customers">;
export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type OrderEvent = Tables<"order_events">;
export type Courier = Tables<"couriers">;
export type DeliveryJob = Tables<"delivery_jobs">;
export type DeliveryEvent = Tables<"delivery_events">;
export type Transaction = Tables<"transactions">;
export type Claim = Tables<"claims">;
export type PricingRule = Tables<"pricing_rules">;
export type Invitation = Tables<"invitations">;

export type OrderStatus = Enums<"order_status">;
export type OrderSource = Enums<"order_source">;
export type JobStatus = Enums<"job_status">;
export type PaymentMethod = Enums<"payment_method">;
export type PaymentStatus = Enums<"payment_status">;
export type ProductStatus = Enums<"product_status">;
export type CourierAccountStatus = Enums<"courier_account_status">;
export type TransactionStatus = Enums<"transaction_status">;
export type ClaimStatus = Enums<"claim_status">;

export type EffectiveCourierStatus = "available" | "busy" | "unavailable" | "offline" | "inactive";
export type BoardCourier = RpcReturn<"store_courier_board">[number];
export type AdminBoardCourier = RpcReturn<"admin_courier_board">[number];

export type ProductVariant = { id: string; name: string; price: number | null; available: boolean };

export type OpeningHoursDay = { day: number; closed: boolean; open: string; close: string };

/** Réponse de get_tracking() — données publiques minimales. */
export type TrackingPayload = {
  reference: string;
  status: JobStatus;
  source: "store_order" | "on_demand";
  store: { name: string; slug: string | null; logo_path: string | null; phone: string | null } | null;
  order_reference: string | null;
  pickup: { label: string; address: string; lat: number | null; lng: number | null };
  dropoff: { label: string; address: string; lat: number | null; lng: number | null };
  package_type: string | null;
  distance_km: number | null;
  collect_amount: number;
  price: number | null;
  currency: string;
  payment_method: PaymentMethod;
  courier: { first_name: string; vehicle_type: string | null; phone: string | null } | null;
  position: { lat: number; lng: number; accuracy: number | null; heading: number | null; at: string; stale: boolean } | null;
  live: boolean;
  timestamps: Record<
    "created_at" | "accepted_at" | "picked_up_at" | "in_transit_at" | "delivered_at" | "failed_at" | "cancelled_at" | "recipient_confirmed_at",
    string | null
  >;
  events: { type: string; status: JobStatus | null; at: string }[];
  stale_after_s: number;
  can_confirm: boolean;
  can_cancel: boolean;
  server_time: string;
};

export type DeliveryQuote = {
  distance_km: number;
  distance_method: "straight_line";
  price: number;
  currency: string;
  rule: string;
  breakdown: { base_fee: number; per_km_fee: number; distance_fee: number; min_fee: number; surcharge: number; rounding: number };
};
