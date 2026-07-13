"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useState } from "react";
import { Check, ImagePlus, Loader2, PackageOpen, Upload } from "lucide-react";
import { ReferenceUploader, StyleReference } from "@/components/ReferenceUploader";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type VisualAsset = {
  id: string;
  file_name: string;
  storage_path: string;
  bucket_id: string;
  kind: string;
  label?: string | null;
  signed_url?: string | null;
};

export function BrandVisualKit({
  brandId,
  initialProducts,
  initialLogos,
  initialReferences,
}: {
  brandId: string;
  initialProducts: VisualAsset[];
  initialLogos: VisualAsset[];
  initialReferences: StyleReference[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [logos, setLogos] = useState(initialLogos);
  const [referenceIds, setReferenceIds] = useState(initialReferences.map((item) => item.id));
  const [busy, setBusy] = useState<"product_photo" | "logo" | null>(null);
  const [message, setMessage] = useState("");

  async function upload(event: ChangeEvent<HTMLInputElement>, kind: "product_photo" | "logo") {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(kind);
    setMessage("");
    try {
      if (!file.type.startsWith("image/")) throw new Error("Sube una imagen JPG, PNG o WebP.");
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vuelve a iniciar sesión para subir archivos.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${user.id}/${brandId}/brand-asset-${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("creative-assets").upload(storagePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const label = cleanLabel(file.name);
      const { data: saved, error: saveError } = await supabase.from("brand_assets").insert({
        brand_id: brandId,
        owner_id: user.id,
        bucket_id: "creative-assets",
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        kind,
        label,
      }).select("id,file_name,storage_path,bucket_id,kind,label").single();
      if (saveError) throw saveError;
      const { data: signed } = await supabase.storage.from("creative-assets").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      const next = { ...saved, signed_url: signed?.signedUrl || null } as VisualAsset;
      if (kind === "logo") setLogos((current) => [next, ...current]);
      else setProducts((current) => [next, ...current]);
      setMessage(kind === "logo" ? "Logo principal actualizado." : "Producto agregado a la biblioteca de la marca.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el archivo.");
    } finally {
      event.target.value = "";
      setBusy(null);
    }
  }

  const ready = logos.length > 0 && products.length > 0 && referenceIds.length >= 5;

  return (
    <section className="brand-visual-kit">
      <header>
        <div>
          <span className="eyebrow">Identidad para generación</span>
          <h2>Kit visual de la marca</h2>
          <p>Estos archivos alimentan todos los anuncios. Se configuran aquí una sola vez, no durante cada generación.</p>
        </div>
        <span className={ready ? "kit-status ready" : "kit-status"}>{ready ? <Check size={14} /> : <PackageOpen size={14} />}{ready ? "Kit listo" : "Faltan archivos"}</span>
      </header>

      <div className="brand-kit-columns">
        <article>
          <div className="brand-kit-title"><b>Logo principal</b><small>{logos.length ? "Listo" : "Obligatorio"}</small></div>
          <div className="brand-asset-library">
            {logos.slice(0, 2).map((asset) => <AssetCard key={asset.id} asset={asset} contain />)}
            <label className="brand-asset-add">{busy === "logo" ? <Loader2 className="spin" /> : <Upload />}<span>{logos.length ? "Actualizar logo" : "Subir logo"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event, "logo")} /></label>
          </div>
        </article>
        <article>
          <div className="brand-kit-title"><b>Productos</b><small>{products.length} guardados</small></div>
          <div className="brand-asset-library">
            {products.slice(0, 4).map((asset) => <AssetCard key={asset.id} asset={asset} />)}
            <label className="brand-asset-add">{busy === "product_photo" ? <Loader2 className="spin" /> : <ImagePlus />}<span>Agregar producto</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event, "product_photo")} /></label>
          </div>
        </article>
      </div>

      <div className="brand-reference-zone">
        <div className="brand-kit-title"><div><b>Referencias visuales</b><p>Entre 5 y 10 imágenes para aprender composición, color y lenguaje visual.</p></div><small>{referenceIds.length}/10</small></div>
        <ReferenceUploader brandId={brandId} initialReferences={initialReferences} selectedIds={[]} onSelectionChange={() => undefined} onItemsChange={setReferenceIds} selectionEnabled={false} />
      </div>
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}

function AssetCard({ asset, contain = false }: { asset: VisualAsset; contain?: boolean }) {
  return <div className="brand-asset-card">{asset.signed_url ? <img className={contain ? "contain" : ""} src={asset.signed_url} alt={asset.label || asset.file_name} /> : <ImagePlus />}<span>{asset.label || cleanLabel(asset.file_name)}</span></div>;
}

function cleanLabel(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
