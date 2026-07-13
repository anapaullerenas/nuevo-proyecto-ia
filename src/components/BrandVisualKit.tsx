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
  metadata?: { logo_variant?: "primary" | "light" | "dark" } | null;
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

  async function upload(event: ChangeEvent<HTMLInputElement>, kind: "product_photo" | "logo", logoVariant?: "primary" | "light" | "dark") {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(kind);
    setMessage("");
    try {
      if (!file.type.startsWith("image/")) throw new Error("Sube una imagen PNG, SVG, JPG o WebP.");
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vuelve a iniciar sesión para subir archivos.");
      const [{ data: creativeUsage }, { data: brandUsage }] = await Promise.all([supabase.from("creative_assets").select("file_size").eq("owner_id", user.id), supabase.from("brand_assets").select("file_size").eq("owner_id", user.id)]);
      const usedBytes = [...(creativeUsage || []), ...(brandUsage || [])].reduce((sum, item) => sum + Number(item.file_size || 0), 0);
      if (usedBytes + file.size > 2 * 1024 * 1024 * 1024) throw new Error("Alcanzaste 2 GB de archivos. Libera espacio antes de subir otro recurso.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${user.id}/${brandId}/brand-asset-${file.lastModified}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("creative-assets").upload(storagePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const label = kind === "logo" ? ({ primary: "Logo principal", light: "Logo claro", dark: "Logo oscuro" }[logoVariant || "primary"]) : cleanLabel(file.name);
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
        metadata: kind === "logo" ? { logo_variant: logoVariant || "primary" } : {},
      }).select("id,file_name,storage_path,bucket_id,kind,label,metadata").single();
      if (saveError) throw saveError;
      const { data: signed } = await supabase.storage.from("creative-assets").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      const next = { ...saved, signed_url: signed?.signedUrl || null } as VisualAsset;
      if (kind === "logo") setLogos((current) => [next, ...current]);
      else setProducts((current) => [next, ...current]);
      setMessage(kind === "logo" ? "Variante de logotipo actualizada." : "Producto agregado a la biblioteca de la marca.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el archivo.");
    } finally {
      event.target.value = "";
      setBusy(null);
    }
  }

  const ready = logos.length > 0 && products.length > 0 && referenceIds.length >= 5;
  const logoByVariant = (variant: "primary" | "light" | "dark") => logos.find((logo) => (logo.metadata?.logo_variant || "primary") === variant);

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
          <div className="logo-variant-grid">
            {(["primary", "light", "dark"] as const).map((variant) => {
              const asset = logoByVariant(variant);
              const label = { primary: "Principal", light: "Para fondos oscuros", dark: "Para fondos claros" }[variant];
              return <label className={`logo-variant-slot ${variant}`} key={variant}>{asset?.signed_url ? <img src={asset.signed_url} alt={label} /> : busy === "logo" ? <Loader2 className="spin" /> : <Upload />}<b>{label}</b><small>{asset ? "Reemplazar" : "Subir transparente"}</small><input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" onChange={(event) => upload(event, "logo", variant)} /></label>;
            })}
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
