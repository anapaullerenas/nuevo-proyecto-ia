import { NextRequest, NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  chargeCredits,
  CREDIT_COSTS,
  creditErrorStatus,
  refundCredits,
} from "@/lib/credits";
import { estimateCostUsd } from "@/lib/ai/provider-pricing";
import {
  buildMetaDashboardHtml,
  parseStructuredJson,
  prepareMetaReport,
  type MetaAgentAnalysis,
  type MetaRow,
  type PreparedMetaReport,
} from "@/lib/meta-ads";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return NextResponse.json(
      { error: "La plataforma aún no está configurada." },
      { status: 500 },
    );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Inicia sesión para analizar Meta." },
      { status: 401 },
    );

  const body = (await request.json()) as { importId?: string };
  if (!body.importId)
    return NextResponse.json(
      { error: "Falta el archivo a analizar." },
      { status: 400 },
    );

  const { data: metaImport } = await supabase
    .from("meta_imports")
    .select("id,brand_id,file_name,summary")
    .eq("id", body.importId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!metaImport)
    return NextResponse.json(
      { error: "No encontré ese export en tu cuenta." },
      { status: 404 },
    );

  const storagePath =
    typeof metaImport.summary?.storage_path === "string"
      ? metaImport.summary.storage_path
      : "";
  if (!storagePath)
    return NextResponse.json(
      { error: "El export no tiene un archivo asociado." },
      { status: 400 },
    );

  await supabase
    .from("meta_imports")
    .update({ status: "processing" })
    .eq("id", metaImport.id)
    .eq("owner_id", user.id);

  let creditCharge;
  try {
    creditCharge = await chargeCredits({
      userId: user.id,
      amount: CREDIT_COSTS.meta_analysis,
      reason: "meta_analysis",
      brandId: metaImport.brand_id,
      provider: "openai",
      model: "gpt-4.1-mini",
      inputTokens: 9000,
      outputTokens: 6500,
      costUsd: estimateCostUsd({
        provider: "openai",
        model: "gpt-4.1-mini",
        inputTokens: 9000,
        outputTokens: 6500,
      }),
      route: "analysis",
    });
  } catch (error) {
    await supabase
      .from("meta_imports")
      .update({ status: "uploaded" })
      .eq("id", metaImport.id)
      .eq("owner_id", user.id);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos validar tus créditos.",
      },
      { status: creditErrorStatus(error) },
    );
  }

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from("meta-imports")
      .download(storagePath);
    if (downloadError || !file)
      throw new Error(downloadError?.message || "No pude descargar el export.");
    if (file.size > 20 * 1024 * 1024)
      throw new Error(
        "El export supera 20 MB. Reduce el rango de fechas y vuelve a exportarlo.",
      );

    const rows = await parseRows(
      Buffer.from(await file.arrayBuffer()),
      metaImport.file_name || "export.csv",
    );
    if (rows.length < 1)
      throw new Error("No encontré filas de anuncios en el archivo.");

    const { data: brand } = await supabase
      .from("brands")
      .select("name,category,audience,offer,creative_goal")
      .eq("id", metaImport.brand_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    const prepared = prepareMetaReport(rows);
    const summary = await analyzeMetaRows(prepared, brand || {});
    const dashboardHtml = buildMetaDashboardHtml(summary, prepared);
    const completedSummary = {
      ...summary,
      dashboard_html: dashboardHtml,
      storage_path: storagePath,
      rows_analyzed: rows.length,
      consolidated_creatives: prepared.consolidatedCreatives,
      preparation_checks: prepared.checks,
    };

    const { error: updateError } = await supabase
      .from("meta_imports")
      .update({ status: "completed", summary: completedSummary })
      .eq("id", metaImport.id)
      .eq("owner_id", user.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ analysis: completedSummary });
  } catch (error) {
    if (creditCharge.charged)
      await refundCredits(
        user.id,
        creditCharge.amount,
        "meta_analysis",
        metaImport.brand_id,
        creditCharge.operationId,
      );
    console.error("meta analysis failed", error);
    await supabase
      .from("meta_imports")
      .update({ status: "failed" })
      .eq("id", metaImport.id)
      .eq("owner_id", user.id);
    return NextResponse.json(
      {
        error:
          "No pudimos terminar el análisis del archivo. Tus créditos fueron devueltos; verifica el formato e intenta nuevamente.",
      },
      { status: 500 },
    );
  }
}

async function parseRows(buffer: Buffer, fileName: string): Promise<MetaRow[]> {
  if (/\.xlsx?$/i.test(fileName)) {
    const sheet = await readSheet(buffer);
    if (sheet.length < 2) return [];
    const headers = sheet[0].map((cell, index) =>
      String(cell || `columna_${index + 1}`).trim(),
    );
    return sheet
      .slice(1, 501)
      .map((row) =>
        Object.fromEntries(
          headers.map((header, index) => [header, normalizeCell(row[index])]),
        ),
      ) as MetaRow[];
  }

  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const matrix = parseCsv(text).slice(0, 501);
  if (matrix.length < 2) return [];
  const headers = matrix[0].map(
    (cell, index) => cell.trim() || `columna_${index + 1}`,
  );
  return matrix
    .slice(1)
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, normalizeCell(row[index])]),
      ),
    ) as MetaRow[];
}

function parseCsv(text: string) {
  const delimiter =
    text.split("\n", 1)[0].split(";").length >
    text.split("\n", 1)[0].split(",").length
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeCell(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return null;
  return String(value).trim();
}

async function analyzeMetaRows(
  prepared: PreparedMetaReport,
  brand: Record<string, unknown>,
): Promise<MetaAgentAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("El análisis IA aún no está activo.");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      client: { type: "string" },
      campaign_type: {
        type: "string",
        enum: [
          "Sitio Web (Compras)",
          "WhatsApp / Mensajes",
          "Generación de Leads",
          "Reconocimiento / Comunidad",
          "Campaña no identificada",
        ],
      },
      primary_kpi: { type: "string" },
      currency: { type: "string" },
      period: {
        type: "object",
        additionalProperties: false,
        properties: {
          start: { type: "string" },
          end: { type: "string" },
          label: { type: "string" },
        },
        required: ["start", "end", "label"],
      },
      express_summary: {
        type: "object",
        additionalProperties: false,
        properties: {
          key_sentence: { type: "string" },
          what_worked: { type: "array", items: { type: "string" } },
          what_failed: { type: "array", items: { type: "string" } },
          next_week: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: { type: "string" },
          },
        },
        required: ["key_sentence", "what_worked", "what_failed", "next_week"],
      },
      executive_summary: { type: "string" },
      ranking: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            mps: { type: "number", minimum: 0, maximum: 100 },
            decision: { type: "string", enum: ["GANADOR", "APAGAR"] },
            performance: { type: "string" },
            spend: { type: "string" },
            results: { type: "string" },
            cost_per_result: { type: "string" },
            ctr: { type: "string" },
            frequency: { type: "string" },
            roas: { type: "string" },
            evidence: { type: "string" },
          },
          required: [
            "name",
            "mps",
            "decision",
            "performance",
            "spend",
            "results",
            "cost_per_result",
            "ctr",
            "frequency",
            "roas",
            "evidence",
          ],
        },
      },
      top_3: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            why: { type: "string" },
            metrics: { type: "string" },
            next_action: { type: "string" },
          },
          required: ["name", "why", "metrics", "next_action"],
        },
      },
      turn_off: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            reason: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["name", "reason", "evidence"],
        },
      },
      patterns: { type: "array", items: { type: "string" } },
      creative_hypotheses: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            hypothesis: { type: "string" },
            evidence: { type: "string" },
            confidence: { type: "string", enum: ["Alta", "Media", "Baja"] },
          },
          required: ["hypothesis", "evidence", "confidence"],
        },
      },
      funnel: {
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string" },
          missing_measurement: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                value: { type: "string" },
                rate_to_next: { type: "string" },
              },
              required: ["name", "value", "rate_to_next"],
            },
          },
        },
        required: ["summary", "missing_measurement", "steps"],
      },
      fatigue: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            frequency: { type: "string" },
            verdict: { type: "string" },
            action: { type: "string" },
          },
          required: ["name", "frequency", "verdict", "action"],
        },
      },
      algorithm_learning: { type: "array", items: { type: "string" } },
      recommendations: {
        type: "object",
        additionalProperties: false,
        properties: {
          high: { type: "array", items: { type: "string" } },
          medium: { type: "array", items: { type: "string" } },
          low: { type: "array", items: { type: "string" } },
        },
        required: ["high", "medium", "low"],
      },
      required_answers: {
        type: "array",
        minItems: 8,
        maxItems: 8,
        items: { type: "string" },
      },
      playbook: { type: "array", items: { type: "string" } },
      data_quality: { type: "array", items: { type: "string" } },
    },
    required: [
      "client",
      "campaign_type",
      "primary_kpi",
      "currency",
      "period",
      "express_summary",
      "executive_summary",
      "ranking",
      "top_3",
      "turn_off",
      "patterns",
      "creative_hypotheses",
      "funnel",
      "fatigue",
      "algorithm_learning",
      "recommendations",
      "required_answers",
      "playbook",
      "data_quality",
    ],
  };

  const systemPrompt = `Actúa como el Agente Analista de Meta Ads definido por el Documento Maestro de AnaPau iA. Aplica la metodología completa sin repetirla ni explicarla.

OBJETIVO
Convierte el reporte en decisiones inequívocas sobre qué escalar, qué apagar y qué producir después. Interpreta como Media Buyer Senior; no te limites a describir métricas.

PROCESO YA EJECUTADO POR EL SERVIDOR
- El servidor detectó el tipo de campaña, consolidó duplicados por nombre, recalculó totales y tasas ponderadas, aplicó el filtro anti-ruido y calculó el MPS 0–100.
- Conserva exactamente campaign_type, primary_kpi, currency, period, mps y decision recibidos. No vuelvas a inventar ni modificar esos cálculos.
- La acción comunicada es SIEMPRE binaria: GANADOR o APAGAR. El matiz vive en performance y evidence.

CRITERIOS
- Compras web: prioriza ROAS y costo por compra. ROAS <1 pierde dinero; >3 es sólido; >10 con volumen permite escalamiento agresivo.
- WhatsApp/Mensajes: prioriza costo por conversación. ≤25 MXN sano, 25–40 aceptable, >40 caro. Un CTR al enlace de 0.4–0.7% puede ser normal.
- Leads: prioriza costo por lead. Reconocimiento: costo por interacción/seguidor.
- No concluyas por CTR con menos de 200–300 impresiones ni por CPR/ROAS con 0–1 resultados. Distingue falta de datos de fracaso.
- Fatiga: frecuencia <2 saludable, 2–3 normal, >3 probable; sólo afirma deterioro si los datos lo respaldan.
- El algoritmo vota con el presupuesto: interpreta concentración, descarte rápido, dispersión y volumen de señal.
- Las inferencias sobre hook, edición, mensaje, dolor, oferta o destino son HIPÓTESIS y deben identificarse como tales.
- Si falta el cierre final de WhatsApp o cualquier paso del embudo, señálalo como medición faltante. Nunca inventes.

ENTREGA MODO 1
Produce todo lo necesario para un Dashboard Ejecutivo completo: resumen exprés, exactamente 3 acciones de la próxima semana, resumen a fondo, ranking MPS, top 3, apagar, patrones, hipótesis, embudo, fatiga, aprendizaje del algoritmo, recomendaciones por impacto, las 8 respuestas obligatorias y playbook.

COMUNICACIÓN
Usa español simple, directo y accionable. Traduce jerga: costo por venta/conversación, regreso por cada $1, clics %, cuántas veces lo vio la misma persona. Cada conclusión debe citar evidencia real. No uses inseguridad corporal ni promesas médicas.`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Cliente y contexto de marca: ${JSON.stringify(brand)}
Reporte preparado y verificado por el servidor: ${JSON.stringify(prepared)}

Genera el análisis completo. Si algún dato no existe, escribe "No disponible". Respeta exactamente los cálculos y decisiones del reporte preparado.`,
    },
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini",
        temperature: 0.2,
        max_tokens: 7000,
        response_format: {
          type: "json_schema",
          json_schema: { name: "meta_creative_analysis", strict: true, schema },
        },
        messages:
          attempt === 0
            ? messages
            : [
                ...messages,
                {
                  role: "user",
                  content:
                    "Genera de nuevo el análisis completo respetando estrictamente el esquema. La respuesta anterior no pudo procesarse.",
                },
              ],
      }),
    });

    if (!response.ok) {
      console.error(
        "meta-analysis OpenAI error",
        response.status,
        (await response.text()).slice(0, 500),
      );
      if (attempt === 0) continue;
      throw new Error(
        "No pude terminar el análisis en este momento. El export quedó guardado; intenta de nuevo en unos minutos.",
      );
    }

    const responseText = await response.text();
    let data: {
      choices?: Array<{
        message?: { content?: string | Record<string, unknown>; refusal?: string };
      }>;
    };
    try {
      data = JSON.parse(responseText) as typeof data;
    } catch {
      console.error(
        "meta-analysis provider returned non-JSON",
        response.status,
        responseText.slice(0, 300),
      );
      if (attempt === 0) continue;
      throw new Error("El proveedor devolvió una respuesta incompleta.");
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error(
        "meta-analysis empty structured output",
        data.choices?.[0]?.message,
      );
      if (attempt === 0) continue;
      throw new Error(
        "No pude completar la lectura del archivo. Intenta analizarlo nuevamente.",
      );
    }

    try {
      const parsed = parseStructuredJson(content) as MetaAgentAnalysis;
      return {
        ...parsed,
        client:
          String(parsed.client || brand.name || "Cliente").trim() || "Cliente",
        campaign_type: prepared.campaignType,
        primary_kpi: prepared.primaryKpi,
        currency: prepared.currency,
        period: prepared.period,
        ranking: prepared.creatives.map((creative) => {
          const narrative = parsed.ranking.find(
            (item) =>
              item.name.trim().toLowerCase() ===
              creative.name.trim().toLowerCase(),
          );
          return {
            name: creative.name,
            mps: creative.mps,
            decision: creative.decision,
            performance:
              narrative?.performance ||
              (creative.dataStatus === "confiable"
                ? creative.decision === "GANADOR"
                  ? "Resultado rentable con muestra útil"
                  : "Gasto sin eficiencia suficiente"
                : creative.dataStatus),
            spend:
              narrative?.spend ||
              `${prepared.currency} ${creative.spend.toFixed(2)}`,
            results:
              narrative?.results ||
              new Intl.NumberFormat("es-MX").format(creative.results),
            cost_per_result:
              narrative?.cost_per_result ||
              (creative.costPerResult === null
                ? "No disponible"
                : `${prepared.currency} ${creative.costPerResult.toFixed(2)}`),
            ctr:
              narrative?.ctr ||
              (creative.ctr === null
                ? "No disponible"
                : `${creative.ctr.toFixed(2)}%`),
            frequency:
              narrative?.frequency ||
              (creative.frequency === null
                ? "No disponible"
                : creative.frequency.toFixed(2)),
            roas:
              narrative?.roas ||
              (creative.roas === null
                ? "No disponible"
                : `${creative.roas.toFixed(2)}x`),
            evidence:
              narrative?.evidence ||
              "Cálculo verificado directamente desde el export.",
          };
        }),
      };
    } catch (error) {
      console.error(
        "meta-analysis JSON parse error",
        error,
        String(content).slice(0, 500),
      );
    }
  }

  throw new Error(
    "No pude completar el análisis. El archivo sigue guardado y puedes intentarlo nuevamente.",
  );
}
