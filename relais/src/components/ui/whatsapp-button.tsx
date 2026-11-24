import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Lien WhatsApp (wa.me) : ouvre WhatsApp avec le message prérempli, envoi manuel. */
export function WhatsAppButton({ href, label, size = "md", className }: { href: string | null; label: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  if (!href) return null;
  return (
    <Button asChild variant="whatsapp" size={size} className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle /> {label}
      </a>
    </Button>
  );
}
