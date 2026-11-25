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
export type Plan = Tables<"plans">;
export type StoreSubscription = Tables<"store_subscriptions">;
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
  tracking_level: "status" | "live";
  store: { name: string | null; slug: string | null; logo_path: string | null; phone: string | null };
  order_reference: string | null;
  pickup: { label: string | null; address: string; lat: number | null; lng: number | null };
  dropoff: { label: string; address: string; lat: number | null; lng: number | null };
  package_type: string | null;
  distance_km: number | null;
  collect_amount: number;
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
  server_time: string;
};

/** Réponse de store_plan_info() : plan en vigueur et utilisation. */
export type PlanInfo = {
  code: string;
  tracking: Enums<"tracking_level">;
  max_couriers: number;
  max_staff: number;
  couriers_used: number;
  staff_used: number;
  ends_at: string | null;
  pending: boolean;
};

export type PaymentDetails = { payee_name: string | null; orange_money: string | null; mtn_momo: string | null };
