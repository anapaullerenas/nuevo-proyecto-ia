"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Clipboard, FileText, Lightbulb, Loader2, Pencil, Plus, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { ScriptAnalysis, ScriptAnalysisMode } from "@/lib/ai/script-analysis";

type ScriptAnalysisResult = { score: number; verdict: string; analysis: ScriptAnalysis };

export type ScriptHistoryItem = {
  id: string;
  name: string;
  createdAt: string;
  result: ScriptAnalysisResult;
};

const MODES: Array<{ id: ScriptAnalysisMode; label: string; placeholder: string }> = [
  { id: "analyze", label: "Analizar guion", placeholder: "Pega aquí el guion que quieres diagnosticar…" },
  { id: "improve", label: "Mejorar guion", placeholder: "Pega el guion que quieres hacer más claro, poderoso y fácil de grabar…" },
  { id: "generate", label: "Crear desde una idea", placeholder: "Describe la idea, problema, promesa o mensaje que quieres convertir en guion…" },
];

const CRITERION_LABELS: Record<string, string> = {
  hook: "Hook y primera frase",
  problem_or_desire: "Problema o deseo",
  promise: "Claridad de la promesa",
  mechanism_or_proof: "Mecanismo o prueba",
  clarity_and_pacing: "Claridad y ritmo",
  cta_or_offer: "CTA u oferta",
  brand_and_credibility: "Voz y credibilidad",
};

export function ScriptAnalysisWorkspace({ brandId, initialHistory }: { brandId: string; initialHistory: ScriptHistoryItem[] }) {
  const [mode, setMode] = useState<ScriptAnalysisMode>("analyze");
  const [format, setFormat] = useState("short");
  const [objective, setObjective] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScriptHistoryItem | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const words = useMemo(() => sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0, [sourceText]);
  const seconds = Math.max(0, Math.round((words / 145) * 60));

  async function submit() {
    if (sourceText.trim().length < 20 || loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/script-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandId, mode, format, objective, text: sourceText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo analizar el guion.");
      const saved = data.analysis as { id: string; score: number; verdict: string; analysis: ScriptAnalysis; created_at: string };
      const item: ScriptHistoryItem = { id: saved.id, name: saved.analysis.title, createdAt: saved.created_at, result: { score: saved.score, verdict: saved.verdict, analysis: saved.analysis } };
      setHistory((current) => [item, ...current]);
      setResult(item);
      window.scrollTo({ top: 110, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo analizar el guion.");
    } finally { setLoading(false); }
  }

  async function rename(entry: ScriptHistoryItem) {
    const name = draftName.trim();
    if (name.length < 2) return;
    const response = await fetch(`/api/creative-library/${entry.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "No se pudo cambiar el nombre."); return; }
    setHistory((current) => current.map((item) => item.id === entry.id ? { ...item, name: data.name, result: { ...item.result, analysis: { ...item.result.analysis, title: data.name } } } : item));
    if (result?.id === entry.id) setResult({ ...result, name: data.name, result: { ...result.result, analysis: { ...result.result.analysis, title: data.name } } });
    setRenamingId(null); setDraftName("");
  }

  async function remove(entry: ScriptHistoryItem) {
    if (!window.confirm(`¿Borrar “${entry.name}” y su análisis?`)) return;
    const response = await fetch(`/api/creative-library/${entry.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "No se pudo borrar el análisis."); return; }
    setHistory((current) => current.filter((item) => item.id !== entry.id));
    if (result?.id === entry.id) setResult(null);
  }

  if (result) return <ScriptResult entry={result} onBack={() => setResult(null)} onNew={() => { setResult(null); setSourceText(""); setObjective(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} />;

  const activeMode = MODES.find((item) => item.id === mode) || MODES[0];
  return (
    <div className="script-entry-workspace">
      <section className="script-analysis-panel">
        <div className="script-analysis-copy">
          <span className="eyebrow">Nuevo análisis de guion</span>
          <h2>Convierte una idea en un guion que retiene y vende.</h2>
          <p>La IA contrasta tu texto con estructuras validadas, la etapa de conciencia y la memoria de tu marca.</p>
          <ul><li><Check size={15} /> Diagnóstico con puntuación y prioridades</li><li><Check size={15} /> Versión mejorada sin perder tu voz</li><li><Check size={15} /> Hooks y tomas listas para probar</li></ul>
        </div>
        <div className="script-composer">
          <div className="script-mode-tabs" role="tablist" aria-label="Objetivo del guion">
            {MODES.map((item) => <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)}>{item.label}</button>)}
          </div>
          <label><span>Tu {mode === "generate" ? "idea" : "guion"}</span><textarea value={sourceText} maxLength={15000} onChange={(event) => setSourceText(event.target.value)} placeholder={activeMode.placeholder} /></label>
          <div className="script-settings"><label><span>Formato</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option value="short">Video corto · 15–30 s</option><option value="ugc">UGC · 30–60 s</option><option value="sales">Video de venta · 60–120 s</option><option value="custom">Duración personalizada</option></select></label><label><span>Objetivo o CTA <small>opcional</small></span><input value={objective} maxLength={500} onChange={(event) => setObjective(event.target.value)} placeholder="Ej. Conversión · probar el producto" /></label></div>
          <div className="script-composer-footer"><small>{words} palabras · duración estimada: {formatDuration(seconds)}</small><button className="primary-action" type="button" disabled={sourceText.trim().length < 20 || loading} onClick={submit}>{loading ? <Loader2 className="spin" size={16} /> : <WandSparkles size={16} />}{loading ? "Fortaleciendo el guion…" : mode === "generate" ? "Crear guion" : "Analizar y fortalecer"}</button></div>
          {error && <p className="script-error"><X size={14} /> {error}</p>}
        </div>
      </section>
      <ScriptLibrary history={history} renamingId={renamingId} draftName={draftName} setDraftName={setDraftName} onOpen={setResult} onStartRename={(entry) => { setRenamingId(entry.id); setDraftName(entry.name); }} onCancelRename={() => setRenamingId(null)} onRename={rename} onDelete={remove} />
    </div>
  );
}

function ScriptResult({ entry, onBack, onNew }: { entry: ScriptHistoryItem; onBack: () => void; onNew: () => void }) {
  const analysis = entry.result.analysis;
  return <div className="script-result-layout">
    <header className="script-result-hero"><div className="script-score"><b>{analysis.score}</b><span>/100</span></div><div><span className="eyebrow">Diagnóstico del guion · {analysis.verdict}</span><h2>{analysis.summary}</h2><small>{analysis.word_count} palabras · {formatDuration(analysis.estimated_duration_seconds)} · {analysis.selected_structure.name}</small></div><button type="button" onClick={onBack}><ArrowLeft size={15} /> Volver a editar</button></header>
    <section className="script-result-grid"><div className="script-result-rail">
      <article className="script-report-card"><h3><Sparkles size={17} /> Qué está funcionando</h3>{analysis.strengths.map((item, index) => <div className="script-strength" key={`${item.point}-${index}`}><b>{item.point}</b><p>{item.evidence}</p></div>)}</article>
      <article className="script-report-card"><h3><Lightbulb size={17} /> Puntuación por estructura</h3>{Object.entries(analysis.criteria).map(([key, item]) => <div className="script-criterion" key={key}><div><span>{CRITERION_LABELS[key] || key}</span><b>{item.score}/{item.max}</b></div><div className="script-score-track"><i style={{ width: `${(item.score / item.max) * 100}%` }} /></div><small>{item.recommendation}</small></div>)}</article>
      <article className="script-report-card"><h3>Las 3 mejoras prioritarias</h3><ol className="script-priorities">{analysis.priority_fixes.map((item) => <li key={item.priority}><b>{item.what}</b><span>{item.where}</span><p>{item.why}</p></li>)}</ol></article>
    </div><div className="script-result-main">
      <article className="script-report-card script-rewrite"><header><div><span className="eyebrow">Versión fortalecida</span><h3>Lista para grabar · {formatDuration(analysis.estimated_duration_seconds)}</h3></div><button type="button" onClick={() => copy(analysis.improved_script)}><Clipboard size={14} /> Copiar</button></header><pre>{analysis.improved_script}</pre></article>
      <article className="script-report-card"><h3>Tres hooks para probar</h3><div className="script-hook-grid">{analysis.hook_variants.map((hook, index) => <article key={`${hook.name}-${index}`}><span>0{index + 1}</span><b>{hook.name}</b><p>{hook.hook}</p><small>{hook.mechanism}</small><button type="button" onClick={() => copy(hook.hook)}><Clipboard size={13} /> Copiar</button></article>)}</div></article>
      <article className="script-report-card"><h3>Plan mínimo de grabación</h3><div className="script-beats">{analysis.beat_sheet.map((beat, index) => <article key={`${beat.timestamp}-${index}`}><time>{beat.timestamp}</time><div><b>{beat.purpose}</b><p>{beat.shot}</p><blockquote>{beat.spoken_line}</blockquote>{beat.on_screen_text && <small>Texto: {beat.on_screen_text}</small>}</div></article>)}</div></article>
      {(analysis.evidence_warnings.length > 0 || analysis.assumptions.length > 0) && <article className="script-report-card script-warnings"><h3><AlertTriangle size={17} /> Antes de grabar, confirma</h3>{[...analysis.evidence_warnings, ...analysis.assumptions].map((warning, index) => <p key={`${warning}-${index}`}>{warning}</p>)}</article>}
    </div></section>
    <footer className="analysis-action-bar"><div><Check size={17} /><span><b>Guardado en tu biblioteca</b> Puedes volver a este análisis cuando quieras.</span></div><button className="secondary-action" type="button" onClick={onBack}>Editar texto</button><button className="primary-action" type="button" onClick={onNew}><Plus size={15} /> Nuevo guion</button></footer>
  </div>;
}

function ScriptLibrary({ history, renamingId, draftName, setDraftName, onOpen, onStartRename, onCancelRename, onRename, onDelete }: { history: ScriptHistoryItem[]; renamingId: string | null; draftName: string; setDraftName: (value: string) => void; onOpen: (entry: ScriptHistoryItem) => void; onStartRename: (entry: ScriptHistoryItem) => void; onCancelRename: () => void; onRename: (entry: ScriptHistoryItem) => void; onDelete: (entry: ScriptHistoryItem) => void }) {
  return <section className="creative-library script-library"><header><div><FileText size={21} /><div><span className="eyebrow">Biblioteca</span><h2>Guiones anteriores</h2></div></div><small>{history.length} guardados</small></header>{history.length ? <div className="creative-library-grid">{history.map((entry) => <article className="script-library-card" key={entry.id}>{renamingId === entry.id ? <div className="script-library-rename"><input value={draftName} maxLength={90} onChange={(event) => setDraftName(event.target.value)} autoFocus /><div><button type="button" onClick={onCancelRename}><X size={14} /></button><button type="button" onClick={() => onRename(entry)}><Check size={14} /></button></div></div> : <><button className="script-library-open" type="button" onClick={() => onOpen(entry)}><span className="library-score">{entry.result.score}</span><div><b>{entry.name}</b><small>Guion · {entry.result.verdict}</small></div><time>{new Date(entry.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</time></button><div className="script-library-actions"><button type="button" aria-label="Renombrar" onClick={() => onStartRename(entry)}><Pencil size={13} /></button><button type="button" aria-label="Borrar" onClick={() => onDelete(entry)}><Trash2 size={13} /></button></div></>}</article>)}</div> : <div className="library-empty"><FileText size={28} /><b>Aún no hay guiones analizados</b><p>Tu primer diagnóstico aparecerá aquí y quedará conectado con la marca activa.</p></div>}</section>;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60); const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")} min`;
}

function copy(value: string) { navigator.clipboard?.writeText(value); }
