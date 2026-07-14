"use client";

import { ChangeEvent, CSSProperties, ReactNode, useState } from "react";
import Image from "next/image";
import * as tus from "tus-js-client";
import { ArrowLeft, Brain, Check, Clipboard, Eye, FileText, FlaskConical, ImageUp, Library, Loader2, Lock, Pencil, Plus, Rocket, Sparkles, Trash2, X } from "lucide-react";
import {
  CREATIVE_STORAGE_QUOTA_BYTES,
  CREATIVE_STORAGE_QUOTA_LABEL,
  MAX_CREATIVE_FILE_SIZE_BYTES,
  MAX_CREATIVE_FILE_SIZE_LABEL,
  MAX_PERSISTED_CREATIVE_SIZE_BYTES,
  MAX_PERSISTED_CREATIVE_SIZE_LABEL,
} from "@/lib/creative-upload-limits";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSupabaseEnv } from "@/lib/supabase/config";
import styles from "./CreativeAssetUploader.module.css";

type UploadItem = {
  id: string;
  assetId?: string;
  name: string;
  file?: File;
  previewUrl?: string;
  assetType?: "image" | "video";
  status: "subiendo" | "listo" | "error";
  analysisStatus?: "idle" | "analizando" | "listo" | "error";
  message?: string;
  analysis?: CreativeAnalysisResult;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

type CreativeAnalysisResult = {
  score: number;
  verdict: string;
  analysis: CreativeDissection;
};

export type CreativeHistoryItem = {
  id: string;
  assetId?: string | null;
  name: string;
  assetType: "image" | "video";
  createdAt: string;
  previewUrl?: string;
  result: CreativeAnalysisResult;
};

type Signal = { level?: string; note?: string };

type CreativeDissection = {
  score?: number;
  verdict?: string;
  summary?: string;
  winning_reason?: string;
  core_diagnosis?: {
    what_really_sells?: string;
    central_tension?: string;
    belief_shift?: string;
    biggest_leak?: string;
    evidence_note?: string;
  };
  why_it_works?: string[];
  diagnosis?: Record<string, Signal>;
  signals?: {
    scroll_stop?: Signal;
    clarity?: Signal;
    offer?: Signal;
  };
  structural_analysis?: {
    product?: string;
    creative_type?: string;
    format?: string;
    visual_context?: string;
    visible_text?: string[];
    transcription?: Array<{ second?: string; text?: string }>;
  };
  dashboard?: {
    hook?: {
      type?: string;
      text_overlay?: string;
      duration_seconds?: number;
      effectiveness_score?: number;
      scroll_stop_mechanism?: string;
      effectiveness_reasoning?: string;
      frame_descriptions?: string[];
    };
    patterns?: {
      power_words?: string[];
      ugc_markers?: string[];
      emotional_arc?: string;
      pacing_rhythm?: string;
      persuasion_framework?: string;
      retention_techniques?: string[];
    };
    visual_frames?: Array<{ timestamp?: string; subject?: string; description?: string; text_on_screen?: string; composition?: string }>;
  };
  psychological_analysis?: {
    scroll_stop?: {
      primary_trigger?: string;
      mechanism?: string;
      reasoning?: string;
      strength_score?: number;
    };
    target_avatar?: {
      who?: string;
      mindset?: string;
      resonance_reason?: string;
    };
    buyer_psychology?: {
      deep_desire?: string;
      agitated_pain?: string;
      identity_shift?: string;
      objections_neutralized?: string[];
      awareness_level?: string;
      market_sophistication?: string;
    };
    math_breakdown?: {
      hook_duration_seconds?: number;
      ideal_hook_window?: string;
      pacing_score?: number;
      cta_timing?: string;
      thumbstop_estimate?: string;
      retention_risk_points?: Array<{ timestamp?: string; risk?: string }>;
    };
  };
  persuasion_triggers?: Array<{ name?: string; timestamp?: string; score?: number; explanation?: string }>;
  emotional_arc?: Array<{ timestamp?: string; emotion?: string; function?: string }>;
  evidence_timeline?: Array<{
    timestamp?: string;
    spoken_or_visible?: string;
    visual_action?: string;
    viewer_thought?: string;
    psychological_mechanism?: string;
    conversion_role?: string;
    decision?: string;
  }>;
  winning_recipe?: string[];
  keep?: string[];
  test?: string[];
  change?: string[];
  produce_next?: string[];
  original_script?: string;
  script_variants?: Array<{
    name?: string;
    hypothesis?: string;
    audience_angle?: string;
    scenario?: string;
    must_preserve?: string[];
    script?: string;
    beat_sheet?: Array<{ timestamp?: string; shot?: string; spoken_line?: string; on_screen_text?: string }>;
    team_brief?: string[];
    why_it_may_win?: string;
    single_test_variable?: string;
  }>;
  variants?: Array<{ name?: string; angle?: string; hook?: string; execution?: string }>;
  replication_plan?: {
    voice_tone?: string;
    editing_notes?: string[];
    shot_list?: string[];
    static_ad_angle?: string;
    production_brief?: string;
    do_not_change?: string[];
  };
  generation_prompts?: Array<{ name?: string; mode?: string; prompt?: string }>;
  source_coverage?: {
    transcript_verified?: boolean;
    transcript_characters?: number;
    transcript_segments?: number;
    duration_seconds?: number | null;
    visual_frames?: number;
  };
};

export function CreativeAssetUploader({ brandId, initialHistory }: { brandId: string; initialHistory: CreativeHistoryItem[] }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [history, setHistory] = useState(initialHistory);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<CreativeHistoryItem | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingNameId, setSavingNameId] = useState<string | null>(null);
  const [libraryNotice, setLibraryNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const currentResult = items.find((item) => item.analysis);
  const activeItem = currentResult || (selectedHistory ? {
    id: selectedHistory.id,
    name: selectedHistory.name,
    assetType: selectedHistory.assetType,
    previewUrl: selectedHistory.previewUrl,
    status: "listo" as const,
    analysis: selectedHistory.result,
  } : undefined);

  function resetWorkspace() {
    setItems([]);
    setSelectedHistory(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveCreativeName(entry: CreativeHistoryItem) {
    const name = draftName.trim();
    if (name.length < 2) {
      setLibraryNotice({ text: "Escribe un nombre de al menos dos caracteres.", tone: "error" });
      return;
    }

    setSavingNameId(entry.id);
    setLibraryNotice(null);
    try {
      const response = await fetch(`/api/creative-library/${entry.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLibraryNotice({ text: data.error || "No se pudo cambiar el nombre.", tone: "error" });
        return;
      }
      setHistory((current) => current.map((item) => item.id === entry.id ? { ...item, name: data.name } : item));
      setSelectedHistory((current) => current?.id === entry.id ? { ...current, name: data.name } : current);
      setRenamingId(null);
      setLibraryNotice({ text: `“${data.name}” quedó guardado.`, tone: "success" });
    } catch {
      setLibraryNotice({ text: "No pudimos guardar el nombre. Intenta nuevamente.", tone: "error" });
    } finally {
      setSavingNameId(null);
    }
  }

  async function deleteCreative(entry: CreativeHistoryItem) {
    if (!window.confirm(`¿Borrar “${cleanFileName(entry.name)}” y su análisis? Esta acción no se puede deshacer.`)) return;
    try {
      const response = await fetch(`/api/creative-library/${entry.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setLibraryNotice({ text: data.error || "No se pudo borrar el creativo.", tone: "error" });
        return;
      }
      setHistory((current) => current.filter((item) => item.id !== entry.id));
      if (selectedHistory?.id === entry.id) setSelectedHistory(null);
      setLibraryNotice({ text: "Creativo eliminado de la biblioteca.", tone: "success" });
    } catch {
      setLibraryNotice({ text: "No pudimos borrar el creativo. Intenta nuevamente.", tone: "error" });
    }
  }

  function startRenaming(entry: CreativeHistoryItem) {
    setRenamingId(entry.id);
    setDraftName(cleanFileName(entry.name));
    setLibraryNotice(null);
  }

  function cancelRenaming() {
    setRenamingId(null);
    setDraftName("");
  }

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
    const [{ data: creativeUsage }, { data: brandUsage }] = await Promise.all([supabase.from("creative_assets").select("file_size,storage_path").eq("owner_id", user.id), supabase.from("brand_assets").select("file_size").eq("owner_id", user.id)]);
    const usedBytes = [
      ...(creativeUsage || []).filter((item) => item.storage_path),
      ...(brandUsage || []),
    ].reduce((sum, item) => sum + Number(item.file_size || 0), 0);
    if (usedBytes + files.reduce((sum, file) => sum + file.size, 0) > CREATIVE_STORAGE_QUOTA_BYTES) {
      setItems([{ id: crypto.randomUUID(), name: "Almacenamiento", status: "error", message: `Alcanzaste ${CREATIVE_STORAGE_QUOTA_LABEL} de archivos. Borra creativos que ya no necesitas antes de subir más.` }]); setIsUploading(false); return;
    }

    for (const file of files) {
      const localId = crypto.randomUUID();
      setItems((current) => [...current, { id: localId, name: file.name, file, previewUrl: URL.createObjectURL(file), status: "subiendo" }]);

      const fileType = resolveCreativeFileType(file);
      const assetType = fileType?.assetType || null;

      if (!assetType) {
        setItems((current) =>
          current.map((item) =>
            item.id === localId ? { ...item, status: "error", message: "Formato no soportado." } : item,
          ),
        );
        continue;
      }

      if (file.size > MAX_CREATIVE_FILE_SIZE_BYTES) {
        setItems((current) =>
          current.map((item) =>
            item.id === localId
              ? {
                  ...item,
                  status: "error",
                  message: `Este archivo supera ${MAX_CREATIVE_FILE_SIZE_LABEL}. Comprime el video o exporta una versión más ligera antes de subirlo.`,
                }
              : item,
          ),
        );
        continue;
      }

      if (assetType === "image" && file.size > MAX_PERSISTED_CREATIVE_SIZE_BYTES) {
        setItems((current) =>
          current.map((item) =>
            item.id === localId
              ? {
                  ...item,
                  status: "error",
                  message: `Esta imagen supera ${MAX_PERSISTED_CREATIVE_SIZE_LABEL}. Exporta una versión JPG o WebP más ligera antes de subirla.`,
                }
              : item,
          ),
        );
        continue;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const shouldPersistOriginal = file.size <= MAX_PERSISTED_CREATIVE_SIZE_BYTES;
      const storagePath = shouldPersistOriginal
        ? `${user.id}/${brandId}/creative-${Date.now()}-${crypto.randomUUID()}-${safeName}`
        : null;

      if (storagePath) {
        try {
          await uploadCreativeAsset({
            file,
            contentType: fileType?.contentType || file.type,
            storagePath,
            onProgress: (percentage) => setItems((current) => current.map((item) =>
              item.id === localId ? { ...item, message: `Subiendo… ${percentage}%` } : item,
            )),
          });
        } catch (uploadError) {
          setItems((current) =>
            current.map((item) => (item.id === localId ? {
              ...item,
              status: "error",
              message: friendlyUploadError(uploadError),
            } : item)),
          );
          continue;
        }
      } else {
        setItems((current) => current.map((item) => item.id === localId
          ? { ...item, message: "Video grande listo. Se analizará localmente sin guardar el original pesado." }
          : item));
      }

      const { data: insertedAsset, error: insertError } = await supabase
        .from("creative_assets")
        .insert({
          brand_id: brandId,
          owner_id: user.id,
          asset_type: assetType,
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: fileType?.contentType || file.type,
        })
        .select("id")
        .single();

      setItems((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                assetId: insertedAsset?.id,
                assetType,
                status: insertError ? "error" : "listo",
                analysisStatus: "idle",
                message: insertError
                  ? insertError.message
                  : storagePath
                    ? "Archivo guardado. Ya puedes analizarlo."
                    : "Video listo. Ya puedes analizarlo; el original no ocupará espacio en tu cuenta.",
              }
            : item,
        ),
      );
    }

    event.target.value = "";
    setIsUploading(false);
  }

  async function analyzeItem(item: UploadItem) {
    if (!item.assetId) return;

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id ? { ...currentItem, analysisStatus: "analizando", message: "Analizando creativo..." } : currentItem,
      ),
    );

    try {
      const frames = item.assetType === "video" && item.file ? await extractVideoFrames(item.file) : [];
      let audioEvidence: Awaited<ReturnType<typeof extractVideoAudio>> | null = null;

      if (item.assetType === "video" && item.file) {
        setItems((current) =>
          current.map((currentItem) =>
            currentItem.id === item.id
              ? { ...currentItem, message: "Preparando el audio completo y los momentos clave..." }
              : currentItem,
          ),
        );

        try {
          audioEvidence = await extractVideoAudio(item.file);
        } catch (error) {
          if (item.file.size > MAX_TRANSCRIPTION_FILE_SIZE) {
            throw new Error(
              error instanceof Error
                ? `${error.message} No iniciaré un análisis incompleto.`
                : "No pude extraer el audio completo. No iniciaré un análisis incompleto.",
            );
          }
        }
      }

      const requestBody = new FormData();
      requestBody.append("assetId", item.assetId);
      requestBody.append("frames", JSON.stringify(frames));
      if (audioEvidence) {
        requestBody.append("audio", audioEvidence.file, audioEvidence.file.name);
        requestBody.append("audioDurationSeconds", String(audioEvidence.durationSeconds));
      }

      const response = await fetch("/api/creative-analysis", {
        method: "POST",
        body: requestBody,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "No se pudo analizar el creativo.");

      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                analysisStatus: "listo",
                message: "Análisis listo.",
                analysis: data.analysis,
              }
            : currentItem,
        ),
      );
    } catch (error) {
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                analysisStatus: "error",
                message: error instanceof Error ? error.message : "No se pudo analizar el creativo.",
              }
            : currentItem,
        ),
      );
    }
  }

  if (activeItem?.analysis) {
    const score = activeItem.analysis.score;
    const verdict = verdictFromScore(score);
    return (
      <div className="creative-result-layout analysis-reading-mode">
        <header className="analysis-compact-header">
          <div>
            <span className="eyebrow">Análisis creativo</span>
            <b title={activeItem.name}>{cleanFileName(activeItem.name)}</b>
            <small>{activeItem.assetType === "video" ? "Video" : "Imagen"} · {verdict} · {score}/100</small>
          </div>
          <button className="secondary-action" type="button" onClick={resetWorkspace}>
            <Plus size={16} /> Nuevo análisis
          </button>
        </header>

        {activeItem.previewUrl && <CreativePreview type={activeItem.assetType} url={activeItem.previewUrl} name={activeItem.name} />}

        <CreativeAnalysisCard result={activeItem.analysis} assetType={activeItem.assetType || "video"} />

        <footer className="analysis-action-bar">
          <div>
            <Check size={17} />
            <span><b>Guardado en memoria</b> Las recetas ya están disponibles para el chat y la creación de estáticos.</span>
          </div>
          <a className="secondary-action" href="/crear-estaticos">Convertir idea en estático</a>
          <button className="primary-action" type="button" onClick={resetWorkspace}>Analizar otra versión</button>
        </footer>
        <button className="analysis-back-link" type="button" onClick={resetWorkspace}>
          <ArrowLeft size={15} /> Volver a la biblioteca
        </button>
      </div>
    );
  }

  return (
    <div className="creative-entry-workspace">
      <section className="creative-upload-panel">
        <div className="creative-upload-copy">
          <span className="eyebrow">Nuevo análisis</span>
          <h2>Sube el anuncio que quieres diseccionar</h2>
          <p>Imágenes y videos se analizan con la información guardada de tu marca.</p>
        </div>

        <label className="creative-file-picker">
          {isUploading ? <Loader2 className="spin" size={24} /> : <ImageUp size={24} />}
          <b>{isUploading ? "Subiendo archivo..." : "Elegir imagen o video"}</b>
          <span>Videos hasta {MAX_CREATIVE_FILE_SIZE_LABEL} · imágenes hasta {MAX_PERSISTED_CREATIVE_SIZE_LABEL}</span>
          <input type="file" accept="image/*,.mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm,video/x-m4v" onChange={handleFiles} />
        </label>

        {items.length > 0 && (
          <div className="creative-upload-queue">
            {items.map((item) => (
              <article key={item.id} className={item.status}>
                <div>
                  <b>{cleanFileName(item.name)}</b>
                  <small>{item.message || item.status}</small>
                </div>
                {item.status === "listo" && item.assetId && item.analysisStatus !== "listo" && (
                  <button className="primary-action" type="button" onClick={() => analyzeItem(item)} disabled={item.analysisStatus === "analizando"}>
                    {item.analysisStatus === "analizando" ? <Loader2 className="spin" size={15} /> : <Brain size={15} />}
                    {item.analysisStatus === "analizando" ? "Analizando..." : "Analizar ahora · 120 cr"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="creative-library">
        <header>
          <div>
            <Library size={19} />
            <div><span className="eyebrow">Biblioteca</span><h2>Análisis anteriores</h2></div>
          </div>
          <small>{history.length} guardados</small>
        </header>
        {libraryNotice && (
          <p
            className={`${styles.libraryNotice} ${libraryNotice.tone === "error" ? styles.libraryNoticeError : ""}`}
            role="status"
            aria-live="polite"
          >
            {libraryNotice.tone === "success" ? <Check size={16} /> : <X size={16} />}
            {libraryNotice.text}
          </p>
        )}
        {history.length === 0 ? (
          <div className="library-empty"><Eye size={22} /><b>Aún no hay análisis</b><p>El primer resultado aparecerá aquí automáticamente.</p></div>
        ) : (
          <div className="creative-library-grid">
            {history.map((entry) => (
              <article className={`${styles.libraryCard} ${renamingId === entry.id ? styles.libraryCardEditing : ""}`} key={entry.id}>
                {renamingId === entry.id ? (
                  <form
                    className={styles.renamePanel}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveCreativeName(entry);
                    }}
                  >
                    <div className={styles.renameHeading}>
                      <span className="library-score">{entry.result.score}</span>
                      <div>
                        <b>Renombrar creativo</b>
                        <small>El análisis y sus resultados no cambian.</small>
                      </div>
                    </div>
                    <label htmlFor={`creative-name-${entry.id}`}>Nombre del archivo</label>
                    <input
                      id={`creative-name-${entry.id}`}
                      autoFocus
                      maxLength={90}
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") cancelRenaming();
                      }}
                      aria-describedby={`creative-name-help-${entry.id}`}
                    />
                    <small id={`creative-name-help-${entry.id}`} className={styles.renameHelp}>
                      {draftName.trim().length}/90 caracteres
                    </small>
                    <div className={styles.renameActions}>
                      <button type="button" className={styles.cancelButton} onClick={cancelRenaming} disabled={savingNameId === entry.id}>
                        <X size={15} /> Cancelar
                      </button>
                      <button type="submit" className={styles.saveButton} disabled={savingNameId === entry.id || draftName.trim().length < 2}>
                        {savingNameId === entry.id ? <Loader2 className="spin" size={15} /> : <Check size={15} />}
                        {savingNameId === entry.id ? "Guardando…" : "Guardar nombre"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <button className={`${styles.openCard} creative-library-open`} type="button" onClick={() => setSelectedHistory(entry)}>
                      <span className="library-score">{entry.result.score}</span>
                      <div>
                        <b>{cleanFileName(entry.name)}</b>
                        <small>{entry.assetType === "video" ? "Video" : "Estático"} · {verdictFromScore(entry.result.score)}</small>
                      </div>
                      <time>{new Date(entry.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</time>
                    </button>
                    <div className={styles.cardActions} role="group" aria-label={`Acciones para ${cleanFileName(entry.name)}`}>
                      <button type="button" className={styles.cardAction} onClick={() => startRenaming(entry)}>
                        <Pencil size={14} /> Renombrar
                      </button>
                      <button type="button" className={`${styles.cardAction} ${styles.deleteAction}`} onClick={() => void deleteCreative(entry)}>
                        <Trash2 size={14} /> Borrar
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CreativePreview({ type, url, name }: { type?: "image" | "video"; url: string; name: string }) {
  return (
    <section className="creative-source-preview">
      <div><span className="eyebrow">Creativo analizado</span><b>{cleanFileName(name)}</b></div>
      {type === "video" ? <video src={url} controls preload="metadata" /> : <Image src={url} alt={`Creativo ${cleanFileName(name)}`} width={1200} height={1200} unoptimized />}
    </section>
  );
}

function CreativeAnalysisCard({ result, assetType }: { result: CreativeAnalysisResult; assetType: "image" | "video" }) {
  const analysis = normalizeClientAnalysis(result.analysis, result);
  if (assetType === "image") return <StaticCreativeAnalysisCard result={result} analysis={analysis} />;
  const score = analysis.score ?? result.score;
  const verdict = verdictFromScore(score);
  const verdictMeta = verdictStyle(score);
  const hook = analysis.dashboard?.hook;
  const structure = analysis.structural_analysis;
  const psychology = analysis.psychological_analysis;
  const buyer = psychology?.buyer_psychology;
  const math = psychology?.math_breakdown;
  const patterns = analysis.dashboard?.patterns;
  const decision = score >= 85 ? "Escalar" : score >= 70 ? "Mantener y probar" : score >= 50 ? "Iterar" : "Pausar";

  return (
    <section className="creative-result">
      <div className="creative-result-head">
        <div
          className="creative-score-ring"
          style={{ "--score": `${score}%`, "--score-color": verdictMeta.color } as CSSProperties}
        >
          <b>{score}</b>
          <span>/100</span>
        </div>
        <div>
          <span className="eyebrow">Lectura profunda</span>
          <h3>{analysis.winning_reason || "Análisis creativo completo."}</h3>
          <strong className={`verdict-badge ${verdictMeta.className}`}>{verdict}</strong>
        </div>
      </div>

      <section className="creative-action-brief">
        <div>
          <span className="creative-decision-pill">Decisión · {decision}</span>
          <h4>Qué significa este resultado para tu estrategia creativa</h4>
          <p>{analysis.summary || analysis.core_diagnosis?.what_really_sells || "La plataforma convirtió el análisis en una decisión clara para la siguiente ronda."}</p>
        </div>
        <div className="creative-action-columns">
          <article><span>Lo que funciona</span><b>{analysis.core_diagnosis?.what_really_sells || analysis.keep?.[0] || "La idea central del anuncio"}</b></article>
          <article><span>Qué mantener</span><b>{analysis.keep?.[0] || "El elemento que concentra la atención"}</b></article>
          <article><span>Qué probar ahora</span><b>{analysis.test?.[0] || analysis.produce_next?.[0] || "Una variación controlada del hook"}</b></article>
        </div>
      </section>

      <div className="creative-signal-grid">
        <SignalCard title="Detiene el scroll" signal={analysis.signals?.scroll_stop} />
        <SignalCard title="Claridad inmediata" signal={analysis.signals?.clarity} />
        <SignalCard title="Oferta" signal={analysis.signals?.offer} />
      </div>

      <nav className="creative-layer-tabs" aria-label="Secciones del análisis">
        <a href="#resumen"><Eye size={15} /> Resumen</a>
        <a href="#psicologia"><Brain size={15} /> Psicología</a>
        <a href="#guiones"><FileText size={15} /> Guiones</a>
        <a href="#plan"><Rocket size={15} /> Plan</a>
      </nav>

      <section className="analysis-section analysis-section-anchor" id="resumen">
        <header className="analysis-section-heading">
          <span>01</span><div><h3>Qué está haciendo vender al creativo</h3><p>Diagnóstico basado en frases, escenas y señales visibles.</p></div>
        </header>

        <ReportPanel icon={<Eye size={18} />} title="La lectura central" wide>
          <div className="core-diagnosis-grid">
            <Insight label="Lo que realmente vende" value={analysis.core_diagnosis?.what_really_sells} />
            <Insight label="Tensión central" value={analysis.core_diagnosis?.central_tension} />
            <Insight label="Cambio de creencia" value={analysis.core_diagnosis?.belief_shift} />
            <Insight label="Mayor fuga" value={analysis.core_diagnosis?.biggest_leak} />
          </div>
          {analysis.core_diagnosis?.evidence_note && <p className="evidence-note">{analysis.core_diagnosis.evidence_note}</p>}
        </ReportPanel>

        <ReportPanel icon={<FlaskConical size={18} />} title="El anuncio, momento a momento" wide>
          <EvidenceTimeline items={analysis.evidence_timeline || []} />
        </ReportPanel>

        <div className="creative-deep-grid summary-grid">
        <ReportPanel icon={<Sparkles size={18} />} title="La receta ganadora">
          <NumberedList items={analysis.winning_recipe || []} />
        </ReportPanel>

        <ReportPanel icon={<Lock size={18} />} title="Que mantener" eyebrow="no negociable">
          <CheckList items={analysis.keep || []} />
          <div className="soft-divider" />
          <b className="panel-mini-title">Que probar despues</b>
          <ArrowList items={analysis.test || []} />
        </ReportPanel>
        </div>
      </section>

      <section className="analysis-section analysis-section-anchor" id="psicologia">
        <header className="analysis-section-heading">
          <span>02</span><div><h3>Por qué persuade</h3><p>La tensión, las creencias y las decisiones que mueve en la compradora.</p></div>
        </header>
        <div className="creative-deep-grid psychology-grid">
        <ReportPanel icon={<Brain size={18} />} title="Hook y mecanismo">
          <div className="hook-summary">
            <strong>{hook?.effectiveness_score ?? psychology?.scroll_stop?.strength_score ?? "-"}/10</strong>
            <span>{hook?.type || psychology?.scroll_stop?.primary_trigger || "Mecanismo no especificado"}</span>
          </div>
          <p>{hook?.scroll_stop_mechanism || psychology?.scroll_stop?.mechanism || "Sin mecanismo especifico."}</p>
          {hook?.effectiveness_reasoning && <p className="muted-text">{hook.effectiveness_reasoning}</p>}
          <FrameList frames={hook?.frame_descriptions || []} />
        </ReportPanel>

        <ReportPanel icon={<Brain size={18} />} title="Psicologia del comprador">
          <Insight label="Deseo profundo" value={buyer?.deep_desire} />
          <Insight label="Dolor agitado" value={buyer?.agitated_pain} />
          <Insight label="Cambio de identidad" value={buyer?.identity_shift} />
          <Insight label="Avatar" value={psychology?.target_avatar?.who} />
          <CheckList items={buyer?.objections_neutralized || []} />
        </ReportPanel>

        <ReportPanel icon={<FlaskConical size={18} />} title="Desglose de retencion">
          <MetricGrid
            metrics={[
              ["Hook", `${math?.hook_duration_seconds ?? "-"}s`, math?.ideal_hook_window],
              ["Pacing", `${math?.pacing_score ?? "-"}/10`, math?.thumbstop_estimate],
              ["CTA", math?.cta_timing || "-", "momento de pedir accion"],
            ]}
          />
          <b className="panel-mini-title">Riesgos</b>
          <ArrowList items={(math?.retention_risk_points || []).map((point) => `${point.timestamp || "momento"} - ${point.risk || ""}`)} />
        </ReportPanel>

        <ReportPanel icon={<Eye size={18} />} title="Estructura visual">
          <Insight label="Tipo" value={structure?.creative_type} />
          <Insight label="Producto" value={structure?.product} />
          <Insight label="Formato" value={structure?.format} />
          <p>{structure?.visual_context || "Sin contexto visual detallado."}</p>
          <ChipRow items={structure?.visible_text || []} />
        </ReportPanel>

        <ReportPanel icon={<Sparkles size={18} />} title="Gatillos de persuasion">
          <ProgressList items={analysis.persuasion_triggers || []} />
        </ReportPanel>

        <ReportPanel icon={<Brain size={18} />} title="Arco emocional y patrones">
          <Insight label="Framework" value={patterns?.persuasion_framework} />
          <Insight label="Arco" value={patterns?.emotional_arc} />
          <Timeline items={analysis.emotional_arc || []} />
          <ChipRow items={[...(patterns?.power_words || []), ...(patterns?.ugc_markers || [])]} />
        </ReportPanel>
        </div>
      </section>

      <section className="analysis-section analysis-section-anchor" id="guiones">
        <header className="analysis-section-heading">
          <span>03</span><div><h3>Guiones listos para usar</h3><p>El original recuperado y tres hipótesis completas para iterar.</p></div>
        </header>
        <ReportPanel icon={<FileText size={18} />} title="Guion original" wide>
          {analysis.original_script ? (
            <div className="original-script-block">
              {analysis.source_coverage?.transcript_verified && (
                <p className="evidence-note">
                  <Check size={14} /> Audio completo verificado · {analysis.source_coverage.transcript_segments || 1} segmentos · {analysis.source_coverage.visual_frames || 0} momentos visuales
                </p>
              )}
              <p className="script-box">{analysis.original_script}</p>
              <button type="button" onClick={() => copyText(analysis.original_script || "")}><Clipboard size={14} /> Copiar guion</button>
            </div>
          ) : <p className="muted-text">No hubo audio o texto suficiente para recuperar el guion.</p>}
        </ReportPanel>
        <div className="variant-grid">
          {(analysis.script_variants || []).map((variant, index) => (
            <article key={`${variant.name}-${index}`} className="variant-card">
              <div>
                <span>{variant.name || `Variante ${index + 1}`}</span>
                <button type="button" onClick={() => copyText(variant.script || "")}>
                  <Clipboard size={14} />
                  Copiar
                </button>
              </div>
              {variant.hypothesis && <Insight label="Hipótesis" value={variant.hypothesis} />}
              {variant.audience_angle && <Insight label="Ángulo" value={variant.audience_angle} />}
              {variant.scenario && <b>{variant.scenario}</b>}
              <p className="variant-script">{variant.script}</p>
              <BeatSheet items={variant.beat_sheet || []} />
              <CheckList items={variant.must_preserve || []} />
              <CheckList items={variant.team_brief || []} />
              {variant.why_it_may_win && <Insight label="Por qué puede ganar" value={variant.why_it_may_win} />}
              {variant.single_test_variable && <Insight label="Variable única" value={variant.single_test_variable} />}
            </article>
          ))}
        </div>
      </section>

      <section className="analysis-section analysis-section-anchor" id="plan">
        <header className="analysis-section-heading">
          <span>04</span><div><h3>Plan para producir la siguiente ronda</h3><p>Un brief operativo, no una lista de ideas sueltas.</p></div>
        </header>
        <div className="creative-deep-grid plan-grid">
        <ReportPanel icon={<Rocket size={18} />} title="Plan de replicacion">
          <Insight label="Brief de producción" value={analysis.replication_plan?.production_brief} />
          <Insight label="Tono" value={analysis.replication_plan?.voice_tone} />
          <CheckList items={analysis.replication_plan?.editing_notes || []} />
          <b className="panel-mini-title">Shot list</b>
          <NumberedList items={analysis.replication_plan?.shot_list || []} />
          <b className="panel-mini-title">No cambiar</b>
          <CheckList items={analysis.replication_plan?.do_not_change || []} />
          <Insight label="Angulo para estatico" value={analysis.replication_plan?.static_ad_angle} />
        </ReportPanel>

        <ReportPanel icon={<Clipboard size={18} />} title="Prompts para producir mas">
          <div className="prompt-list">
            {(analysis.generation_prompts || []).map((prompt, index) => (
              <article key={`${prompt.name}-${index}`}>
                <div>
                  <span>{prompt.name || `Prompt ${index + 1}`}</span>
                  <small>{prompt.mode}</small>
                  <button type="button" onClick={() => copyText(prompt.prompt || "")}>
                    <Clipboard size={14} />
                    Copiar prompt
                  </button>
                </div>
                <p>{prompt.prompt}</p>
              </article>
            ))}
          </div>
        </ReportPanel>
        </div>
      </section>
    </section>
  );
}

function StaticCreativeAnalysisCard({ result, analysis }: { result: CreativeAnalysisResult; analysis: CreativeDissection }) {
  const score = analysis.score ?? result.score;
  const verdict = verdictFromScore(score);
  const verdictMeta = verdictStyle(score);
  const structure = analysis.structural_analysis;
  const decision = score >= 80 ? "Usar y escalar" : score >= 60 ? "Probar con ajustes" : "Rediseñar antes de pautar";
  return (
    <section className="creative-result static-analysis-report">
      <header className="static-analysis-hero">
        <div className="static-score" style={{ "--score-color": verdictMeta.color } as CSSProperties}><b>{score}</b><span>/100</span></div>
        <div><span className="eyebrow">Análisis de creativo estático</span><h3>{analysis.winning_reason || "Lectura visual completa del anuncio."}</h3><strong className={`verdict-badge ${verdictMeta.className}`}>{verdict}</strong></div>
        <div className="static-decision"><span>Decisión recomendada</span><b>{decision}</b></div>
      </header>
      <div className="creative-signal-grid static-signal-grid"><SignalCard title="Impacto al detener scroll" signal={analysis.signals?.scroll_stop} /><SignalCard title="Mensaje en 2 segundos" signal={analysis.signals?.clarity} /><SignalCard title="Razón para actuar" signal={analysis.signals?.offer} /></div>
      <section className="static-reading-board">
        <article className="static-reading-main"><span>Lo que vende la pieza</span><h4>{analysis.core_diagnosis?.what_really_sells || "La idea visual principal"}</h4><p>{analysis.core_diagnosis?.evidence_note || analysis.core_diagnosis?.central_tension || "Lectura basada en composición, texto visible y producto."}</p></article>
        <article><span>Qué conservar</span><CheckList items={analysis.keep || []} /></article>
        <article><span>Qué corregir</span><ArrowList items={analysis.test || []} /></article>
      </section>
      <div className="static-analysis-grid">
        <ReportPanel icon={<Eye size={18} />} title="Jerarquía visual"><Insight label="Formato" value={structure?.format} /><Insight label="Tipo de pieza" value={structure?.creative_type} /><Insight label="Contexto visual" value={structure?.visual_context} /><b className="panel-mini-title">Texto que se alcanza a leer</b><ChipRow items={structure?.visible_text || []} /></ReportPanel>
        <ReportPanel icon={<Brain size={18} />} title="Lectura de compradora"><Insight label="Tensión" value={analysis.core_diagnosis?.central_tension} /><Insight label="Cambio de creencia" value={analysis.core_diagnosis?.belief_shift} /><Insight label="Mayor fuga" value={analysis.core_diagnosis?.biggest_leak} /></ReportPanel>
        <ReportPanel icon={<Sparkles size={18} />} title="Receta reutilizable"><NumberedList items={analysis.winning_recipe || []} /></ReportPanel>
        <ReportPanel icon={<Rocket size={18} />} title="Siguiente pieza"><Insight label="Brief" value={analysis.replication_plan?.production_brief} /><Insight label="Ángulo recomendado" value={analysis.replication_plan?.static_ad_angle} /><CheckList items={analysis.replication_plan?.do_not_change || []} /></ReportPanel>
      </div>
    </section>
  );
}

function normalizeClientAnalysis(analysis: CreativeDissection, result: CreativeAnalysisResult): CreativeDissection {
  const score = analysis.score ?? result.score;
  const legacyVariants =
    analysis.script_variants ||
    analysis.variants?.map((variant, index) => ({
      name: variant.name || `Variante ${index + 1}`,
      scenario: variant.angle,
      script: [variant.hook, variant.execution].filter(Boolean).join("\n\n"),
      team_brief: variant.execution ? [variant.execution] : [],
    }));

  return {
    ...analysis,
    score,
    verdict: verdictFromScore(score),
    winning_reason: analysis.winning_reason || analysis.summary || "Análisis creativo listo.",
    signals:
      analysis.signals ||
      (analysis.diagnosis
        ? {
            scroll_stop: analysis.diagnosis.hook,
            clarity: analysis.diagnosis.clarity,
            offer: analysis.diagnosis.offer,
          }
        : undefined),
    winning_recipe: analysis.winning_recipe?.length ? analysis.winning_recipe : analysis.why_it_works || [],
    test: analysis.test?.length ? analysis.test : [...(analysis.change || []), ...(analysis.produce_next || [])],
    script_variants: legacyVariants || [],
  };
}

function verdictFromScore(score: number) {
  if (score >= 90) return "Escalable";
  if (score >= 75) return "Ganador";
  if (score >= 60) return "Potencial";
  if (score >= 40) return "Rescatable";
  return "Débil";
}

function verdictStyle(score: number) {
  if (score >= 90) return { className: "escalable", color: "#2f7a4f" };
  if (score >= 75) return { className: "ganador", color: "#2f7a4f" };
  if (score >= 60) return { className: "potencial", color: "#4f62a7" };
  if (score >= 40) return { className: "rescatable", color: "#a46b17" };
  return { className: "debil", color: "#9a2323" };
}

function cleanFileName(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72);
}

function SignalCard({ title, signal }: { title: string; signal?: Signal }) {
  const level = signal?.level || "Medio";
  return (
    <article className={`creative-signal ${level.toLowerCase()}`}>
      <div>
        <b>{title}</b>
        <strong>{level}</strong>
      </div>
      <p>{signal?.note || "Sin nota especifica."}</p>
    </article>
  );
}

function ReportPanel({
  icon,
  title,
  eyebrow,
  wide,
  anchorId,
  children,
}: {
  icon: ReactNode;
  title: string;
  eyebrow?: string;
  wide?: boolean;
  anchorId?: string;
  children: ReactNode;
}) {
  return (
    <article id={anchorId} className={`report-panel${wide ? " wide" : ""}`}>
      <header>
        {icon}
        <b>{title}</b>
        {eyebrow && <span>{eyebrow}</span>}
      </header>
      {children}
    </article>
  );
}

function Insight({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="insight-row">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function NumberedList({ items }: { items: string[] }) {
  if (!items.length) return <p className="muted-text">Sin elementos todavia.</p>;
  return (
    <ol className="numbered-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ol>
  );
}

function CheckList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="check-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>
          <Check size={15} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ArrowList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="arrow-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function FrameList({ frames }: { frames: string[] }) {
  if (!frames.length) return null;
  return (
    <div className="frame-list">
      <b className="panel-mini-title">Lectura frame por frame</b>
      {frames.map((frame, index) => (
        <p key={`${frame}-${index}`}>
          <span>F{index + 1}</span>
          {frame}
        </p>
      ))}
    </div>
  );
}

function ChipRow({ items }: { items: string[] }) {
  const cleanItems = items.filter(Boolean).slice(0, 12);
  if (!cleanItems.length) return null;
  return (
    <div className="chip-row">
      {cleanItems.map((item, index) => (
        <span key={`${item}-${index}`}>{item}</span>
      ))}
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, string, string | undefined]> }) {
  return (
    <div className="metric-grid">
      {metrics.map(([label, value, note]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
          {note && <small>{note}</small>}
        </div>
      ))}
    </div>
  );
}

function ProgressList({ items }: { items: Array<{ name?: string; timestamp?: string; score?: number; explanation?: string }> }) {
  if (!items.length) return <p className="muted-text">Sin gatillos detectados.</p>;
  return (
    <div className="progress-list">
      {items.map((item, index) => (
        <article key={`${item.name}-${index}`}>
          <div>
            <b>{item.name}</b>
            <span>{item.timestamp}</span>
          </div>
          <p>{item.explanation}</p>
          <div className="progress-track">
            <span style={{ width: `${Math.min(Math.max(Number(item.score) || 0, 0), 10) * 10}%` }} />
          </div>
          <strong>{item.score ?? "-"}/10</strong>
        </article>
      ))}
    </div>
  );
}

function EvidenceTimeline({ items }: { items: NonNullable<CreativeDissection["evidence_timeline"]> }) {
  if (!items.length) return <p className="muted-text">Este análisis anterior no incluye la lectura por momentos.</p>;
  return (
    <div className="evidence-timeline">
      {items.map((item, index) => (
        <article key={`${item.timestamp}-${index}`}>
          <time>{item.timestamp || `Momento ${index + 1}`}</time>
          <div>
            <blockquote>{item.spoken_or_visible || "Sin frase comprobable"}</blockquote>
            {item.visual_action && <p><b>Qué ocurre</b>{cleanEvidenceText(item.visual_action)}</p>}
            {item.viewer_thought && <p><b>Qué piensa la espectadora</b>{item.viewer_thought}</p>}
            {item.psychological_mechanism && <p><b>Por qué funciona</b>{item.psychological_mechanism}</p>}
            {item.conversion_role && <p><b>Función en la venta</b>{item.conversion_role}</p>}
          </div>
          <span className={`evidence-decision ${(item.decision || "").toLowerCase()}`}>{item.decision === "Corregir" ? "Mejorar" : item.decision === "Probar" ? "Probar siguiente" : item.decision?.toLowerCase() === "revisar" ? "Evidencia parcial" : item.decision || "Evidencia visual"}</span>
        </article>
      ))}
    </div>
  );
}

function cleanEvidenceText(value: string) {
  return value.replace(/^\s*\[?inferido\]?\s*[:—-]?\s*/i, "").trim();
}

function BeatSheet({ items }: { items: NonNullable<NonNullable<CreativeDissection["script_variants"]>[number]["beat_sheet"]> }) {
  if (!items.length) return null;
  return (
    <details className="beat-sheet">
      <summary>Ver tomas y textos</summary>
      <div>
        {items.map((item, index) => (
          <article key={`${item.timestamp}-${index}`}>
            <time>{item.timestamp || `${index + 1}`}</time>
            <p><b>{item.shot}</b>{item.spoken_line}</p>
            {item.on_screen_text && <span>Texto: {item.on_screen_text}</span>}
          </article>
        ))}
      </div>
    </details>
  );
}

function Timeline({ items }: { items: Array<{ timestamp?: string; emotion?: string; function?: string }> }) {
  if (!items.length) return null;
  return (
    <div className="emotion-timeline">
      {items.map((item, index) => (
        <p key={`${item.timestamp}-${index}`}>
          <span>{item.timestamp}</span>
          <b>{item.emotion}</b>
          {item.function}
        </p>
      ))}
    </div>
  );
}

function copyText(text: string) {
  if (!text || typeof navigator === "undefined") return;
  navigator.clipboard?.writeText(text);
}

async function extractVideoFrames(file: File) {
  const videoUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("No pude leer el video."));
    });

    const duration = video.duration || 1;
    const candidates = [
      0.2,
      0.8,
      1.6,
      2.8,
      duration * 0.15,
      duration * 0.28,
      duration * 0.42,
      duration * 0.56,
      duration * 0.7,
      duration * 0.82,
      duration * 0.92,
      duration * 0.98,
    ];
    const times = candidates
      .map((time) => Math.min(Math.max(time, 0), Math.max(duration - 0.1, 0)))
      .filter((time, index, list) => Number.isFinite(time) && list.findIndex((candidate) => Math.abs(candidate - time) < 0.25) === index)
      .slice(0, 12);

    const frames: Array<{ image: string; timestamp: number }> = [];
    for (const time of times) {
      frames.push({ image: await captureFrame(video, time), timestamp: time });
    }

    return frames;
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}

const MAX_TRANSCRIPTION_FILE_SIZE = 24 * 1024 * 1024;
const TRANSCRIPTION_SAMPLE_RATE = 16_000;

async function extractVideoAudio(file: File) {
  const audioContext = new AudioContext();

  try {
    const decoded = await audioContext.decodeAudioData(await file.arrayBuffer());
    const wav = encodeMonoWav(decoded, TRANSCRIPTION_SAMPLE_RATE);

    if (wav.size > MAX_TRANSCRIPTION_FILE_SIZE) {
      throw new Error("El audio completo todavía supera el límite permitido.");
    }

    return {
      file: new File([wav], `${cleanFileName(file.name) || "video"}-audio-completo.wav`, { type: "audio/wav" }),
      durationSeconds: decoded.duration,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes("límite")
        ? error.message
        : "Este navegador no pudo preparar la pista de audio del video.",
    );
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

function encodeMonoWav(audio: AudioBuffer, targetSampleRate: number) {
  const sourceRate = audio.sampleRate;
  const sampleCount = Math.max(1, Math.ceil(audio.duration * targetSampleRate));
  const output = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(output);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, sampleCount * 2, true);

  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
  for (let index = 0; index < sampleCount; index += 1) {
    const sourcePosition = index * sourceRate / targetSampleRate;
    const before = Math.min(Math.floor(sourcePosition), audio.length - 1);
    const after = Math.min(before + 1, audio.length - 1);
    const mix = sourcePosition - before;
    let sample = 0;

    for (const channel of channels) {
      sample += channel[before] + (channel[after] - channel[before]) * mix;
    }

    sample = Math.max(-1, Math.min(1, sample / Math.max(channels.length, 1)));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([output], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function resolveCreativeFileType(file: File) {
  if (IMAGE_TYPES.includes(file.type)) return { assetType: "image" as const, contentType: file.type };
  if (VIDEO_TYPES.includes(file.type)) return { assetType: "video" as const, contentType: file.type };

  const extension = file.name.toLowerCase().split(".").pop();
  const fallbackTypes: Record<string, { assetType: "image" | "video"; contentType: string }> = {
    jpg: { assetType: "image", contentType: "image/jpeg" },
    jpeg: { assetType: "image", contentType: "image/jpeg" },
    png: { assetType: "image", contentType: "image/png" },
    webp: { assetType: "image", contentType: "image/webp" },
    gif: { assetType: "image", contentType: "image/gif" },
    mp4: { assetType: "video", contentType: "video/mp4" },
    mov: { assetType: "video", contentType: "video/quicktime" },
    webm: { assetType: "video", contentType: "video/webm" },
    m4v: { assetType: "video", contentType: "video/x-m4v" },
  };

  return extension ? fallbackTypes[extension] || null : null;
}

async function uploadCreativeAsset({
  file,
  contentType,
  storagePath,
  onProgress,
}: {
  file: File;
  contentType: string;
  storagePath: string;
  onProgress: (percentage: number) => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = getSupabaseEnv().url;

  if (!session?.access_token || !supabaseUrl) throw new Error("Vuelve a iniciar sesión antes de subir el archivo.");

  const hostname = new URL(supabaseUrl).hostname;
  const endpoint = hostname.endsWith(".supabase.co")
    ? `https://${hostname.split(".")[0]}.storage.supabase.co/storage/v1/upload/resumable`
    : `${new URL(supabaseUrl).origin}/storage/v1/upload/resumable`;

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "creative-assets",
        objectName: storagePath,
        contentType,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress(Math.min(100, Math.round((bytesUploaded / Math.max(bytesTotal, 1)) * 100)));
      },
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      })
      .catch(reject);
  });
}

function friendlyUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/maximum allowed size|payload too large|too large|413/i.test(message)) {
    return `El almacenamiento rechazó este archivo por tamaño. Los videos que superan ${MAX_PERSISTED_CREATIVE_SIZE_LABEL} se procesan localmente sin guardar el original.`;
  }
  return message || "No se pudo subir el archivo.";
}

function captureFrame(video: HTMLVideoElement, time: number) {
  return new Promise<string>((resolve, reject) => {
    video.currentTime = Math.min(time, Math.max(video.duration - 0.1, 0));
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const width = Math.min(video.videoWidth || 720, 960);
      const ratio = width / (video.videoWidth || width);
      canvas.width = width;
      canvas.height = Math.max(1, Math.round((video.videoHeight || 720) * ratio));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("No pude extraer frames del video."));
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    video.onerror = () => reject(new Error("No pude extraer frames del video."));
  });
}
