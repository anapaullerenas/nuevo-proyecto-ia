import Link from "next/link";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
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
              <span className="eyebrow">Analisis Meta</span>
              <h1>Sube el export y detecta anuncios ganadores.</h1>
              <p>
                Este modulo recibira CSV/XLSX de Meta Ads, normalizara metricas
                y marcara ganadores por hook, oferta, formato, fatiga y costo.
              </p>
            </div>
            <div className="status-card compact">
              <b>Estado</b>
              <span className="status-warn">Subida en preparacion</span>
            </div>
          </div>

          <div className="export-guide">
            <span className="eyebrow">Antes de exportar desde Meta</span>
            <h2>Marca estas columnas para que el analisis tenga sentido.</h2>
            <div>
              {[
                "Nombre del anuncio",
                "Campana y conjunto",
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
                "ROAS o valor de conversion",
              ].map((item) => (
                <label key={item}>
                  <input type="checkbox" defaultChecked /> {item}
                </label>
              ))}
            </div>
          </div>

          <div className="upload-zone">
            <FileSpreadsheet size={32} />
            <b>CSV o XLSX de Meta Ads</b>
            <p>
              Antes de exportar: marca nombre del anuncio, gasto, impresiones,
              CTR, CPC, CPM, compras/leads, ROAS, fecha, campana y conjunto.
            </p>
            <button disabled>
              <UploadCloud size={16} /> Subida real pendiente de endpoint
            </button>
          </div>

          <div className="analysis-grid three">
            <article>
              <span>01</span>
              <b>Ranking ganador</b>
              <p>Que anuncio escalar, cual pausar y cual iterar.</p>
            </article>
            <article>
              <span>02</span>
              <b>Lectura de fatiga</b>
              <p>Senales de caida por frecuencia, CTR o costo.</p>
            </article>
            <article>
              <span>03</span>
              <b>Brief accionable</b>
              <p>Que producir despues con base en datos reales.</p>
            </article>
          </div>

          <div className="meta-calculator-link">
            <div>
              <span className="eyebrow">Rentabilidad</span>
              <b>Antes de escalar, calcula tu ROAS objetivo y CPA maximo.</b>
              <p>La calculadora vive como herramienta independiente para simular costos, leads, ventas y gasto publicitario.</p>
            </div>
            <Link href="/calculadora-costos" className="soft-button">Abrir calculadora</Link>
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
