import { AppFrame, SetupState } from "@/components/AppFrame";
import { CreativeAssetUploader } from "@/components/CreativeAssetUploader";
import { getWorkspace } from "@/lib/workspace";

export default async function AnalisisCreativosPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const { data: analyses } = await workspace.supabase
    .from("creative_analyses")
    .select("id,score,verdict,analysis,created_at,creative_assets(file_name,asset_type,storage_path)")
    .eq("brand_id", workspace.activeBrand.id)
    .eq("owner_id", workspace.user.id)
    .order("created_at", { ascending: false })
    .limit(24);

  const storagePaths = (analyses || []).map((item) => {
    const asset = Array.isArray(item.creative_assets) ? item.creative_assets[0] : item.creative_assets;
    return asset?.storage_path || "";
  }).filter(Boolean);
  const { data: signedFiles } = storagePaths.length
    ? await workspace.supabase.storage.from("creative-assets").createSignedUrls(storagePaths, 60 * 60)
    : { data: [] };
  const signedUrlByPath = new Map((signedFiles || []).map((file) => [file.path, file.signedUrl]));

  const history = (analyses || []).map((item) => {
    const asset = Array.isArray(item.creative_assets) ? item.creative_assets[0] : item.creative_assets;
    return {
      id: item.id,
      name: asset?.file_name || `Análisis ${new Date(item.created_at).toLocaleDateString("es-MX")}`,
      assetType: (asset?.asset_type === "image" ? "image" : "video") as "image" | "video",
      createdAt: item.created_at,
      previewUrl: asset?.storage_path ? signedUrlByPath.get(asset.storage_path) || undefined : undefined,
      result: {
        score: item.score || 0,
        verdict: item.verdict || "",
        analysis: item.analysis || {},
      },
    };
  });

  return (
    <AppFrame active="/analisis-creativos" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page creative-analysis">
        <div className="studio-panel">
          <div className="panel-heading">
            <span className="eyebrow">Análisis creativos</span>
            <h1>Entiende qué hace vender a cada creativo.</h1>
            <p>
              Sube una imagen o video, analiza su estructura y vuelve a consultar
              cada resultado desde la biblioteca de tu marca.
            </p>
          </div>
          <CreativeAssetUploader brandId={workspace.activeBrand.id} initialHistory={history} />
        </div>
      </section>
    </AppFrame>
  );
}
