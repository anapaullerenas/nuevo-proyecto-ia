import { AppFrame, SetupState } from "@/components/AppFrame";
import { CreativeAnalysisWorkspace } from "@/components/CreativeAnalysisWorkspace";
import { ScriptAnalysis } from "@/lib/ai/script-analysis";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AnalisisCreativosPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const { data: analyses } = await workspace.supabase
    .from("creative_analyses")
    .select("id,score,verdict,analysis,created_at,creative_assets(id,file_name,asset_type,storage_path)")
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

  const visualHistory = (analyses || []).filter((item) => !isScriptAnalysis(item.analysis)).map((item) => {
    const asset = Array.isArray(item.creative_assets) ? item.creative_assets[0] : item.creative_assets;
    return {
      id: item.id,
      assetId: asset?.id || null,
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

  const scriptHistory = (analyses || []).filter((item) => isScriptAnalysis(item.analysis)).map((item) => {
    const analysis = item.analysis as unknown as ScriptAnalysis;
    return {
      id: item.id,
      name: analysis.title || `Guion ${new Date(item.created_at).toLocaleDateString("es-MX")}`,
      createdAt: item.created_at,
      result: {
        score: item.score || analysis.score || 0,
        verdict: item.verdict || analysis.verdict || "",
        analysis,
      },
    };
  });

  return (
    <AppFrame active="/analisis-creativos" brand={workspace.activeBrand} brandList={workspace.brandList} credits={workspace.walletBalance} unlimited={workspace.isUnlimited}>
      <section className="work-page creative-analysis">
        <div className="studio-panel">
          <div className="panel-heading">
            <span className="eyebrow">Análisis creativos</span>
            <h1>Entiende y fortalece cada idea antes de grabarla.</h1>
            <p>
              Analiza imágenes, videos o guiones con la información guardada de tu marca.
            </p>
          </div>
          <CreativeAnalysisWorkspace brandId={workspace.activeBrand.id} visualHistory={visualHistory} scriptHistory={scriptHistory} />
        </div>
      </section>
    </AppFrame>
  );
}

function isScriptAnalysis(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "source_type" in value && value.source_type === "script";
}
