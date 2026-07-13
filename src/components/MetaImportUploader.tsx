"use client";

import { ChangeEvent, useState } from "react";
import { AlertTriangle, BarChart3, Check, FileSpreadsheet, Loader2, RefreshCw, Sparkles, UploadCloud } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type UploadItem = {
  id: string;
  importId?: string;
  name: string;
  status: "subiendo" | "listo" | "error";
  analysisStatus?: "idle" | "analizando" | "listo" | "error";
  message?: string;
  analysis?: MetaAnalysis;
};

type MetaAnalysis = {
  period_summary?: string;
  rows_analyzed?: number;
  totals?: Record<string, string>;
  winners?: Array<{ name?: string; decision?: string; reason?: string; metrics?: string }>;
  fatigue?: Array<{ name?: string; signal?: string; action?: string }>;
  actions?: string[];
  next_briefs?: Array<{ title?: string; angle?: string; evidence?: string }>;
  data_quality?: string[];
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

      const [{ error: fileError }, { data: savedImport, error: importError }] = await Promise.all([
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
        }).select("id").single(),
      ]);

      const error = fileError || importError;
      setItems((current) =>
        current.map((item) =>
          item.id === localId
            ? {
                ...item,
                importId: savedImport?.id,
                status: error ? "error" : "listo",
                analysisStatus: error ? "error" : "idle",
                message: error ? error.message : "Archivo listo. Ejecuta el análisis para ver decisiones.",
              }
            : item,
        ),
      );
    }

    event.target.value = "";
    setIsUploading(false);
  }

  async function analyzeImport(item: UploadItem) {
    if (!item.importId) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, analysisStatus: "analizando", message: "Leyendo campañas y comparando anuncios..." } : entry));

    try {
      const response = await fetch("/api/meta-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importId: item.importId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo analizar el export.");
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, analysisStatus: "listo", analysis: data.analysis, message: "Análisis completado." } : entry));
    } catch (error) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, analysisStatus: "error", message: error instanceof Error ? error.message : "No se pudo analizar el export." } : entry));
    }
  }

  const completed = items.find((item) => item.analysis)?.analysis;

  if (completed) return <MetaAnalysisDashboard analysis={completed} onReset={() => setItems([])} />;

  return (
    <div className="meta-import-workspace">
      <div className="upload-zone meta-upload-zone">
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
              {item.status === "listo" && item.importId && item.analysisStatus !== "listo" && (
                <button className="primary-action meta-analyze-action" type="button" onClick={() => analyzeImport(item)} disabled={item.analysisStatus === "analizando"}>
                  {item.analysisStatus === "analizando" ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
                  {item.analysisStatus === "analizando" ? "Analizando campañas..." : "Analizar datos · 120 cr"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function MetaAnalysisDashboard({ analysis, onReset }: { analysis: MetaAnalysis; onReset: () => void }) {
  const totals = Object.entries(analysis.totals || {});
  return (
    <section className="meta-results">
      <header className="meta-results-head">
        <div><span className="eyebrow">Análisis completado</span><h2>Decisiones de campañas</h2><p>{analysis.period_summary}</p></div>
        <button className="secondary-action" type="button" onClick={onReset}><RefreshCw size={15} /> Analizar otro export</button>
      </header>
      {totals.length > 0 && <div className="meta-kpis">{totals.map(([label, value]) => <article key={label}><span>{label}</span><b>{value}</b></article>)}</div>}
      <div className="meta-result-grid">
        <article className="meta-ranking">
          <header><BarChart3 size={18} /><b>Ranking y decisión</b></header>
          <div>{(analysis.winners || []).map((item, index) => <section key={`${item.name}-${index}`}><span className={`decision-badge ${(item.decision || "").toLowerCase()}`}>{item.decision}</span><div><b>{item.name || `Anuncio ${index + 1}`}</b><small>{item.metrics}</small><p>{item.reason}</p></div></section>)}</div>
        </article>
        <article>
          <header><AlertTriangle size={18} /><b>Fatiga y riesgos</b></header>
          <div className="meta-stack">{(analysis.fatigue || []).map((item, index) => <section key={`${item.name}-${index}`}><b>{item.name}</b><p>{item.signal}</p><small>{item.action}</small></section>)}</div>
        </article>
        <article>
          <header><Check size={18} /><b>Acciones prioritarias</b></header>
          <ol className="numbered-list">{(analysis.actions || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol>
        </article>
        <article>
          <header><Sparkles size={18} /><b>Qué producir después</b></header>
          <div className="meta-stack">{(analysis.next_briefs || []).map((item, index) => <section key={`${item.title}-${index}`}><b>{item.title}</b><p>{item.angle}</p><small>{item.evidence}</small></section>)}</div>
        </article>
      </div>
      {(analysis.data_quality || []).length > 0 && <aside className="data-quality-note"><AlertTriangle size={16} /><div><b>Calidad de datos</b><p>{analysis.data_quality?.join(" · ")}</p></div></aside>}
    </section>
  );
}
