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

          <ChatWorkspace brandName={workspace.activeBrand.name} />
        </section>
      </section>
    </AppFrame>
  );
}
