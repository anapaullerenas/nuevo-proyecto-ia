import { AppFrame, SetupState } from "@/components/AppFrame";
import { StaticStudio } from "@/components/StaticStudio";
import { getWorkspace } from "@/lib/workspace";

export default async function CrearEstaticosPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const [{ data: rawAssets }, { data: archetypes }, { data: rawGallery }, { data: rawReferences }] = await Promise.all([
    workspace.supabase
      .from("brand_assets")
      .select("id,file_name,storage_path,bucket_id,kind,label,created_at")
      .eq("brand_id", workspace.activeBrand.id)
      .eq("owner_id", workspace.user.id)
      .eq("kind", "product_photo")
      .order("created_at", { ascending: false }),
    workspace.supabase
      .from("static_archetypes")
      .select("id,name,label_visible,stage,prompt_fragment")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    workspace.supabase
      .from("static_creatives")
      .select("id,storage_path,prompt,ficha,archetype,format,funnel_stage,quality,version,status,created_at")
      .eq("brand_id", workspace.activeBrand.id)
      .eq("owner_id", workspace.user.id)
      .eq("status", "generated")
      .order("created_at", { ascending: false })
      .limit(12),
    workspace.supabase
      .from("brand_assets")
      .select("id,file_name,storage_path,bucket_id,metadata,created_at")
      .eq("brand_id", workspace.activeBrand.id)
      .eq("owner_id", workspace.user.id)
      .eq("kind", "style_reference")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const assets = await Promise.all(
    (rawAssets || []).map(async (asset) => {
      const { data: signed } = await workspace.supabase
        .storage
        .from(asset.bucket_id)
        .createSignedUrl(asset.storage_path, 60 * 60 * 24 * 7);
      return { ...asset, signed_url: signed?.signedUrl || null };
    }),
  );

  const gallery = await Promise.all(
    (rawGallery || []).map(async (item) => {
      if (!item.storage_path) return { ...item, signed_url: null };
      const { data: signed } = await workspace.supabase
        .storage
        .from("creative-assets")
        .createSignedUrl(item.storage_path, 60 * 60 * 24 * 7);
      return { ...item, signed_url: signed?.signedUrl || null };
    }),
  );

  const references = await Promise.all(
    (rawReferences || []).map(async (reference) => {
      const { data: signed } = await workspace.supabase.storage
        .from(reference.bucket_id)
        .createSignedUrl(reference.storage_path, 60 * 60 * 24 * 7);
      return { ...reference, signed_url: signed?.signedUrl || null };
    }),
  );

  return (
    <AppFrame active="/crear-estaticos" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page static-studio">
        <div className="studio-panel">
          <div className="panel-heading split">
            <div>
              <span className="eyebrow">Crear estáticos</span>
              <h1>Crea anuncios estáticos para tu marca.</h1>
              <p>
                Elige producto, formato y objetivo. La plataforma prepara la dirección creativa y conserva tus piezas en la galería.
              </p>
            </div>
            <div className="status-card compact">
              <b>{workspace.activeBrand.name}</b>
              <span className="status-ok">Generación conectada</span>
            </div>
          </div>

          <StaticStudio
            brandId={workspace.activeBrand.id}
            brandName={workspace.activeBrand.name}
            initialAssets={assets}
            archetypes={archetypes || []}
            initialGallery={gallery}
            initialReferences={references}
          />
        </div>
      </section>
    </AppFrame>
  );
}
