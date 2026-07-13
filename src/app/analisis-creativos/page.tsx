import { Brain } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { CreativeAssetUploader } from "@/components/CreativeAssetUploader";
import { getWorkspace } from "@/lib/workspace";

const sections = [
  "Score ganador",
  "Gancho y claridad",
  "Oferta y objeciones",
  "Psicología de compra",
  "Receta ganadora",
  "Qué mantener",
  "Qué producir después",
  "Variantes recomendadas",
];

export default async function AnalisisCreativosPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  return (
    <AppFrame active="/analisis-creativos" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page creative-analysis">
        <div className="studio-panel">
          <div className="panel-heading">
            <span className="eyebrow">Análisis creativos</span>
            <h1>Sube imagen o video y recibe una lectura profunda.</h1>
            <p>
              Analiza anuncios visuales con una lectura clara: score, psicología,
              señales, receta ganadora, guiones y próximos pasos.
            </p>
          </div>

          <div className="two-column">
            <CreativeAssetUploader brandId={workspace.activeBrand.id} />
            <div className="analysis-map">
              <Brain size={22} />
              <b>Estructura del análisis</b>
              <div>
                {sections.map((section) => (
                  <span key={section}>{section}</span>
                ))}
              </div>
              <p className="status-warn">Después de subir un archivo, presiona Analizar. Imágenes se leen directo; videos se interpretan con frames clave.</p>
            </div>
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
