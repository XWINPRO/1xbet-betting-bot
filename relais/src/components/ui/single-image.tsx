"use client";

import * as React from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadStoreAsset } from "@/components/ui/image-uploader";
import { Button } from "@/components/ui/button";
import { publicAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export function SingleImageField({
  storeId,
  folder,
  value,
  onChange,
  aspect = "square",
  maxSize = 800,
}: {
  storeId: string;
  folder: string;
  value: string | null;
  onChange: (path: string | null) => void;
  aspect?: "square" | "banner";
  maxSize?: number;
}) {
  const { t } = useI18n();
  const [uploading, setUploading] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const url = publicAssetUrl(value);
  return (
    <div className="flex items-center gap-4">
      <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-subtle", aspect === "square" ? "size-20" : "h-20 w-48")}>
        {uploading ? (
          <LoaderCircle className="size-5 animate-spin text-ink-3" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-5 text-ink-4" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()} disabled={uploading}>
          {value ? t("Remplacer") : t("Choisir une image")}
        </Button>
        {value ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            <Trash2 /> {t("Retirer")}
          </Button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          try {
            onChange(await uploadStoreAsset(storeId, folder, file, maxSize));
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setUploading(false);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
