"use client";

import { ChangeEvent, useState } from "react";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type UploadItem = {
  id: string;
  name: string;
  status: "subiendo" | "listo" | "error";
  message?: string;
};

export function MetaImportUploader({ brandId }: { brandId: string }) {
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
      const storagePath = `${user.id}/${brandId}/meta-${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("meta-imports").upload(storagePath, file, {
        contentType: file.type || "text/csv",
        upsert: false,
      });

      if (uploadError) {
        setItems((current) =>
          current.map((item) => (item.id === localId ? { ...item, status: "error", message: uploadError.message } : item)),
        );
        continue;
      }

      const [{ error: fileError }, { error: importError }] = await Promise.all([
        supabase.from("uploaded_files").insert({
          brand_id: brandId,
          owner_id: user.id,
          bucket_id: "meta-imports",
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          kind: "meta_export",
        }),
        supabase.from("meta_imports").insert({
          brand_id: brandId,
          owner_id: user.id,
          file_name: file.name,
          status: "uploaded",
          summary: { storage_path: storagePath, file_size: file.size, mime_type: file.type },
        }),
      ]);

      const error = fileError || importError;
      setItems((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                status: error ? "error" : "listo",
                message: error ? error.message : "Export guardado. Procesamiento IA en siguiente paso.",
              }
            : item,
        ),
      );
    }

    event.target.value = "";
    setIsUploading(false);
  }

  return (
    <div className="upload-zone">
      <FileSpreadsheet size={32} />
      <b>CSV o XLSX de Meta Ads</b>
      <p>Sube el archivo exportado. Quedara guardado para analizar ganadores, fatiga y costo por resultado.</p>
      <label className="upload-action">
        {isUploading ? <Loader2 className="spin" size={16} /> : <UploadCloud size={16} />}
        {isUploading ? "Subiendo..." : "Subir export"}
        <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFiles} />
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
