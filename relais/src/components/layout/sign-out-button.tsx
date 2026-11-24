import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton({ variant = "secondary", className }: { variant?: "secondary" | "ghost"; className?: string }) {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant={variant} className={className}>
        <LogOut /> Se déconnecter
      </Button>
    </form>
  );
}
