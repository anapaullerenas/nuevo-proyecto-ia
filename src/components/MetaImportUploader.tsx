"use client";

import { ChangeEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ClipboardCopy,
  FileSpreadsheet,
  Loader2,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  UploadCloud,
} from "lucide-react";
import { CREDIT_COSTS } from "@/lib/credit-catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type UploadItem = {
  id: string;
  importId?: string;
  name: string;
  status: "subiendo" | "listo" | "error";
  analysisStatus?: "idle" | "analizando" | "listo" | "error";
  message?: string;
};

type CreativeVerdict = "winner" | "good" | "acceptable" | "poor";

type RankedCreative = {
  name: string;
  creative_id?: string;
  roas?: string;
  sales?: string;
  spend?: string;
  verdict: CreativeVerdict;
  decision: string;
  reason: string;
};

export type MetaAnalysis = {
  period?: { start?: string; end?: string; label?: string };
  period_summary?: string;
  creative_strategy_summary?: string;
  winning_pattern?: string;
  next_move?: string;
  rows_analyzed?: number;
  totals?: Record<string, string>;
  creative_ranking?: RankedCreative[];
  winners?: Array<{ name?: string; decision?: string; reason?: string; metrics?: string }>;
  fatigue?: Array<{ name?: string; signal?: string; action?: string }>;
  actions?: string[];
  next_briefs?: Array<{ title?: string; angle?: string; evidence?: string }>;
  data_quality?: string[];
};

export type MetaHistoryItem = {
  id: string;
  fileName: string;
  createdAt: string;
  analysis: MetaAnalysis;
};

const verdictLabels: Record<CreativeVerdict, string> = {
  winner: "Winner",
  good: "Bueno",
  acceptable: "Aceptable",
  poor: "Bajo",
};

function cleanTechnicalError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/json|unterminated|unexpected token|openai|maximum context|api/i.test(message)) {
    return "No pudimos terminar el análisis. Intenta de nuevo; el archivo quedó guardado y no perdiste tu información.";
  }
  return message || "No se pudo analizar el export. Intenta de nuevo.";
}

function verdictFromDecision(decision = ""): CreativeVerdict {
  const value = decision.toLowerCase();
  if (value.includes("escalar") || value.includes("winner") || value.includes("ganador")) return "winner";
  if (value.includes("mantener")) return "good";
  if (value.includes("pausar")) return "poor";
  return "acceptable";
}

function normalizeRanking(analysis: MetaAnalysis): RankedCreative[] {
  if (analysis.creative_ranking?.length) return analysis.creative_ranking;
  return (analysis.winners || []).map((item) => ({
    name: item.name || "Creativo sin nombre",
    roas: item.metrics?.match(/(?:ROAS\s*)?([\d.,]+x)/i)?.[1] || "—",
    sales: item.metrics?.match(/(\d+)\s*(?:ventas|compras|resultados)/i)?.[1] || "—",
    spend: item.metrics?.match(/(?:gasto|inversión)\s*[:$]?\s*([\d.,]+)/i)?.[1] || "—",
    verdict: verdictFromDecision(item.decision),
    decision: item.decision || "Revisar",
    reason: item.reason || item.metrics || "Revisa el volumen antes de tomar una decisión.",
  }));
}

function formatDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function periodLabel(entry: MetaHistoryItem) {
  const period = entry.analysis.period;
  if (period?.start && period?.end) return `${formatDate(period.start)} — ${formatDate(period.end)}`;
  if (period?.label) return period.label;
  return new Date(entry.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export function MetaImportUploader({ brandId, initialHistory }: { brandId: string; initialHistory: MetaHistoryItem[] }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [history, setHistory] = useState(initialHistory);
  const [selectedId, setSelectedId] = useState(initialHistory[0]?.id || "");
  const [isUploading, setIsUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(initialHistory.length === 0);

  const selected = history.find((entry) => entry.id === selectedId) || history[0];

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setIsUploading(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setItems([{ id: crypto.randomUUID(), name: "Sesión", status: "error", message: "Vuelve a iniciar sesión." }]);
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
        setItems((current) => current.map((item) => item.id === localId ? { ...item, status: "error", message: "No pudimos subir el archivo. Intenta de nuevo." } : item));
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
      setItems((current) => current.map((item) => item.id === localId ? {
        ...item,
        importId: savedImport?.id,
        status: error ? "error" : "listo",
        analysisStatus: error ? "error" : "idle",
        message: error ? "No pudimos guardar el export. Intenta de nuevo." : "Archivo listo para analizar.",
      } : item));
    }

    event.target.value = "";
    setIsUploading(false);
  }

  async function analyzeImport(item: UploadItem) {
    if (!item.importId) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, analysisStatus: "analizando", message: "Leyendo creativos y detectando patrones..." } : entry));

    try {
      const response = await fetch("/api/meta-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importId: item.importId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo analizar el export.");

      const saved: MetaHistoryItem = {
        id: item.importId,
        fileName: item.name,
        createdAt: new Date().toISOString(),
        analysis: data.analysis,
      };
      setHistory((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)]);
      setSelectedId(saved.id);
      setShowUpload(false);
      setItems([]);
    } catch (error) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, analysisStatus: "error", message: cleanTechnicalError(error) } : entry));
    }
  }

  return (
    <div className="meta-creative-workspace">
      <section className="meta-period-history">
        <header>
          <div><span className="eyebrow">Historial guardado</span><h2>Periodos analizados</h2></div>
          <button className="secondary-action" type="button" onClick={() => setShowUpload((current) => !current)}>
            <Plus size={15} /> Nuevo análisis
          </button>
        </header>

        {showUpload && (
          <div className="meta-inline-upload">
            <FileSpreadsheet size={24} />
            <div><b>Sube el export de Meta</b><p>CSV o XLSX con nombres, inversión, resultados y ROAS. El análisis quedará guardado.</p></div>
            <label className="upload-action">
              {isUploading ? <Loader2 className="spin" size={16} /> : <UploadCloud size={16} />}
              {isUploading ? "Subiendo..." : "Seleccionar export"}
              <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFiles} />
            </label>
            {items.length > 0 && <div className="meta-upload-queue">{items.map((item) => (
              <article key={item.id} className={item.status}>
                <div><b>{item.name}</b><small>{item.message || item.status}</small></div>
                {item.status === "listo" && item.importId && item.analysisStatus !== "listo" && (
                  <button className="primary-action" type="button" onClick={() => analyzeImport(item)} disabled={item.analysisStatus === "analizando"}>
                    {item.analysisStatus === "analizando" ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
                    {item.analysisStatus === "analizando" ? "Analizando creativos..." : `Analizar y guardar · ${CREDIT_COSTS.meta_analysis} cr`}
                  </button>
                )}
              </article>
            ))}</div>}
          </div>
        )}

        {history.length > 0 && <div className="meta-period-rail">{history.map((entry) => {
          const ranking = normalizeRanking(entry.analysis);
          const winners = ranking.filter((item) => item.verdict === "winner").length;
          return <button key={entry.id} type="button" className={selected?.id === entry.id ? "selected" : ""} onClick={() => setSelectedId(entry.id)}>
            <CalendarDays size={16} />
            <span><b>{periodLabel(entry)}</b><small>{ranking.length || entry.analysis.rows_analyzed || 0} creativos · {winners} winners</small></span>
            {selected?.id === entry.id && <Check size={15} />}
          </button>;
        })}</div>}
      </section>

      {selected ? <MetaAnalysisDashboard entry={selected} /> : !showUpload ? (
        <div className="meta-empty-history"><FileSpreadsheet size={28} /><b>Aún no hay periodos analizados</b><p>Sube tu primer export para descubrir qué creativos escalar, mantener o pausar.</p></div>
      ) : null}
    </div>
  );
}

function MetaAnalysisDashboard({ entry }: { entry: MetaHistoryItem }) {
  const analysis = entry.analysis;
  const ranking = useMemo(() => normalizeRanking(analysis), [analysis]);
  const winners = ranking.filter((item) => item.verdict === "winner");
  const poor = ranking.filter((item) => item.verdict === "poor");
  const totals = analysis.totals || {};

  async function copySummary() {
    const lines = [
      `Análisis Meta · ${periodLabel(entry)}`,
      analysis.creative_strategy_summary || analysis.period_summary || "",
      `Patrón ganador: ${analysis.winning_pattern || "Sin patrón confirmado"}`,
      `Qué hacer ahora: ${analysis.next_move || analysis.actions?.[0] || "Revisar ranking"}`,
      ...ranking.map((item, index) => `${index + 1}. ${item.name} — ROAS ${item.roas || "—"}, ventas ${item.sales || "—"}, ${verdictLabels[item.verdict]}, ${item.decision}.`),
    ];
    await navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
  }

  return (
    <section className="meta-creative-results">
      <header className="meta-creative-head">
        <div><span className="eyebrow">Estrategia creativa · análisis guardado</span><h2>Qué está funcionando</h2><p><CalendarDays size={15} /> Periodo analizado: <b>{periodLabel(entry)}</b></p></div>
        <button className="secondary-action" type="button" onClick={copySummary}><ClipboardCopy size={15} /> Copiar resumen</button>
      </header>

      <div className="meta-creative-kpis">
        <article className="winner"><Trophy size={18} /><span><b>{winners.length}</b><small>creativos winner</small></span></article>
        <article><TrendingUp size={18} /><span><b>{totals.roas || ranking[0]?.roas || "—"}</b><small>ROAS del periodo</small></span></article>
        <article><BadgeCheck size={18} /><span><b>{totals.results || totals.sales || "—"}</b><small>ventas o resultados</small></span></article>
        <article className="poor"><TrendingDown size={18} /><span><b>{poor.length}</b><small>creativos para pausar</small></span></article>
      </div>

      <section className="meta-strategy-brief meta-clean-brief">
        <header><span>Interpretación del período</span><h3>{firstSentence(analysis.creative_strategy_summary || analysis.period_summary || "El análisis está listo para tomar decisiones creativas.")}</h3></header>
        <div className="meta-decision-steps">
          <article><span>01</span><div><b>Qué se repite en los ganadores</b><p>{analysis.winning_pattern || "Revisa los primeros creativos del ranking y conserva su mecanismo principal."}</p></div></article>
          <article><span>02</span><div><b>La decisión para esta semana</b><p>{analysis.next_move || analysis.actions?.[0] || "Mantén los ganadores y pausa lo que no recupera inversión."}</p></div></article>
        </div>
        <details><summary>Leer interpretación completa</summary><p>{analysis.creative_strategy_summary || analysis.period_summary}</p></details>
      </section>

      <section className="meta-ranking-board">
        <header><div><span className="eyebrow">Del mejor al que necesita atención</span><h2>Ranking de creativos</h2></div><small>Ordenado por resultado, no por nombre</small></header>
        <div className="meta-ranking-labels"><span>Creativo</span><span>ROAS</span><span>Ventas</span><span>Inversión</span><span>Resultado</span><span>Decisión</span></div>
        <div className="meta-creative-ranking">{ranking.map((item, index) => (
          <article key={`${item.name}-${index}`} className={`rank-${item.verdict}`}>
            <div className="meta-creative-identity"><i>{index + 1}</i><span><b>{item.creative_id || `CREATIVO ${String(index + 1).padStart(2, "0")}`}</b><strong>{item.name}</strong><small>{item.reason}</small></span></div>
            <b>{item.roas || "—"}</b><b>{item.sales || "—"}</b><b>{item.spend || "—"}</b>
            <span className={`meta-verdict ${item.verdict}`}>{item.verdict === "winner" && <Trophy size={12} />}{verdictLabels[item.verdict]}</span>
            <span className="meta-decision">{item.decision}<ArrowRight size={13} /></span>
          </article>
        ))}</div>
        {ranking.length === 0 && <div className="meta-ranking-empty">El archivo no incluyó datos suficientes para ordenar creativos. Revisa las columnas de nombre, inversión, resultados y ROAS.</div>}
      </section>

      <div className="meta-support-grid">
        <article><header><AlertTriangle size={17} /><b>Fatiga y riesgos</b></header>{(analysis.fatigue || []).map((item, index) => <section key={`${item.name}-${index}`}><b>{item.name}</b><p>{item.signal}</p><small>{item.action}</small></section>)}</article>
        <article><header><Sparkles size={17} /><b>Qué producir después</b></header>{(analysis.next_briefs || []).map((item, index) => <section key={`${item.title}-${index}`}><b>{item.title}</b><p>{item.angle}</p><small>{item.evidence}</small></section>)}</article>
      </div>

      {(analysis.data_quality || []).length > 0 && <aside className="data-quality-note"><AlertTriangle size={16} /><div><b>Calidad de datos</b><p>{analysis.data_quality?.join(" · ")}</p></div></aside>}
    </section>
  );
}

function firstSentence(value: string) {
  const clean = value.trim();
  const match = clean.match(/^.*?[.!?](?:\s|$)/);
  return (match?.[0] || clean).trim().slice(0, 220);
}
