import Link from "next/link";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { MetaImportUploader } from "@/components/MetaImportUploader";
import { getWorkspace } from "@/lib/workspace";

export default async function AnalisisMetaPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  return (
    <AppFrame active="/analisis-meta" brand={workspace.activeBrand} credits={workspace.walletBalance}>
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

          <MetaImportUploader brandId={workspace.activeBrand.id} />

          <div className="analysis-grid three">
            <article>
              <span>01</span>
              <b>Ranking ganador</b>
              <p>Qué anuncio escalar, cuál pausar y cuál iterar.</p>
            </article>
            <article>
              <span>02</span>
              <b>Lectura de fatiga</b>
              <p>Señales de caída por frecuencia, CTR o costo.</p>
            </article>
            <article>
              <span>03</span>
              <b>Brief accionable</b>
              <p>Qué producir después con base en datos reales.</p>
            </article>
          </div>

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
