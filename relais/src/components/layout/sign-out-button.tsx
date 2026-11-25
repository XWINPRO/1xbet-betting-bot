"use client";

import { LogOut } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton({ variant = "secondary", className }: { variant?: "secondary" | "ghost"; className?: string }) {
  const { t } = useI18n();
  return (
    <form action={signOutAction}>
      <Button type="submit" variant={variant} className={className}>
        <LogOut /> {t("Se déconnecter")}
      </Button>
    </form>
  );
}
