import { AppFrame, SetupState } from "@/components/AppFrame";
import { StaticStudio } from "@/components/StaticStudio";
import { getWorkspace } from "@/lib/workspace";

export default async function CrearEstaticosPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const [{ data: rawAssets }, { data: archetypes }, { data: rawGallery }] = await Promise.all([
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

  return (
    <AppFrame active="/crear-estaticos" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page static-studio">
        <div className="studio-panel">
          <div className="panel-heading split">
            <div>
              <span className="eyebrow">Crear estáticos</span>
              <h1>Un estudio guiado, no un generador suelto.</h1>
              <p>
                Define dirección creativa, referencias, variantes y etapa del
                embudo. La IA crea piezas con la memoria de la marca activa.
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
          />
        </div>
      </section>
    </AppFrame>
  );
}
