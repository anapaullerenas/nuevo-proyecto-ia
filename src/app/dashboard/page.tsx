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
          <p>{activeBrand.category || "Completa la categoría de tu marca"}</p>
          <dl>
            <div>
              <dt>Producción</dt>
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
            <h2>Aún no hay análisis, imports ni estáticos.</h2>
            <p>
              Empieza con una acción concreta: conversa con la IA, sube un
              creativo o guarda tus números en la calculadora.
            </p>
          </div>

          <div className="module-grid">
            <article>
              <MessageCircle />
              <b>Chat IA</b>
              <p>Preguntar que producir con el contexto de marca guardado.</p>
              <Link href="/chat" className="module-action">Iniciar conversación</Link>
            </article>
            <article>
              <ChartNoAxesCombined />
              <b>Análisis Meta</b>
              <p>Subir CSV/XLSX exportado desde Meta para detectar ganadores.</p>
              <Link href="/analisis-meta" className="module-action">
                <UploadCloud size={15} /> Subir export
              </Link>
            </article>
            <article>
              <Brain />
              <b>Análisis creativos</b>
              <p>Subir video o imagen para obtener score, psicologia y variantes.</p>
              <Link href="/analisis-creativos" className="module-action">Nuevo analisis</Link>
            </article>
            <article>
              <ImagePlus />
              <b>Crear estáticos</b>
              <p>Crear desde cero o desde un creativo ganador cuando exista.</p>
              <Link href="/crear-estaticos" className="module-action">Crear primer estático</Link>
            </article>
          </div>
        </section>
      </section>
    </AppFrame>
  );
}
