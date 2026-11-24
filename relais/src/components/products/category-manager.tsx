"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Tags, Trash2 } from "lucide-react";
import { createCategoryAction, deleteCategoryAction, renameCategoryAction } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function CategoryManager({ categories }: { categories: { id: string; name: string; count: number }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [name, setName] = React.useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Tags /> Catégories
      </Button>
      <DialogContent title="Catégories" description="Organisez votre catalogue et la navigation de votre boutique.">
        <form
          className="mb-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await createCategoryAction(name);
            if (!res.ok) return toast.error(res.error);
            setName("");
            router.refresh();
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la catégorie" />
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Ajouter
          </Button>
        </form>
        {categories.length === 0 ? (
          <p className="text-[13px] text-ink-3">Aucune catégorie.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                {editing === c.id ? (
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8" autoFocus />
                ) : (
                  <span className="flex-1 text-[13.5px]">
                    {c.name} <span className="text-xs text-ink-3">· {c.count} produit(s)</span>
                  </span>
                )}
                {editing === c.id ? (
                  <Button
                    size="icon-sm"
                    variant="primary"
                    aria-label="Enregistrer"
                    onClick={async () => {
                      const res = await renameCategoryAction(c.id, draft);
                      if (!res.ok) return toast.error(res.error);
                      setEditing(null);
                      router.refresh();
                    }}
                  >
                    <Check />
                  </Button>
                ) : (
                  <Button size="icon-sm" variant="ghost" aria-label="Renommer" onClick={() => (setEditing(c.id), setDraft(c.name))}>
                    <Pencil />
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="danger-ghost"
                  aria-label="Supprimer"
                  onClick={async () => {
                    const res = await deleteCategoryAction(c.id);
                    if (!res.ok) return toast.error(res.error);
                    toast.success(res.message ?? "Supprimée.");
                    router.refresh();
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
