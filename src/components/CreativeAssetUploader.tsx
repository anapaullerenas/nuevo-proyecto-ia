"use client";

import { ChangeEvent, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type UploadItem = {
  id: string;
  name: string;
  status: "subiendo" | "listo" | "error";
  message?: string;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function CreativeAssetUploader({ brandId }: { brandId: string }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setIsUploading(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setItems([{ id: crypto.randomUUID(), name: "Sesion", status: "error", message: "Vuelve a iniciar sesion." }]);
      setIsUploading(false);
      return;
    }

    for (const file of files) {
      const localId = crypto.randomUUID();
      setItems((current) => [...current, { id: localId, name: file.name, status: "subiendo" }]);

      const assetType = IMAGE_TYPES.includes(file.type) ? "image" : VIDEO_TYPES.includes(file.type) ? "video" : null;

      if (!assetType) {
        setItems((current) =>
          current.map((item) =>
            item.id === localId ? { ...item, status: "error", message: "Formato no soportado." } : item,
          ),
        );
        continue;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${user.id}/${brandId}/creative-${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("creative-assets").upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        setItems((current) =>
          current.map((item) => (item.id === localId ? { ...item, status: "error", message: uploadError.message } : item)),
        );
        continue;
      }

      const { error: insertError } = await supabase.from("creative_assets").insert({
        brand_id: brandId,
        owner_id: user.id,
        asset_type: assetType,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      });

      setItems((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                status: insertError ? "error" : "listo",
                message: insertError ? insertError.message : "Archivo guardado. Analisis IA en siguiente paso.",
              }
            : item,
        ),
      );
    }

    event.target.value = "";
    setIsUploading(false);
  }

  return (
    <div className="upload-zone tall">
      <ImageUp size={34} />
      <b>Subir imagen o video del anuncio</b>
      <p>Guarda el activo en la marca activa. Despues conectamos el analisis profundo con IA.</p>
      <label className="upload-action">
        {isUploading ? <Loader2 className="spin" size={16} /> : <ImageUp size={16} />}
        {isUploading ? "Subiendo..." : "Seleccionar creativo"}
        <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple onChange={handleFiles} />
      </label>
      {items.length > 0 && (
        <div className="upload-list">
          {items.map((item) => (
            <div key={item.id} className={item.status}>
              <span>{item.name}</span>
              <small>{item.message || item.status}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
