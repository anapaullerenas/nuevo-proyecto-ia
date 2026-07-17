import Link from "next/link";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { MetaImportUploader } from "@/components/MetaImportUploader";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AnalisisMetaPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const { data: savedImports } = await workspace.supabase
    .from("meta_imports")
    .select("id,file_name,summary,created_at")
    .eq("brand_id", workspace.activeBrand.id)
    .eq("owner_id", workspace.user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(24);

  const history = (savedImports || []).map((item) => ({
    id: item.id,
    fileName: item.file_name || "Export de Meta",
    createdAt: item.created_at,
    analysis: item.summary || {},
  }));

  return (
    <AppFrame active="/analisis-meta" brand={workspace.activeBrand} brandList={workspace.brandList} credits={workspace.walletBalance} unlimited={workspace.isUnlimited}>
      <section className="work-page">
        <div className="studio-panel">
          <div className="panel-heading split">
            <div>
              <span className="eyebrow">Análisis Meta</span>
              <h1>Sube el export y detecta anuncios ganadores.</h1>
              <p>
                Sube CSV/XLSX de Meta Ads para guardar el reporte de la marca
                y preparar decisiones de ganadores, fatiga e iteraciones.
              </p>
            </div>
            <div className="status-card compact">
              <b>Estado</b>
              <span className="status-ok">Subida activa</span>
            </div>
          </div>

          <div className="download-instructions">
            <span className="eyebrow">Instrucciones para descargar tu archivo</span>
            <h2>Antes de subirlo aquí, expórtalo así desde Meta Ads.</h2>
            <ol>
              <li>Entra a Meta Ads Manager y abre Campañas, Conjuntos o Anuncios.</li>
              <li>Elige el rango de fechas que quieres analizar.</li>
              <li>Activa las columnas de rendimiento: gasto, impresiones, alcance, CTR, CPC, CPM, resultados y costo por resultado.</li>
              <li>Da clic en Exportar y descarga el archivo en CSV o XLSX.</li>
              <li>Regresa a esta pantalla y súbelo para generar el diagnóstico.</li>
            </ol>
          </div>

          <div className="export-guide">
            <span className="eyebrow">Antes de exportar desde Meta</span>
            <h2>Marca estas columnas para que el análisis tenga sentido.</h2>
            <div>
              {[
                "Nombre del anuncio",
                "Campaña y conjunto",
                "Fecha o rango",
                "Gasto",
                "Impresiones",
                "Alcance",
                "Frecuencia",
                "CTR",
                "CPC",
                "CPM",
                "Resultados",
                "Costo por resultado",
                "Compras/leads/mensajes",
                "ROAS o valor de conversión",
              ].map((item) => (
                <label key={item}>
                  <input type="checkbox" defaultChecked /> {item}
                </label>
              ))}
            </div>
          </div>

          <MetaImportUploader brandId={workspace.activeBrand.id} initialHistory={history} />

          <div className="meta-calculator-link">
            <div>
              <span className="eyebrow">Rentabilidad</span>
              <b>Antes de escalar, calcula tu ROAS objetivo y CPA máximo.</b>
              <p>La calculadora vive como herramienta independiente para simular costos, leads, ventas y gasto publicitario.</p>
            </div>
            <Link href="/calculadora-costos" className="soft-button">Abrir calculadora</Link>
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
