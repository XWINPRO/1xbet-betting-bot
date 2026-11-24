"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ellipsis, ExternalLink, EyeOff, Eye, MessageCircle, Pencil, Link2 } from "lucide-react";
import { setProductStatusAction } from "@/lib/actions/products";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import type { ProductStatus } from "@/types/domain";

export function ProductStatusToggle({ id, status, disabled }: { id: string; status: ProductStatus; disabled?: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(status === "active");
  const [pending, startTransition] = React.useTransition();
  return (
    <Switch
      checked={checked}
      disabled={disabled || pending || status === "archived"}
      aria-label={checked ? "Masquer le produit" : "Mettre en vente"}
      onCheckedChange={(c) => {
        setChecked(c);
        startTransition(async () => {
          const res = await setProductStatusAction(id, c ? "active" : "inactive");
          if (!res.ok) {
            setChecked(!c);
            toast.error(res.error);
          } else router.refresh();
        });
      }}
    />
  );
}

export function ProductRowActions({ id, status, shareUrl, shareText, canManage }: { id: string; status: ProductStatus; shareUrl: string | null; shareText: string; canManage: boolean }) {
  const router = useRouter();
  async function setStatus(s: ProductStatus) {
    const res = await setProductStatusAction(id, s);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="Actions">
          <Ellipsis />
        </Button>
      </DropdownTrigger>
      <DropdownContent>
        {canManage ? (
          <DropdownItem asChild>
            <Link href={`/dashboard/products/${id}`}>
              <Pencil /> Modifier
            </Link>
          </DropdownItem>
        ) : null}
        {shareUrl ? (
          <>
            <DropdownItem asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Partager sur WhatsApp
              </a>
            </DropdownItem>
            <DropdownItem
              onSelect={async () => {
                await navigator.clipboard.writeText(shareUrl);
                toast.success("Lien copié.");
              }}
            >
              <Link2 /> Copier le lien
            </DropdownItem>
            <DropdownItem asChild>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Voir en boutique
              </a>
            </DropdownItem>
          </>
        ) : null}
        {canManage && status === "archived" ? (
          <>
            <DropdownSeparator />
            <DropdownItem onSelect={() => void setStatus("inactive")}>
              <Eye /> Désarchiver
            </DropdownItem>
          </>
        ) : canManage ? (
          <>
            <DropdownSeparator />
            <DropdownItem onSelect={() => void setStatus("archived")}>
              <EyeOff /> Archiver
            </DropdownItem>
          </>
        ) : null}
      </DropdownContent>
    </Dropdown>
  );
}
