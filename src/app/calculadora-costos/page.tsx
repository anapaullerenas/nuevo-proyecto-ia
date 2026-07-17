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
            <h1>Calcula tu campaña con los números que sí usas.</h1>
            <p>
              Llena meta de facturación, duración, presupuesto, ticket, costos,
              utilidad mínima y descuento. La plataforma te da el CPA seguro,
              ventas necesarias y presupuesto diario.
            </p>
          </div>
          <div className="calculator-note">
            <Calculator />
            <b>Sin CTR, CPM ni tecnicismos</b>
            <p>Usa métricas financieras comunes para decidir si una campaña tiene sentido.</p>
          </div>
        </div>

        <MetaCalculator brandId={workspace.activeBrand.id} brandName={workspace.activeBrand.name} />

        <div className="analysis-grid three calculator-guidance">
          <article>
            <Target />
            <span>01</span>
            <b>Primero, tu meta</b>
            <p>Cuánto quieres facturar y cuántos días estará activa la campaña.</p>
          </article>
          <article>
            <Target />
            <span>02</span>
            <b>Después, tus costos</b>
            <p>Ticket, descuento, costos variables y utilidad mínima por venta.</p>
          </article>
          <article>
            <Target />
            <span>03</span>
            <b>Por último, tu decisión</b>
            <p>CPA seguro, ventas necesarias, presupuesto total y diagnóstico.</p>
          </article>
        </div>
      </section>
    </AppFrame>
  );
}
