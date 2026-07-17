import { Calculator, Target } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { MetaCalculator } from "@/components/MetaCalculator";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function CalculadoraCostosPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  return (
    <AppFrame active="/calculadora-costos" brand={workspace.activeBrand} brandList={workspace.brandList} credits={workspace.walletBalance} unlimited={workspace.isUnlimited}>
      <section className="work-page calculator-page">
        <div className="panel-heading split calculator-hero">
          <div>
            <span className="eyebrow">Calculadora de costos</span>
            <h1>Descubre cuánto puedes invertir sin adivinar.</h1>
            <p>
              Elige cómo vendes y traduce tus números a una decisión sencilla:
              cuánto puedes pagar y qué presupuesto necesita tu meta.
            </p>
          </div>
          <div className="calculator-note">
            <Calculator />
            <b>Para decisiones de pauta</b>
            <p>Úsala antes de analizar Meta o lanzar nuevos estáticos.</p>
          </div>
        </div>

        <MetaCalculator brandId={workspace.activeBrand.id} brandName={workspace.activeBrand.name} />

        <div className="analysis-grid three calculator-guidance">
          <article>
            <Target />
            <span>01</span>
            <b>Primero, tu realidad</b>
            <p>El precio, los costos y la forma en que realmente conviertes.</p>
          </article>
          <article>
            <Target />
            <span>02</span>
            <b>Después, tu límite</b>
            <p>Cuánto puedes pagar por una compra, un mensaje o una clienta.</p>
          </article>
          <article>
            <Target />
            <span>03</span>
            <b>Por último, tu plan</b>
            <p>Qué presupuesto diario y mensual hace coherente tu meta.</p>
          </article>
        </div>
      </section>
    </AppFrame>
  );
}
