"use client";

import { FormEvent, useMemo, useState } from "react";
import { Copy, Download, ImagePlus, Layers3, Loader2, WandSparkles } from "lucide-react";
import { ReferenceUploader } from "@/components/ReferenceUploader";

type GeneratedStatic = {
  id: string;
  storage_path: string;
  public_url: string;
  prompt: string;
  concept: {
    direction: string;
    format: string;
    funnel_stage: string;
    variant: number;
  };
};

const formats = ["1:1 Feed", "4:5 Feed", "9:16 Story/Reel", "Carrusel"];
const stages = [
  "Descubrimiento - detener scroll",
  "Consideración - explicar mecanismo",
  "Conversión - oferta y urgencia",
  "Retargeting - objeciones y prueba",
];

export function StaticStudio({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [direction, setDirection] = useState("");
  const [referenceMode, setReferenceMode] = useState("automatico");
  const [format, setFormat] = useState("4:5 Feed");
  const [stage, setStage] = useState(stages[0]);
  const [variants, setVariants] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<GeneratedStatic[]>([]);

  const promptMother = useMemo(
    () =>
      `Crear estático para ${brandName}. Dirección: ${direction || "pendiente"}. Formato: ${format}. Etapa: ${stage}. Modo de referencias: ${referenceMode}. Mantener jerarquía clara: hook visible, beneficio concreto, prueba u objeción, llamado a la acción.`,
    [brandName, direction, format, referenceMode, stage],
  );

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (direction.trim().length < 20) {
      setMessage("Escribe una dirección creativa un poco más específica antes de generar.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/static-generation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandId,
          direction,
          referenceMode,
          format,
          funnelStage: stage,
          variants,
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "No se pudo generar el estático.");

      setResults(data.statics || []);
      setMessage("Estático generado y guardado en la marca.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar el estático.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <form className="studio-split" onSubmit={handleGenerate}>
      <section className="brief-stack">
        <label>
          01 Dirección creativa
          <textarea
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            placeholder="Cuenta qué quieres comunicar, a quién y qué debería entender en dos segundos."
            required
          />
        </label>

        <div className="choice-row">
          <button className={referenceMode === "automatico" ? "selected" : ""} type="button" onClick={() => setReferenceMode("automatico")}>
            <Layers3 size={15} /> Automático
          </button>
          <button className={referenceMode === "elegir" ? "selected" : ""} type="button" onClick={() => setReferenceMode("elegir")}>
            Elegir refs
          </button>
          <button className={referenceMode === "sin_refs" ? "selected" : ""} type="button" onClick={() => setReferenceMode("sin_refs")}>
            Sin refs
          </button>
        </div>

        <div className="format-grid">
          {formats.map((item) => (
            <button className={format === item ? "selected" : ""} type="button" key={item} onClick={() => setFormat(item)}>
              {item}
            </button>
          ))}
        </div>

        <label>
          Etapa del embudo
          <select value={stage} onChange={(event) => setStage(event.target.value)}>
            {stages.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          02 Variantes
          <input
            type="number"
            min="1"
            max="4"
            value={variants}
            onChange={(event) => setVariants(Math.min(Math.max(Number(event.target.value), 1), 4))}
          />
        </label>

        <ReferenceUploader brandId={brandId} />

        <div className="static-actions">
          <button className="primary-action" type="submit" disabled={isGenerating}>
            {isGenerating ? <Loader2 className="spin" size={16} /> : <WandSparkles size={16} />}
            {isGenerating ? "Generando..." : `Generar estático · ${variants * 250} cr`}
          </button>
          <button className="secondary-action" type="button" onClick={() => navigator.clipboard?.writeText(promptMother)}>
            <Copy size={15} /> Copiar prompt madre
          </button>
        </div>

        {message && <p className="form-message">{message}</p>}
      </section>

      <aside className="preview-board generated-preview">
        {results.length === 0 ? (
          <>
            <ImagePlus size={34} />
            <b>Vista previa aparecerá aquí</b>
            <p>El resultado se guarda en la marca para editarlo, descargarlo y usarlo como base de nuevas variantes.</p>
          </>
        ) : (
          <div className="generated-grid">
            {results.map((item) => (
              <article key={item.id}>
                <img src={item.public_url} alt={`Estático generado para ${brandName}`} />
                <div>
                  <b>Variante {item.concept.variant}</b>
                  <a href={item.public_url} download>
                    <Download size={15} /> Descargar
                  </a>
                </div>
                <button type="button" onClick={() => navigator.clipboard?.writeText(item.prompt)}>
                  <Copy size={15} /> Copiar prompt
                </button>
              </article>
            ))}
          </div>
        )}
      </aside>
    </form>
  );
}
