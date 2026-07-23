"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useState } from "react";
import {
  Bookmark,
  Check,
  ImageIcon,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type StyleReference = {
  id: string;
  file_name: string;
  storage_path: string;
  bucket_id: string;
  signed_url?: string | null;
  metadata?: {
    analysis_status?: string;
    saved_as_style?: boolean;
    custom_style_name?: string;
    analysis?: {
      matched_archetype_id?: string | null;
      matched_archetype_label?: string | null;
      match_confidence?: number;
      recipe_mode?: "catalog" | "custom";
    };
  } | null;
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
  const [deletingId, setDeletingId] = useState("");
  const [notice, setNotice] = useState("");

  async function readResponse(response: Response) {
    const text = await response.text();
    if (!text.trim()) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(
        response.ok
          ? "La respuesta llegó incompleta."
          : "El servidor no pudo completar la solicitud.",
      );
    }
  }

  async function saveAsStyle(item: ReferenceItem) {
    const response = await fetch("/api/static-reference-style", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId: item.id, name: item.metadata?.analysis?.matched_archetype_label || item.file_name }),
    });
    if (!response.ok) return;
    setItems((current) => current.map((reference) => reference.id === item.id
      ? { ...reference, metadata: { ...reference.metadata, saved_as_style: true }, message: "Guardado en Mis estilos" }
      : reference));
  }

  function toggleReference(id: string) {
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id].slice(-10));
  }

  async function deleteReference(item: ReferenceItem) {
    if (
      !window.confirm(
        `¿Borrar “${item.file_name}”? Esta referencia dejará de aparecer en el kit de marca.`,
      )
    )
      return;
    setDeletingId(item.id);
    setNotice("");
    try {
      const response = await fetch(`/api/brand-references/${item.id}`, {
        method: "DELETE",
      });
      const data = await readResponse(response);
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "No se pudo borrar la referencia.",
        );
      setItems((current) => {
        const next = current.filter((reference) => reference.id !== item.id);
        onItemsChange?.(next.map((reference) => reference.id));
        return next;
      });
      if (selectedIds.includes(item.id))
        onSelectionChange(selectedIds.filter((id) => id !== item.id));
      setNotice("Referencia eliminada.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo borrar la referencia.",
      );
    } finally {
      setDeletingId("");
    }
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
    const [{ data: creativeUsage }, { data: brandUsage }] = await Promise.all([supabase.from("creative_assets").select("file_size").eq("owner_id", user.id), supabase.from("brand_assets").select("file_size").eq("owner_id", user.id)]);
    const usedBytes = [...(creativeUsage || []), ...(brandUsage || [])].reduce((sum, item) => sum + Number(item.file_size || 0), 0);
    if (usedBytes + files.reduce((sum, file) => sum + file.size, 0) > 2 * 1024 * 1024 * 1024) { setIsUploading(false); return; }

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
      let analysis: Record<string, unknown> = {};
      try {
        analysis = await readResponse(analysisResponse);
      } catch (error) {
        analysis = {
          error:
            error instanceof Error
              ? error.message
              : "No se pudo leer la respuesta.",
        };
      }
      const analysisPayload =
        analysis.analysis && typeof analysis.analysis === "object"
          ? (analysis.analysis as NonNullable<
              StyleReference["metadata"]
            >["analysis"])
          : undefined;
      const analysisSucceeded = analysisResponse.ok && Boolean(analysisPayload);
      setItems((current) =>
        current.map((reference) =>
          reference.id === saved.id
            ? {
                ...reference,
                status: analysisSucceeded ? "lista" : "error",
                metadata: analysisSucceeded
                  ? {
                      ...reference.metadata,
                      analysis_status: "ready",
                      analysis: analysisPayload,
                    }
                  : reference.metadata,
                message: analysisSucceeded
                  ? analysisPayload?.matched_archetype_label
                    ? `Coincide con ${analysisPayload.matched_archetype_label}`
                    : "Receta propia detectada"
                  : typeof analysis.error === "string"
                    ? analysis.error
                    : "No se pudo analizar",
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
            <div className="reference-thumbnail-item" key={item.id}>
              <button
                type="button"
                className={selectionEnabled && selectedIds.includes(item.id) ? "selected" : ""}
                onClick={() => selectionEnabled && toggleReference(item.id)}
                disabled={item.status === "analizando"}
                aria-disabled={!selectionEnabled}
              >
                {item.signed_url ? <img src={item.signed_url} alt={item.file_name} /> : <ImageIcon size={22} />}
                <span>{item.status === "analizando" ? <Loader2 className="spin" size={14} /> : <Check size={14} />}</span>
                <small>{item.message}</small>
              </button>
              {item.status === "lista" && (
                <div className="reference-item-actions">
                  <button className="save-reference-style" type="button" onClick={() => saveAsStyle(item)} disabled={item.metadata?.saved_as_style || deletingId === item.id}>
                    <Bookmark size={13} /> {item.metadata?.saved_as_style ? "Guardado" : "Guardar estilo"}
                  </button>
                  <button className="delete-reference" type="button" onClick={() => deleteReference(item)} disabled={deletingId === item.id} aria-label={`Borrar ${item.file_name}`}>
                    {deletingId === item.id ? <Loader2 className="spin" size={13} /> : <Trash2 size={13} />} Borrar
                  </button>
                </div>
              )}
              {item.status !== "lista" && (
                <button className="delete-reference full" type="button" onClick={() => deleteReference(item)} disabled={deletingId === item.id}>
                  {deletingId === item.id ? <Loader2 className="spin" size={13} /> : <Trash2 size={13} />} Borrar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {notice && <p className="reference-notice" aria-live="polite">{notice}</p>}
    </div>
  );
}
