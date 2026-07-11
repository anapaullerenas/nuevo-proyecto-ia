import { SendHorizontal, Sparkles } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { getAiStatus, getWorkspace } from "@/lib/workspace";

export default async function ChatPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const ai = getAiStatus();
  const isReady = ai.openai || ai.anthropic;

  return (
    <AppFrame active="/chat" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page chat-layout">
        <aside className="context-rail">
          <span className="eyebrow">Memoria activa</span>
          <h1>{workspace.activeBrand.name}</h1>
          <p>{workspace.activeBrand.offer || "Oferta pendiente de enriquecer."}</p>
          <div className="status-card">
            <b>Estado IA</b>
            <span className={isReady ? "status-ok" : "status-warn"}>
              {isReady ? "Lista para conectar respuestas" : "Faltan llaves OpenAI/Anthropic"}
            </span>
          </div>
        </aside>

        <section className="studio-panel">
          <div className="panel-heading">
            <span className="eyebrow">Chat IA</span>
            <h2>Tu estratega de creativos con memoria de marca.</h2>
            <p>
              Aqui la persona pregunta que producir, que analizar o como mejorar
              un anuncio usando la informacion madre de la marca.
            </p>
          </div>

          <div className="chat-empty">
            <Sparkles size={22} />
            <b>{isReady ? "Listo para implementar conversacion real" : "Conecta una llave para activar respuestas"}</b>
            <p>
              La interfaz ya esta separada del dashboard. El siguiente paso es
              conectar el endpoint del modelo y descontar creditos por consulta.
            </p>
          </div>

          <form className="composer">
            <input
              disabled={!isReady}
              placeholder={
                isReady
                  ? "Ej. Que estatico producirias esta semana para esta marca?"
                  : "Agrega OPENAI_API_KEY o ANTHROPIC_API_KEY para activar el chat"
              }
            />
            <button disabled={!isReady} aria-label="Enviar mensaje">
              <SendHorizontal size={18} />
            </button>
          </form>
        </section>
      </section>
    </AppFrame>
  );
}
