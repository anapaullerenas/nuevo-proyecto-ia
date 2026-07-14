"use client";

import { useState } from "react";
import { FileText, Images } from "lucide-react";
import { CreativeAssetUploader, CreativeHistoryItem } from "@/components/CreativeAssetUploader";
import { ScriptAnalysisWorkspace, ScriptHistoryItem } from "@/components/ScriptAnalysisWorkspace";

export function CreativeAnalysisWorkspace({
  brandId,
  visualHistory,
  scriptHistory,
}: {
  brandId: string;
  visualHistory: CreativeHistoryItem[];
  scriptHistory: ScriptHistoryItem[];
}) {
  const [source, setSource] = useState<"visual" | "script">("visual");

  return (
    <div className="creative-analysis-workspace">
      <nav className="analysis-source-tabs" aria-label="Tipo de análisis">
        <button type="button" className={source === "visual" ? "active" : ""} onClick={() => setSource("visual")}>
          <Images size={19} />
          <span><b>Imagen o video</b><small>Disecciona un anuncio existente</small></span>
        </button>
        <button type="button" className={source === "script" ? "active" : ""} onClick={() => setSource("script")}>
          <FileText size={19} />
          <span><b>Guion o idea</b><small>Analiza, mejora o crea antes de grabar</small></span>
        </button>
      </nav>
      {source === "visual"
        ? <CreativeAssetUploader brandId={brandId} initialHistory={visualHistory} />
        : <ScriptAnalysisWorkspace brandId={brandId} initialHistory={scriptHistory} />}
    </div>
  );
}
