"use client";

import * as React from "react";
import { ImagePlus, LoaderCircle, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, publicAssetUrl, randomFileName } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Redimensionne côté navigateur (≤ maxSize px) pour limiter le poids des photos. */
async function downscale(file: File, maxSize: number): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/webp") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** Envoi direct vers Supabase Storage (bucket public store-assets/<store_id>/…). */
export async function uploadStoreAsset(storeId: string, folder: string, file: File, maxSize = 1600): Promise<string> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error("Format accepté : JPEG, PNG ou WebP.");
  const prepared = await downscale(file, maxSize);
  if (prepared.size > MAX_IMAGE_BYTES) throw new Error("Image trop lourde (5 Mo maximum).");
  const path = `${storeId}/${folder}/${randomFileName(prepared)}`;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from("store-assets").upload(path, prepared, { cacheControl: "31536000", contentType: prepared.type, upsert: false });
  if (error) throw new Error("Envoi de l'image impossible.");
  return path;
}

export function ImageListUploader({
  storeId,
  value,
  onChange,
  max = 8,
}: {
  storeId: string;
  value: string[];
  onChange: (paths: string[]) => void;
  max?: number;
}) {
  const [uploading, setUploading] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, max - value.length);
    setUploading(list.length);
    const added: string[] = [];
    for (const file of list) {
      try {
        added.push(await uploadStoreAsset(storeId, "products", file));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onChange([...value, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((path, i) => (
          <div key={path} className="group relative aspect-square overflow-hidden rounded-md border border-line bg-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicAssetUrl(path)!} alt="" className="size-full object-cover" />
            {i === 0 ? <span className="absolute top-1.5 left-1.5 rounded-xs bg-ink/80 px-1.5 py-0.5 text-[10.5px] font-medium text-white">Principale</span> : null}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              {i > 0 ? (
                <button
                  type="button"
                  aria-label="Définir comme principale"
                  className="rounded-sm bg-surface/95 p-1 text-ink shadow-sm hover:bg-surface"
                  onClick={() => onChange([path, ...value.filter((p) => p !== path)])}
                >
                  <ArrowLeft className="size-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Retirer l'image"
                className="rounded-sm bg-surface/95 p-1 text-danger-ink shadow-sm hover:bg-surface"
                onClick={() => onChange(value.filter((p) => p !== path))}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="flex aspect-square items-center justify-center rounded-md border border-line bg-subtle">
            <LoaderCircle className="size-5 animate-spin text-ink-3" />
          </div>
        ))}
        {value.length + uploading < max ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn("flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong text-xs text-ink-3 transition-colors hover:border-ink-4 hover:bg-subtle hover:text-ink")}
          >
            <ImagePlus className="size-5" />
            Ajouter
          </button>
        ) : null}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} multiple className="sr-only" onChange={(e) => void handleFiles(e.target.files)} />
      <p className="mt-2 text-xs text-ink-3">JPEG, PNG ou WebP · {max} images maximum · redimensionnées automatiquement.</p>
    </div>
  );
}
