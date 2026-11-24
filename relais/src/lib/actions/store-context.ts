"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STORE_COOKIE, getViewer } from "@/lib/auth";

export async function switchStoreAction(formData: FormData) {
  const storeId = String(formData.get("store_id") ?? "");
  const viewer = await getViewer();
  if (!viewer || !viewer.memberships.some((m) => m.store_id === storeId)) redirect("/dashboard");
  const cookieStore = await cookies();
  cookieStore.set(STORE_COOKIE, storeId, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
