import { NextRequest, NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { chargeCredits, CREDIT_COSTS, creditErrorStatus, refundCredits } from "@/lib/credits";
import { estimateCostUsd } from "@/lib/ai/provider-pricing";

export const maxDuration = 120;

type MetaRow = Record<string, string | number | null>;

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "La plataforma aún no está configurada." }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para analizar Meta." }, { status: 401 });

  const body = (await request.json()) as { importId?: string };
  if (!body.importId) return NextResponse.json({ error: "Falta el archivo a analizar." }, { status: 400 });

  const { data: metaImport } = await supabase
    .from("meta_imports")
    .select("id,brand_id,file_name,summary")
    .eq("id", body.importId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!metaImport) return NextResponse.json({ error: "No encontré ese export en tu cuenta." }, { status: 404 });

  const storagePath = typeof metaImport.summary?.storage_path === "string" ? metaImport.summary.storage_path : "";
  if (!storagePath) return NextResponse.json({ error: "El export no tiene un archivo asociado." }, { status: 400 });

  await supabase.from("meta_imports").update({ status: "processing" }).eq("id", metaImport.id).eq("owner_id", user.id);

  let creditCharge;
  try {
    creditCharge = await chargeCredits({ userId: user.id, amount: CREDIT_COSTS.meta_analysis, reason: "meta_analysis", brandId: metaImport.brand_id, provider: "openai", model: "gpt-4.1-mini", inputTokens: 7000, outputTokens: 2500, costUsd: estimateCostUsd({ provider: "openai", model: "gpt-4.1-mini", inputTokens: 7000, outputTokens: 2500 }), route: "analysis" });
  } catch (error) {
    await supabase.from("meta_imports").update({ status: "uploaded" }).eq("id", metaImport.id).eq("owner_id", user.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No pudimos validar tus créditos." }, { status: creditErrorStatus(error) });
  }

  try {
    const { data: file, error: downloadError } = await supabase.storage.from("meta-imports").download(storagePath);
    if (downloadError || !file) throw new Error(downloadError?.message || "No pude descargar el export.");
    if (file.size > 20 * 1024 * 1024) throw new Error("El export supera 20 MB. Reduce el rango de fechas y vuelve a exportarlo.");

    const rows = await parseRows(Buffer.from(await file.arrayBuffer()), metaImport.file_name || "export.csv");
    if (rows.length < 1) throw new Error("No encontré filas de anuncios en el archivo.");

    const { data: brand } = await supabase
      .from("brands")
      .select("name,category,audience,offer,creative_goal")
      .eq("id", metaImport.brand_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    const summary = await analyzeMetaRows(rows, brand || {});
    const completedSummary = { ...summary, storage_path: storagePath, rows_analyzed: rows.length };

    const { error: updateError } = await supabase
      .from("meta_imports")
      .update({ status: "completed", summary: completedSummary })
      .eq("id", metaImport.id)
      .eq("owner_id", user.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ analysis: completedSummary });
  } catch (error) {
    if (creditCharge.charged) await refundCredits(user.id, creditCharge.amount, "meta_analysis", metaImport.brand_id);
    console.error("meta analysis failed", error);
    await supabase.from("meta_imports").update({ status: "failed" }).eq("id", metaImport.id).eq("owner_id", user.id);
    return NextResponse.json({ error: "No pudimos terminar el análisis del archivo. Tus créditos fueron devueltos; verifica el formato e intenta nuevamente." }, { status: 500 });
  }
}

async function parseRows(buffer: Buffer, fileName: string): Promise<MetaRow[]> {
  if (/\.xlsx?$/i.test(fileName)) {
    const sheet = await readSheet(buffer);
    if (sheet.length < 2) return [];
    const headers = sheet[0].map((cell, index) => String(cell || `columna_${index + 1}`).trim());
    return sheet.slice(1, 501).map((row) => Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])]))) as MetaRow[];
  }

  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const matrix = parseCsv(text).slice(0, 501);
  if (matrix.length < 2) return [];
  const headers = matrix[0].map((cell, index) => cell.trim() || `columna_${index + 1}`);
  return matrix.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])]))) as MetaRow[];
}

function parseCsv(text: string) {
  const delimiter = text.split("\n", 1)[0].split(";").length > text.split("\n", 1)[0].split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === delimiter && !quoted) { row.push(cell); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
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

async function analyzeMetaRows(rows: MetaRow[], brand: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("El análisis IA aún no está activo.");

  const compactRows = rows.slice(0, 300).map((row) => {
    const entries = Object.entries(row).filter(([, value]) => value !== null && value !== "").slice(0, 24);
    return Object.fromEntries(entries);
  });

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      period: {
        type: "object",
        additionalProperties: false,
        properties: { start: { type: "string" }, end: { type: "string" }, label: { type: "string" } },
        required: ["start", "end", "label"],
      },
      period_summary: { type: "string" },
      creative_strategy_summary: { type: "string" },
      winning_pattern: { type: "string" },
      next_move: { type: "string" },
      totals: {
        type: "object",
        additionalProperties: false,
        properties: {
          spend: { type: "string" }, results: { type: "string" }, sales: { type: "string" }, roas: { type: "string" }, cpa: { type: "string" },
        },
        required: ["spend", "results", "sales", "roas", "cpa"],
      },
      creative_ranking: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" }, creative_id: { type: "string" }, roas: { type: "string" }, sales: { type: "string" }, spend: { type: "string" },
            verdict: { type: "string", enum: ["winner", "good", "acceptable", "poor"] },
            decision: { type: "string", enum: ["Escalar", "Mantener", "Mejorar", "Iterar", "Pausar"] },
            reason: { type: "string" },
          },
          required: ["name", "creative_id", "roas", "sales", "spend", "verdict", "decision", "reason"],
        },
      },
      winners: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          properties: { name: { type: "string" }, decision: { type: "string" }, reason: { type: "string" }, metrics: { type: "string" } },
          required: ["name", "decision", "reason", "metrics"],
        },
      },
      fatigue: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          properties: { name: { type: "string" }, signal: { type: "string" }, action: { type: "string" } },
          required: ["name", "signal", "action"],
        },
      },
      actions: { type: "array", items: { type: "string" } },
      next_briefs: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          properties: { title: { type: "string" }, angle: { type: "string" }, evidence: { type: "string" } },
          required: ["title", "angle", "evidence"],
        },
      },
      data_quality: { type: "array", items: { type: "string" } },
    },
    required: ["period", "period_summary", "creative_strategy_summary", "winning_pattern", "next_move", "totals", "creative_ranking", "winners", "fatigue", "actions", "next_briefs", "data_quality"],
  };

  const systemPrompt = `Eres directora de estrategia creativa con dominio de Meta Ads. Tu prioridad es explicar qué CREATIVOS funcionan y qué hacer con ellos, no escribir un reporte técnico para media buyers.

REGLAS:
- Usa únicamente datos presentes en el archivo. No inventes ROAS, ventas, gasto ni fechas.
- Ordena creative_ranking del mejor al peor combinando rentabilidad, volumen y muestra.
- winner: retorno y volumen suficientes para escalar; good: rentable y estable; acceptable: señales mixtas o muestra insuficiente; poor: gasta sin recuperar o convierte claramente peor.
- No escales por ROAS con muestra mínima. Una frecuencia alta sólo es fatiga si coincide con deterioro.
- Cada razón debe citar números reales del archivo, pero explicarse en lenguaje simple.
- creative_strategy_summary, winning_pattern y next_move deben ser claros para una dueña de marca, no técnicos.
- Si una métrica no existe, devuelve "No disponible". Si no detectas fecha, usa cadena vacía en start/end y "Periodo del export" en label.
- Máximo 12 creativos en el ranking, 8 winners, 5 señales de fatiga, 5 acciones y 4 briefs.
- No uses lenguaje de inseguridad corporal ni promesas médicas al sugerir próximos creativos.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Marca: ${JSON.stringify(brand)}\nFilas disponibles: ${rows.length}\nDatos: ${JSON.stringify(compactRows)}` },
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini",
        temperature: 0.2,
        max_tokens: 3500,
        response_format: { type: "json_schema", json_schema: { name: "meta_creative_analysis", strict: true, schema } },
        messages: attempt === 0 ? messages : [...messages, { role: "user", content: "Genera de nuevo el análisis completo respetando estrictamente el esquema. La respuesta anterior no pudo procesarse." }],
      }),
    });

    if (!response.ok) {
      console.error("meta-analysis OpenAI error", response.status, (await response.text()).slice(0, 500));
      if (attempt === 0) continue;
      throw new Error("No pude terminar el análisis en este momento. El export quedó guardado; intenta de nuevo en unos minutos.");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("meta-analysis empty structured output", data.choices?.[0]?.message);
      if (attempt === 0) continue;
      throw new Error("No pude completar la lectura del archivo. Intenta analizarlo nuevamente.");
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      console.error("meta-analysis JSON parse error", error, content.slice(0, 500));
    }
  }

  throw new Error("No pude completar el análisis. El archivo sigue guardado y puedes intentarlo nuevamente.");
}
