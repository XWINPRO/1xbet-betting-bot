import { redirect } from "next/navigation";
import { homePathFor, requireViewer } from "@/lib/auth";

/** Aiguillage après connexion selon le rôle de l'utilisateur. */
export default async function HomeRedirect() {
  const viewer = await requireViewer("/home");
  redirect(homePathFor(viewer));
}
