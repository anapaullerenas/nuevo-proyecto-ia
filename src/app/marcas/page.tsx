import Link from "next/link";
import { Plus } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { getWorkspace, labelContentOwner } from "@/lib/workspace";

export default async function MarcasPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  return (
    <AppFrame active="/marcas" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page">
        <div className="studio-panel">
          <div className="panel-heading split">
            <div>
              <span className="eyebrow">Mis marcas</span>
              <h1>La información madre vive aquí.</h1>
              <p>Cada marca guarda audiencia, oferta, voz y quién produce contenido.</p>
            </div>
            <Link href="/onboarding" className="soft-button">
              <Plus size={16} /> Agregar marca
            </Link>
          </div>

          <div className="brand-list">
            {workspace.brandList.map((brand) => (
              <article key={brand.id}>
                <span>{brand.id === workspace.activeBrand.id ? "Activa" : "Guardada"}</span>
                <h2>{brand.name}</h2>
                <p>{brand.category || "Completa la categoría"}</p>
                <dl>
                  <div>
                    <dt>Producción</dt>
                    <dd>{labelContentOwner(brand.content_owner)}</dd>
                  </div>
                  <div>
                    <dt>Objetivo</dt>
                    <dd>{brand.creative_goal || "Define un primer objetivo"}</dd>
                  </div>
                </dl>
                <Link href={`/marcas/${brand.id}/editar`} className="inline-action">
                  Editar memoria
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
