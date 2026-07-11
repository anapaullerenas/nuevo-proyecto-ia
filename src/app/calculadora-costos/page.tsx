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
            <h1>Decide cuanto puedes invertir sin adivinar.</h1>
            <p>
              Una herramienta para entender break even, ROAS objetivo, CPA maximo,
              CPL maximo y escenarios de pauta antes de escalar anuncios.
            </p>
          </div>
          <div className="calculator-note">
            <Calculator />
            <b>Para decisiones de pauta</b>
            <p>Usala antes de analizar Meta o lanzar nuevos estaticos.</p>
          </div>
        </div>

        <MetaCalculator />

        <div className="analysis-grid three calculator-guidance">
          <article>
            <Target />
            <span>01</span>
            <b>Break even</b>
            <p>Tu ROAS minimo para no perder dinero despues de costos variables.</p>
          </article>
          <article>
            <Target />
            <span>02</span>
            <b>CPA objetivo</b>
            <p>El costo maximo por compra para conservar el margen deseado.</p>
          </article>
          <article>
            <Target />
            <span>03</span>
            <b>CPL maximo</b>
            <p>Cuanto pagar por lead o mensaje segun tu tasa de cierre real.</p>
          </article>
        </div>
      </section>
    </AppFrame>
  );
}
