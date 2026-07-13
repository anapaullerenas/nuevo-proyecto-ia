"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Check, Download, ImagePlus, Loader2, Pencil, Sparkles, Upload, WandSparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ReferenceUploader, StyleReference } from "@/components/ReferenceUploader";

type BrandAsset = {
  id: string;
  file_name: string;
  storage_path: string;
  bucket_id: string;
  kind: string;
  label?: string | null;
  signed_url?: string | null;
};

type StaticArchetype = {
  id: string;
  name: string;
  label_visible: string;
  stage: string;
  prompt_fragment: string;
};

type StaticBrief = {
  arquetipo: string;
  arquetipo_label: string;
  concepto: string;
  hook_visual: string;
  texto_principal: string;
  texto_secundario: string;
  cta: string;
  disclaimer: string;
  text_render_mode: "baked" | "layered";
  composicion: {
    zona_superior: string;
    zona_media: string;
    zona_inferior: string;
  };
  paleta: string[];
  emocion_objetivo: string;
  por_que_funciona: string;
  riesgo_a_evitar: string;
  notas_disenadora: string[];
  must_preserve: string[];
  must_avoid: string[];
  review_score: number;
  review_summary: string;
};

type GeneratedStatic = {
  id: string;
  storage_path: string;
  public_url?: string | null;
  signed_url?: string | null;
  prompt?: string | null;
  ficha: StaticBrief;
  archetype?: string | null;
  format: string;
  funnel_stage: string;
  quality: string;
  version: number;
  status: string;
  created_at?: string;
};

const formats = ["1:1 Feed", "4:5 Feed", "9:16 Story/Reel"];
const stages = ["Descubrimiento", "Consideración", "Conversión", "Retargeting"];
const examples = [
  "Ej: El 2x1 termina el domingo y quiero urgencia sin verme desesperada.",
  "Ej: Quiero explicar por qué mi producto sí funciona aunque parezca caro.",
  "Ej: Necesito un anuncio para quienes ya me conocen pero todavía no compran.",
];

function cleanAssetLabel(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StaticStudio({
  brandId,
  brandName,
  initialAssets,
  initialLogos,
  archetypes,
  initialGallery,
  initialReferences,
  unlimitedCredits = false,
}: {
  brandId: string;
  brandName: string;
  initialAssets: BrandAsset[];
  initialLogos: BrandAsset[];
  archetypes: StaticArchetype[];
  initialGallery: GeneratedStatic[];
  initialReferences: StyleReference[];
  unlimitedCredits?: boolean;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [logos, setLogos] = useState(initialLogos);
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets[0]?.id || "");
  const [serviceNoProduct, setServiceNoProduct] = useState(false);
  const [format, setFormat] = useState("4:5 Feed");
  const [stage, setStage] = useState("Conversión");
  const [archetypeId, setArchetypeId] = useState("automatico");
  const [intent, setIntent] = useState("");
  const [variants, setVariants] = useState(1);
  const [quality, setQuality] = useState<"medium" | "high">("medium");
  const [brief, setBrief] = useState<StaticBrief | null>(null);
  const [creativeId, setCreativeId] = useState<string | null>(null);
  const [gallery, setGallery] = useState(initialGallery);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"asset" | "brief" | "generate" | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [referenceMode, setReferenceMode] = useState<"original" | "inspired">("original");
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [availableReferenceIds, setAvailableReferenceIds] = useState(initialReferences.map((item) => item.id));
  const [confirmingGeneration, setConfirmingGeneration] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setExampleIndex((current) => (current + 1) % examples.length), 2800);
    return () => window.clearInterval(id);
  }, []);

  const imageCost = quality === "high" ? 300 : 150;
  const identityReady = logos.length > 0 && availableReferenceIds.length >= 5;
  const canCreateBrief = identityReady && (serviceNoProduct || Boolean(selectedAssetId));
  const totalGenerationCost = variants * imageCost;

  async function handleAssetUpload(event: ChangeEvent<HTMLInputElement>, kind: "product_photo" | "logo" = "product_photo") {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");
    setBusy("asset");

    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Vuelve a iniciar sesión para subir archivos.");
      if (!file.type.startsWith("image/")) throw new Error("Sube una imagen en JPG, PNG o WebP.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${user.id}/${brandId}/brand-asset-${Date.now()}-${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from("creative-assets").upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);

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
          kind,
          label: cleanAssetLabel(file.name),
        })
        .select("id,file_name,storage_path,bucket_id,kind,label")
        .single();

      if (insertError) throw new Error(insertError.message);

      const { data: signed } = await supabase.storage.from("creative-assets").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      const newAsset = { ...saved, signed_url: signed?.signedUrl } as BrandAsset;
      if (kind === "logo") {
        setLogos((current) => [newAsset, ...current]);
        setMessage("Logo guardado como parte de la identidad de la marca.");
      } else {
        setAssets((current) => [newAsset, ...current]);
        setSelectedAssetId(newAsset.id);
        setServiceNoProduct(false);
        setMessage("Foto de producto guardada. Ya puede usarse para generar estáticos.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo subir la foto de producto.");
    } finally {
      event.target.value = "";
      setBusy(null);
    }
  }

  async function handleCreateBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!canCreateBrief) {
      setMessage(!identityReady ? "Completa el kit visual: un logo y al menos cinco referencias." : "Sube una foto de producto o marca que vendes servicios para crear la ficha.");
      return;
    }

    if (intent.trim().length < 16) {
      setMessage("Escribe qué quieres comunicar con un poco más de contexto.");
      return;
    }

    if (referenceMode === "inspired" && selectedReferenceIds.length === 0) {
      setMessage("Selecciona al menos una referencia para adaptar su estructura visual.");
      return;
    }

    setBusy("brief");
    try {
      const response = await fetch("/api/static-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandId,
          intent,
          format,
          funnelStage: stage,
          archetypeId,
          productAssetId: serviceNoProduct ? undefined : selectedAssetId,
          serviceNoProduct,
          logoAssetId: logos[0]?.id,
          referenceAssetIds: referenceMode === "inspired" ? selectedReferenceIds : availableReferenceIds.slice(0, 5),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear la ficha.");

      setBrief(data.ficha);
      setCreativeId(data.creativeId);
      setMessage("Ficha creada. Revisa el texto exacto antes de generar imagen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la ficha.");
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerate() {
    setMessage("");

    if (!brief) {
      setMessage("Primero crea y aprueba la ficha del anuncio.");
      return;
    }

    setConfirmingGeneration(false);
    setBusy("generate");
    try {
      const response = await fetch("/api/static-generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandId,
          creativeId,
          ficha: brief,
          format,
          funnelStage: stage,
          quality,
          variants,
          productAssetId: serviceNoProduct ? undefined : selectedAssetId,
          serviceNoProduct,
          logoAssetId: logos[0]?.id,
          referenceAssetIds: referenceMode === "inspired" ? selectedReferenceIds : availableReferenceIds.slice(0, 5),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo generar la imagen.");

      setGallery((current) => [...(data.statics || []), ...current]);
      setMessage("Estático generado y guardado en la galería de la marca.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar la imagen.");
    } finally {
      setBusy(null);
    }
  }

  function updateBrief<K extends keyof StaticBrief>(key: K, value: StaticBrief[K]) {
    setBrief((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      if (key === "texto_secundario" || key === "cta" || key === "disclaimer") {
        const fineWords = [next.texto_secundario, next.cta, next.disclaimer].join(" ").trim().split(/\s+/).filter(Boolean).length;
        next.text_render_mode = next.disclaimer.trim() || fineWords > 8 ? "layered" : "baked";
      }
      return next;
    });
  }

  function updateZone(key: keyof StaticBrief["composicion"], value: string) {
    setBrief((current) =>
      current
        ? {
            ...current,
            composicion: { ...current.composicion, [key]: value },
          }
        : current,
    );
  }

  return (
    <div className="static-machine">
      <form className="static-controls" onSubmit={handleCreateBrief}>
        <section className="static-section product-gate">
          <div className="section-title">
            <span>01</span>
            <div>
              <b>Kit visual de tu marca</b>
              <p>El logo, producto y referencias se guardan para todas tus futuras piezas.</p>
            </div>
          </div>

          <div className="asset-strip">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className={selectedAssetId === asset.id && !serviceNoProduct ? "selected" : ""}
                onClick={() => {
                  setSelectedAssetId(asset.id);
                  setServiceNoProduct(false);
                }}
              >
                {asset.signed_url ? <img src={asset.signed_url} alt={asset.file_name} /> : <ImagePlus size={18} />}
                <span>{asset.label || cleanAssetLabel(asset.file_name)}</span>
                {selectedAssetId === asset.id && !serviceNoProduct && <Check size={14} />}
              </button>
            ))}

            <label className="asset-upload">
              {busy === "asset" ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
              <span>Agregar producto</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleAssetUpload(event, "product_photo")} />
            </label>
          </div>

          <div className="brand-kit-row">
            <div><b>Logo principal</b><small>{logos.length ? "Listo" : "Obligatorio"}</small></div>
            <div className="asset-strip compact-assets">
              {logos.slice(0, 3).map((logo) => (
                <div className="brand-logo-asset" key={logo.id}>{logo.signed_url ? <img src={logo.signed_url} alt={logo.label || "Logo"} /> : <ImagePlus size={18} />}<span>{logo.label || cleanAssetLabel(logo.file_name)}</span></div>
              ))}
              <label className="asset-upload">
                {busy === "asset" ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                <span>{logos.length ? "Cambiar logo" : "Subir logo"}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleAssetUpload(event, "logo")} />
              </label>
            </div>
          </div>

          <label className="service-toggle">
            <input
              type="checkbox"
              checked={serviceNoProduct}
              onChange={(event) => setServiceNoProduct(event.target.checked)}
            />
            <span>Vendo servicios o no necesito foto de producto en esta pieza.</span>
          </label>
        </section>

        <section className="static-section">
          <div className="section-title">
            <span>02</span>
            <div>
              <b>Formato</b>
              <p>Elige dónde va a vivir la pieza.</p>
            </div>
          </div>
          <div className="format-preview-grid">
            {formats.map((item) => (
              <button key={item} type="button" className={format === item ? "selected" : ""} onClick={() => setFormat(item)}>
                <span className={`mini-canvas ${item.includes("9:16") ? "story" : item.includes("1:1") ? "square" : "portrait"}`}>
                  {item.includes("9:16") && (
                    <>
                      <i />
                      <em />
                    </>
                  )}
                </span>
                <b>{item}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="static-section">
          <div className="section-title">
            <span>03</span>
            <div>
              <b>Etapa y estilo</b>
              <p>Automático elige el formato estratégico por ti.</p>
            </div>
          </div>

          <div className="stage-tabs">
            {stages.map((item) => (
              <button key={item} type="button" className={stage === item ? "selected" : ""} onClick={() => setStage(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="archetype-grid">
            <button type="button" className={archetypeId === "automatico" ? "selected" : ""} onClick={() => setArchetypeId("automatico")}>
              <Sparkles size={16} />
              <b>Automático</b>
              <span>La directora elige según marca, etapa y ganadores.</span>
            </button>
            {archetypes.map((item) => (
              <button key={item.id} type="button" className={archetypeId === item.id ? "selected" : ""} onClick={() => setArchetypeId(item.id)}>
                <b>{item.label_visible}</b>
                <span>{item.stage}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="static-section">
          <div className="section-title">
            <span>04</span>
            <div>
              <b>Qué quieres comunicar</b>
              <p>Escribe intención, no prompt técnico.</p>
            </div>
          </div>

          <textarea value={intent} onChange={(event) => setIntent(event.target.value)} placeholder={examples[exampleIndex]} />

          <div className="generation-controls">
            <fieldset className="variant-selector">
              <legend>Variantes</legend>
              <div>
                {[1, 2, 3].map((count) => (
                  <button key={count} type="button" className={variants === count ? "selected" : ""} onClick={() => setVariants(count)}>
                    {count}
                  </button>
                ))}
              </div>
              <small>{unlimitedCredits ? "Incluido en tu cuenta" : `${totalGenerationCost} créditos de generación`}</small>
            </fieldset>
            <label>
              Calidad
              <select value={quality} onChange={(event) => setQuality(event.target.value === "high" ? "high" : "medium")}>
                <option value="medium">Estándar{unlimitedCredits ? " · incluida" : " · 150 cr"}</option>
                <option value="high">Alta{unlimitedCredits ? " · incluida" : " · 300 cr"}</option>
              </select>
            </label>
          </div>

          <button className="primary-action" type="submit" disabled={busy === "brief" || busy === "generate"}>
            {busy === "brief" ? <Loader2 className="spin" size={16} /> : <Pencil size={16} />}
            {busy === "brief" ? "Creando ficha..." : unlimitedCredits ? "Crear ficha del anuncio · incluido" : "Crear ficha del anuncio · 20 cr"}
          </button>
        </section>

        <details className="optional-references" open={!identityReady}>
          <summary><span>Referencias de identidad · {availableReferenceIds.length}/5</span><small>{availableReferenceIds.length >= 5 ? "Kit visual listo" : "Sube al menos cinco imágenes obligatorias"}</small></summary>
          <div className="reference-mode">
            <button type="button" className={referenceMode === "original" ? "selected" : ""} onClick={() => setReferenceMode("original")}>
              <b>Dirección original</b><span>La IA trabaja con tu marca y producto.</span>
            </button>
            <button type="button" className={referenceMode === "inspired" ? "selected" : ""} onClick={() => setReferenceMode("inspired")}>
              <b>Inspirada en referencias</b><span>Usa composición y estilo, nunca identidad ajena.</span>
            </button>
          </div>
          <ReferenceUploader
            brandId={brandId}
            initialReferences={initialReferences}
            selectedIds={selectedReferenceIds}
            onSelectionChange={setSelectedReferenceIds}
            onItemsChange={(ids) => setAvailableReferenceIds(ids)}
          />
        </details>

        {message && <p className="form-message">{message}</p>}
      </form>

      <aside className="static-output">
        {!brief ? (
          <div className="static-empty">
            <WandSparkles size={34} />
            <b>Primero la ficha, después la imagen.</b>
            <p>La plataforma decide concepto, texto exacto y composición antes de gastar créditos de generación.</p>
          </div>
        ) : (
          <section className="brief-preview">
            <div className="brief-head">
              <span>{brief.arquetipo_label}</span>
              <b>{brief.review_score ? `Aprobada · ${brief.review_score}/100` : "Ficha editable"}</b>
            </div>

            <label>
              Concepto
              <textarea value={brief.concepto} onChange={(event) => updateBrief("concepto", event.target.value)} />
            </label>

            <div className="copy-grid">
              <label>
                Texto principal
                <input value={brief.texto_principal} onChange={(event) => updateBrief("texto_principal", event.target.value)} />
              </label>
              <label>
                Texto secundario
                <input value={brief.texto_secundario} onChange={(event) => updateBrief("texto_secundario", event.target.value)} />
              </label>
              <label>
                CTA
                <input value={brief.cta} onChange={(event) => updateBrief("cta", event.target.value)} />
              </label>
            </div>

            <label>
              Disclaimer o texto legal
              <input value={brief.disclaimer || ""} onChange={(event) => updateBrief("disclaimer", event.target.value)} placeholder="Déjalo vacío si no aplica" />
            </label>
            <div className={`text-render-note ${brief.text_render_mode}`}>
              <Check size={15} />
              <span><b>{brief.text_render_mode === "layered" ? "Texto compuesto con precisión" : "Headline corto dentro de la imagen"}</b>{brief.text_render_mode === "layered" ? " Los acentos, CTA y disclaimer se añaden como una capa exacta después de generar." : " Esta ficha es suficientemente breve para una composición directa."}</span>
            </div>

            <details className="art-direction-details">
              <summary>Ver dirección de arte</summary>
              <label>
                Hook visual
                <textarea value={brief.hook_visual} onChange={(event) => updateBrief("hook_visual", event.target.value)} />
              </label>
              <div className="zone-grid">
                <label>Superior<input value={brief.composicion.zona_superior} onChange={(event) => updateZone("zona_superior", event.target.value)} /></label>
                <label>Media<input value={brief.composicion.zona_media} onChange={(event) => updateZone("zona_media", event.target.value)} /></label>
                <label>Inferior<input value={brief.composicion.zona_inferior} onChange={(event) => updateZone("zona_inferior", event.target.value)} /></label>
              </div>
            </details>

            <div className="why-card">
              <b>Por qué funciona</b>
              <p>{brief.por_que_funciona}</p>
            </div>

            {confirmingGeneration ? (
              <div className="generation-confirmation" role="dialog" aria-label="Confirmar generación">
                <div><b>Revisa antes de generar</b><span>{format} · {variants} {variants === 1 ? "pieza" : "piezas"} · {unlimitedCredits ? "incluido en tu cuenta" : `costo estimado ${totalGenerationCost} cr`}</span></div>
                <button type="button" onClick={() => setConfirmingGeneration(false)}>Cancelar</button>
                <button type="button" className="confirm" onClick={handleGenerate}>Confirmar</button>
              </div>
            ) : (
              <button className="primary-action" type="button" disabled={busy === "generate"} onClick={() => setConfirmingGeneration(true)}>
                {busy === "generate" ? <Loader2 className="spin" size={16} /> : <WandSparkles size={16} />}
                {busy === "generate" ? "Generando imagen..." : unlimitedCredits ? "Generar imagen · incluido" : `Generar imagen · ${totalGenerationCost} cr`}
              </button>
            )}
          </section>
        )}

        <section className="static-gallery">
          <div className="brief-head">
            <span>Galería</span>
            <b>{gallery.length} piezas</b>
          </div>

          {gallery.length === 0 ? (
            <p className="gallery-empty">Las imágenes generadas aparecerán aquí con su ficha y versión.</p>
          ) : (
            <div className="gallery-grid">
              {gallery.map((item) => (
                <article key={item.id}>
                  {(item.public_url || item.signed_url) && <img src={item.public_url || item.signed_url || ""} alt={`Estático para ${brandName}`} />}
                  <div>
                    <span>{item.ficha?.arquetipo_label || item.archetype || "Estático"}</span>
                    <b>{item.ficha?.texto_principal || "Pieza generada"}</b>
                    <small>{item.format} · v{item.version}</small>
                  </div>
                  {(item.public_url || item.signed_url) && (
                    <a href={item.public_url || item.signed_url || ""} download={`${brandName}_${item.format}_v${item.version}.png`}>
                      <Download size={15} /> Descargar
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
