import assert from "node:assert/strict";
import {
  buildMetaDashboardHtml,
  parseStructuredJson,
  prepareMetaReport,
  type MetaAgentAnalysis,
} from "../src/lib/meta-ads";

const prepared = prepareMetaReport([
  {
    "Nombre del anuncio": "UGC ganador",
    "Nombre de la campaña": "Mensajes julio",
    "Indicador de resultado": "messaging_conversation_started",
    "Importe gastado (MXN)": "20.00",
    Resultados: "2",
    Impresiones: "400",
    Alcance: "300",
    "Clics en el enlace": "4",
    Moneda: "MXN",
    "Inicio del informe": "2026-07-01",
    "Fin del informe": "2026-07-07",
  },
  {
    "Nombre del anuncio": "UGC ganador",
    "Nombre de la campaña": "Mensajes julio",
    "Indicador de resultado": "messaging_conversation_started",
    "Importe gastado (MXN)": "10.00",
    Resultados: "1",
    Impresiones: "200",
    Alcance: "180",
    "Clics en el enlace": "2",
    Moneda: "MXN",
    "Inicio del informe": "2026-07-01",
    "Fin del informe": "2026-07-07",
  },
  {
    "Nombre del anuncio": "Hook sin respuesta",
    "Nombre de la campaña": "Mensajes julio",
    "Indicador de resultado": "messaging_conversation_started",
    "Importe gastado (MXN)": "30.00",
    Resultados: "0",
    Impresiones: "50",
    Alcance: "45",
    "Clics en el enlace": "0",
    Moneda: "MXN",
    "Inicio del informe": "2026-07-01",
    "Fin del informe": "2026-07-07",
  },
]);

assert.equal(prepared.campaignType, "WhatsApp / Mensajes");
assert.equal(prepared.sourceRows, 3);
assert.equal(prepared.consolidatedCreatives, 2);
assert.equal(prepared.totals.spend, 60);
assert.equal(prepared.totals.results, 3);
assert.equal(prepared.creatives[0].name, "UGC ganador");
assert.equal(prepared.creatives[0].rowsMerged, 2);
assert.equal(prepared.creatives[0].costPerResult, 10);
assert.equal(prepared.creatives[0].decision, "GANADOR");
assert.equal(
  prepared.creatives.find((item) => item.name === "Hook sin respuesta")
    ?.decision,
  "APAGAR",
);
assert.equal(
  prepared.creatives.find((item) => item.name === "Hook sin respuesta")
    ?.dataStatus,
  "sin datos suficientes",
);

assert.deepEqual(parseStructuredJson('```json\n{"ok":true}\n```'), {
  ok: true,
});

const analysis: MetaAgentAnalysis = {
  client: "Cliente QA",
  campaign_type: prepared.campaignType,
  primary_kpi: prepared.primaryKpi,
  currency: prepared.currency,
  period: prepared.period,
  express_summary: {
    key_sentence: "UGC ganador produjo conversaciones a buen costo.",
    what_worked: ["El ganador concentró los resultados."],
    what_failed: ["Un hook gastó sin generar conversaciones."],
    next_week: ["Escalar ganador", "Apagar perdedor", "Crear variaciones"],
  },
  executive_summary: "La campaña tiene un ganador claro.",
  ranking: [],
  top_3: [
    {
      name: "UGC ganador",
      why: "Costo sano.",
      metrics: "3 conversaciones a MXN 10.",
      next_action: "Escalar gradualmente.",
    },
  ],
  turn_off: [
    {
      name: "Hook sin respuesta",
      reason: "Sin resultados.",
      evidence: "MXN 30 gastados.",
    },
  ],
  patterns: ["El concepto UGC funciona mejor."],
  creative_hypotheses: [
    {
      hypothesis: "El hook del ganador detiene mejor el scroll.",
      evidence: "Más clics y resultados.",
      confidence: "Media",
    },
  ],
  funnel: {
    summary: "El embudo llega a conversaciones.",
    missing_measurement: "Falta medir conversación a venta.",
    steps: [
      { name: "Impresiones", value: "650", rate_to_next: "0.9% a clic" },
      { name: "Conversaciones", value: "3", rate_to_next: "Venta no medida" },
    ],
  },
  fatigue: [
    {
      name: "UGC ganador",
      frequency: "1.25",
      verdict: "Sin fatiga",
      action: "Vigilar al escalar.",
    },
  ],
  algorithm_learning: ["Meta favorece el anuncio con resultados."],
  recommendations: {
    high: ["Concentrar presupuesto."],
    medium: ["Crear variaciones."],
    low: ["Mejorar nombres."],
  },
  required_answers: Array.from(
    { length: 8 },
    (_, index) => `Respuesta ${index + 1}`,
  ),
  playbook: ["Replicar el concepto ganador sin editar el original."],
  data_quality: ["La venta final no está en el export."],
};

const html = buildMetaDashboardHtml(analysis, prepared);
assert.match(html, /^<!doctype html>/);
assert.match(html, /Resumen exprés/);
assert.match(html, /Ranking por MPS/);
assert.match(html, /Las 8 respuestas obligatorias/);
assert.match(html, /Playbook de creativos/);
assert.doesNotMatch(html, /<script/i);

console.log("Meta Ads preparation, decisions and HTML dashboard: OK");
