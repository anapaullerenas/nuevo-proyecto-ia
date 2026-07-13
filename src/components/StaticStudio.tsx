"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Download, Expand, ImageIcon, Loader2, Pencil, RefreshCw, Sparkles, WandSparkles, X } from "lucide-react";
import type { StyleReference } from "@/components/ReferenceUploader";

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
  logo_usage: "none" | "subtle" | "prominent";
  cta_usage: "none" | "text" | "button";
  disclaimer: string;
  text_render_mode: "baked" | "layered";
  composicion: { zona_superior: string; zona_media: string; zona_inferior: string };
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
  parent_id?: string | null;
  status: string;
  created_at?: string;
};

const formats = ["1:1 Feed", "4:5 Feed", "9:16 Story/Reel"];
const stages = ["Descubrimiento", "Consideración", "Conversión", "Retargeting"];
const examples = [
  "Ej: Quiero presentar el producto a personas que todavía no conocen la marca.",
  "Ej: Quiero explicar por qué el producto vale lo que cuesta sin sonar técnica.",
  "Ej: Quiero una pieza directa para vender el pack antes del domingo.",
];
const swipeSlide = "https://docs.google.com/presentation/d/1v9wvp-GLzMXOe88Lvd_tjso4qGv9UOXt_MqvFfMJKcs/export/png?id=1v9wvp-GLzMXOe88Lvd_tjso4qGv9UOXt_MqvFfMJKcs&pageid=g337cb9cdf36_0_1994";
const visualReferences = [
  { id: "product_context", label: "Producto en contexto", note: "Escena real + razones breves", position: "left" },
  { id: "creator_bundle", label: "Creadora + producto", note: "Prueba humana y cercana", position: "center" },
  { id: "aspirational_demo", label: "Resultado aspiracional", note: "Resultado primero, producto después", position: "right" },
] as const;

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
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssets[0]?.id || "");
  const [serviceNoProduct, setServiceNoProduct] = useState(false);
  const [format, setFormat] = useState("4:5 Feed");
  const [stage, setStage] = useState("Conversión");
  const [archetypeId, setArchetypeId] = useState("automatico");
  const [externalReference, setExternalReference] = useState<"none" | "product_context" | "creator_bundle" | "aspirational_demo">("none");
  const [intent, setIntent] = useState("");
  const [proposals, setProposals] = useState(1);
  const [quality, setQuality] = useState<"medium" | "high">("medium");
  const [brief, setBrief] = useState<StaticBrief | null>(null);
  const [creativeId, setCreativeId] = useState<string | null>(null);
  const [gallery, setGallery] = useState(initialGallery);
  const [selectedCreative, setSelectedCreative] = useState<GeneratedStatic | null>(initialGallery[0] || null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"brief" | "generate" | "edit" | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [openStep, setOpenStep] = useState<"setup" | "style" | "intent" | "brief">("setup");
  const [correction, setCorrection] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setExampleIndex((current) => (current + 1) % examples.length), 3000);
    return () => window.clearInterval(id);
  }, []);

  const identityReady = initialLogos.length > 0 && initialReferences.length >= 5;
  const productReady = serviceNoProduct || Boolean(selectedAssetId);
  const totalCost = proposals * (quality === "high" ? 300 : 150);
  const selectedUrl = selectedCreative?.public_url || selectedCreative?.signed_url || "";

  async function handleCreateBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!identityReady) return setMessage("Completa el kit visual desde Mis marcas antes de crear.");
    if (!productReady) return setMessage("Elige un producto para este anuncio.");
    if (intent.trim().length < 16) return setMessage("Cuéntanos un poco más sobre lo que quieres comunicar.");
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
          logoAssetId: initialLogos[0]?.id,
          referenceAssetIds: initialReferences.slice(0, 10).map((item) => item.id),
          externalReference,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo preparar el anuncio.");
      setBrief(data.ficha);
      setCreativeId(data.creativeId);
      setOpenStep("brief");
      setMessage("Dirección lista. Revisa el texto y genera la imagen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo preparar el anuncio.");
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerate() {
    if (!brief) return;
    setBusy("generate");
    setMessage("");
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          variants: proposals,
          productAssetId: serviceNoProduct ? undefined : selectedAssetId,
          serviceNoProduct,
          logoAssetId: initialLogos[0]?.id,
          referenceAssetIds: initialReferences.slice(0, 10).map((item) => item.id),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo generar la imagen.");
      const created = (data.statics || []) as GeneratedStatic[];
      setGallery((current) => [...created, ...current]);
      setSelectedCreative(created[0] || null);
      setMessage(`${created.length === 1 ? "Propuesta creada" : `${created.length} propuestas creadas`} y guardada${created.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar la imagen.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCorrection() {
    if (!selectedCreative || correction.trim().length < 6) return setMessage("Escribe la corrección puntual que quieres hacer.");
    setBusy("edit");
    setMessage("");
    try {
      const response = await fetch("/api/static-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ staticId: selectedCreative.id, instruction: correction.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo corregir la imagen.");
      const edited = data.static as GeneratedStatic;
      setGallery((current) => [edited, ...current]);
      setSelectedCreative(edited);
      setCorrection("");
      setMessage(`Corrección guardada como versión ${edited.version}. La anterior sigue disponible.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo corregir la imagen.");
    } finally {
      setBusy(null);
    }
  }

  function updateBrief<K extends keyof StaticBrief>(key: K, value: StaticBrief[K]) {
    setBrief((current) => current ? { ...current, [key]: value } : current);
  }

  return (
    <div className="static-editor">
      <section className="creative-canvas" ref={stageRef}>
        <header className="creative-canvas-head">
          <div><span className="eyebrow">Mesa de creación</span><h2>{selectedCreative ? "Tu anuncio, en tamaño real" : "Aquí aparecerá tu anuncio"}</h2></div>
          {selectedCreative && <span className="canvas-version">{selectedCreative.format} · versión {selectedCreative.version}</span>}
        </header>

        {busy === "generate" ? (
          <div className={`generation-stage ${formatClass(format)}`}><div className="generation-pulse"><WandSparkles /><b>Construyendo {proposals === 1 ? "tu propuesta" : `${proposals} propuestas`}…</b><span>Composición, producto, copy y logo</span></div></div>
        ) : selectedCreative && selectedUrl ? (
          <div className="canvas-viewer">
            <div className={`canvas-image-shell ${formatClass(selectedCreative.format)}`}>
              <img src={selectedUrl} alt={`Anuncio generado para ${brandName}`} />
              <button type="button" className="expand-canvas" onClick={() => setFullScreen(true)}><Expand size={17} /> Ver pantalla completa</button>
            </div>
            <div className="canvas-actions">
              <div><span>{selectedCreative.ficha?.arquetipo_label || "Anuncio estático"}</span><b>{selectedCreative.ficha?.texto_principal || "Propuesta generada"}</b></div>
              <a href={selectedUrl} download={`${brandName}_${selectedCreative.format}_v${selectedCreative.version}.png`}><Download size={17} /> Descargar en alta calidad</a>
            </div>
          </div>
        ) : (
          <div className="canvas-empty"><ImageIcon size={42} /><b>La imagen será la protagonista.</b><p>Completa los tres pasos de abajo. Cuando generes, no tendrás que volver a buscar el resultado.</p></div>
        )}

        {gallery.length > 0 && (
          <div className="proposal-filmstrip" aria-label="Propuestas y versiones">
            {gallery.map((item, index) => {
              const url = item.public_url || item.signed_url || "";
              return <button type="button" key={item.id} className={selectedCreative?.id === item.id ? "selected" : ""} onClick={() => setSelectedCreative(item)}>{url && <img src={url} alt={`Propuesta ${index + 1}`} />}<span>{item.status === "edited" ? `Edición v${item.version}` : `Propuesta ${index + 1}`}</span></button>;
            })}
          </div>
        )}

        {selectedCreative && (
          <div className="image-correction-bar">
            <div><Pencil size={18} /><span><b>¿Quieres corregir algo?</b> Describe únicamente el cambio. La versión actual no se borrará.</span></div>
            <textarea value={correction} onChange={(event) => setCorrection(event.target.value)} placeholder={'Ej: Cambia “axilas” por “entrepierna”. Mantén todo lo demás exactamente igual.'} />
            <button type="button" onClick={handleCorrection} disabled={busy === "edit"}>{busy === "edit" ? <Loader2 className="spin" /> : <RefreshCw />} {busy === "edit" ? "Corrigiendo en tiempo real…" : unlimitedCredits ? "Crear versión corregida · incluido" : "Crear versión corregida"}</button>
          </div>
        )}
      </section>

      <div className="studio-readiness">
        <div className={identityReady ? "ready" : ""}>{identityReady ? <Check /> : <ImageIcon />}<span><b>Identidad de {brandName}</b><small>{initialAssets.length} productos · {initialReferences.length} referencias · logo {initialLogos.length ? "listo" : "pendiente"}</small></span></div>
        <Link href={`/marcas/${brandId}/editar`}>{identityReady ? "Administrar kit visual" : "Completar en Mis marcas"}</Link>
      </div>

      <form className="studio-steps" onSubmit={handleCreateBrief}>
        <details open={openStep === "setup"} onToggle={(event) => event.currentTarget.open && setOpenStep("setup")}>
          <summary><StepNumber number="01" done={productReady} /><span><b>Producto y formato</b><small>{selectedProductLabel(initialAssets, selectedAssetId, serviceNoProduct)} · {format}</small></span><ChevronDown /></summary>
          <div className="studio-step-body setup-grid">
            <div><label className="field-label">Producto</label><div className="compact-product-row">{initialAssets.map((asset) => <button type="button" key={asset.id} className={selectedAssetId === asset.id && !serviceNoProduct ? "selected" : ""} onClick={() => { setSelectedAssetId(asset.id); setServiceNoProduct(false); }}>{asset.signed_url && <img src={asset.signed_url} alt={asset.label || asset.file_name} />}<span>{asset.label || cleanLabel(asset.file_name)}</span>{selectedAssetId === asset.id && !serviceNoProduct && <Check />}</button>)}</div><label className="service-toggle compact"><input type="checkbox" checked={serviceNoProduct} onChange={(event) => setServiceNoProduct(event.target.checked)} /><span>Esta pieza no necesita producto.</span></label></div>
            <div><label className="field-label">Formato</label><div className="format-capsules">{formats.map((item) => <button type="button" key={item} className={format === item ? "selected" : ""} onClick={() => setFormat(item)}><span className={`format-icon ${formatClass(item)}`} /><b>{item}</b></button>)}</div></div>
          </div>
        </details>

        <details open={openStep === "style"} onToggle={(event) => event.currentTarget.open && setOpenStep("style")}>
          <summary><StepNumber number="02" done /><span><b>Etapa y estructura visual</b><small>{stage} · {archetypeId === "automatico" ? "Automático" : archetypes.find((item) => item.id === archetypeId)?.label_visible}</small></span><ChevronDown /></summary>
          <div className="studio-step-body">
            <div className="stage-tabs compact-tabs">{stages.map((item) => <button key={item} type="button" className={stage === item ? "selected" : ""} onClick={() => setStage(item)}>{item}</button>)}</div>
            <div className="swipe-reference-head"><div><span className="eyebrow">Inspiración de estructura</span><b>Elige una lectura visual, no una marca.</b></div><a href="https://docs.google.com/presentation/d/1v9wvp-GLzMXOe88Lvd_tjso4qGv9UOXt_MqvFfMJKcs/edit?slide=id.g337cb9cdf36_0_1994#slide=id.g337cb9cdf36_0_1994" target="_blank" rel="noreferrer">Ver fuente</a></div>
            <div className="external-reference-rail">
              <button type="button" className={externalReference === "none" ? "selected original" : "original"} onClick={() => setExternalReference("none")}><Sparkles /><b>Dirección original</b><span>La IA decide con tu brief.</span></button>
              {visualReferences.map((item) => <button type="button" key={item.id} className={externalReference === item.id ? "selected" : ""} onClick={() => setExternalReference(item.id)}><span className={`swipe-crop ${item.position}`} style={{ backgroundImage: `url(${swipeSlide})` }} /><b>{item.label}</b><span>{item.note}</span></button>)}
            </div>
            <div className="archetype-carousel">
              <button type="button" className={archetypeId === "automatico" ? "selected automatic" : "automatic"} onClick={() => setArchetypeId("automatico")}><div className="archetype-auto-visual"><Sparkles /></div><b>Automático</b><span>La directora elige la estructura más adecuada.</span></button>
              {archetypes.map((item) => <button type="button" data-archetype={item.id} key={item.id} className={archetypeId === item.id ? "selected" : ""} onClick={() => setArchetypeId(item.id)}><ArchetypeMockup id={item.id} /><b>{item.label_visible}</b><span>{structureDescription(item.id)}</span></button>)}
            </div>
          </div>
        </details>

        <details open={openStep === "intent"} onToggle={(event) => event.currentTarget.open && setOpenStep("intent")}>
          <summary><StepNumber number="03" done={intent.trim().length >= 16} /><span><b>Qué quieres comunicar</b><small>{intent ? `${intent.slice(0, 74)}${intent.length > 74 ? "…" : ""}` : "Contexto, cantidad y calidad"}</small></span><ChevronDown /></summary>
          <div className="studio-step-body intent-step">
            <textarea value={intent} onChange={(event) => setIntent(event.target.value)} placeholder={examples[exampleIndex]} />
            <div className="proposal-controls"><fieldset><legend>Cantidad de propuestas nuevas</legend><div>{[1, 2, 3].map((count) => <button key={count} type="button" className={proposals === count ? "selected" : ""} onClick={() => setProposals(count)}>{count}</button>)}</div><small>No son variaciones de un ganador; son conceptos nuevos para explorar.</small></fieldset><label>Calidad<select value={quality} onChange={(event) => setQuality(event.target.value === "high" ? "high" : "medium")}><option value="medium">Estándar{unlimitedCredits ? " · incluida" : ""}</option><option value="high">Alta{unlimitedCredits ? " · incluida" : ""}</option></select></label></div>
            <button className="primary-action prepare-action" type="submit" disabled={busy === "brief" || busy === "generate"}>{busy === "brief" ? <Loader2 className="spin" /> : <Pencil />} {busy === "brief" ? "Preparando dirección…" : "Preparar anuncio"}</button>
          </div>
        </details>

        {brief && (
          <details open={openStep === "brief"} onToggle={(event) => event.currentTarget.open && setOpenStep("brief")} className="brief-step">
            <summary><StepNumber number="04" done /><span><b>Texto y dirección aprobados</b><small>{brief.arquetipo_label} · {brief.review_score}/100</small></span><ChevronDown /></summary>
            <div className="studio-step-body brief-editor">
              <label>Concepto<textarea value={brief.concepto} onChange={(event) => updateBrief("concepto", event.target.value)} /></label>
              <div className="copy-grid"><label>Texto principal<input value={brief.texto_principal} onChange={(event) => updateBrief("texto_principal", event.target.value)} /></label><label>Texto secundario<input value={brief.texto_secundario} onChange={(event) => updateBrief("texto_secundario", event.target.value)} /></label><label>CTA<input value={brief.cta} disabled={brief.cta_usage === "none"} onChange={(event) => updateBrief("cta", event.target.value)} /></label></div>
              <div className="creative-usage-controls"><label>Logotipo<select value={brief.logo_usage} onChange={(event) => updateBrief("logo_usage", event.target.value as StaticBrief["logo_usage"])}><option value="none">No usar</option><option value="subtle">Discreto</option><option value="prominent">Protagonista</option></select></label><label>Call to action<select value={brief.cta_usage} onChange={(event) => updateBrief("cta_usage", event.target.value as StaticBrief["cta_usage"])}><option value="none">Sin CTA</option><option value="text">Texto discreto</option><option value="button">Botón</option></select></label></div>
              <label>Disclaimer o texto legal<input value={brief.disclaimer || ""} onChange={(event) => updateBrief("disclaimer", event.target.value)} placeholder="Déjalo vacío si no aplica" /></label>
              <details className="art-direction-details"><summary>Ver dirección de arte</summary><p>{brief.hook_visual}</p><div className="direction-zones"><span><b>Arriba</b>{brief.composicion.zona_superior}</span><span><b>Centro</b>{brief.composicion.zona_media}</span><span><b>Abajo</b>{brief.composicion.zona_inferior}</span></div></details>
              <div className="brief-generate-row"><div><span>{proposals} {proposals === 1 ? "propuesta" : "propuestas"} · {format}</span><small>{unlimitedCredits ? "Incluido en tu cuenta" : `${totalCost} créditos estimados`}</small></div><button type="button" onClick={handleGenerate} disabled={busy === "generate"}>{busy === "generate" ? <Loader2 className="spin" /> : <WandSparkles />} {busy === "generate" ? "Generando…" : "Generar ahora"}</button></div>
            </div>
          </details>
        )}
        {message && <p className="form-message studio-message">{message}</p>}
      </form>

      {fullScreen && selectedCreative && selectedUrl && <div className="canvas-lightbox" role="dialog" aria-modal="true"><button type="button" onClick={() => setFullScreen(false)}><X /> Cerrar</button><img src={selectedUrl} alt={`Vista completa de ${brandName}`} /></div>}
    </div>
  );
}

function StepNumber({ number, done }: { number: string; done?: boolean }) {
  return <span className={done ? "step-number done" : "step-number"}>{done ? <Check size={14} /> : number}</span>;
}

function ArchetypeMockup({ id }: { id: string }) {
  return <span className={`archetype-mockup mock-${id}`}><i /><i /><i /></span>;
}

function formatClass(value: string) {
  return value.includes("9:16") ? "story" : value.includes("1:1") ? "square" : "portrait";
}

function selectedProductLabel(assets: BrandAsset[], id: string, service: boolean) {
  if (service) return "Sin producto";
  const asset = assets.find((item) => item.id === id);
  return asset?.label || (asset ? cleanLabel(asset.file_name) : "Elige producto");
}

function cleanLabel(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function structureDescription(id: string) {
  const descriptions: Record<string, string> = {
    oferta_directa: "Oferta arriba, producto al centro y CTA claro.",
    testimonio_chat: "Prueba social real con producto como respaldo.",
    before_after: "Dos estados comparables con el producto como puente.",
    us_vs_them: "Dos columnas para mostrar una diferencia concreta.",
    beneficios_apilados: "Producto central con tres razones de compra.",
    problema_solucion: "Problema visible arriba y solución abajo.",
    ugc_casual: "Escena nativa, humana y poco producida.",
    editorial: "Producto hero con aire y jerarquía premium.",
  };
  return descriptions[id] || "Estructura visual pensada para este objetivo.";
}
