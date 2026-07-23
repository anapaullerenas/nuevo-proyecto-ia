export type MetaRow = Record<string, string | number | null>;

export type CampaignType =
  | "Sitio Web (Compras)"
  | "WhatsApp / Mensajes"
  | "Generación de Leads"
  | "Reconocimiento / Comunidad"
  | "Campaña no identificada";

export type PreparedCreative = {
  name: string;
  campaign: string;
  adSet: string;
  spend: number;
  results: number;
  impressions: number;
  reach: number;
  clicks: number;
  landingViews: number;
  checkouts: number;
  conversionValue: number;
  costPerResult: number | null;
  ctr: number | null;
  frequency: number | null;
  roas: number | null;
  mps: number;
  decision: "GANADOR" | "APAGAR";
  dataStatus: "confiable" | "muestra limitada" | "sin datos suficientes";
  rowsMerged: number;
};

export type PreparedMetaReport = {
  campaignType: CampaignType;
  primaryKpi: string;
  currency: string;
  period: { start: string; end: string; label: string };
  sourceRows: number;
  consolidatedCreatives: number;
  totals: {
    spend: number;
    results: number;
    impressions: number;
    reach: number;
    clicks: number;
    landingViews: number;
    checkouts: number;
    conversionValue: number;
    costPerResult: number | null;
    ctr: number | null;
    frequency: number | null;
    roas: number | null;
  };
  creatives: PreparedCreative[];
  omittedCreatives: number;
  checks: string[];
};

export type MetaAgentAnalysis = {
  client: string;
  campaign_type: CampaignType;
  primary_kpi: string;
  currency: string;
  period: { start: string; end: string; label: string };
  express_summary: {
    key_sentence: string;
    what_worked: string[];
    what_failed: string[];
    next_week: string[];
  };
  executive_summary: string;
  ranking: Array<{
    name: string;
    mps: number;
    decision: "GANADOR" | "APAGAR";
    performance: string;
    spend: string;
    results: string;
    cost_per_result: string;
    ctr: string;
    frequency: string;
    roas: string;
    evidence: string;
  }>;
  top_3: Array<{
    name: string;
    why: string;
    metrics: string;
    next_action: string;
  }>;
  turn_off: Array<{ name: string; reason: string; evidence: string }>;
  patterns: string[];
  creative_hypotheses: Array<{
    hypothesis: string;
    evidence: string;
    confidence: "Alta" | "Media" | "Baja";
  }>;
  funnel: {
    summary: string;
    missing_measurement: string;
    steps: Array<{ name: string; value: string; rate_to_next: string }>;
  };
  fatigue: Array<{
    name: string;
    frequency: string;
    verdict: string;
    action: string;
  }>;
  algorithm_learning: string[];
  recommendations: {
    high: string[];
    medium: string[];
    low: string[];
  };
  required_answers: string[];
  playbook: string[];
  data_quality: string[];
};

type WorkingCreative = Omit<
  PreparedCreative,
  "costPerResult" | "ctr" | "frequency" | "roas" | "mps" | "decision" | "dataStatus"
> & {
  weightedCtr: number;
  weightedRoas: number;
  weightedMetricSpend: number;
  resultIndicators: string[];
};

const ALIASES = {
  name: ["nombre del anuncio", "ad name", "anuncio"],
  campaign: ["nombre de la campana", "campaign name", "campana"],
  adSet: ["nombre del conjunto", "ad set name", "conjunto de anuncios"],
  indicator: ["indicador de resultado", "result indicator", "tipo de resultado"],
  spend: ["importe gastado", "amount spent", "gasto", "inversion"],
  results: ["resultados", "results"],
  impressions: ["impresiones", "impressions"],
  reach: ["alcance", "reach"],
  clicks: ["clics en el enlace", "link clicks", "clics", "clicks"],
  landingViews: ["visitas a la pagina de destino", "landing page views"],
  checkouts: ["pagos iniciados", "checkouts initiated", "initiated checkout"],
  conversionValue: ["valor de resultados", "conversion value", "purchase conversion value"],
  ctr: ["ctr (porcentaje de clics en el enlace)", "link ctr", "ctr"],
  roas: ["roas de resultados", "purchase roas", "roas"],
  start: ["inicio del informe", "reporting starts", "fecha de inicio"],
  end: ["fin del informe", "reporting ends", "fecha de finalizacion"],
  currency: ["moneda", "currency"],
} as const;

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function valueFor(row: MetaRow, aliases: readonly string[]) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const exact = entries.find(([key]) => normalizeKey(key) === alias);
    if (exact) return exact[1];
  }
  for (const alias of aliases) {
    const partial = entries.find(([key]) => normalizeKey(key).includes(alias));
    if (partial) return partial[1];
  }
  return null;
}

function parseMetric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  let clean = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.\-]/g, "");
  if (!clean) return 0;
  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    clean =
      comma > dot
        ? clean.replace(/\./g, "").replace(",", ".")
        : clean.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = clean.length - comma - 1;
    clean = decimals > 0 && decimals <= 2 ? clean.replace(",", ".") : clean.replace(/,/g, "");
  } else if ((clean.match(/\./g) || []).length > 1) {
    clean = clean.replace(/\./g, "");
  }
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseDate(value: unknown) {
  const text = textValue(value);
  if (!text) return "";
  const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function campaignFrom(indicators: string, hasRoas: boolean): CampaignType {
  const normalized = normalizeKey(indicators);
  if (
    hasRoas ||
    /purchase|compra|pixel|conversion value|valor de conversion/.test(normalized)
  )
    return "Sitio Web (Compras)";
  if (/lead|cliente potencial/.test(normalized)) return "Generación de Leads";
  if (/messag|mensaje|conversation|conversacion|whatsapp/.test(normalized))
    return "WhatsApp / Mensajes";
  if (/follow|seguidor|interaccion|engagement|reach|alcance/.test(normalized))
    return "Reconocimiento / Comunidad";
  return "Campaña no identificada";
}

function primaryKpi(campaign: CampaignType) {
  if (campaign === "Sitio Web (Compras)") return "ROAS y costo por compra";
  if (campaign === "WhatsApp / Mensajes") return "Costo por conversación";
  if (campaign === "Generación de Leads") return "Costo por lead";
  if (campaign === "Reconocimiento / Comunidad")
    return "Costo por interacción o seguidor";
  return "Costo por resultado";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function ctrScore(ctr: number | null, reliable: boolean, campaign: CampaignType) {
  if (ctr === null || !reliable) return 50;
  if (campaign === "WhatsApp / Mensajes") {
    if (ctr >= 1.2) return 100;
    if (ctr >= 0.7) return 85;
    if (ctr >= 0.4) return 68;
    if (ctr >= 0.2) return 42;
    return 15;
  }
  if (ctr >= 3) return 100;
  if (ctr >= 2) return 90;
  if (ctr >= 1) return 70;
  if (ctr >= 0.5) return 40;
  return 15;
}

function cprScore(
  cpr: number | null,
  globalCpr: number | null,
  campaign: CampaignType,
) {
  if (cpr === null) return 0;
  if (campaign === "WhatsApp / Mensajes") {
    if (cpr <= 25) return 100;
    if (cpr <= 40) return 75;
    if (cpr <= 60) return 40;
    return 12;
  }
  if (campaign === "Sitio Web (Compras)" && globalCpr) {
    if (cpr <= globalCpr * 0.8) return 100;
    if (cpr <= globalCpr) return 82;
    if (cpr <= globalCpr * 1.5) return 55;
    return 18;
  }
  if (cpr <= 20) return 100;
  if (cpr <= 60) return 72;
  if (cpr <= 100) return 38;
  return 12;
}

function roasScore(roas: number | null) {
  if (roas === null) return 0;
  if (roas >= 10) return 100;
  if (roas >= 3) return 85;
  if (roas >= 1) return 60;
  return clamp(roas * 45);
}

function frequencyScore(frequency: number | null) {
  if (frequency === null) return 50;
  if (frequency < 2) return 100;
  if (frequency <= 2.5) return 90;
  if (frequency <= 3) return 65;
  if (frequency <= 4) return 35;
  return 15;
}

function calculateMps(
  creative: Omit<PreparedCreative, "mps" | "decision" | "dataStatus">,
  totals: PreparedMetaReport["totals"],
  campaign: CampaignType,
  maxima: { results: number; checkouts: number; spend: number },
) {
  const hasRoas = creative.roas !== null;
  const hasCheckouts = maxima.checkouts > 0;
  const weights = [
    { value: cprScore(creative.costPerResult, totals.costPerResult, campaign), weight: 30 },
    {
      value: ctrScore(creative.ctr, creative.impressions >= 200, campaign),
      weight: 20,
    },
    {
      value: maxima.results
        ? Math.sqrt(creative.results / maxima.results) * 100
        : 0,
      weight: 15,
    },
    ...(hasRoas ? [{ value: roasScore(creative.roas), weight: 15 }] : []),
    ...(hasCheckouts
      ? [
          {
            value: Math.sqrt(creative.checkouts / maxima.checkouts) * 100,
            weight: 10,
          },
        ]
      : []),
    { value: frequencyScore(creative.frequency), weight: 5 },
    {
      value:
        creative.results <= 0 && creative.spend > 0
          ? 5
          : maxima.spend
            ? 35 + Math.sqrt(creative.spend / maxima.spend) * 65
            : 0,
      weight: 5,
    },
  ];
  const availableWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  return Math.round(
    weights.reduce((sum, item) => sum + clamp(item.value) * item.weight, 0) /
      availableWeight,
  );
}

function decide(
  creative: Omit<PreparedCreative, "mps" | "decision" | "dataStatus">,
  campaign: CampaignType,
  globalCpr: number | null,
) {
  if (creative.results <= 0) return "APAGAR" as const;
  if (campaign === "Sitio Web (Compras)") {
    if (creative.roas !== null) return creative.roas >= 1 ? "GANADOR" : "APAGAR";
    return creative.costPerResult !== null &&
      (!globalCpr || creative.costPerResult <= globalCpr * 1.25)
      ? "GANADOR"
      : "APAGAR";
  }
  if (campaign === "WhatsApp / Mensajes")
    return creative.costPerResult !== null && creative.costPerResult <= 40
      ? "GANADOR"
      : "APAGAR";
  if (creative.costPerResult === null) return "APAGAR";
  return !globalCpr || creative.costPerResult <= globalCpr * 1.25
    ? "GANADOR"
    : "APAGAR";
}

export function prepareMetaReport(rows: MetaRow[]): PreparedMetaReport {
  const grouped = new Map<string, WorkingCreative>();
  const datesStart: string[] = [];
  const datesEnd: string[] = [];
  const currencies = new Map<string, number>();

  rows.forEach((row, index) => {
    const name =
      textValue(valueFor(row, ALIASES.name)) || `Anuncio sin nombre ${index + 1}`;
    const key = normalizeKey(name);
    const spend = parseMetric(valueFor(row, ALIASES.spend));
    const impressions = parseMetric(valueFor(row, ALIASES.impressions));
    const ctr = parseMetric(valueFor(row, ALIASES.ctr));
    const roas = parseMetric(valueFor(row, ALIASES.roas));
    const indicator = textValue(valueFor(row, ALIASES.indicator));
    const start = parseDate(valueFor(row, ALIASES.start));
    const end = parseDate(valueFor(row, ALIASES.end));
    const currency = textValue(valueFor(row, ALIASES.currency)).toUpperCase();
    if (start) datesStart.push(start);
    if (end) datesEnd.push(end);
    if (currency) currencies.set(currency, (currencies.get(currency) || 0) + 1);

    const existing = grouped.get(key) || {
      name,
      campaign: textValue(valueFor(row, ALIASES.campaign)),
      adSet: textValue(valueFor(row, ALIASES.adSet)),
      spend: 0,
      results: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      landingViews: 0,
      checkouts: 0,
      conversionValue: 0,
      weightedCtr: 0,
      weightedRoas: 0,
      weightedMetricSpend: 0,
      resultIndicators: [],
      rowsMerged: 0,
    };
    existing.spend += spend;
    existing.results += parseMetric(valueFor(row, ALIASES.results));
    existing.impressions += impressions;
    existing.reach += parseMetric(valueFor(row, ALIASES.reach));
    existing.clicks += parseMetric(valueFor(row, ALIASES.clicks));
    existing.landingViews += parseMetric(valueFor(row, ALIASES.landingViews));
    existing.checkouts += parseMetric(valueFor(row, ALIASES.checkouts));
    existing.conversionValue += parseMetric(valueFor(row, ALIASES.conversionValue));
    existing.weightedCtr += ctr * impressions;
    existing.weightedRoas += roas * spend;
    existing.weightedMetricSpend += spend;
    if (indicator) existing.resultIndicators.push(indicator);
    existing.rowsMerged += 1;
    grouped.set(key, existing);
  });

  const indicators = [...grouped.values()]
    .flatMap((item) => item.resultIndicators)
    .join(" ");
  const hasRoas = [...grouped.values()].some(
    (item) => item.conversionValue > 0 || item.weightedRoas > 0,
  );
  const campaignType = campaignFrom(indicators, hasRoas);
  const base = [...grouped.values()].map((item) => {
    const costPerResult = item.results > 0 ? item.spend / item.results : null;
    const ctr =
      item.impressions > 0
        ? item.clicks > 0
          ? (item.clicks / item.impressions) * 100
          : item.weightedCtr / item.impressions
        : null;
    const frequency = item.reach > 0 ? item.impressions / item.reach : null;
    const roas =
      item.spend > 0
        ? item.conversionValue > 0
          ? item.conversionValue / item.spend
          : item.weightedRoas / Math.max(item.weightedMetricSpend, 1)
        : null;
    return {
      name: item.name,
      campaign: item.campaign,
      adSet: item.adSet,
      spend: item.spend,
      results: item.results,
      impressions: item.impressions,
      reach: item.reach,
      clicks: item.clicks,
      landingViews: item.landingViews,
      checkouts: item.checkouts,
      conversionValue: item.conversionValue,
      costPerResult,
      ctr: ctr && Number.isFinite(ctr) ? ctr : null,
      frequency: frequency && Number.isFinite(frequency) ? frequency : null,
      roas: roas && Number.isFinite(roas) ? roas : null,
      rowsMerged: item.rowsMerged,
    };
  });

  const totals = base.reduce(
    (sum, item) => ({
      spend: sum.spend + item.spend,
      results: sum.results + item.results,
      impressions: sum.impressions + item.impressions,
      reach: sum.reach + item.reach,
      clicks: sum.clicks + item.clicks,
      landingViews: sum.landingViews + item.landingViews,
      checkouts: sum.checkouts + item.checkouts,
      conversionValue: sum.conversionValue + item.conversionValue,
      costPerResult: null,
      ctr: null,
      frequency: null,
      roas: null,
    }),
    {
      spend: 0,
      results: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      landingViews: 0,
      checkouts: 0,
      conversionValue: 0,
      costPerResult: null as number | null,
      ctr: null as number | null,
      frequency: null as number | null,
      roas: null as number | null,
    },
  );
  totals.costPerResult = totals.results > 0 ? totals.spend / totals.results : null;
  totals.ctr =
    totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null;
  totals.frequency =
    totals.reach > 0 ? totals.impressions / totals.reach : null;
  totals.roas =
    totals.spend > 0 && totals.conversionValue > 0
      ? totals.conversionValue / totals.spend
      : null;

  const maxima = {
    results: Math.max(0, ...base.map((item) => item.results)),
    checkouts: Math.max(0, ...base.map((item) => item.checkouts)),
    spend: Math.max(0, ...base.map((item) => item.spend)),
  };
  const creatives = base
    .map((item) => {
      const mps = calculateMps(item, totals, campaignType, maxima);
      const decision = decide(item, campaignType, totals.costPerResult);
      const dataStatus =
        item.impressions < 80 && item.results <= 0
          ? "sin datos suficientes"
          : item.impressions < 200 || item.results <= 1
            ? "muestra limitada"
            : "confiable";
      return { ...item, mps, decision, dataStatus } satisfies PreparedCreative;
    })
    .sort(
      (a, b) =>
        b.mps - a.mps ||
        b.results - a.results ||
        b.spend - a.spend ||
        a.name.localeCompare(b.name),
    );

  const notableSpend = Math.max(totals.spend * 0.01, 1);
  const relevant = creatives.filter(
    (item) =>
      item.results > 0 ||
      item.spend >= notableSpend ||
      item.impressions >= 300,
  );
  const compact = (relevant.length ? relevant : creatives).slice(0, 30);
  const mergedRows = creatives.reduce(
    (sum, item) => sum + Math.max(0, item.rowsMerged - 1),
    0,
  );
  const currency =
    [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "MXN";
  const start = datesStart.sort()[0] || "";
  const end = datesEnd.sort().at(-1) || "";
  const periodLabel =
    start && end ? `${start} a ${end}` : "Período del export";

  return {
    campaignType,
    primaryKpi: primaryKpi(campaignType),
    currency,
    period: { start, end, label: periodLabel },
    sourceRows: rows.length,
    consolidatedCreatives: creatives.length,
    totals,
    creatives: compact,
    omittedCreatives: Math.max(0, creatives.length - compact.length),
    checks: [
      `${rows.length} filas cargadas y ${creatives.length} creativos consolidados.`,
      mergedRows
        ? `${mergedRows} filas duplicadas se integraron por nombre de anuncio.`
        : "No se detectaron duplicados por nombre de anuncio.",
      "CTR marcado como muestra limitada debajo de 200 impresiones.",
      "CPR y ROAS tratados como muestra limitada con 0–1 resultados.",
      "Totales, tasas y promedios ponderados recalculados desde los datos base.",
    ],
  };
}

export function parseStructuredJson(content: unknown) {
  if (content && typeof content === "object") return content;
  if (typeof content !== "string") throw new Error("La IA no devolvió datos estructurados.");
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start)
      return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    throw new Error("La respuesta estructurada quedó incompleta.");
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function list(items: string[], empty = "Sin hallazgos adicionales") {
  const values = items.length ? items : [empty];
  return `<ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function money(value: number | null, currency: string) {
  if (value === null) return "No disponible";
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function number(value: number | null, digits = 1) {
  return value === null
    ? "No disponible"
    : new Intl.NumberFormat("es-MX", {
        maximumFractionDigits: digits,
      }).format(value);
}

export function buildMetaDashboardHtml(
  analysis: MetaAgentAnalysis,
  prepared: PreparedMetaReport,
) {
  const ranking = analysis.ranking.length
    ? analysis.ranking
    : prepared.creatives.map((item) => ({
        name: item.name,
        mps: item.mps,
        decision: item.decision,
        performance: item.dataStatus,
        spend: money(item.spend, prepared.currency),
        results: number(item.results, 0),
        cost_per_result: money(item.costPerResult, prepared.currency),
        ctr: item.ctr === null ? "No disponible" : `${number(item.ctr)}%`,
        frequency:
          item.frequency === null ? "No disponible" : number(item.frequency, 2),
        roas: item.roas === null ? "No disponible" : `${number(item.roas, 2)}x`,
        evidence: "Cálculo verificado desde el export.",
      }));
  const champion = ranking[0]?.name || "Sin ganador confirmado";
  const resultLabel =
    analysis.campaign_type === "WhatsApp / Mensajes"
      ? "Conversaciones"
      : analysis.campaign_type === "Sitio Web (Compras)"
        ? "Compras"
        : "Resultados";
  const cards = [
    ["Inversión", money(prepared.totals.spend, prepared.currency)],
    [resultLabel, number(prepared.totals.results, 0)],
    ["Costo por resultado", money(prepared.totals.costPerResult, prepared.currency)],
    ["Campeón", champion],
  ];
  const recommendations = [
    ["Impacto alto", analysis.recommendations.high, "high"],
    ["Impacto medio", analysis.recommendations.medium, "medium"],
    ["Impacto bajo", analysis.recommendations.low, "low"],
  ];
  const questions = [
    "¿Cuál fue el mejor anuncio y por qué?",
    "¿Cuál fue el peor anuncio y por qué?",
    "¿Qué tres aprendizajes dejan los anuncios ganadores?",
    "¿Qué errores se repiten en los anuncios perdedores?",
    "¿Qué anuncios apagarías?",
    "¿Qué anuncios escalarías y cómo?",
    "¿Qué hipótesis tienes del contenido de los creativos?",
    "Si fueras el Director de Performance, ¿cuáles serían tus 3 prioridades para la próxima semana?",
  ];

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard Meta Ads · ${escapeHtml(analysis.client)}</title>
<style>
:root{--bg:#0f1117;--surface:#1a1d27;--surface2:#22263a;--line:#2e3350;--text:#e2e8f0;--muted:#94a3b8;--green:#10b981;--red:#ef4444;--amber:#f59e0b;--blue:#4f6ef7;--purple:#7c3aed;--gold:#fbbf24}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{width:min(1180px,calc(100% - 28px));margin:0 auto;padding:34px 0 54px}h1,h2,h3,p{margin-top:0}h1{margin-bottom:8px;font-size:clamp(30px,5vw,58px);line-height:1.02}h2{margin:0 0 16px;font-size:clamp(23px,3vw,34px)}h3{margin-bottom:10px}.muted{color:var(--muted)}.badges,.grid,.two,.three,.priority{display:grid;gap:14px}.badges{display:flex;flex-wrap:wrap;margin:20px 0 0}.badge{border:1px solid var(--line);border-radius:999px;padding:7px 11px;background:var(--surface);color:var(--muted);font-size:12px;font-weight:800}.express{margin-top:26px;border:1px solid #454aa0;border-radius:22px;padding:clamp(20px,4vw,38px);background:linear-gradient(135deg,rgba(79,110,247,.22),rgba(124,58,237,.2) 55%,rgba(26,29,39,.95))}.lead{max-width:880px;font-size:clamp(20px,3vw,31px);line-height:1.25;font-weight:850}.grid{grid-template-columns:repeat(4,minmax(0,1fr));margin:22px 0}.card,.panel{border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:18px}.card small{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.card b{display:block;margin-top:8px;font-size:clamp(20px,3vw,30px);line-height:1.1;word-break:break-word}.two{grid-template-columns:1fr 1fr}.good{border-color:rgba(16,185,129,.45)}.bad{border-color:rgba(239,68,68,.45)}ul{margin:0;padding-left:20px}li+li{margin-top:8px}.next{margin-top:14px;border-color:rgba(251,191,36,.5)}.next ol{margin:0;padding-left:24px}.divider{margin:45px 0;text-align:center;color:var(--muted)}.divider:before,.divider:after{content:"";display:inline-block;width:min(18vw,180px);height:1px;margin:0 14px;vertical-align:middle;background:var(--line)}.section{margin-top:44px}.kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:16px}.ranking{width:100%;border-collapse:collapse;min-width:1000px;background:var(--surface)}th,td{padding:13px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;background:var(--surface2)}tr:last-child td{border-bottom:0}.decision{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:900}.decision.win{color:#a7f3d0;background:rgba(16,185,129,.16)}.decision.stop{color:#fecaca;background:rgba(239,68,68,.16)}.score{color:var(--gold);font-weight:900}.guide{margin:10px 4px 0;color:var(--muted);font-size:12px}.three{grid-template-columns:repeat(3,minmax(0,1fr))}.panel p:last-child{margin-bottom:0}.panel.stop{border-color:rgba(239,68,68,.38)}.hypothesis{border-color:rgba(124,58,237,.45)}.confidence{color:#c4b5fd;font-size:12px;font-weight:800}.funnel{display:flex;gap:10px;align-items:stretch;overflow:auto}.funnel .panel{min-width:175px;flex:1}.arrow{align-self:center;color:var(--blue);font-size:24px}.priority{grid-template-columns:repeat(3,minmax(0,1fr))}.priority .high{border-color:rgba(239,68,68,.45)}.priority .medium{border-color:rgba(245,158,11,.45)}.priority .low{border-color:rgba(79,110,247,.45)}.qa{margin-top:28px;color:var(--muted);font-size:12px}.footer{margin-top:48px;border-top:1px solid var(--line);padding-top:20px;color:var(--muted);font-size:12px}
@media(max-width:820px){.grid,.kpis,.three,.priority{grid-template-columns:1fr 1fr}.two{grid-template-columns:1fr}.funnel{display:grid;grid-template-columns:1fr}.arrow{display:none}}
@media(max-width:520px){.page{width:min(100% - 18px,1180px);padding-top:20px}.grid,.kpis,.three,.priority{grid-template-columns:1fr}.express{padding:18px}.divider:before,.divider:after{width:34px;margin:0 7px}}
</style>
</head>
<body><main class="page">
<header>
  <p class="muted">Dashboard Ejecutivo · Meta Ads</p>
  <h1>${escapeHtml(analysis.client)}</h1>
  <p class="muted">${escapeHtml(analysis.period.label)} · ${prepared.consolidatedCreatives} anuncios consolidados</p>
  <div class="badges"><span class="badge">${escapeHtml(analysis.campaign_type)}</span><span class="badge">KPI: ${escapeHtml(analysis.primary_kpi)}</span><span class="badge">${escapeHtml(prepared.currency)}</span></div>
</header>
<section class="express">
  <h2>⚡ Resumen exprés</h2>
  <p class="lead">${escapeHtml(analysis.express_summary.key_sentence)}</p>
  <div class="grid">${cards.map(([label, value]) => `<article class="card"><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></article>`).join("")}</div>
  <div class="two"><article class="panel good"><h3>✅ Qué funcionó</h3>${list(analysis.express_summary.what_worked)}</article><article class="panel bad"><h3>🚫 Qué NO funcionó</h3>${list(analysis.express_summary.what_failed)}</article></div>
  <article class="panel next"><h3>🎯 Qué hacemos la próxima semana</h3><ol>${analysis.express_summary.next_week.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></article>
</section>
<div class="divider">👇 ¿Quieres profundizar?</div>
<section class="section"><h2>1. Resumen ejecutivo</h2><article class="panel"><p>${escapeHtml(analysis.executive_summary)}</p></article><div class="grid kpis">${cards.map(([label, value]) => `<article class="card"><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></article>`).join("")}</div></section>
<section class="section"><h2>2. Ranking por MPS</h2><div class="table-wrap"><table class="ranking"><thead><tr><th>Anuncio</th><th>MPS</th><th>¿Cómo le fue?</th><th>Inversión</th><th>Resultados</th><th>Costo</th><th>Clics %</th><th>Frecuencia</th><th>ROAS</th><th>Acción</th></tr></thead><tbody>${ranking.map((item) => `<tr><td><b>${escapeHtml(item.name)}</b><br><small class="muted">${escapeHtml(item.evidence)}</small></td><td class="score">${escapeHtml(item.mps)}/100</td><td>${escapeHtml(item.performance)}</td><td>${escapeHtml(item.spend)}</td><td>${escapeHtml(item.results)}</td><td>${escapeHtml(item.cost_per_result)}</td><td>${escapeHtml(item.ctr)}</td><td>${escapeHtml(item.frequency)}</td><td>${escapeHtml(item.roas)}</td><td><span class="decision ${item.decision === "GANADOR" ? "win" : "stop"}">${item.decision === "GANADOR" ? "🏆" : "🚫"} ${escapeHtml(item.decision)}</span></td></tr>`).join("")}${prepared.omittedCreatives ? `<tr><td colspan="10">+${prepared.omittedCreatives} anuncios de bajo volumen resumidos fuera de la tabla para eliminar ruido.</td></tr>` : ""}</tbody></table></div><p class="guide"><b>Cómo leerla:</b> MPS ordena el desempeño general sobre 100; la decisión final siempre es binaria. “Clics %” mide atención y “frecuencia” cuántas veces vio el anuncio la misma persona.</p></section>
<section class="section"><h2>3. Top 3 mejores anuncios</h2><div class="three">${analysis.top_3.slice(0, 3).map((item, index) => `<article class="panel"><h3>${index === 0 ? "🏆" : "⭐"} ${escapeHtml(item.name)}</h3><p>${escapeHtml(item.why)}</p><p class="muted">${escapeHtml(item.metrics)}</p><p><b>Siguiente acción:</b> ${escapeHtml(item.next_action)}</p></article>`).join("")}</div></section>
<section class="section"><h2>4. Anuncios recomendados para apagar</h2><div class="three">${analysis.turn_off.map((item) => `<article class="panel stop"><h3>🚫 ${escapeHtml(item.name)}</h3><p>${escapeHtml(item.reason)}</p><p class="muted">${escapeHtml(item.evidence)}</p></article>`).join("") || '<article class="panel">No hay anuncios con evidencia suficiente para apagar.</article>'}</div></section>
<section class="section"><h2>5. Patrones encontrados</h2><article class="panel">${list(analysis.patterns)}</article></section>
<section class="section"><h2>6. Insights de creativos</h2><div class="three">${analysis.creative_hypotheses.map((item) => `<article class="panel hypothesis"><h3>Hipótesis</h3><p>${escapeHtml(item.hypothesis)}</p><p class="muted">${escapeHtml(item.evidence)}</p><span class="confidence">Confianza ${escapeHtml(item.confidence)}</span></article>`).join("")}</div></section>
<section class="section"><h2>7. Análisis del embudo</h2><p>${escapeHtml(analysis.funnel.summary)}</p><div class="funnel">${analysis.funnel.steps.map((item, index) => `${index ? '<span class="arrow">→</span>' : ""}<article class="panel"><small class="muted">${escapeHtml(item.name)}</small><h3>${escapeHtml(item.value)}</h3><p>${escapeHtml(item.rate_to_next)}</p></article>`).join("")}</div>${analysis.funnel.missing_measurement ? `<p class="guide"><b>Medición faltante:</b> ${escapeHtml(analysis.funnel.missing_measurement)}</p>` : ""}</section>
<section class="section"><h2>8. Detección de fatiga</h2><div class="three">${analysis.fatigue.map((item) => `<article class="panel"><h3>${escapeHtml(item.name)}</h3><p><b>Frecuencia:</b> ${escapeHtml(item.frequency)}</p><p>${escapeHtml(item.verdict)}</p><p class="muted">${escapeHtml(item.action)}</p></article>`).join("")}</div></section>
<section class="section"><h2>9. Qué está aprendiendo el algoritmo</h2><article class="panel">${list(analysis.algorithm_learning)}</article></section>
<section class="section"><h2>10. Recomendaciones priorizadas</h2><div class="priority">${recommendations.map(([label, items, tone]) => `<article class="panel ${tone}"><h3>${escapeHtml(label)}</h3>${list(items as string[])}</article>`).join("")}</div></section>
<section class="section"><h2>Las 8 respuestas obligatorias</h2><div class="two">${questions.map((question, index) => `<article class="panel"><h3>${index + 1}. ${escapeHtml(question)}</h3><p>${escapeHtml(analysis.required_answers[index] || "No hay datos suficientes para responder con certeza.")}</p></article>`).join("")}</div></section>
<section class="section"><h2>Playbook de creativos</h2><article class="panel">${list(analysis.playbook)}</article></section>
<aside class="qa"><b>Calidad y límites de datos:</b> ${escapeHtml([...prepared.checks, ...analysis.data_quality].join(" · "))}</aside>
<footer class="footer">AnaPau iA · Fuente: export de Meta Ads · ${escapeHtml(analysis.period.label)} · ${escapeHtml(analysis.client)} · ${escapeHtml(analysis.campaign_type)}</footer>
</main></body></html>`;
}
