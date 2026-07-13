import { Calculator, Target } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { MetaCalculator } from "@/components/MetaCalculator";
import { getWorkspace } from "@/lib/workspace";

export default async function CalculadoraCostosPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  return (
    <AppFrame active="/calculadora-costos" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page calculator-page">
        <div className="panel-heading split calculator-hero">
          <div>
            <span className="eyebrow">Calculadora de costos</span>
            <h1>Decide cuánto puedes invertir sin adivinar.</h1>
            <p>
              Una herramienta para entender break even, ROAS objetivo, CPA máximo,
              CPL máximo y escenarios de pauta antes de escalar anuncios.
            </p>
          </div>
          <div className="calculator-note">
            <Calculator />
            <b>Para decisiones de pauta</b>
            <p>Úsala antes de analizar Meta o lanzar nuevos estáticos.</p>
          </div>
        </div>

        <MetaCalculator brandId={workspace.activeBrand.id} />

        <div className="analysis-grid three calculator-guidance">
          <article>
            <Target />
            <span>01</span>
            <b>Break even</b>
            <p>Tu ROAS mínimo para no perder dinero después de costos variables.</p>
          </article>
          <article>
            <Target />
            <span>02</span>
            <b>CPA objetivo</b>
            <p>El costo máximo por compra para conservar el margen deseado.</p>
          </article>
          <article>
            <Target />
            <span>03</span>
            <b>CPL máximo</b>
            <p>Cuánto pagar por lead o mensaje según tu tasa de cierre real.</p>
          </article>
        </div>
      </section>
    </AppFrame>
  );
}
