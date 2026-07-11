import Link from "next/link";
import {
  Brain,
  ChartNoAxesCombined,
  ImagePlus,
  MessageCircle,
  UploadCloud,
} from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { getWorkspace, labelContentOwner } from "@/lib/workspace";

export default async function DashboardPage() {
  const workspace = await getWorkspace();

  if (!workspace) return <SetupState />;

  const { activeBrand, walletBalance } = workspace;

  return (
    <AppFrame active="/dashboard" brand={activeBrand} credits={walletBalance}>
      <section className="real-dashboard">
        <aside className="brand-context">
          <span className="eyebrow">Marca activa</span>
          <h1>{activeBrand.name}</h1>
          <p>{activeBrand.category || "Categoria pendiente"}</p>
          <dl>
            <div>
              <dt>Produccion</dt>
              <dd>{labelContentOwner(activeBrand.content_owner)}</dd>
            </div>
            <div>
              <dt>Objetivo</dt>
              <dd>{activeBrand.creative_goal || "Definir primer objetivo creativo"}</dd>
            </div>
          </dl>
          <Link href="/onboarding" className="secondary-action">
            Agregar otra marca
          </Link>
        </aside>

        <section className="empty-ops">
          <div className="empty-hero">
            <span className="eyebrow">Dashboard real</span>
            <h2>Aun no hay analisis, imports ni estaticos.</h2>
            <p>
              Esta es la pantalla correcta para una cuenta nueva: primero carga
              datos o conversa con la IA. Los resultados apareceran cuando
              existan acciones reales en la base.
            </p>
          </div>

          <div className="module-grid">
            <article>
              <MessageCircle />
              <b>Chat IA</b>
              <p>Preguntar que producir con el contexto de marca guardado.</p>
              <Link href="/chat" className="module-action">Iniciar conversacion</Link>
            </article>
            <article>
              <ChartNoAxesCombined />
              <b>Analisis Meta</b>
              <p>Subir CSV/XLSX exportado desde Meta para detectar ganadores.</p>
              <Link href="/analisis-meta" className="module-action">
                <UploadCloud size={15} /> Subir export
              </Link>
            </article>
            <article>
              <Brain />
              <b>Analisis creativos</b>
              <p>Subir video o imagen para obtener score, psicologia y variantes.</p>
              <Link href="/analisis-creativos" className="module-action">Nuevo analisis</Link>
            </article>
            <article>
              <ImagePlus />
              <b>Crear estaticos</b>
              <p>Crear desde cero o desde un creativo ganador cuando exista.</p>
              <Link href="/crear-estaticos" className="module-action">Crear primer estatico</Link>
            </article>
          </div>
        </section>
      </section>
    </AppFrame>
  );
}
