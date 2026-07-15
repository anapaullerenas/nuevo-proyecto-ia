import { AppFrame, SetupState } from "@/components/AppFrame";
import { StaticStudio } from "@/components/StaticStudio";
import { CURATED_STATIC_FORMATS, detectBrandEvidence } from "@/lib/static-format-catalog";
import { getWorkspace } from "@/lib/workspace";

export default async function CrearEstaticosPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const [{ data: rawAssets }, { data: rawLogos }, { data: rawGallery }, { data: rawReferences }] = await Promise.all([
    workspace.supabase
      .from("brand_assets")
      .select("id,file_name,storage_path,bucket_id,kind,label,created_at")
      .eq("brand_id", workspace.activeBrand.id)
      .eq("owner_id", workspace.user.id)
      .eq("kind", "product_photo")
      .order("created_at", { ascending: false }),
    workspace.supabase
      .from("brand_assets")
      .select("id,file_name,storage_path,bucket_id,kind,label,created_at")
      .eq("brand_id", workspace.activeBrand.id)
      .eq("owner_id", workspace.user.id)
      .eq("kind", "logo")
      .order("created_at", { ascending: false }),
    workspace.supabase
      .from("static_creatives")
      .select("id,storage_path,prompt,ficha,archetype,format,funnel_stage,quality,version,parent_id,status,qa_report,created_at")
      .eq("brand_id", workspace.activeBrand.id)
      .eq("owner_id", workspace.user.id)
      .in("status", ["generated", "edited", "needs_review"])
      .order("created_at", { ascending: false })
      .limit(30),
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

  const logos = await Promise.all(
    (rawLogos || []).map(async (asset) => {
      const { data: signed } = await workspace.supabase.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 60 * 60 * 24 * 7);
      return { ...asset, signed_url: signed?.signedUrl || null };
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
    <AppFrame active="/crear-estaticos" brand={workspace.activeBrand} credits={workspace.walletBalance} unlimited={workspace.isUnlimited}>
      <section className="work-page static-studio">
        <div className="studio-panel">
          <div className="panel-heading split static-studio-head">
            <div>
              <span className="eyebrow">Crear estáticos</span>
              <h1>Tu estudio está listo para crear.</h1>
              <p>
                Empieza una pieza nueva con el contexto de tu marca ya preparado. Tus creaciones anteriores permanecen disponibles en la galería.
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
            initialLogos={logos}
            archetypes={CURATED_STATIC_FORMATS}
            initialGallery={gallery}
            initialReferences={references}
            unlimitedCredits={workspace.isUnlimited}
            brandEvidence={detectBrandEvidence(workspace.activeBrand)}
          />
        </div>
      </section>
    </AppFrame>
  );
}
