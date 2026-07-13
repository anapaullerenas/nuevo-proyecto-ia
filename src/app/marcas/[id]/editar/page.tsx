import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandOnboardingForm } from "@/components/BrandOnboardingForm";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { getWorkspace } from "@/lib/workspace";

export default async function EditarMarcaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const { id } = await params;
  const brand = workspace.brandList.find((item) => item.id === id);

  if (!brand) notFound();

  return (
    <AppFrame active="/marcas" brand={workspace.activeBrand} credits={workspace.walletBalance} unlimited={workspace.isUnlimited}>
      <section className="work-page">
        <div className="studio-panel">
          <div className="panel-heading split">
            <div>
              <span className="eyebrow">Editar marca</span>
              <h1>{brand.name}</h1>
              <p>Ajusta la memoria madre. Esto cambiará el contexto para chat, análisis y estáticos.</p>
            </div>
            <Link href="/marcas" className="secondary-action">Cancelar</Link>
          </div>
          <BrandOnboardingForm initialBrand={brand} submitLabel="Guardar cambios" />
        </div>
      </section>
    </AppFrame>
  );
}
