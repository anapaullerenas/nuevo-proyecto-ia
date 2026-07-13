"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useState } from "react";
import { Check, ImageIcon, Loader2, UploadCloud } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type StyleReference = {
  id: string;
  file_name: string;
  storage_path: string;
  bucket_id: string;
  signed_url?: string | null;
  metadata?: { analysis_status?: string } | null;
};

type ReferenceItem = StyleReference & {
  status: "analizando" | "lista" | "error";
  message?: string;
};

export function ReferenceUploader({
  brandId,
  initialReferences,
  selectedIds,
  onSelectionChange,
  onItemsChange,
  selectionEnabled = true,
}: {
  brandId: string;
  initialReferences: StyleReference[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onItemsChange?: (ids: string[]) => void;
  selectionEnabled?: boolean;
}) {
  const [items, setItems] = useState<ReferenceItem[]>(
    initialReferences.map((reference) => ({
      ...reference,
      status: reference.metadata?.analysis_status === "error" ? "error" : "lista",
      message: reference.metadata?.analysis_status === "ready" ? "Estilo analizado" : "Referencia disponible",
    })),
  );
  const [isUploading, setIsUploading] = useState(false);

  function toggleReference(id: string) {
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id].slice(-10));
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 10 - items.length));
    if (!files.length) return;

    setIsUploading(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsUploading(false);
      return;
    }

    let nextSelectedIds = [...selectedIds];

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${user.id}/${brandId}/style-reference-${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("creative-assets").upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) continue;

      const { data: saved, error: insertError } = await supabase
        .from("brand_assets")
        .insert({
          brand_id: brandId,
          owner_id: user.id,
          bucket_id: "creative-assets",
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          kind: "style_reference",
          label: "Inspiración visual",
          metadata: { analysis_status: "processing" },
        })
        .select("id,file_name,storage_path,bucket_id,metadata")
        .single();
      if (insertError || !saved) continue;

      const { data: signed } = await supabase.storage.from("creative-assets").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      const item: ReferenceItem = {
        ...saved,
        signed_url: signed?.signedUrl || null,
        status: "analizando",
        message: "Leyendo estructura y estilo",
      };
      setItems((current) => {
        const next = [item, ...current].slice(0, 10);
        onItemsChange?.(next.map((reference) => reference.id));
        return next;
      });
      nextSelectedIds = [...nextSelectedIds, saved.id].slice(-10);
      onSelectionChange(nextSelectedIds);

      const analysisResponse = await fetch("/api/static-reference-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: saved.id }),
      });
      const analysis = await analysisResponse.json();
      setItems((current) =>
        current.map((reference) =>
          reference.id === saved.id
            ? {
                ...reference,
                status: analysisResponse.ok ? "lista" : "error",
                message: analysisResponse.ok ? "Estilo analizado" : analysis.error || "No se pudo analizar",
              }
            : reference,
        ),
      );
    }

    event.target.value = "";
    setIsUploading(false);
  }

  return (
    <div className="reference-uploader">
      <div className="reference-picker-row">
        <label className="reference-picker">
          {isUploading ? <Loader2 className="spin" size={18} /> : <UploadCloud size={18} />}
          <span><b>{isUploading ? "Preparando referencias..." : "Agregar referencias"}</b><small>JPG, PNG o WebP · máximo 10</small></span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleFiles} disabled={isUploading || items.length >= 10} />
        </label>
        <p><b>{selectionEnabled ? selectedIds.length : items.length}</b> {selectionEnabled ? "seleccionadas" : "guardadas"}</p>
      </div>

      {items.length > 0 && (
        <div className="reference-thumbnails">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={selectionEnabled && selectedIds.includes(item.id) ? "selected" : ""}
              onClick={() => selectionEnabled && toggleReference(item.id)}
              disabled={item.status === "analizando"}
              aria-disabled={!selectionEnabled}
            >
              {item.signed_url ? <img src={item.signed_url} alt={item.file_name} /> : <ImageIcon size={22} />}
              <span>{item.status === "analizando" ? <Loader2 className="spin" size={14} /> : <Check size={14} />}</span>
              <small>{item.message}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
