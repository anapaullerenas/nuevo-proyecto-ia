import { Copy, ImagePlus, Layers3, WandSparkles } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { getAiStatus, getWorkspace } from "@/lib/workspace";

export default async function CrearEstaticosPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const ai = getAiStatus();

  return (
    <AppFrame active="/crear-estaticos" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page static-studio">
        <div className="studio-panel">
          <div className="panel-heading split">
            <div>
              <span className="eyebrow">Crear estaticos</span>
              <h1>Un estudio guiado, no un generador suelto.</h1>
              <p>
                La persona define direccion creativa, referencias, variantes y
                ediciones. La IA debe actuar como disenadora con memoria de marca.
              </p>
            </div>
            <button className="soft-button" disabled={!ai.openai}>
              <WandSparkles size={16} /> {ai.openai ? "Generar" : "Falta OpenAI"}
            </button>
          </div>

          <div className="studio-split">
            <section className="brief-stack">
              <label>
                01 Direccion creativa
                <textarea placeholder="Cuenta que quieres comunicar, a quien y que debe entender en dos segundos." />
              </label>
              <div className="choice-row">
                <button className="selected" type="button"><Layers3 size={15} /> Automatico</button>
                <button type="button">Elegir refs</button>
                <button type="button">Sin refs</button>
              </div>
              <label>
                02 Variantes
                <input placeholder="Ej. 4 versiones: prueba social, objecion, oferta, antes/despues" />
              </label>
            </section>

            <aside className="preview-board">
              <ImagePlus size={34} />
              <b>Vista previa aparecera aqui</b>
              <p>
                Sin llave de imagen no se genera archivo. La estructura queda
                lista para guardar versiones, editar y duplicar.
              </p>
              <button disabled>
                <Copy size={15} /> Duplicar version
              </button>
            </aside>
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
