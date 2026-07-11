"use client";

import { useMemo, useState } from "react";

export function MetaCalculator() {
  const [ticket, setTicket] = useState(97);
  const [productCost, setProductCost] = useState(22);
  const [shipping, setShipping] = useState(6);
  const [fees, setFees] = useState(4);
  const [targetNetMargin, setTargetNetMargin] = useState(20);
  const [leadCloseRate, setLeadCloseRate] = useState(18);
  const [dailyBudget, setDailyBudget] = useState(30);
  const [cpm, setCpm] = useState(12);
  const [ctr, setCtr] = useState(1.4);
  const [landingConversion, setLandingConversion] = useState(18);

  const result = useMemo(() => {
    const variableCost = productCost + shipping + fees;
    const contribution = Math.max(ticket - variableCost, 0);
    const contributionMargin = ticket > 0 ? contribution / ticket : 0;
    const breakEvenRoas = contributionMargin > 0 ? 1 / contributionMargin : 0;
    const targetProfit = ticket * (targetNetMargin / 100);
    const targetCpa = Math.max(contribution - targetProfit, 0);
    const targetRoas = targetCpa > 0 ? ticket / targetCpa : 0;
    const maxCpl = targetCpa * (leadCloseRate / 100);
    const monthlySpend = dailyBudget * 30;
    const impressions = cpm > 0 ? (monthlySpend / cpm) * 1000 : 0;
    const clicks = impressions * (ctr / 100);
    const leads = clicks * (landingConversion / 100);
    const sales = leads * (leadCloseRate / 100);
    const revenue = sales * ticket;
    const grossAfterProduct = sales * contribution;
    const projectedProfit = grossAfterProduct - monthlySpend;
    const projectedRoas = monthlySpend > 0 ? revenue / monthlySpend : 0;

    return {
      variableCost,
      contribution,
      contributionMargin,
      breakEvenRoas,
      targetCpa,
      targetRoas,
      maxCpl,
      monthlySpend,
      impressions,
      clicks,
      leads,
      sales,
      revenue,
      projectedProfit,
      projectedRoas,
    };
  }, [ticket, productCost, shipping, fees, targetNetMargin, leadCloseRate, dailyBudget, cpm, ctr, landingConversion]);

  return (
    <section className="calculator-card deep-calculator">
      <div className="calculator-intro">
        <span className="eyebrow">Calculadora</span>
        <h2>Costos, ROAS y punto de equilibrio.</h2>
        <p>
          Simula cuanto puedes pagar por compra, lead o mensaje antes de escalar
          publicidad. La idea es que cada marca entienda su numero limite.
        </p>
      </div>

      <div className="calc-sections">
        <fieldset>
          <legend>Economia de la oferta</legend>
          <div className="calc-grid">
            <label>
              Ticket promedio
              <input type="number" value={ticket} min="1" onChange={(event) => setTicket(Number(event.target.value))} />
            </label>
            <label>
              Costo producto/servicio
              <input type="number" value={productCost} min="0" onChange={(event) => setProductCost(Number(event.target.value))} />
            </label>
            <label>
              Envio / entrega
              <input type="number" value={shipping} min="0" onChange={(event) => setShipping(Number(event.target.value))} />
            </label>
            <label>
              Comisiones / fees
              <input type="number" value={fees} min="0" onChange={(event) => setFees(Number(event.target.value))} />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Meta de rentabilidad</legend>
          <div className="calc-grid">
            <label>
              Margen neto deseado %
              <input
                type="number"
                value={targetNetMargin}
                min="0"
                max="90"
                onChange={(event) => setTargetNetMargin(Number(event.target.value))}
              />
            </label>
            <label>
              Cierre de lead/mensaje %
              <input
                type="number"
                value={leadCloseRate}
                min="1"
                max="100"
                onChange={(event) => setLeadCloseRate(Number(event.target.value))}
              />
            </label>
            <label>
              Gasto diario
              <input type="number" value={dailyBudget} min="1" onChange={(event) => setDailyBudget(Number(event.target.value))} />
            </label>
            <label>
              CPM esperado
              <input type="number" value={cpm} min="1" onChange={(event) => setCpm(Number(event.target.value))} />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Conversion esperada</legend>
          <div className="calc-grid compact">
            <label>
              CTR %
              <input type="number" value={ctr} min="0.1" step="0.1" onChange={(event) => setCtr(Number(event.target.value))} />
            </label>
            <label>
              Conversion a lead %
              <input
                type="number"
                value={landingConversion}
                min="1"
                max="100"
                onChange={(event) => setLandingConversion(Number(event.target.value))}
              />
            </label>
          </div>
        </fieldset>
      </div>

      <div className="calc-results">
        <div>
          <span>Margen contribucion</span>
          <b>${result.contribution.toFixed(2)}</b>
          <small>{(result.contributionMargin * 100).toFixed(1)}% despues de costos variables</small>
        </div>
        <div>
          <span>CPA break even</span>
          <b>${result.contribution.toFixed(2)}</b>
          <small>Si pagas mas, pierdes dinero antes de costos fijos.</small>
        </div>
        <div>
          <span>ROAS break even</span>
          <b>{result.breakEvenRoas.toFixed(2)}x</b>
          <small>ROAS minimo para no perder en la oferta.</small>
        </div>
        <div>
          <span>CPA objetivo</span>
          <b>${result.targetCpa.toFixed(2)}</b>
          <small>Para conservar {targetNetMargin}% de margen neto.</small>
        </div>
        <div>
          <span>ROAS objetivo</span>
          <b>{result.targetRoas.toFixed(2)}x</b>
          <small>Meta de ROAS para escalar con margen.</small>
        </div>
        <div>
          <span>CPL / mensaje max.</span>
          <b>${result.maxCpl.toFixed(2)}</b>
          <small>Basado en cierre de {leadCloseRate}%.</small>
        </div>
        <div>
          <span>Gasto mensual</span>
          <b>${result.monthlySpend.toFixed(2)}</b>
          <small>Presupuesto diario x 30 dias.</small>
        </div>
        <div>
          <span>Utilidad proyectada</span>
          <b>${result.projectedProfit.toFixed(2)}</b>
          <small>Con los supuestos de trafico actuales.</small>
        </div>
      </div>

      <div className="scenario-table">
        <b>Simulacion mensual</b>
        <div>
          <span>Impresiones</span>
          <strong>{Math.round(result.impressions).toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>Clics</span>
          <strong>{Math.round(result.clicks).toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>Leads / mensajes</span>
          <strong>{Math.round(result.leads).toLocaleString("en-US")}</strong>
        </div>
        <div>
          <span>Ventas estimadas</span>
          <strong>{result.sales.toFixed(1)}</strong>
        </div>
        <div>
          <span>Ingresos</span>
          <strong>${result.revenue.toFixed(2)}</strong>
        </div>
        <div>
          <span>ROAS proyectado</span>
          <strong>{result.projectedRoas.toFixed(2)}x</strong>
        </div>
      </div>
    </section>
  );
}
