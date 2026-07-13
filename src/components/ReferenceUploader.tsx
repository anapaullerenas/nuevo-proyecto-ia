"use client";

import { ChangeEvent, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type UploadItem = {
  id: string;
  name: string;
  status: "subiendo" | "listo" | "error";
  message?: string;
};

export function ReferenceUploader({ brandId }: { brandId: string }) {
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

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${user.id}/${brandId}/reference-${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("creative-assets").upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

      if (uploadError) {
        setItems((current) =>
          current.map((item) => (item.id === localId ? { ...item, status: "error", message: uploadError.message } : item)),
        );
        continue;
      }

      const { error: insertError } = await supabase.from("uploaded_files").insert({
        brand_id: brandId,
        owner_id: user.id,
        bucket_id: "creative-assets",
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        kind: "static_reference",
      });

      setItems((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                status: insertError ? "error" : "listo",
                message: insertError ? insertError.message : "Referencia guardada.",
              }
            : item,
        ),
      );
    }

    event.target.value = "";
    setIsUploading(false);
  }

  return (
    <label className="file-drop upload-drop">
      Referencias
      <input type="file" multiple accept="image/*,.pdf,.txt" onChange={handleFiles} />
      <span>Sube anuncios, capturas o referencias. Quedaran guardadas para esta marca.</span>
      {isUploading && <em>Subiendo referencias...</em>}
      {items.length > 0 && (
        <div className="upload-list compact">
          {items.map((item) => (
            <div key={item.id} className={item.status}>
              {isUploading && item.status === "subiendo" ? <Loader2 className="spin" size={13} /> : <FileUp size={13} />}
              <span>{item.name}</span>
              <small>{item.message || item.status}</small>
            </div>
          ))}
        </div>
      )}
    </label>
  );
}
