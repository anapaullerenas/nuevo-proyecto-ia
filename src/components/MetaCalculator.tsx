"use client";

import { useMemo, useState } from "react";

export function MetaCalculator() {
  const [ticket, setTicket] = useState(97);
  const [margin, setMargin] = useState(65);
  const [closeRate, setCloseRate] = useState(20);
  const [dailyBudget, setDailyBudget] = useState(20);

  const result = useMemo(() => {
    const grossProfit = ticket * (margin / 100);
    const maxCpa = grossProfit * 0.35;
    const maxLead = maxCpa * (closeRate / 100);
    const monthlySpend = dailyBudget * 30;
    const leadsPerMonth = maxLead > 0 ? monthlySpend / maxLead : 0;

    return {
      grossProfit,
      maxCpa,
      maxLead,
      monthlySpend,
      leadsPerMonth,
    };
  }, [ticket, margin, closeRate, dailyBudget]);

  return (
    <section className="calculator-card">
      <div>
        <span className="eyebrow">Calculadora</span>
        <h2>Cuanto puedes pagar por resultado.</h2>
        <p>Sirve para aterrizar si un anuncio es rentable antes de escalarlo.</p>
      </div>

      <div className="calc-grid">
        <label>
          Ticket promedio
          <input type="number" value={ticket} min="1" onChange={(event) => setTicket(Number(event.target.value))} />
        </label>
        <label>
          Margen %
          <input type="number" value={margin} min="1" max="100" onChange={(event) => setMargin(Number(event.target.value))} />
        </label>
        <label>
          Cierre de leads %
          <input type="number" value={closeRate} min="1" max="100" onChange={(event) => setCloseRate(Number(event.target.value))} />
        </label>
        <label>
          Gasto diario
          <input type="number" value={dailyBudget} min="1" onChange={(event) => setDailyBudget(Number(event.target.value))} />
        </label>
      </div>

      <div className="calc-results">
        <div>
          <span>Utilidad aprox.</span>
          <b>${result.grossProfit.toFixed(2)}</b>
        </div>
        <div>
          <span>CPA maximo sugerido</span>
          <b>${result.maxCpa.toFixed(2)}</b>
        </div>
        <div>
          <span>Costo max. por lead</span>
          <b>${result.maxLead.toFixed(2)}</b>
        </div>
        <div>
          <span>Gasto mensual</span>
          <b>${result.monthlySpend.toFixed(2)}</b>
        </div>
      </div>
    </section>
  );
}
