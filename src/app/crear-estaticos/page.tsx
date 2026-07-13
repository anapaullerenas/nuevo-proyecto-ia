import { AppFrame, SetupState } from "@/components/AppFrame";
import { StaticStudio } from "@/components/StaticStudio";
import { getWorkspace } from "@/lib/workspace";

export default async function CrearEstaticosPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  return (
    <AppFrame active="/crear-estaticos" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page static-studio">
        <div className="studio-panel">
          <div className="panel-heading split">
            <div>
              <span className="eyebrow">Crear estáticos</span>
              <h1>Un estudio guiado, no un generador suelto.</h1>
              <p>
                Define dirección creativa, referencias, variantes y etapa del
                embudo. La IA crea piezas con la memoria de la marca activa.
              </p>
            </div>
            <div className="status-card compact">
              <b>{workspace.activeBrand.name}</b>
              <span className="status-ok">Generación conectada</span>
            </div>
          </div>

          <StaticStudio brandId={workspace.activeBrand.id} brandName={workspace.activeBrand.name} />
        </div>
      </section>
    </AppFrame>
  );
}
