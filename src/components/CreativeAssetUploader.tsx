"use client";

import { ChangeEvent, CSSProperties, ReactNode, useState } from "react";
import { Brain, Check, Clipboard, Eye, FileText, FlaskConical, ImageUp, Loader2, Lock, Rocket, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type UploadItem = {
  id: string;
  assetId?: string;
  name: string;
  file?: File;
  assetType?: "image" | "video";
  status: "subiendo" | "listo" | "error";
  analysisStatus?: "idle" | "analizando" | "listo" | "error";
  message?: string;
  analysis?: CreativeAnalysisResult;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

type CreativeAnalysisResult = {
  score: number;
  verdict: string;
  analysis: CreativeDissection;
};

type Signal = { level?: string; note?: string };

type CreativeDissection = {
  score?: number;
  verdict?: string;
  summary?: string;
  winning_reason?: string;
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
  winning_recipe?: string[];
  keep?: string[];
  test?: string[];
  change?: string[];
  produce_next?: string[];
  original_script?: string;
  script_variants?: Array<{ name?: string; scenario?: string; script?: string; team_brief?: string[] }>;
  variants?: Array<{ name?: string; angle?: string; hook?: string; execution?: string }>;
  replication_plan?: {
    voice_tone?: string;
    editing_notes?: string[];
    shot_list?: string[];
    static_ad_angle?: string;
  };
  generation_prompts?: Array<{ name?: string; mode?: string; prompt?: string }>;
};

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
      setItems((current) => [...current, { id: localId, name: file.name, file, status: "subiendo" }]);

      const assetType = IMAGE_TYPES.includes(file.type) ? "image" : VIDEO_TYPES.includes(file.type) ? "video" : null;

      if (!assetType) {
        setItems((current) =>
          current.map((item) =>
            item.id === localId ? { ...item, status: "error", message: "Formato no soportado." } : item,
          ),
        );
        continue;
      }

      if (assetType === "video" && file.size > MAX_VIDEO_SIZE) {
        setItems((current) =>
          current.map((item) =>
            item.id === localId
              ? {
                  ...item,
                  status: "error",
                  message: "Este video supera 200 MB. Comprime el archivo o exporta una versión más ligera antes de subirlo.",
                }
              : item,
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

      const { data: insertedAsset, error: insertError } = await supabase
        .from("creative_assets")
        .insert({
          brand_id: brandId,
          owner_id: user.id,
          asset_type: assetType,
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
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
                message: insertError ? insertError.message : "Archivo guardado. Ya puedes analizarlo.",
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
      const response = await fetch("/api/creative-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: item.assetId, frames }),
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

  return (
    <div className="upload-zone tall">
      <ImageUp size={34} />
      <b>Subir imagen o video del anuncio</b>
      <p>Sube imagen o video y recibe una lectura profunda con score, psicología, receta, guiones y variantes.</p>
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
              {item.status === "listo" && item.assetId && item.analysisStatus !== "listo" && (
                <button
                  className="inline-action"
                  type="button"
                  onClick={() => analyzeItem(item)}
                  disabled={item.analysisStatus === "analizando"}
                >
                  {item.analysisStatus === "analizando" ? <Loader2 className="spin" size={14} /> : <Brain size={14} />}
                  {item.analysisStatus === "analizando" ? "Analizando..." : "Analizar · 120 cr"}
                </button>
              )}
              {item.analysis && <CreativeAnalysisCard result={item.analysis} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreativeAnalysisCard({ result }: { result: CreativeAnalysisResult }) {
  const analysis = normalizeClientAnalysis(result.analysis, result);
  const score = analysis.score ?? result.score;
  const verdict = analysis.verdict || result.verdict;
  const hook = analysis.dashboard?.hook;
  const structure = analysis.structural_analysis;
  const psychology = analysis.psychological_analysis;
  const buyer = psychology?.buyer_psychology;
  const math = psychology?.math_breakdown;
  const patterns = analysis.dashboard?.patterns;

  return (
    <section className="creative-result">
      <div className="creative-result-head">
        <div className="creative-score-ring" style={{ "--score": `${score}%` } as CSSProperties}>
          <b>{score}</b>
          <span>/100</span>
        </div>
        <div>
          <span className="eyebrow">Lectura profunda</span>
          <h3>{analysis.winning_reason || "Análisis creativo completo."}</h3>
          <strong>{verdict}</strong>
        </div>
      </div>

      <div className="creative-signal-grid">
        <SignalCard title="Detiene el scroll" signal={analysis.signals?.scroll_stop} />
        <SignalCard title="Claridad inmediata" signal={analysis.signals?.clarity} />
        <SignalCard title="Oferta" signal={analysis.signals?.offer} />
      </div>

      <div className="creative-layer-tabs">
        <span><Eye size={15} /> Dashboard</span>
        <span><Brain size={15} /> Psicologia</span>
        <span><FileText size={15} /> Guiones</span>
        <span><Rocket size={15} /> Plan</span>
      </div>

      <div className="creative-deep-grid">
        <ReportPanel icon={<Sparkles size={18} />} title="La receta ganadora">
          <NumberedList items={analysis.winning_recipe || []} />
        </ReportPanel>

        <ReportPanel icon={<Lock size={18} />} title="Que mantener" eyebrow="no negociable">
          <CheckList items={analysis.keep || []} />
          <div className="soft-divider" />
          <b className="panel-mini-title">Que probar despues</b>
          <ArrowList items={analysis.test || []} />
        </ReportPanel>

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

      <ReportPanel icon={<FileText size={18} />} title="Guion original y variantes" wide>
        {analysis.original_script && <p className="script-box">{analysis.original_script}</p>}
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
              {variant.scenario && <b>{variant.scenario}</b>}
              <p>{variant.script}</p>
              <CheckList items={variant.team_brief || []} />
            </article>
          ))}
        </div>
      </ReportPanel>

      <div className="creative-deep-grid">
        <ReportPanel icon={<Rocket size={18} />} title="Plan de replicacion">
          <Insight label="Tono" value={analysis.replication_plan?.voice_tone} />
          <CheckList items={analysis.replication_plan?.editing_notes || []} />
          <b className="panel-mini-title">Shot list</b>
          <NumberedList items={analysis.replication_plan?.shot_list || []} />
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
  );
}

function normalizeClientAnalysis(analysis: CreativeDissection, result: CreativeAnalysisResult): CreativeDissection {
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
    score: analysis.score ?? result.score,
    verdict: analysis.verdict || result.verdict,
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
  children,
}: {
  icon: ReactNode;
  title: string;
  eyebrow?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={`report-panel${wide ? " wide" : ""}`}>
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
      0.4,
      1.2,
      2.4,
      duration * 0.22,
      duration * 0.38,
      duration * 0.55,
      duration * 0.72,
      duration * 0.9,
    ];
    const times = candidates
      .map((time) => Math.min(Math.max(time, 0), Math.max(duration - 0.1, 0)))
      .filter((time, index, list) => Number.isFinite(time) && list.findIndex((candidate) => Math.abs(candidate - time) < 0.25) === index)
      .slice(0, 8);

    const frames: string[] = [];
    for (const time of times) {
      frames.push(await captureFrame(video, time));
    }

    return frames;
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
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
