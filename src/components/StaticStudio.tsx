"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Expand,
  Eye,
  ImageIcon,
  Images,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  ReferenceUploader,
  type StyleReference,
} from "@/components/ReferenceUploader";
import { CREDIT_COSTS } from "@/lib/credit-catalog";
import type { BrandEvidence, StaticEvidence } from "@/lib/static-format-catalog";

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
  thumbnail_path?: string;
  short_description?: string;
  use_when?: string;
  visual_keys?: string[];
  version?: string;
  required_evidence?: StaticEvidence[];
  unlock_message?: string;
  objectives?: string[];
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
  composicion: {
    zona_superior: string;
    zona_media: string;
    zona_inferior: string;
  };
  art_direction: {
    decision_visual_fuerte: string;
    iluminacion: string;
    camara_y_encuadre: string;
    superficie_y_entorno: string;
    props: string;
    tratamiento_color: string;
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
  parent_id?: string | null;
  status: string;
  qa_report?: { razon?: string; veredicto?: "aprobada" | "regenerar" } | null;
  created_at?: string;
};

type OpenStep = "setup" | "style" | "intent";
type DirectionMode = "automatic" | "catalog" | "reference";
type StudioMemory = {
  assetId?: string;
  format?: string;
  serviceNoProduct?: boolean;
};

const formats = ["1:1 Feed", "4:5 Feed", "9:16 Story/Reel"];
const stages = ["Descubrimiento", "Consideración", "Conversión", "Retargeting"];
const examples = [
  "Ej: Quiero presentar mi oferta a personas que todavía no conocen la marca.",
  "Ej: Quiero explicar por qué esta solución vale lo que cuesta sin sonar técnica.",
  "Ej: Quiero una pieza directa para impulsar registros, reservas o ventas esta semana.",
];

export function StaticStudio({
  brandId,
  brandName,
  initialAssets,
  initialLogos,
  archetypes,
  initialGallery,
  initialReferences,
  unlimitedCredits = false,
  brandEvidence,
}: {
  brandId: string;
  brandName: string;
  initialAssets: BrandAsset[];
  initialLogos: BrandAsset[];
  archetypes: StaticArchetype[];
  initialGallery: GeneratedStatic[];
  initialReferences: StyleReference[];
  unlimitedCredits?: boolean;
  brandEvidence: BrandEvidence;
}) {
  const [selectedAssetId, setSelectedAssetId] = useState(
    initialAssets[0]?.id || "",
  );
  const [serviceNoProduct, setServiceNoProduct] = useState(
    initialAssets.length === 0,
  );
  const [format, setFormat] = useState("4:5 Feed");
  const [stage, setStage] = useState("Conversión");
  const [archetypeId, setArchetypeId] = useState("automatico");
  const [directionMode, setDirectionMode] = useState<DirectionMode>("automatic");
  const [intent, setIntent] = useState("");
  const [proposals, setProposals] = useState(1);
  const [quality, setQuality] = useState<"medium" | "high">("high");
  const [brief, setBrief] = useState<StaticBrief | null>(null);
  const [creativeId, setCreativeId] = useState<string | null>(null);
  const [gallery, setGallery] = useState(initialGallery);
  const [selectedCreative, setSelectedCreative] =
    useState<GeneratedStatic | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"brief" | "generate" | "edit" | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [openStep, setOpenStep] = useState<OpenStep>("intent");
  const [correction, setCorrection] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const [referencePreview, setReferencePreview] =
    useState<StaticArchetype | null>(null);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>(
    [],
  );
  const [referenceCount, setReferenceCount] = useState(
    initialReferences.length,
  );
  const [remainingProposals, setRemainingProposals] = useState(0);
  const [variantOffset, setVariantOffset] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(12);
  const [memoryReady, setMemoryReady] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, -1 | 1>>({});
  const stageRef = useRef<HTMLElement>(null);
  const correctionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const id = window.setInterval(
      () => setExampleIndex((current) => (current + 1) % examples.length),
      3000,
    );
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(
          `static-studio-memory:${brandId}`,
        );
        const memory = raw ? (JSON.parse(raw) as StudioMemory) : null;
        if (
          memory?.assetId &&
          initialAssets.some((asset) => asset.id === memory.assetId)
        ) {
          setSelectedAssetId(memory.assetId);
        }
        if (memory?.format && formats.includes(memory.format))
          setFormat(memory.format);
        if (typeof memory?.serviceNoProduct === "boolean")
          setServiceNoProduct(memory.serviceNoProduct);
      } catch {
        // A damaged local preference should never block the studio.
      } finally {
        setMemoryReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [brandId, initialAssets]);

  useEffect(() => {
    if (!memoryReady) return;
    const memory: StudioMemory = {
      assetId: selectedAssetId,
      format,
      serviceNoProduct,
    };
    window.localStorage.setItem(
      `static-studio-memory:${brandId}`,
      JSON.stringify(memory),
    );
  }, [brandId, format, memoryReady, selectedAssetId, serviceNoProduct]);

  const identityReady =
    initialLogos.length > 0 ||
    initialReferences.length > 0 ||
    initialAssets.length > 0;
  const productReady = true;
  const selectedUrl =
    selectedCreative?.public_url || selectedCreative?.signed_url || "";
  const latestCreative = gallery[0] || null;
  const visibleGallery = gallery.slice(0, galleryVisible);
  const selectedArchetype =
    archetypes.find((item) => item.id === archetypeId) || null;
  const selectedReference = initialReferences.find((item) => selectedReferenceIds.includes(item.id));
  const selectedReferenceMatch = selectedReference?.metadata?.analysis?.matched_archetype_id;
  const estimatedCredits = CREDIT_COSTS.static_brief + (quality === "high"
    ? CREDIT_COSTS.static_generate_high
    : CREDIT_COSTS.static_generate_medium);

  function isLocked(item: StaticArchetype) {
    return (item.required_evidence || []).some((requirement) => !brandEvidence[requirement]);
  }

  async function handleCreateBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (intent.trim().length < 16)
      return setMessage(
        "Cuéntanos un poco más sobre lo que quieres comunicar.",
      );
    setBusy("brief");
    setSelectedCreative(null);
    setCorrection("");
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const response = await fetch("/api/static-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandId,
          intent,
          format,
          funnelStage: stage,
          archetypeId: directionMode === "automatic"
            ? "automatico"
            : directionMode === "reference"
              ? selectedReferenceMatch || "automatico"
              : archetypeId,
          productAssetId: serviceNoProduct ? undefined : selectedAssetId,
          serviceNoProduct,
          logoAssetId: initialLogos[0]?.id,
          referenceAssetIds: directionMode === "reference" ? selectedReferenceIds : [],
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudo preparar el anuncio.");
      setBrief(data.ficha);
      setCreativeId(data.creativeId);
      setRemainingProposals(0);
      setVariantOffset(0);
      setMessage(
        data.automaticSelection
          ? `Dirección lista: ${data.automaticSelection.label}. ${data.automaticSelection.reason}`
          : "Dirección lista. Revisa el texto en el lienzo y genera la imagen.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo preparar el anuncio.",
      );
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
          variants: 1,
          variantOffset,
          productAssetId: serviceNoProduct ? undefined : selectedAssetId,
          serviceNoProduct,
          logoAssetId: initialLogos[0]?.id,
          referenceAssetIds: directionMode === "reference" ? selectedReferenceIds : [],
          useRawStyleReferences: false,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudo generar la imagen.");
      const created = (data.statics || []) as GeneratedStatic[];
      setGallery((current) => [...created, ...current]);
      setSelectedCreative(created[0] || null);
      const pending =
        variantOffset === 0
          ? Math.max(0, proposals - 1)
          : Math.max(0, remainingProposals - 1);
      setRemainingProposals(pending);
      setVariantOffset((current) => current + 1);
      setMessage(
        created[0]?.status === "needs_review"
          ? `La pieza quedó visible, pero el control de calidad detectó: ${created[0]?.qa_report?.razon || "un problema que requiere revisión"}.`
          : pending > 0
          ? `Propuesta creada y guardada. Revísala antes de generar ${pending === 1 ? "la siguiente" : `las ${pending} restantes`}.`
          : "Propuesta creada y guardada en la galería.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo generar la imagen.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function deleteCreative(item: GeneratedStatic) {
    if (
      !window.confirm(
        "¿Borrar esta pieza de la galería? Esta acción no se puede deshacer.",
      )
    )
      return;
    setMessage("");
    const response = await fetch(`/api/static-library/${item.id}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      return setMessage(data.error || "No se pudo borrar la pieza.");
    setGallery((current) =>
      current.filter((creative) => creative.id !== item.id),
    );
    if (selectedCreative?.id === item.id) {
      setSelectedCreative(null);
      setBrief(null);
      setCreativeId(null);
    }
    setMessage("La pieza se borró de la galería.");
  }

  async function handleCorrection() {
    if (!selectedCreative || correction.trim().length < 6)
      return setMessage("Escribe la corrección puntual que quieres hacer.");
    setBusy("edit");
    setMessage("");
    try {
      const response = await fetch("/api/static-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          staticId: selectedCreative.id,
          instruction: correction.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudo corregir la imagen.");
      const edited = data.static as GeneratedStatic;
      setGallery((current) => [edited, ...current]);
      setSelectedCreative(edited);
      setCorrection("");
      setMessage(
        `Corrección guardada como versión ${edited.version}. La anterior sigue disponible.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo corregir la imagen.",
      );
    } finally {
      setBusy(null);
    }
  }

  function updateBrief<K extends keyof StaticBrief>(
    key: K,
    value: StaticBrief[K],
  ) {
    setBrief((current) => (current ? { ...current, [key]: value } : current));
  }

  function resetPiece() {
    setIntent("");
    setStage("Conversión");
    setArchetypeId("automatico");
    setProposals(1);
    setQuality("medium");
    setBrief(null);
    setCreativeId(null);
    setSelectedCreative(null);
    setCorrection("");
    setRemainingProposals(0);
    setVariantOffset(0);
    setMessage("");
    setOpenStep("intent");
    window.requestAnimationFrame(() =>
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function viewCreative(item: GeneratedStatic) {
    setBrief(null);
    setSelectedCreative(item);
    setCorrection("");
    setMessage("");
    window.requestAnimationFrame(() =>
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function editCreative(item: GeneratedStatic, newVersion = false) {
    setBrief(null);
    setSelectedCreative(item);
    setCorrection("");
    setMessage(
      newVersion
        ? "Describe un cambio concreto para crear una nueva versión sin borrar la anterior."
        : "Esta pieza está lista para corregirse. Escribe un solo cambio puntual.",
    );
    window.setTimeout(() => {
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      correctionRef.current?.focus();
    }, 60);
  }

  function trackDownload(item: GeneratedStatic) {
    void fetch(`/api/static-download/${item.id}`, { method: "POST" });
  }

  async function rateCreative(item: GeneratedStatic, rating: -1 | 1) {
    setFeedback((current) => ({ ...current, [item.id]: rating }));
    const response = await fetch("/api/static-feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staticId: item.id, rating }),
    });
    if (!response.ok) {
      setFeedback((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setMessage("No pudimos guardar tu valoración; intenta nuevamente.");
    }
  }

  const canvasTitle = selectedCreative
    ? "Tu pieza, en tamaño real"
    : brief
      ? "La ficha está lista para producir"
      : "Un lienzo listo para tu próxima idea";

  return (
    <div className="static-editor static-editor-always-ready">
      <div className="static-workspace">
        <aside className="studio-creation-flow" aria-label="Flujo de creación">
          <div className="studio-flow-header">
            <span className="eyebrow">Nueva pieza</span>
            <h2>De la idea al anuncio.</h2>
            <p>
              Tu marca ya está preparada. Solo dinos qué quieres comunicar hoy.
            </p>
          </div>

          <div className="studio-readiness">
            <div className={identityReady ? "ready" : ""}>
              {identityReady ? <Check /> : <ImageIcon />}
              <span>
                <b>Identidad de {brandName}</b>
                <small>
                  {initialAssets.length} activos de producto ·{" "}
                  {initialReferences.length} referencias · {initialLogos.length}{" "}
                  logotipos · todo opcional
                </small>
              </span>
            </div>
            <Link href={`/marcas/${brandId}/editar`}>
              {identityReady ? "Administrar" : "Agregar contexto"}
            </Link>
          </div>

          <form className="static-simple-builder" onSubmit={handleCreateBrief}>
            <div className="static-builder-main">
              <label className="static-intent-box">
                <Sparkles size={20} />
                <textarea
                  value={intent}
                  onChange={(event) => setIntent(event.target.value)}
                  placeholder="Cuéntame qué quieres comunicar o provocar con esta imagen"
                  maxLength={320}
                />
                <small>{intent.length}/320</small>
              </label>

              <div className="static-direction-heading">
                <div>
                  <span className="eyebrow">Dirección visual</span>
                  <h3>Elige cuánto control quieres.</h3>
                </div>
                <p>Usamos la estructura; el contenido siempre sale de la memoria de {brandName}.</p>
              </div>

              <div className="static-direction-tabs" role="tablist" aria-label="Modo de dirección visual">
                <button type="button" className={directionMode === "automatic" ? "selected" : ""} onClick={() => { setDirectionMode("automatic"); setArchetypeId("automatico"); }}>
                  <Sparkles size={17} /> Automático <small>Recomendado</small>
                </button>
                <button type="button" className={directionMode === "catalog" ? "selected" : ""} onClick={() => { setDirectionMode("catalog"); if (archetypeId === "automatico") setArchetypeId("oferta_directa"); }}>
                  <WandSparkles size={17} /> Estilos Anapau
                </button>
                <button type="button" className={directionMode === "reference" ? "selected" : ""} onClick={() => setDirectionMode("reference")}>
                  <ImageIcon size={17} /> Mi referencia
                </button>
              </div>

              {directionMode === "automatic" && (
                <div className="automatic-explainer">
                  <span><Sparkles size={20} /></span>
                  <div><b>La plataforma decide con reglas claras.</b><p>Primero descarta estilos sin evidencia, después prioriza tu objetivo y los resultados anteriores, y por último evita repetir las últimas composiciones.</p></div>
                </div>
              )}

              {directionMode === "catalog" && (
                <div className="static-pattern-grid">
                  {archetypes.map((item) => {
                    const locked = isLocked(item);
                    return (
                      <article key={item.id} className={`${archetypeId === item.id ? "selected" : ""} ${locked ? "locked" : ""}`}>
                        <button type="button" disabled={locked} onClick={() => setArchetypeId(item.id)}>
                          <span className="pattern-wireframe" data-pattern={item.id} aria-hidden="true"><i /><i /><i /><i /></span>
                          <b>{item.label_visible}</b>
                          <small>{item.visual_keys?.slice(0, 2).join(" · ")}</small>
                          {!locked && archetypeId === item.id && <Check className="pattern-check" size={16} />}
                        </button>
                        {locked && <Link href={`/marcas/${brandId}/editar`}><span>Bloqueado</span>{item.unlock_message}</Link>}
                      </article>
                    );
                  })}
                </div>
              )}

              {directionMode === "reference" && (
                <section className="simple-reference-zone">
                  <div><b>Sube una referencia</b><p>La convertimos en una receta de jerarquía, densidad y composición. La imagen ajena no pasa al generador.</p></div>
                  <ReferenceUploader
                    brandId={brandId}
                    initialReferences={initialReferences}
                    selectedIds={selectedReferenceIds}
                    onSelectionChange={(ids) => setSelectedReferenceIds(ids.slice(-1))}
                    onItemsChange={(ids) => setReferenceCount(ids.length)}
                  />
                  <small>{unlimitedCredits ? "Análisis incluido." : `Las primeras 6 referencias por marca están incluidas; después, ${CREDIT_COSTS.reference_analysis} créditos por análisis.`}</small>
                </section>
              )}
            </div>

            <aside className="static-builder-summary">
              <span className="eyebrow">Resumen</span>
              <section>
                <b>Producto</b>
                <div className="summary-product">
                  {!serviceNoProduct && initialAssets.find((asset) => asset.id === selectedAssetId)?.signed_url
                    ? <img src={initialAssets.find((asset) => asset.id === selectedAssetId)?.signed_url || ""} alt="" />
                    : <ImageIcon size={24} />}
                  <span>{selectedProductLabel(initialAssets, selectedAssetId, serviceNoProduct)}</span>
                </div>
                <select value={serviceNoProduct ? "service" : selectedAssetId} onChange={(event) => { setServiceNoProduct(event.target.value === "service"); if (event.target.value !== "service") setSelectedAssetId(event.target.value); }}>
                  {initialAssets.map((asset, index) => <option value={asset.id} key={asset.id}>{assetDisplayLabel(asset, index)}</option>)}
                  <option value="service">Sin foto de producto</option>
                </select>
              </section>
              <section>
                <b>Formato</b>
                <div className="summary-format-options">{formats.map((item) => <button type="button" key={item} className={format === item ? "selected" : ""} onClick={() => setFormat(item)}><span className={`format-icon ${formatClass(item)}`} />{item.split(" ")[0]}</button>)}</div>
              </section>
              <section>
                <b>Objetivo</b>
                <select value={stage} onChange={(event) => setStage(event.target.value)}>{stages.map((item) => <option value={item} key={item}>{item}</option>)}</select>
              </section>
              <section>
                <b>Dirección</b>
                <p>{directionMode === "automatic" ? "Automática" : directionMode === "reference" ? selectedReferenceMatch ? `Referencia → ${archetypes.find((item) => item.id === selectedReferenceMatch)?.label_visible}` : "Referencia propia" : selectedArchetype?.label_visible}</p>
              </section>
              <label>Calidad<select value={quality} onChange={(event) => setQuality(event.target.value === "high" ? "high" : "medium")}><option value="high">Alta · recomendada</option><option value="medium">Estándar</option></select></label>
              <div className="summary-cost"><small>Costo estimado total</small><b>{unlimitedCredits ? "Incluido" : `${estimatedCredits} créditos`}</b><span>Ficha + 1 imagen</span></div>
              <button className="primary-action studio-create-brief" type="submit" disabled={busy === "brief" || busy === "generate" || (directionMode === "reference" && selectedReferenceIds.length === 0)}>
                {busy === "brief" ? <Loader2 className="spin" /> : <Sparkles />}
                {busy === "brief" ? "Preparando dirección…" : `Crear ficha · ${unlimitedCredits ? "incluido" : `${CREDIT_COSTS.static_brief} cr`}`}
              </button>
              <small className="credit-lock-note">Los créditos de imagen se descuentan sólo cuando decidas generarla.</small>
            </aside>
            {message && <p className="form-message studio-message" aria-live="polite">{message}</p>}
          </form>

          <form className="studio-steps legacy-studio-steps" onSubmit={handleCreateBrief}>
            <details
              open={openStep === "setup"}
              onToggle={(event) =>
                event.currentTarget.open && setOpenStep("setup")
              }
            >
              <summary>
                <StepNumber number="01" done={productReady} />
                <span>
                  <b>Activo principal y formato</b>
                  <small>
                    {selectedProductLabel(
                      initialAssets,
                      selectedAssetId,
                      serviceNoProduct,
                    )}{" "}
                    · {format}
                  </small>
                </span>
                <ChevronDown />
              </summary>
              <div className="studio-step-body setup-grid">
                <div>
                  <label className="field-label">
                    Foto de producto o activo principal
                  </label>
                  <div className="compact-product-row">
                    {initialAssets.map((asset, index) => {
                      const label = assetDisplayLabel(asset, index);
                      return (
                        <button
                          type="button"
                          key={asset.id}
                          className={
                            selectedAssetId === asset.id && !serviceNoProduct
                              ? "selected"
                              : ""
                          }
                          onClick={() => {
                            setSelectedAssetId(asset.id);
                            setServiceNoProduct(false);
                          }}
                        >
                          {asset.signed_url && (
                            <img src={asset.signed_url} alt={label} />
                          )}
                          <span>{label}</span>
                          {selectedAssetId === asset.id &&
                            !serviceNoProduct && <Check />}
                        </button>
                      );
                    })}
                  </div>
                  <label className="service-toggle compact">
                    <input
                      type="checkbox"
                      checked={serviceNoProduct}
                      onChange={(event) =>
                        setServiceNoProduct(event.target.checked)
                      }
                    />
                    <span>Esta pieza no necesita una foto de producto.</span>
                  </label>
                </div>
                <div>
                  <label className="field-label">Formato</label>
                  <div className="format-capsules">
                    {formats.map((item) => (
                      <button
                        type="button"
                        key={item}
                        className={format === item ? "selected" : ""}
                        onClick={() => setFormat(item)}
                      >
                        <span className={`format-icon ${formatClass(item)}`} />
                        <b>{item}</b>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            <details
              open={openStep === "style"}
              onToggle={(event) =>
                event.currentTarget.open && setOpenStep("style")
              }
            >
              <summary>
                <StepNumber number="02" done />
                <span>
                  <b>Etapa y estructura</b>
                  <small>
                    {stage} ·{" "}
                    {archetypeId === "automatico"
                      ? "Automático"
                      : archetypes.find((item) => item.id === archetypeId)
                          ?.label_visible}
                  </small>
                </span>
                <ChevronDown />
              </summary>
              <div className="studio-step-body">
                <div className="stage-tabs compact-tabs">
                  {stages.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={stage === item ? "selected" : ""}
                      onClick={() => setStage(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="archetype-section-heading">
                  <div>
                    <span className="eyebrow">Estructura del anuncio</span>
                    <b>Elige visualmente cómo se contará la idea.</b>
                  </div>
                  <small>
                    Son referencias de composición. La pieza final usará tu
                    identidad.
                  </small>
                </div>
                <div
                  className="archetype-format-strip"
                  aria-label="Formatos de anuncio disponibles"
                >
                  <button
                    type="button"
                    className={
                      archetypeId === "automatico"
                        ? "selected automatic"
                        : "automatic"
                    }
                    onClick={() => setArchetypeId("automatico")}
                  >
                    <span className="archetype-mini-visual automatic">
                      <Sparkles />
                    </span>
                    <b>Automático</b>
                  </button>
                  {archetypes.map((item) => (
                    <button
                      type="button"
                      data-archetype={item.id}
                      key={item.id}
                      className={archetypeId === item.id ? "selected" : ""}
                      onClick={() => setArchetypeId(item.id)}
                    >
                      <span className="archetype-mini-visual">
                        {item.thumbnail_path && (
                          <img
                            src={item.thumbnail_path}
                            alt=""
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <b>{item.label_visible}</b>
                    </button>
                  ))}
                </div>

                {selectedArchetype?.thumbnail_path ? (
                  <div className="archetype-reference-panel">
                    <button
                      type="button"
                      className="archetype-reference-visual"
                      onClick={() => setReferencePreview(selectedArchetype)}
                      aria-label={`Ampliar referencia de ${selectedArchetype.label_visible}`}
                    >
                      <img
                        src={selectedArchetype.thumbnail_path}
                        alt={`Referencia visual: ${selectedArchetype.label_visible}`}
                      />
                      <span>
                        <Expand size={15} /> Ver referencia completa
                      </span>
                    </button>
                    <div className="archetype-reference-copy">
                      <span className="eyebrow">Referencia seleccionada</span>
                      <h3>{selectedArchetype.label_visible}</h3>
                      <p>{selectedArchetype.short_description}</p>
                      <div className="archetype-visual-keys">
                        {selectedArchetype.visual_keys?.map((key) => (
                          <span key={key}>{key}</span>
                        ))}
                      </div>
                      <small>
                        <b>Úsalo cuando</b>
                        {selectedArchetype.use_when}
                      </small>
                      <div className="archetype-recipe-note">
                        <WandSparkles size={16} />
                        <span>
                          La plataforma tomará esta arquitectura visual y la
                          adaptará a tu oferta, tus textos y tu identidad.
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="archetype-reference-panel automatic">
                    <div className="archetype-automatic-stage">
                      <Sparkles />
                      <span>
                        <b>Dirección automática</b>La estratega elegirá una de
                        las 10 estructuras según tu objetivo, etapa y mensaje.
                      </span>
                    </div>
                    <div className="archetype-reference-copy">
                      <span className="eyebrow">Recomendado para empezar</span>
                      <h3>La mejor estructura para tu idea</h3>
                      <p>
                        No necesitas adivinar el formato. La plataforma compara
                        tu brief con las diez recetas visuales y elige la más
                        adecuada.
                      </p>
                      <div className="archetype-recipe-note">
                        <WandSparkles size={16} />
                        <span>
                          La decisión también queda guardada en el JSON y guía
                          la composición de la imagen.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <section className="brand-reference-zone studio-reference-zone">
                  <header>
                    <div>
                      <span className="eyebrow">
                        Referencia propia · opcional
                      </span>
                      <h3>Sube una imagen para guiar el estilo</h3>
                    </div>
                    <p>
                      Tomaremos composición, jerarquía y atmósfera. La marca, el
                      producto y los textos seguirán siendo los de{" "}
                      <b>{brandName}</b>.
                    </p>
                  </header>
                  <ReferenceUploader
                    brandId={brandId}
                    initialReferences={initialReferences}
                    selectedIds={selectedReferenceIds}
                    onSelectionChange={setSelectedReferenceIds}
                    onItemsChange={(ids) => setReferenceCount(ids.length)}
                  />
                  <small className="studio-reference-cost">
                    {unlimitedCredits
                      ? "Análisis de referencia incluido."
                      : `Hasta 6 referencias analizadas están incluidas por marca; a partir de la séptima, cada nueva usa ${CREDIT_COSTS.reference_analysis} créditos.`}
                    {` ${selectedReferenceIds.length} de ${referenceCount} activas para esta pieza.`}
                  </small>
                </section>
              </div>
            </details>

            <details
              className="intent-focus-step"
              open={openStep === "intent"}
              onToggle={(event) =>
                event.currentTarget.open && setOpenStep("intent")
              }
            >
              <summary>
                <StepNumber number="03" done={intent.trim().length >= 16} />
                <span>
                  <b>Qué quieres comunicar</b>
                  <small>
                    {intent
                      ? `${intent.slice(0, 74)}${intent.length > 74 ? "…" : ""}`
                      : "Escribe la intención de esta pieza"}
                  </small>
                </span>
                <ChevronDown />
              </summary>
              <div className="studio-step-body intent-step">
                <textarea
                  autoFocus
                  value={intent}
                  onChange={(event) => setIntent(event.target.value)}
                  placeholder={examples[exampleIndex]}
                />
                <div className="proposal-controls">
                  <fieldset>
                    <legend>Cantidad de propuestas nuevas</legend>
                    <div>
                      {[1, 2, 3].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={proposals === count ? "selected" : ""}
                          onClick={() => setProposals(count)}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                    <small>
                      Son conceptos nuevos para explorar, no variaciones de un
                      ganador.
                    </small>
                  </fieldset>
                  <label>
                    Calidad
                    <select
                      value={quality}
                      onChange={(event) =>
                        setQuality(
                          event.target.value === "high" ? "high" : "medium",
                        )
                      }
                    >
                      <option value="high">
                        Alta · recomendada
                        {unlimitedCredits ? " · incluida" : ""}
                      </option>
                      <option value="medium">
                        Estándar{unlimitedCredits ? " · incluida" : ""}
                      </option>
                    </select>
                  </label>
                </div>
                <button
                  className="primary-action prepare-action studio-create-brief"
                  type="submit"
                  disabled={busy === "brief" || busy === "generate"}
                >
                  {busy === "brief" ? <Loader2 className="spin" /> : <Pencil />}
                  {busy === "brief"
                    ? "Preparando dirección…"
                    : unlimitedCredits
                      ? "Crear ficha del anuncio · incluido"
                      : `Crear ficha del anuncio · ${CREDIT_COSTS.static_brief} cr`}
                </button>
              </div>
            </details>

            {message && (
              <p className="form-message studio-message" aria-live="polite">
                {message}
              </p>
            )}
          </form>
        </aside>

        <section className="creative-canvas" ref={stageRef}>
          <header className="creative-canvas-head">
            <div>
              <span className="eyebrow">Lienzo de producción</span>
              <h2>{canvasTitle}</h2>
            </div>
            {selectedCreative ? (
              <div className="canvas-head-actions">
                <span className="canvas-version">
                  {selectedCreative.format} · versión {selectedCreative.version}
                </span>
                <button
                  type="button"
                  onClick={resetPiece}
                  disabled={busy !== null}
                >
                  <Plus size={16} /> Crear otra pieza
                </button>
              </div>
            ) : (
              <span className="canvas-version">{format}</span>
            )}
          </header>

          {busy === "generate" ? (
            <div
              className={`generation-stage ${formatClass(format)}`}
              aria-live="polite"
            >
              <div className="generation-pulse">
                <WandSparkles />
                <b>
                  Construyendo{" "}
                  {proposals === 1 ? "tu propuesta" : "la siguiente propuesta"}…
                </b>
                <span>
                  La imagen se guardará automáticamente en tu galería.
                </span>
                <div className="generation-progress-steps">
                  <i>Composición</i>
                  <i>Producto y copy</i>
                  <i>Revisión final</i>
                </div>
              </div>
            </div>
          ) : selectedCreative && selectedUrl ? (
            <>
              <div className="canvas-viewer">
                {selectedCreative.status === "needs_review" && (
                  <div className="qa-warning"><b>Esta pieza necesita revisión.</b><span>El control de calidad hizo dos correcciones automáticas y todavía detectó: {selectedCreative.qa_report?.razon || "un problema visual"}. Puedes verla, pero te recomendamos crear una versión corregida antes de descargar.</span></div>
                )}
                <div
                  className={`canvas-image-shell ${formatClass(selectedCreative.format)}`}
                >
                  <img
                    src={selectedUrl}
                    alt={`Anuncio generado para ${brandName}`}
                  />
                  <button
                    type="button"
                    className="expand-canvas"
                    onClick={() => setFullScreen(true)}
                  >
                    <Expand size={17} /> Ver pantalla completa
                  </button>
                </div>
                <div className="canvas-actions">
                  <div>
                    <span>
                      {selectedCreative.ficha?.arquetipo_label ||
                        "Anuncio estático"}
                    </span>
                    <b>
                      {selectedCreative.ficha?.texto_principal ||
                        "Propuesta generada"}
                    </b>
                  </div>
                  <div className="canvas-primary-actions">
                    <div className="creative-feedback" aria-label="Valorar resultado">
                      <span>¿Te sirvió?</span>
                      <button type="button" className={feedback[selectedCreative.id] === 1 ? "selected" : ""} onClick={() => rateCreative(selectedCreative, 1)} aria-label="Buen resultado"><ThumbsUp size={15} /></button>
                      <button type="button" className={feedback[selectedCreative.id] === -1 ? "selected" : ""} onClick={() => rateCreative(selectedCreative, -1)} aria-label="Mal resultado"><ThumbsDown size={15} /></button>
                    </div>
                    {remainingProposals > 0 && (
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={busy !== null}
                      >
                        <WandSparkles size={16} /> Generar siguiente
                      </button>
                    )}
                    <a
                      href={selectedUrl}
                      onClick={() => trackDownload(selectedCreative)}
                      download={downloadName(brandName, selectedCreative)}
                    >
                      <Download size={17} /> Descargar en alta calidad
                    </a>
                  </div>
                </div>
              </div>

              {gallery.length > 1 && (
                <div
                  className="proposal-filmstrip"
                  aria-label="Propuestas y versiones"
                >
                  {gallery.slice(0, 8).map((item, index) => {
                    const url = creativeUrl(item);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={
                          selectedCreative.id === item.id ? "selected" : ""
                        }
                        onClick={() => viewCreative(item)}
                      >
                        {url && (
                          <img src={url} alt={`Propuesta ${index + 1}`} />
                        )}
                        <span>
                          {item.status === "edited"
                            ? `Edición v${item.version}`
                            : `Propuesta ${index + 1}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="image-correction-bar">
                <div>
                  <Pencil size={18} />
                  <span>
                    <b>¿Quieres corregir algo?</b> Describe únicamente el
                    cambio. La versión actual no se borrará.
                  </span>
                </div>
                <textarea
                  ref={correctionRef}
                  value={correction}
                  onChange={(event) => setCorrection(event.target.value)}
                  placeholder="Ej: Quita el botón de llamada a la acción y conserva todo lo demás exactamente igual."
                />
                <button
                  type="button"
                  onClick={handleCorrection}
                  disabled={busy === "edit"}
                >
                  {busy === "edit" ? (
                    <Loader2 className="spin" />
                  ) : (
                    <RefreshCw />
                  )}{" "}
                  {busy === "edit"
                    ? "Corrigiendo…"
                    : unlimitedCredits
                      ? "Crear versión corregida · incluido"
                      : `Crear versión corregida · ${CREDIT_COSTS.static_edit} cr`}
                </button>
              </div>
            </>
          ) : brief ? (
            <div className="canvas-brief-state brief-editor">
              <div className="canvas-brief-intro">
                <div>
                  <span>{brief.arquetipo_label}</span>
                  <b>Aprobada · {brief.review_score}/100</b>
                </div>
                <p>{brief.review_summary}</p>
              </div>
              <label>
                Concepto
                <textarea
                  value={brief.concepto}
                  onChange={(event) =>
                    updateBrief("concepto", event.target.value)
                  }
                />
              </label>
              <div className="copy-grid">
                <label>
                  Texto principal
                  <input
                    value={brief.texto_principal}
                    onChange={(event) =>
                      updateBrief("texto_principal", event.target.value)
                    }
                  />
                </label>
                <label>
                  Texto secundario
                  <input
                    value={brief.texto_secundario}
                    onChange={(event) =>
                      updateBrief("texto_secundario", event.target.value)
                    }
                  />
                </label>
                <label>
                  CTA
                  <input
                    value={brief.cta}
                    disabled={brief.cta_usage === "none"}
                    onChange={(event) => updateBrief("cta", event.target.value)}
                  />
                </label>
              </div>
              <div className="creative-usage-controls">
                <label>
                  Logotipo
                  <select
                    value={brief.logo_usage}
                    onChange={(event) =>
                      updateBrief(
                        "logo_usage",
                        event.target.value as StaticBrief["logo_usage"],
                      )
                    }
                  >
                    <option value="none">No usar</option>
                    <option value="subtle">Discreto</option>
                    <option value="prominent">Protagonista</option>
                  </select>
                </label>
                <label>
                  Call to action
                  <select
                    value={brief.cta_usage}
                    onChange={(event) =>
                      updateBrief(
                        "cta_usage",
                        event.target.value as StaticBrief["cta_usage"],
                      )
                    }
                  >
                    <option value="none">Sin CTA</option>
                    <option value="text">Texto discreto</option>
                    <option value="button">Botón</option>
                  </select>
                </label>
              </div>
              <label>
                Disclaimer o texto legal
                <input
                  value={brief.disclaimer || ""}
                  onChange={(event) =>
                    updateBrief("disclaimer", event.target.value)
                  }
                  placeholder="Déjalo vacío si no aplica"
                />
              </label>
              <details className="art-direction-details">
                <summary>Ver cómo se fotografiará y compondrá</summary>
                <p>{brief.hook_visual}</p>
                <div className="direction-zones">
                  <span>
                    <b>Decisión visual</b>
                    {brief.art_direction.decision_visual_fuerte}
                  </span>
                  <span>
                    <b>Luz</b>
                    {brief.art_direction.iluminacion}
                  </span>
                  <span>
                    <b>Cámara</b>
                    {brief.art_direction.camara_y_encuadre}
                  </span>
                  <span>
                    <b>Entorno</b>
                    {brief.art_direction.superficie_y_entorno}
                  </span>
                  <span>
                    <b>Props</b>
                    {brief.art_direction.props}
                  </span>
                  <span>
                    <b>Color</b>
                    {brief.art_direction.tratamiento_color}
                  </span>
                </div>
              </details>
              <div className="brief-generate-row">
                <div>
                  <span>
                    {proposals} {proposals === 1 ? "propuesta" : "propuestas"} ·{" "}
                    {format}
                  </span>
                  <small>
                    {unlimitedCredits
                      ? "Incluido en tu cuenta"
                      : `${quality === "high" ? CREDIT_COSTS.static_generate_high : CREDIT_COSTS.static_generate_medium} créditos por propuesta`}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={busy !== null}
                >
                  <WandSparkles /> Generar imagen
                </button>
              </div>
            </div>
          ) : (
            <div className="studio-blank-state">
              <div className={`blank-format-frame ${formatClass(format)}`}>
                <ImageIcon size={34} />
                <b>Aquí aparecerá tu próximo anuncio</b>
                <p>
                  {format} · cambia el formato y este lienzo se ajustará en
                  vivo.
                </p>
              </div>
            </div>
          )}

          {!selectedCreative && !brief && busy === null && latestCreative && (
            <article className="last-creation-card">
              {creativeUrl(latestCreative) && (
                <img src={creativeUrl(latestCreative)} alt="Última creación" />
              )}
              <div>
                <span>Tu última creación</span>
                <b>{creativeTitle(latestCreative)}</b>
                <small>{formatCreativeDate(latestCreative.created_at)}</small>
              </div>
              <div className="last-creation-actions">
                <button
                  type="button"
                  onClick={() => viewCreative(latestCreative)}
                >
                  <Eye size={14} /> Ver
                </button>
                <button
                  type="button"
                  onClick={() => editCreative(latestCreative)}
                >
                  <Pencil size={14} /> Editar
                </button>
                <a
                  href={creativeUrl(latestCreative)}
                  onClick={() => trackDownload(latestCreative)}
                  download={downloadName(brandName, latestCreative)}
                  aria-label="Descargar última creación"
                >
                  <Download size={15} />
                </a>
              </div>
            </article>
          )}
        </section>
      </div>

      <section
        className="studio-gallery"
        aria-labelledby="studio-gallery-title"
      >
        <header>
          <div>
            <span className="eyebrow">Archivo creativo</span>
            <h2 id="studio-gallery-title">Galería de {brandName}</h2>
            <p>
              Cada pieza y cada corrección quedan disponibles para volver a
              abrirse.
            </p>
          </div>
          {gallery.length > 0 && (
            <span className="gallery-count">
              <Images size={16} /> {gallery.length}{" "}
              {gallery.length === 1 ? "pieza" : "piezas"}
            </span>
          )}
        </header>

        {gallery.length === 0 ? (
          <div className="studio-gallery-empty">
            <ImageIcon />
            <b>Tus piezas aparecerán aquí.</b>
            <p>Crea la primera desde el flujo de arriba.</p>
            <span>↑</span>
          </div>
        ) : (
          <>
            <div className="studio-gallery-grid">
              {visibleGallery.map((item) => {
                const url = creativeUrl(item);
                return (
                  <article
                    key={item.id}
                    className={
                      selectedCreative?.id === item.id ? "selected" : ""
                    }
                  >
                    <button
                      type="button"
                      className="gallery-piece-preview"
                      onClick={() => viewCreative(item)}
                    >
                      {url ? (
                        <img src={url} alt={creativeTitle(item)} />
                      ) : (
                        <ImageIcon />
                      )}
                      <span>
                        {item.ficha?.arquetipo_label || "Anuncio estático"}
                      </span>
                    </button>
                    <div className="gallery-piece-meta">
                      <b>{creativeTitle(item)}</b>
                      <span>
                        {item.format} · v{item.version}
                      </span>
                      <small>{formatCreativeDate(item.created_at)}</small>
                    </div>
                    <div className="gallery-piece-actions">
                      <button type="button" onClick={() => viewCreative(item)}>
                        <Eye /> Ver
                      </button>
                      <button type="button" onClick={() => editCreative(item)}>
                        <Pencil /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => editCreative(item, true)}
                      >
                        <Copy /> Nueva versión
                      </button>
                      {url && (
                        <a
                          href={url}
                          onClick={() => trackDownload(item)}
                          download={downloadName(brandName, item)}
                        >
                          <Download /> Descargar
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteCreative(item)}
                      >
                        <Trash2 /> Borrar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {galleryVisible < gallery.length && (
              <button
                type="button"
                className="gallery-load-more"
                onClick={() => setGalleryVisible((current) => current + 12)}
              >
                Cargar 12 piezas más
              </button>
            )}
          </>
        )}
      </section>

      {fullScreen && selectedCreative && selectedUrl && (
        <div className="canvas-lightbox" role="dialog" aria-modal="true">
          <button type="button" onClick={() => setFullScreen(false)}>
            <X /> Cerrar
          </button>
          <img src={selectedUrl} alt={`Vista completa de ${brandName}`} />
        </div>
      )}

      {referencePreview?.thumbnail_path && (
        <div
          className="reference-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Referencia completa de ${referencePreview.label_visible}`}
          onClick={() => setReferencePreview(null)}
        >
          <button
            type="button"
            className="reference-lightbox-close"
            onClick={() => setReferencePreview(null)}
          >
            <X size={18} /> Cerrar
          </button>
          <div
            className="reference-lightbox-image"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={referencePreview.thumbnail_path}
              alt={`Referencia completa: ${referencePreview.label_visible}`}
            />
          </div>
          <aside onClick={(event) => event.stopPropagation()}>
            <span className="eyebrow">Arquitectura visual</span>
            <h2>{referencePreview.label_visible}</h2>
            <p>{referencePreview.short_description}</p>
            <div className="archetype-visual-keys">
              {referencePreview.visual_keys?.map((key) => (
                <span key={key}>{key}</span>
              ))}
            </div>
            <small>
              <b>Ideal para</b>
              {referencePreview.use_when}
            </small>
            <div className="reference-identity-note">
              <Sparkles size={17} />
              <span>
                Se reutiliza la lógica de composición, nunca la marca, la
                categoría, la oferta, los colores ni el texto de esta
                referencia.
              </span>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function StepNumber({ number, done }: { number: string; done?: boolean }) {
  return (
    <span className={done ? "step-number done" : "step-number"}>
      {done ? <Check size={14} /> : number}
    </span>
  );
}

function formatClass(value: string) {
  return value.includes("9:16")
    ? "story"
    : value.includes("1:1")
      ? "square"
      : "portrait";
}

function selectedProductLabel(
  assets: BrandAsset[],
  id: string,
  service: boolean,
) {
  if (service) return "Sin foto de producto";
  const index = assets.findIndex((item) => item.id === id);
  return index >= 0
    ? assetDisplayLabel(assets[index], index)
    : "Elige producto";
}

function assetDisplayLabel(asset: BrandAsset, index: number) {
  return asset.label?.trim() || `Producto ${index + 1}`;
}

function creativeUrl(item: GeneratedStatic) {
  return item.public_url || item.signed_url || "";
}

function creativeTitle(item: GeneratedStatic) {
  return (
    item.ficha?.texto_principal?.trim() ||
    item.ficha?.arquetipo_label ||
    "Pieza sin título"
  );
}

function formatCreativeDate(value?: string) {
  if (!value) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function downloadName(brandName: string, item: GeneratedStatic) {
  const brand = brandName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${brand || "marca"}_${formatClass(item.format)}_v${item.version}.png`;
}
