import { Brain } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { CreativeAssetUploader } from "@/components/CreativeAssetUploader";
import { getWorkspace } from "@/lib/workspace";

const sections = [
  "Score ganador",
  "Gancho y claridad",
  "Oferta y objeciones",
  "Psicologia de compra",
  "Receta ganadora",
  "Que mantener",
  "Que producir despues",
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
            <span className="eyebrow">Analisis creativos</span>
            <h1>Sube imagen o video y recibe una lectura profunda.</h1>
            <p>
              Este flujo reemplaza el mockup simple: el resultado debe incluir
              variantes, psicologia, por que funciona, que cambiar y que producir.
            </p>
          </div>

          <div className="two-column">
            <CreativeAssetUploader brandId={workspace.activeBrand.id} />
            <div className="analysis-map">
              <Brain size={22} />
              <b>Estructura del analisis</b>
              <div>
                {sections.map((section) => (
                  <span key={section}>{section}</span>
                ))}
              </div>
              <p className="status-warn">La subida ya queda guardada. El siguiente paso es ejecutar el analisis IA sobre cada archivo.</p>
            </div>
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
