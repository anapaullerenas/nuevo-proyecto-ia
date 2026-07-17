"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Package,
  Plus,
  Save,
  Target,
  Trash2,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  calculatePlan,
  calculateProducts,
  calculateSeasonalCampaign,
  calculateServices,
  type CalculatorMode,
  type ExtraCost,
  type PlanGoal,
  type ProductInputs,
  type SeasonalCampaignInputs,
  type ServiceInputs,
} from "@/lib/cost-calculator";

const DEFAULT_PRODUCTS: ProductInputs = {
  ticket: 2500,
  productCost: 650,
  shipping: 120,
  fees: 90,
  extras: [],
  targetNetMargin: 20,
  storeConversion: 2.5,
  dailyBudget: 500,
  cpm: 120,
  ctr: 1.5,
};

const DEFAULT_SERVICES: ServiceInputs = {
  price: 2500,
  deliveryCost: 450,
  extras: [],
  targetNetMargin: 25,
  appointmentRatePerTen: 6,
  closeRatePerTen: 3,
  desiredClients: 10,
  dailyBudget: 500,
  cpm: 120,
  ctr: 1.5,
};

const DEFAULT_SEASONAL: SeasonalCampaignInputs = {
  productOrPromo: "",
  revenueGoal: 100000,
  durationDays: 7,
  availableBudget: 12000,
  discountPerSale: 0,
  seasonalTicket: 1200,
  variableCosts: 420,
  minimumProfitPerSale: 180,
  fixedCostContributionPerSale: 80,
};

const MODE_OPTIONS: Array<{
  id: CalculatorMode;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Package;
}> = [
  {
    id: "seasonal",
    eyebrow: "Calculadora principal",
    title: "Campaña de temporada o promoción",
    description: "Usa las métricas comunes de negocio: meta, ticket, presupuesto, costos, utilidad y CPA seguro.",
    icon: CalendarCheck2,
  },
];

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  help: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
};

function cleanNumber(raw: string, min = 0, max = Number.POSITIVE_INFINITY) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(parsed, min), max);
}

function NumberField({
  label,
  value,
  onChange,
  help,
  min = 0,
  max,
  step = 1,
  prefix,
  suffix,
}: NumberFieldProps) {
  return (
    <label className="cost-number-field">
      <span>{label}</span>
      <span className="cost-input-shell">
        {prefix && <i>{prefix}</i>}
        <input
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = cleanNumber(event.target.value, min, max);
            if (next !== null) onChange(next);
          }}
        />
        {suffix && <i>{suffix}</i>}
      </span>
      <small>{help}</small>
    </label>
  );
}

function ExtraCostsEditor({
  items,
  onChange,
}: {
  items: ExtraCost[];
  onChange: (items: ExtraCost[]) => void;
}) {
  return (
    <div className="extra-costs-editor">
      <div className="extra-costs-head">
        <div>
          <b>Otros costos por venta</b>
          <small>Empaque, comisión de vendedora u otro gasto que ocurre cada vez que vendes.</small>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...items,
              { id: `extra-${Date.now()}-${items.length}`, name: "", amount: 0 },
            ])
          }
          disabled={items.length >= 6}
        >
          <Plus size={15} /> Agregar otro costo
        </button>
      </div>

      {items.length > 0 && (
        <div className="extra-cost-rows">
          {items.map((item, index) => (
            <div className="extra-cost-row" key={item.id}>
              <input
                aria-label={`Nombre del costo ${index + 1}`}
                type="text"
                value={item.name}
                placeholder="Ej. Empaque"
                maxLength={60}
                onChange={(event) =>
                  onChange(items.map((entry) =>
                    entry.id === item.id ? { ...entry, name: event.target.value } : entry
                  ))
                }
              />
              <span className="cost-input-shell">
                <i>$</i>
                <input
                  aria-label={`Monto del costo ${index + 1}`}
                  type="number"
                  inputMode="decimal"
                  value={item.amount}
                  min={0}
                  onChange={(event) => {
                    const amount = cleanNumber(event.target.value);
                    if (amount === null) return;
                    onChange(items.map((entry) =>
                      entry.id === item.id ? { ...entry, amount } : entry
                    ));
                  }}
                />
              </span>
              <button
                type="button"
                aria-label={`Eliminar costo ${item.name || index + 1}`}
                onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({
  label,
  value,
  explanation,
  featured = false,
}: {
  label: string;
  value: string;
  explanation: string;
  featured?: boolean;
}) {
  return (
    <article className={`cost-result-card${featured ? " featured" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      <p>{explanation}</p>
    </article>
  );
}

function ProjectionFlow({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="cost-projection">
      <div className="cost-projection-title">
        <span>Proyección mensual</span>
        <b>{title}</b>
      </div>
      <div className="cost-projection-flow">
        {items.map((item, index) => (
          <div key={item.label}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function MarginWarning() {
  return (
    <div className="calculator-margin-warning" role="alert">
      <CircleDollarSign size={20} />
      <div>
        <b>Con estos costos no hay margen.</b>
        <p>Revisa precio o costos antes de invertir en anuncios.</p>
      </div>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function savedNumber(record: Record<string, unknown> | null, key: string, fallback: number) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function savedExtras(value: unknown): ExtraCost[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((entry, index) => {
    const item = asRecord(entry);
    if (!item) return [];
    return [{
      id: typeof item.id === "string" ? item.id : `saved-${index}`,
      name: typeof item.name === "string" ? item.name : "",
      amount: typeof item.amount === "number" && Number.isFinite(item.amount) ? Math.max(item.amount, 0) : 0,
    }];
  });
}

export function MetaCalculator({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [mode, setMode] = useState<CalculatorMode>("seasonal");
  const [products, setProducts] = useState<ProductInputs>(DEFAULT_PRODUCTS);
  const [services, setServices] = useState<ServiceInputs>(DEFAULT_SERVICES);
  const [seasonal, setSeasonal] = useState<SeasonalCampaignInputs>(DEFAULT_SEASONAL);
  const [planGoal, setPlanGoal] = useState<PlanGoal>("sales");
  const [planQuantity, setPlanQuantity] = useState(20);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "loading" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  const productResult = useMemo(() => calculateProducts(products), [products]);
  const serviceResult = useMemo(() => calculateServices(services), [services]);
  const seasonalResult = useMemo(() => calculateSeasonalCampaign(seasonal), [seasonal]);
  const planResult = useMemo(
    () => calculatePlan(
      { goal: planGoal, quantity: planQuantity },
      productResult,
      serviceResult,
      products,
      services,
    ),
    [planGoal, planQuantity, productResult, serviceResult, products, services],
  );

  useEffect(() => {
    let active = true;

    async function loadSavedEconomics() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("brand_economics")
        .select("*")
        .eq("brand_id", brandId)
        .maybeSingle();

      if (!active || !data) return;

      const assumptions = asRecord(data.assumptions);
      const savedMode = assumptions?.mode;
      if (savedMode === "seasonal") {
        setMode(savedMode);
      }

      const productData = asRecord(assumptions?.products);
      setProducts((current) => ({
        ...current,
        ticket: savedNumber(productData, "ticket", Number(data.ticket) || current.ticket),
        productCost: savedNumber(productData, "productCost", savedNumber(assumptions, "productCost", current.productCost)),
        shipping: savedNumber(productData, "shipping", savedNumber(assumptions, "shipping", current.shipping)),
        fees: savedNumber(productData, "fees", savedNumber(assumptions, "fees", current.fees)),
        extras: savedExtras(productData?.extras),
        targetNetMargin: savedNumber(productData, "targetNetMargin", Number(data.target_net_margin) || current.targetNetMargin),
        storeConversion: savedNumber(productData, "storeConversion", savedNumber(assumptions, "landingConversion", current.storeConversion)),
        dailyBudget: savedNumber(productData, "dailyBudget", savedNumber(assumptions, "dailyBudget", current.dailyBudget)),
        cpm: savedNumber(productData, "cpm", savedNumber(assumptions, "cpm", current.cpm)),
        ctr: savedNumber(productData, "ctr", savedNumber(assumptions, "ctr", current.ctr)),
      }));

      const serviceData = asRecord(assumptions?.services);
      const oldCloseRate = savedNumber(assumptions, "leadCloseRate", DEFAULT_SERVICES.closeRatePerTen * 10) / 10;
      setServices((current) => ({
        ...current,
        price: savedNumber(serviceData, "price", current.price),
        deliveryCost: savedNumber(serviceData, "deliveryCost", current.deliveryCost),
        extras: savedExtras(serviceData?.extras),
        targetNetMargin: savedNumber(serviceData, "targetNetMargin", current.targetNetMargin),
        appointmentRatePerTen: savedNumber(serviceData, "appointmentRatePerTen", current.appointmentRatePerTen),
        closeRatePerTen: savedNumber(serviceData, "closeRatePerTen", oldCloseRate),
        desiredClients: savedNumber(serviceData, "desiredClients", current.desiredClients),
        dailyBudget: savedNumber(serviceData, "dailyBudget", current.dailyBudget),
        cpm: savedNumber(serviceData, "cpm", current.cpm),
        ctr: savedNumber(serviceData, "ctr", current.ctr),
      }));

      const planData = asRecord(assumptions?.plan);
      const goal = planData?.goal;
      if (goal === "sales" || goal === "messages") setPlanGoal(goal);
      setPlanQuantity(savedNumber(planData, "quantity", 20));

      const seasonalData = asRecord(assumptions?.seasonal);
      setSeasonal((current) => ({
        ...current,
        productOrPromo: typeof seasonalData?.productOrPromo === "string" ? seasonalData.productOrPromo : current.productOrPromo,
        revenueGoal: savedNumber(seasonalData, "revenueGoal", current.revenueGoal),
        durationDays: savedNumber(seasonalData, "durationDays", current.durationDays),
        availableBudget: savedNumber(seasonalData, "availableBudget", current.availableBudget),
        discountPerSale: savedNumber(seasonalData, "discountPerSale", current.discountPerSale),
        seasonalTicket: savedNumber(seasonalData, "seasonalTicket", current.seasonalTicket),
        variableCosts: savedNumber(seasonalData, "variableCosts", current.variableCosts),
        minimumProfitPerSale: savedNumber(seasonalData, "minimumProfitPerSale", current.minimumProfitPerSale),
        fixedCostContributionPerSale: savedNumber(seasonalData, "fixedCostContributionPerSale", current.fixedCostContributionPerSale),
      }));
      if (typeof data.updated_at === "string") setSavedAt(data.updated_at);
    }

    loadSavedEconomics();
    return () => {
      active = false;
    };
  }, [brandId]);

  function updateProduct<K extends keyof ProductInputs>(key: K, value: ProductInputs[K]) {
    setProducts((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  function updateService<K extends keyof ServiceInputs>(key: K, value: ServiceInputs[K]) {
    setServices((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  function updateSeasonal<K extends keyof SeasonalCampaignInputs>(key: K, value: SeasonalCampaignInputs[K]) {
    setSeasonal((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  async function saveEconomics() {
    setSaveState("loading");
    setSaveMessage("");

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaveState("error");
      setSaveMessage("Vuelve a iniciar sesión para guardar la calculadora.");
      return;
    }

    const usesSeasonal = mode === "seasonal";
    const usesServices = mode === "services" || (mode === "plan" && planGoal === "messages");
    const activeResult = usesServices ? serviceResult : productResult;
    const activeTicket = usesSeasonal ? seasonal.seasonalTicket : usesServices ? services.price : products.ticket;
    const activeMargin = usesSeasonal && activeTicket > 0
      ? (seasonalResult.marginGrossPerSale / activeTicket) * 100
      : usesServices ? services.targetNetMargin : products.targetNetMargin;

    const { error } = await supabase.from("brand_economics").upsert({
      brand_id: brandId,
      owner_id: user.id,
      ticket: activeTicket,
      variable_cost: usesSeasonal ? seasonal.variableCosts + seasonal.discountPerSale : activeResult.variableCost,
      contribution: usesSeasonal ? seasonalResult.marginGrossPerSale : activeResult.contribution,
      contribution_margin: usesSeasonal && activeTicket > 0 ? seasonalResult.marginGrossPerSale / activeTicket : activeResult.contributionMargin,
      target_net_margin: activeMargin,
      target_cpa: usesSeasonal ? seasonalResult.targetCpa : activeResult.targetCpa,
      break_even_roas: usesSeasonal && seasonalResult.marginGrossPerSale > 0 ? activeTicket / seasonalResult.marginGrossPerSale : activeResult.breakEvenRoas,
      target_roas: usesSeasonal && seasonalResult.targetCpa > 0 ? activeTicket / seasonalResult.targetCpa : activeResult.targetRoas,
      max_cpl: usesSeasonal ? 0 : activeResult.maxCpl,
      assumptions: {
        calculatorVersion: 3,
        mode,
        products,
        services,
        seasonal,
        plan: { goal: planGoal, quantity: planQuantity },
      },
    });

    if (error) {
      setSaveState("error");
      setSaveMessage(error.message);
      return;
    }

    const now = new Date().toISOString();
    setSavedAt(now);
    setSaveState("saved");
    setSaveMessage("Listo. Análisis Meta ya puede usar estos límites.");
  }

  const savedDateLabel = savedAt
    ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(new Date(savedAt))
    : null;

  const productProfitable = productResult.projectedProfit >= 0;
  const serviceProfitable = serviceResult.projectedProfit >= 0;

  return (
    <section className="calculator-card deep-calculator cost-calculator">
      <div className="calculator-intro cost-calculator-intro">
        <div>
          <span className="eyebrow">Campaña de temporada</span>
          <h2>Calcula tu campaña con métricas comunes, sin tecnicismos.</h2>
          <p>Completa la meta, el ticket, el presupuesto, los costos y la utilidad mínima. La plataforma calcula el CPA seguro y el presupuesto necesario.</p>
        </div>
        {savedDateLabel && (
          <span className="saved-economics-badge">
            <CheckCircle2 size={15} /> Números guardados el {savedDateLabel}
          </span>
        )}
      </div>

      {MODE_OPTIONS.length > 1 && (
        <div className="calculator-mode-grid" role="group" aria-label="Forma de vender">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = mode === option.id;
            return (
              <button
                type="button"
                className={selected ? "selected" : ""}
                aria-pressed={selected}
                key={option.id}
                onClick={() => {
                  setMode(option.id);
                  setSaveState("idle");
                }}
              >
                <span className="mode-icon"><Icon size={23} /></span>
                <small>{option.eyebrow}</small>
                <b>{option.title}</b>
                <p>{option.description}</p>
                <i>{selected ? "Elegido" : "Elegir"}</i>
              </button>
            );
          })}
        </div>
      )}

      {mode === "products" && (
        <div className="calculator-mode-content">
          <div className="calculator-mode-heading">
            <span>Productos · e-commerce</span>
            <h3>¿Cuánto deja realmente cada compra?</h3>
            <p>Primero restamos lo que cuesta vender una unidad. Después calculamos cuánto puedes invertir para conseguir la venta.</p>
          </div>

          <div className="calc-sections cost-input-sections">
            <fieldset>
              <legend>Lo que cobras y lo que te cuesta vender</legend>
              <div className="calc-grid cost-field-grid">
                <NumberField label="Ticket promedio" value={products.ticket} onChange={(value) => updateProduct("ticket", value)} prefix="$" help="Ej. una compra promedio de $2,500 MXN." min={1} />
                <NumberField label="Costo del producto" value={products.productCost} onChange={(value) => updateProduct("productCost", value)} prefix="$" help="Lo que pagas por fabricar o comprar una unidad." />
                <NumberField label="Envío" value={products.shipping} onChange={(value) => updateProduct("shipping", value)} prefix="$" help="Lo que absorbe tu marca por cada pedido." />
                <NumberField label="Comisiones y fees" value={products.fees} onChange={(value) => updateProduct("fees", value)} prefix="$" help="Pasarela, marketplace o comisión por venta." />
              </div>
              <ExtraCostsEditor items={products.extras} onChange={(value) => updateProduct("extras", value)} />
            </fieldset>

            <fieldset>
              <legend>Tu meta y los datos de publicidad</legend>
              <div className="calc-grid cost-field-grid">
                <NumberField label="Margen neto deseado" value={products.targetNetMargin} onChange={(value) => updateProduct("targetNetMargin", value)} suffix="%" help="Ej. conservar 20% después de publicidad." max={100} />
                <NumberField label="Conversión de la tienda" value={products.storeConversion} onChange={(value) => updateProduct("storeConversion", value)} suffix="%" help="De cada 100 visitas, cuántas terminan comprando." max={100} step={0.1} />
                <NumberField label="Gasto diario" value={products.dailyBudget} onChange={(value) => updateProduct("dailyBudget", value)} prefix="$" help="Lo que planeas invertir por día." />
                <NumberField label="CPM esperado" value={products.cpm} onChange={(value) => updateProduct("cpm", value)} prefix="$" help="Costo aproximado por mil impresiones en Meta." min={0.01} step={0.1} />
                <NumberField label="CTR esperado" value={products.ctr} onChange={(value) => updateProduct("ctr", value)} suffix="%" help="De cada 100 personas, cuántas hacen clic." max={100} step={0.1} />
              </div>
            </fieldset>
          </div>

          {productResult.rawContribution <= 0 && <MarginWarning />}

          <div className="cost-results-section">
            <div className="cost-section-label">
              <span>La lectura simple</span>
              <h3>Tus números límite</h3>
            </div>
            <div className="calc-results cost-result-grid">
              <ResultCard label="Margen de contribución" value={money.format(productResult.contribution)} explanation={`Te queda ${(productResult.contributionMargin * 100).toFixed(1)}% antes de pagar publicidad.`} />
              <ResultCard label="CPA break even" value={money.format(productResult.breakEvenCpa)} explanation="Si pagas más que esto por una venta, empiezas a perder dinero." />
              <ResultCard featured label="CPA objetivo" value={money.format(productResult.targetCpa)} explanation={`Este es tu límite para conservar ${products.targetNetMargin}% de margen.`} />
              <ResultCard label="ROAS break even" value={`${productResult.breakEvenRoas.toFixed(2)}x`} explanation="Es el retorno mínimo para no perder con esta oferta." />
              <ResultCard label="ROAS objetivo" value={`${productResult.targetRoas.toFixed(2)}x`} explanation="Por arriba de este número, tu campaña respeta el margen deseado." />
            </div>
          </div>

          <ProjectionFlow
            title={`${money.format(productResult.monthlySpend)} de inversión al mes`}
            items={[
              { label: "Impresiones", value: number.format(Math.round(productResult.impressions)) },
              { label: "Clics", value: number.format(Math.round(productResult.clicks)) },
              { label: "Ventas", value: number.format(productResult.sales) },
              { label: "Ingresos", value: money.format(productResult.revenue) },
              { label: "Utilidad", value: money.format(productResult.projectedProfit) },
            ]}
          />

          <div className={`calculator-signal ${productProfitable ? "positive" : "warning"}`}>
            <CheckCircle2 size={21} />
            <div>
              <b>{productProfitable ? "Estos supuestos dan negocio." : "Con estos supuestos todavía no da negocio."}</b>
              <p>{productProfitable
                ? "La proyección conserva utilidad después de producto y publicidad. Valida con poco presupuesto antes de escalar."
                : products.storeConversion < 2
                  ? `Con una conversión de ${products.storeConversion}%, conviene mejorar la tienda antes de subir presupuesto.`
                  : "La variable que más conviene revisar es el precio, los costos o el costo por venta."}</p>
            </div>
          </div>
        </div>
      )}

      {mode === "services" && (
        <div className="calculator-mode-content">
          <div className="calculator-mode-heading">
            <span>Servicios · mensajes y citas</span>
            <h3>¿Cuánto puede costarte iniciar una conversación?</h3>
            <p>Traducimos tu proceso comercial a mensajes, citas y clientas. Aquí no necesitas pensar como una tienda en línea.</p>
          </div>

          <div className="calc-sections cost-input-sections">
            <fieldset>
              <legend>Tu servicio y el costo de entregarlo</legend>
              <div className="calc-grid cost-field-grid">
                <NumberField label="Precio de tu servicio o paquete" value={services.price} onChange={(value) => updateService("price", value)} prefix="$" help="Ej. asesoría de $2,500 MXN." min={1} />
                <NumberField label="Costo de entregarlo" value={services.deliveryCost} onChange={(value) => updateService("deliveryCost", value)} prefix="$" help="Insumos, plataforma, traslados o ayudante." />
                <NumberField label="Margen deseado" value={services.targetNetMargin} onChange={(value) => updateService("targetNetMargin", value)} suffix="%" help="Lo que quieres conservar después de conseguir a la clienta." max={100} />
                <NumberField label="Clientas que quieres al mes" value={services.desiredClients} onChange={(value) => updateService("desiredClients", value)} help="Usaremos esta meta para decirte cuántos mensajes necesitas." min={1} />
              </div>
              <ExtraCostsEditor items={services.extras} onChange={(value) => updateService("extras", value)} />
            </fieldset>

            <fieldset>
              <legend>Cómo conviertes conversaciones en clientas</legend>
              <div className="calc-grid cost-field-grid">
                <NumberField label="De cada 10 mensajes, ¿cuántos agendan?" value={services.appointmentRatePerTen} onChange={(value) => updateService("appointmentRatePerTen", value)} suffix="de 10" help="Ej. si seis personas agendan, escribe 6." max={10} step={0.1} />
                <NumberField label="De cada 10 citas, ¿cuántas compran?" value={services.closeRatePerTen} onChange={(value) => updateService("closeRatePerTen", value)} suffix="de 10" help="Ej. si tres se vuelven clientas, escribe 3." max={10} step={0.1} />
                <NumberField label="Gasto diario" value={services.dailyBudget} onChange={(value) => updateService("dailyBudget", value)} prefix="$" help="Lo que planeas invertir cada día para recibir mensajes." />
                <NumberField label="CPM esperado" value={services.cpm} onChange={(value) => updateService("cpm", value)} prefix="$" help="Costo aproximado por mil impresiones en Meta." min={0.01} step={0.1} />
                <NumberField label="CTR esperado" value={services.ctr} onChange={(value) => updateService("ctr", value)} suffix="%" help="En campañas a mensajes, úsalo como porcentaje que inicia la conversación." max={100} step={0.1} />
              </div>
            </fieldset>
          </div>

          {serviceResult.rawContribution <= 0 && <MarginWarning />}

          <div className="cost-results-section">
            <div className="cost-section-label">
              <span>La lectura simple</span>
              <h3>Lo máximo que puedes pagar</h3>
            </div>
            <div className="calc-results cost-result-grid service-results">
              <ResultCard featured label="Por mensaje" value={money.format(serviceResult.maxCpl)} explanation="Si pagas más que esto por mensaje, el proceso completo deja de ser rentable." />
              <ResultCard label="Por cita agendada" value={money.format(serviceResult.maxAppointmentCost)} explanation="Es tu límite por cada persona que sí agenda contigo." />
              <ResultCard label="Por nueva clienta" value={money.format(serviceResult.targetCpa)} explanation={`Este costo conserva el ${services.targetNetMargin}% de margen que elegiste.`} />
              <ResultCard label={`Mensajes para ${number.format(services.desiredClients)} clientas`} value={number.format(Math.ceil(serviceResult.messagesForGoal))} explanation="Es la cantidad aproximada de conversaciones que necesitas con tu cierre actual." />
            </div>
          </div>

          <ProjectionFlow
            title={`${money.format(serviceResult.monthlySpend)} de inversión al mes`}
            items={[
              { label: "Mensajes", value: number.format(Math.round(serviceResult.messages)) },
              { label: "Citas", value: number.format(serviceResult.appointments) },
              { label: "Clientas", value: number.format(serviceResult.clients) },
              { label: "Ingresos", value: money.format(serviceResult.revenue) },
              { label: "Utilidad", value: money.format(serviceResult.projectedProfit) },
            ]}
          />

          <div className={`calculator-signal ${serviceProfitable ? "positive" : "warning"}`}>
            <CalendarCheck2 size={21} />
            <div>
              <b>{serviceProfitable ? "Estos supuestos dan negocio." : "Con estos supuestos todavía no da negocio."}</b>
              <p>{serviceProfitable
                ? `Tu proceso convierte cerca de ${number.format(serviceResult.clients)} clientas al mes con el presupuesto indicado.`
                : services.closeRatePerTen < 2
                  ? `Con tu cierre actual de ${services.closeRatePerTen} de cada 10 citas, el problema principal no es el anuncio: conviene mejorar precio u oferta de cierre.`
                  : "Conviene revisar el precio, el costo de entrega o cuántas conversaciones llegan a cita."}</p>
            </div>
          </div>
        </div>
      )}

      {mode === "seasonal" && (
        <div className="calculator-mode-content seasonal-mode-content">
          <div className="calculator-mode-heading">
            <span>Campaña de temporada · día 6</span>
            <h3>Llena los datos como en tu hoja y revisa si el presupuesto alcanza.</h3>
            <p>Ideal para Buen Fin, San Valentín, Hot Sale, lanzamientos o promos donde ya tienes una meta, días activos y descuento definido.</p>
          </div>

          <div className="seasonal-calculator-board">
            <section className="seasonal-input-card">
              <header>
                <span>Datos que tú llenas</span>
                <b>Campaña</b>
              </header>
              <label className="seasonal-text-field">
                Producto o promoción de temporada
                <input
                  value={seasonal.productOrPromo}
                  maxLength={120}
                  onChange={(event) => updateSeasonal("productOrPromo", event.target.value)}
                  placeholder="Ej. Kit San Valentín, descuento 15% por Buen Fin"
                />
              </label>
              <div className="calc-grid cost-field-grid seasonal-field-grid">
                <NumberField label="Meta total de facturación" value={seasonal.revenueGoal} onChange={(value) => updateSeasonal("revenueGoal", value)} prefix="$" help="Cuánto quieres vender en toda la campaña." min={1} />
                <NumberField label="Duración de la campaña" value={seasonal.durationDays} onChange={(value) => updateSeasonal("durationDays", value)} suffix="días" help="Cuántos días reales estará activa." min={1} />
                <NumberField label="Presupuesto disponible" value={seasonal.availableBudget} onChange={(value) => updateSeasonal("availableBudget", value)} prefix="$" help="Lo que sí estás dispuesta a invertir." />
                <NumberField label="Descuento por venta" value={seasonal.discountPerSale} onChange={(value) => updateSeasonal("discountPerSale", value)} prefix="$" help="Si no hay descuento, pon 0." />
                <NumberField label="Ticket promedio de temporada" value={seasonal.seasonalTicket} onChange={(value) => updateSeasonal("seasonalTicket", value)} prefix="$" help="Precio real considerando descuento o promoción." min={1} />
                <NumberField label="Costos variables adicionales" value={seasonal.variableCosts} onChange={(value) => updateSeasonal("variableCosts", value)} prefix="$" help="Empaque, regalo, costo extra de producción." />
                <NumberField label="Utilidad mínima por venta" value={seasonal.minimumProfitPerSale} onChange={(value) => updateSeasonal("minimumProfitPerSale", value)} prefix="$" help="Lo que quieres que quede después de ads y costos." />
                <NumberField label="Aportación a costos fijos" value={seasonal.fixedCostContributionPerSale} onChange={(value) => updateSeasonal("fixedCostContributionPerSale", value)} prefix="$" help="Porción por venta para cubrir operación fija." />
              </div>
            </section>

            <section className="seasonal-results-card">
              <header>
                <span>Resultados automáticos</span>
                <b>Lectura financiera</b>
              </header>
              <div className="seasonal-result-table">
                {[
                  ["Margen bruto de temporada por venta", money.format(seasonalResult.marginGrossPerSale), "Ticket de temporada - descuento - costos variables"],
                  ["Aportación a costos fijos por venta", money.format(seasonalResult.fixedCostContributionPerSale), "El monto que decidiste reservar por venta"],
                  ["CPA objetivo seguro de temporada", money.format(seasonalResult.targetCpa), "Margen bruto - aportación CF - utilidad mínima"],
                  ["Ventas necesarias totales", number.format(Math.ceil(seasonalResult.requiredSalesTotal)), "Meta total ÷ ticket promedio de temporada"],
                  ["Ventas necesarias por día", number.format(seasonalResult.requiredSalesPerDay), "Ventas necesarias totales ÷ días de campaña"],
                  ["Presupuesto total necesario", money.format(seasonalResult.requiredBudgetTotal), "Ventas necesarias × CPA objetivo seguro"],
                  ["Presupuesto diario necesario", money.format(seasonalResult.requiredBudgetDaily), "Presupuesto total necesario ÷ días de campaña"],
                  ["Utilidad estimada con presupuesto disponible", money.format(seasonalResult.estimatedProfit), "Ventas posibles × margen bruto - presupuesto"],
                ].map(([label, value, formula]) => (
                  <article key={label}>
                    <b>{label}</b>
                    <strong>{value}</strong>
                    <small>{formula}</small>
                  </article>
                ))}
              </div>
              <div className={`calculator-signal ${seasonalResult.budgetCoverage >= 0.6 ? "positive" : "warning"}`}>
                <CalendarCheck2 size={21} />
                <div>
                  <b>Diagnóstico de temporada</b>
                  <p>{seasonalResult.diagnosis}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {mode === "plan" && (
        <div className="calculator-mode-content plan-mode-content">
          <div className="calculator-mode-heading">
            <span>Planear al revés</span>
            <h3>Empieza por la meta, no por el presupuesto.</h3>
            <p>Tomamos los números que ya llenaste en productos o servicios y calculamos cuánto necesitarías invertir.</p>
          </div>

          <div className="plan-goal-panel">
            <div className="plan-goal-choice">
              <span>¿Qué quieres lograr este mes?</span>
              <div role="group" aria-label="Tipo de meta">
                <button type="button" className={planGoal === "sales" ? "selected" : ""} aria-pressed={planGoal === "sales"} onClick={() => setPlanGoal("sales")}>Ventas</button>
                <button type="button" className={planGoal === "messages" ? "selected" : ""} aria-pressed={planGoal === "messages"} onClick={() => setPlanGoal("messages")}>Mensajes o leads</button>
              </div>
            </div>
            <NumberField
              label={planGoal === "sales" ? "Cantidad de ventas" : "Cantidad de mensajes o leads"}
              value={planQuantity}
              onChange={setPlanQuantity}
              help={planGoal === "sales" ? "Ej. conseguir 20 ventas este mes." : "Ej. recibir 100 conversaciones este mes."}
              min={1}
            />
          </div>

          <fieldset className="plan-assumptions">
            <legend>Números que usaremos</legend>
            {planGoal === "sales" ? (
              <div className="calc-grid cost-field-grid">
                <NumberField label="Ticket promedio" value={products.ticket} onChange={(value) => updateProduct("ticket", value)} prefix="$" help="Lo que factura cada venta promedio." min={1} />
                <NumberField label="Conversión de la tienda" value={products.storeConversion} onChange={(value) => updateProduct("storeConversion", value)} suffix="%" help="Cuántas visitas terminan comprando." max={100} step={0.1} />
                <NumberField label="CPM esperado" value={products.cpm} onChange={(value) => updateProduct("cpm", value)} prefix="$" help="Costo por mil impresiones." min={0.01} step={0.1} />
                <NumberField label="CTR esperado" value={products.ctr} onChange={(value) => updateProduct("ctr", value)} suffix="%" help="Porcentaje que hace clic." max={100} step={0.1} />
              </div>
            ) : (
              <div className="calc-grid cost-field-grid">
                <NumberField label="Precio de tu servicio" value={services.price} onChange={(value) => updateService("price", value)} prefix="$" help="Lo que paga una nueva clienta." min={1} />
                <NumberField label="De 10 mensajes, cuántos agendan" value={services.appointmentRatePerTen} onChange={(value) => updateService("appointmentRatePerTen", value)} suffix="de 10" help="Tu conversión de conversación a cita." max={10} step={0.1} />
                <NumberField label="CPM esperado" value={services.cpm} onChange={(value) => updateService("cpm", value)} prefix="$" help="Costo por mil impresiones." min={0.01} step={0.1} />
                <NumberField label="CTR esperado" value={services.ctr} onChange={(value) => updateService("ctr", value)} suffix="%" help="Porcentaje que inicia una conversación." max={100} step={0.1} />
              </div>
            )}
          </fieldset>

          <div className="plan-result-hero">
            <div>
              <span>Presupuesto diario necesario</span>
              <b>{money.format(planResult.dailyBudget)}</b>
              <p>Es el ritmo de inversión para alcanzar la meta en 30 días con estos supuestos.</p>
            </div>
            <div>
              <span>Presupuesto mensual</span>
              <b>{money.format(planResult.monthlyBudget)}</b>
              <p>Para conseguir {number.format(planQuantity)} {planGoal === "sales" ? "ventas" : "mensajes o leads"}.</p>
            </div>
            <div>
              <span>Costo por resultado esperado</span>
              <b>{money.format(planResult.expectedCostPerResult)}</b>
              <p>{planGoal === "sales" ? "Costo estimado por cada venta." : "Costo estimado por cada conversación."}</p>
            </div>
          </div>

          <div className={`calculator-signal ${planResult.isUnrealistic ? "warning" : "positive"}`}>
            <Target size={21} />
            <div>
              <b>{planResult.isUnrealistic ? "La meta necesita una prueba más prudente." : "La meta es coherente con tus números."}</b>
              <p>{planResult.isUnrealistic
                ? `Con estos supuestos necesitarías ${money.format(planResult.dailyBudget)} diarios. Considera empezar con la mitad, validar el costo real y ajustar antes de escalar.`
                : `El costo esperado está dentro de tu límite de ${money.format(planResult.affordableCostPerResult)} por resultado. Aun así, empieza con una validación corta.`}</p>
            </div>
          </div>
        </div>
      )}

      <div className="calculator-save cost-calculator-save">
        <div>
          <b>Guarda esta realidad para que toda la plataforma la entienda.</b>
          <span>Análisis Meta usará automáticamente tu costo máximo por resultado.</span>
        </div>
        <button type="button" onClick={saveEconomics} disabled={saveState === "loading"}>
          {saveState === "loading" ? <Loader2 className="spin" size={16} /> : saveState === "saved" ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saveState === "loading" ? "Guardando..." : `Guardar los números de ${brandName}`}
        </button>
        {saveMessage && <span className={`calculator-save-message ${saveState}`}>{saveMessage}</span>}
      </div>
    </section>
  );
}
