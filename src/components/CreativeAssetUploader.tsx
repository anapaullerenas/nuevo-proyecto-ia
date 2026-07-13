"use client";

import { ChangeEvent, useState } from "react";
import { Brain, ImageUp, Loader2 } from "lucide-react";
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

type CreativeAnalysisResult = {
  score: number;
  verdict: string;
  analysis: {
    score: number;
    verdict: string;
    summary: string;
    why_it_works?: string[];
    diagnosis?: Record<string, { level: string; note: string }>;
    keep?: string[];
    change?: string[];
    produce_next?: string[];
    variants?: Array<{ name: string; angle: string; hook: string; execution: string }>;
  };
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
                message: "Analisis listo.",
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
      <p>Sube el creativo y luego presiona Analizar ahora para recibir score, diagnostico y variantes.</p>
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
                  {item.analysisStatus === "analizando" ? "Analizando..." : "Analizar ahora"}
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
  const analysis = result.analysis;

  return (
    <section className="creative-result">
      <div className="creative-result-head">
        <span>{analysis.verdict || result.verdict}</span>
        <b>{analysis.score ?? result.score}/100</b>
      </div>
      <p>{analysis.summary}</p>

      <div className="creative-result-grid">
        {Object.entries(analysis.diagnosis || {}).map(([key, value]) => (
          <article key={key}>
            <span>{key}</span>
            <b>{value.level}</b>
            <p>{value.note}</p>
          </article>
        ))}
      </div>

      <div className="creative-result-lists">
        <ResultList title="Que mantener" items={analysis.keep || []} />
        <ResultList title="Que cambiar" items={analysis.change || []} />
        <ResultList title="Que producir despues" items={analysis.produce_next || []} />
      </div>
    </section>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <b>{title}</b>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
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
    const times = [Math.min(0.8, duration * 0.1), duration * 0.35, duration * 0.7].filter(
      (time, index, list) => time >= 0 && Number.isFinite(time) && list.indexOf(time) === index,
    );

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
