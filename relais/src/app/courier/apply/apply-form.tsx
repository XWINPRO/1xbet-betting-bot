"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileCheck2, Upload } from "lucide-react";
import { applyPlatformCourierAction } from "@/lib/actions/courier";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { downscale } from "@/components/ui/image-uploader";
import { randomFileName } from "@/lib/storage";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/switch";
import { Notice } from "@/components/ui/page";
import { VEHICLES } from "@/lib/status";

export function ApplyForm({ userId, defaults }: { userId: string; defaults: { full_name: string; phone: string } }) {
  const [v, setV] = React.useState({ ...defaults, vehicle_type: "moto", vehicle_plate: "", zone: "" });
  const [doc, setDoc] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [accept, setAccept] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setFormError(null);
        const res = await applyPlatformCourierAction({ ...v, id_document_path: doc, accept_terms: accept });
        setPending(false);
        if (res && !res.ok) {
          setErrors(res.fieldErrors ?? {});
          setFormError(res.error);
        }
      }}
    >
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <Field label="Nom complet" htmlFor="ap-name" error={errors.full_name}>
        <Input id="ap-name" className="h-11 text-base" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
      </Field>
      <Field label="Téléphone (WhatsApp)" htmlFor="ap-phone" error={errors.phone}>
        <Input id="ap-phone" type="tel" className="h-11 text-base" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Moyen de transport" htmlFor="ap-vehicle" error={errors.vehicle_type}>
          <NativeSelect id="ap-vehicle" className="h-11 text-base" value={v.vehicle_type} onChange={(e) => setV({ ...v, vehicle_type: e.target.value })}>
            {Object.entries(VEHICLES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Immatriculation" htmlFor="ap-plate" optional>
          <Input id="ap-plate" className="h-11 text-base" value={v.vehicle_plate} onChange={(e) => setV({ ...v, vehicle_plate: e.target.value })} />
        </Field>
      </div>
      <Field label="Zone de travail" htmlFor="ap-zone" error={errors.zone} hint="Ville et quartiers où vous travaillez.">
        <Input id="ap-zone" className="h-11 text-base" value={v.zone} onChange={(e) => setV({ ...v, zone: e.target.value })} placeholder="Ex. Douala — Akwa, Bonanjo, Deido" />
      </Field>
      <Field label="Pièce d'identité" optional hint="Photo ou PDF de votre CNI ou permis. Visible uniquement par l'administration.">
        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line-strong px-3 py-3 text-[13.5px] text-ink-2 hover:bg-subtle">
          {doc ? <FileCheck2 className="size-5 text-success" /> : <Upload className="size-5 text-ink-3" />}
          {uploading ? "Envoi…" : doc ? "Document ajouté — remplacer" : "Ajouter un document"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const prepared = file.type === "application/pdf" ? file : await downscale(file, 1800);
                if (prepared.size > 8 * 1024 * 1024) throw new Error("Fichier trop lourd (8 Mo maximum).");
                const path = `${userId}/${randomFileName(prepared)}`;
                const { error } = await getSupabaseBrowserClient().storage.from("courier-documents").upload(path, prepared, { contentType: prepared.type });
                if (error) throw new Error("Envoi impossible.");
                setDoc(path);
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
      </Field>
      <label className="flex items-start gap-2.5 text-[13.5px] text-ink-2">
        <Checkbox className="mt-0.5" checked={accept} onCheckedChange={(c) => setAccept(c === true)} />
        <span>
          J&apos;accepte de partager ma position GPS pendant mes courses et lorsque je me déclare disponible, et je certifie l&apos;exactitude de mes informations.
        </span>
      </label>
      {errors.accept_terms ? <p className="-mt-2 text-xs text-danger-ink">{errors.accept_terms}</p> : null}
      <Button type="submit" size="lg" variant="primary" loading={pending} disabled={uploading}>
        Envoyer ma candidature
      </Button>
    </form>
  );
}
