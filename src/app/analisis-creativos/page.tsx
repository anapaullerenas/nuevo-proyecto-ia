import { Brain, Clapperboard, ImageUp } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
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
            <div className="upload-zone tall">
              <Clapperboard size={34} />
              <b>Video, imagen o URL del anuncio</b>
              <p>Cuando conectemos IA, aqui se guardara el activo y se analizara con la marca activa.</p>
              <button disabled>
                <ImageUp size={16} /> Subir creativo
              </button>
            </div>
            <div className="analysis-map">
              <Brain size={22} />
              <b>Estructura del analisis</b>
              <div>
                {sections.map((section) => (
                  <span key={section}>{section}</span>
                ))}
              </div>
              <p className="status-warn">El motor de analisis se activara cuando conectemos el servicio de IA.</p>
            </div>
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
