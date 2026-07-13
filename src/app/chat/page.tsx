import { AppFrame, SetupState } from "@/components/AppFrame";
import { ChatWorkspace } from "@/components/ChatWorkspace";
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
            <p>{workspace.activeBrand.offer || "Completa tu oferta para que las respuestas sean más específicas."}</p>
            <div className="status-card">
              <b>Estado IA</b>
            <span className="status-ok">Asistente activo</span>
            </div>
          </aside>

        <section className="studio-panel">
          <div className="panel-heading">
            <span className="eyebrow">Chat IA</span>
            <h2>Tu estratega de creativos con memoria de marca.</h2>
            <p>
              Aquí puedes preguntar qué producir, qué analizar o cómo mejorar
              un anuncio usando la información madre de la marca.
            </p>
          </div>

          <ChatWorkspace brandName={workspace.activeBrand.name} />
        </section>
      </section>
    </AppFrame>
  );
}
