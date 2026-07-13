import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandOnboardingForm } from "@/components/BrandOnboardingForm";
import { BrandVisualKit } from "@/components/BrandVisualKit";
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

  const { data: rawVisualAssets } = await workspace.supabase
    .from("brand_assets")
    .select("id,file_name,storage_path,bucket_id,kind,label,metadata,created_at")
    .eq("brand_id", brand.id)
    .eq("owner_id", workspace.user.id)
    .in("kind", ["product_photo", "logo", "style_reference"])
    .order("created_at", { ascending: false });

  const visualAssets = await Promise.all((rawVisualAssets || []).map(async (asset) => {
    const { data: signed } = await workspace.supabase.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 60 * 60 * 24 * 7);
    return { ...asset, signed_url: signed?.signedUrl || null };
  }));
  const products = visualAssets.filter((asset) => asset.kind === "product_photo");
  const logos = visualAssets.filter((asset) => asset.kind === "logo");
  const references = visualAssets.filter((asset) => asset.kind === "style_reference");

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
          <BrandVisualKit brandId={brand.id} initialProducts={products} initialLogos={logos} initialReferences={references} />
        </div>
      </section>
    </AppFrame>
  );
}
