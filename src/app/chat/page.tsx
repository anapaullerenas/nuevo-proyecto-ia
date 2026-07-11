import { SendHorizontal, Sparkles } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { getWorkspace } from "@/lib/workspace";

export default async function ChatPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  return (
    <AppFrame active="/chat" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page chat-layout">
        <aside className="context-rail">
            <span className="eyebrow">Memoria activa</span>
            <h1>{workspace.activeBrand.name}</h1>
            <p>{workspace.activeBrand.offer || "Oferta pendiente de enriquecer."}</p>
            <div className="status-card">
              <b>Estado IA</b>
            <span className="status-warn">Asistente en preparacion</span>
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
            <b>Tu asistente creativo se esta preparando.</b>
            <p>
              Pronto podras pedir ideas de anuncios, angles, hooks, briefs y
              diagnosticos usando la memoria de esta marca.
            </p>
          </div>

          <form className="composer">
            <input
              disabled
              placeholder="Ej. Que estatico producirias esta semana para esta marca?"
            />
            <button disabled aria-label="Enviar mensaje">
              <SendHorizontal size={18} />
            </button>
          </form>
        </section>
      </section>
    </AppFrame>
  );
}
