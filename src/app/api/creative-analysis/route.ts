import { NextRequest, NextResponse } from "next/server";
import { CREATIVE_DISSECTION_PROMPT } from "@/lib/ai/prompts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CreativeAnalysisInput = {
  assetId: string;
  frames?: Array<string | { image: string; timestamp: number }>;
};

type VideoTranscript = {
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
  warning?: string;
};

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "La plataforma aun no esta configurada." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para analizar creativos." }, { status: 401 });
  }

  const body = (await request.json()) as CreativeAnalysisInput;

  if (!body.assetId) {
    return NextResponse.json({ error: "Falta el creativo a analizar." }, { status: 400 });
  }

  const { data: asset, error: assetError } = await supabase
    .from("creative_assets")
    .select("id,brand_id,owner_id,asset_type,storage_path,file_name,mime_type")
    .eq("id", body.assetId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (assetError || !asset) {
    return NextResponse.json({ error: "No encontre ese creativo en tu cuenta." }, { status: 404 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id,name,website,category,audience,offer,voice,content_owner,creative_goal,strategic_context")
    .eq("id", asset.brand_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "No encontre la marca del creativo." }, { status: 404 });
  }

  await supabase.from("creative_assets").update({ status: "processing" }).eq("id", asset.id).eq("owner_id", user.id);

  try {
    const imageInputs = await getImageInputs(supabase, asset, body.frames || []);

    if (!imageInputs.length) {
      throw new Error("No pude leer imagenes o frames para analizar este creativo.");
    }

    const { data: recipes } = await supabase
      .from("brand_recipes")
      .select("rule")
      .eq("brand_id", asset.brand_id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12);

    const transcript = asset.asset_type === "video" ? await transcribeVideo(supabase, asset) : null;
    const result = await analyzeWithOpenAI({
      brand,
      asset,
      imageInputs,
      transcript,
      previousRecipes: (recipes || []).map((recipe) => recipe.rule).filter(Boolean),
    });

    await supabase.from("creative_assets").update({ status: "analyzed" }).eq("id", asset.id).eq("owner_id", user.id);

    const { data: savedAnalysis, error: saveError } = await supabase
      .from("creative_analyses")
      .insert({
        brand_id: asset.brand_id,
        owner_id: user.id,
        asset_id: asset.id,
        score: result.score,
        verdict: result.verdict,
        analysis: result,
      })
      .select("id,score,verdict,analysis,created_at")
      .single();

    if (saveError) throw new Error(saveError.message);

    await saveWinningRecipes({
      supabase,
      brandId: asset.brand_id,
      ownerId: user.id,
      analysisId: savedAnalysis.id,
      rules: Array.isArray(result.winning_recipe) ? result.winning_recipe : [],
    });

    return NextResponse.json({ analysis: savedAnalysis });
  } catch (error) {
    await supabase.from("creative_assets").update({ status: "failed" }).eq("id", asset.id).eq("owner_id", user.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo analizar el creativo." },
      { status: 500 },
    );
  }
}

async function transcribeVideo(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  asset: { storage_path: string; file_name: string | null; mime_type: string | null },
): Promise<VideoTranscript> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("La transcripción del video aún no está activa.");

  const { data, error } = await supabase.storage.from("creative-assets").download(asset.storage_path);
  if (error || !data) throw new Error(error?.message || "No pude descargar el video para escucharlo.");

  if (data.size > 24 * 1024 * 1024) {
    return {
      text: "",
      segments: [],
      warning: "El archivo supera 24 MB; el análisis visual continúa, pero el guion no puede transcribirse con precisión.",
    };
  }

  const form = new FormData();
  form.append(
    "file",
    new File([data], asset.file_name || "creativo.mp4", { type: asset.mime_type || data.type || "video/mp4" }),
  );
  form.append("model", "whisper-1");
  form.append("language", "es");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`No pude escuchar el video: ${message.slice(0, 180)}`);
  }

  const json = (await response.json()) as {
    text?: string;
    segments?: Array<{ start?: number; end?: number; text?: string }>;
  };

  return {
    text: json.text?.trim() || "",
    segments: (json.segments || []).map((segment) => ({
      start: Number(segment.start) || 0,
      end: Number(segment.end) || 0,
      text: segment.text?.trim() || "",
    })).filter((segment) => segment.text),
  };
}

async function getImageInputs(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  asset: { asset_type: string; storage_path: string; mime_type: string | null },
  frames: Array<string | { image: string; timestamp: number }>,
) {
  if (frames.length) {
    return frames.slice(0, 12).flatMap((frame, index) => {
      const image = typeof frame === "string" ? frame : frame.image;
      const timestamp = typeof frame === "string" ? null : frame.timestamp;
      return [
        { type: "input_text", text: timestamp === null ? `Frame visual ${index + 1}` : `FRAME VERIFICADO ${index + 1} · ${formatSeconds(timestamp)}` },
        { type: "input_image", image_url: image },
      ];
    });
  }

  if (asset.asset_type !== "image") return [];

  const { data, error } = await supabase.storage.from("creative-assets").download(asset.storage_path);
  if (error || !data) throw new Error(error?.message || "No pude descargar la imagen.");

  const buffer = Buffer.from(await data.arrayBuffer());
  const mimeType = asset.mime_type || data.type || "image/png";
  return [
    {
      type: "input_image",
      image_url: `data:${mimeType};base64,${buffer.toString("base64")}`,
    },
  ];
}

async function analyzeWithOpenAI({
  brand,
  asset,
  imageInputs,
  transcript,
  previousRecipes,
}: {
  brand: Record<string, unknown>;
  asset: { asset_type: string; file_name: string | null };
  imageInputs: Array<{ type: string; image_url?: string; text?: string }>;
  transcript: VideoTranscript | null;
  previousRecipes: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("El analisis IA aun no esta activo.");

  const brandContext = `
MARCA
Nombre: ${brand.name || "No especificado"}
Categoria: ${brand.category || "No especificada"}
Sitio/Instagram: ${brand.website || "No especificado"}
Audiencia: ${brand.audience || "No especificada"}
Oferta: ${brand.offer || "No especificada"}
Voz: ${brand.voice || "No especificada"}
Quien produce contenido: ${brand.content_owner || "No especificado"}
Objetivo creativo: ${brand.creative_goal || "No especificado"}
Brief psicológico y estratégico: ${JSON.stringify(brand.strategic_context || {})}

RECETAS GANADORAS PREVIAS DE ESTA MARCA
${previousRecipes.length ? previousRecipes.map((recipe, index) => `${index + 1}. ${recipe}`).join("\n") : "Aun no hay recetas previas guardadas."}

CREATIVO
Tipo: ${asset.asset_type}
Archivo: ${asset.file_name || "Sin nombre"}
Frames visuales verificados: ${imageInputs.filter((input) => input.type === "input_image").length}

TRANSCRIPCION REAL DEL AUDIO
${transcript?.warning || (transcript?.text ? transcript.text : "No aplica o no hay audio comprobable.")}

SEGMENTOS CON TIEMPOS
${transcript?.segments.length
  ? transcript.segments.map((segment) => `[${formatSeconds(segment.start)}-${formatSeconds(segment.end)}] ${segment.text}`).join("\n")
  : "No hay segmentos con tiempos. No inventes diálogo."}
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1",
      temperature: 0.32,
      max_output_tokens: 12000,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: CREATIVE_DISSECTION_PROMPT }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${brandContext}\n${asset.asset_type === "image" ? "FORMATO ESTÁTICO: evalúa jerarquía, lectura en 2 segundos, producto, copy visible, composición, prueba, deseo y acción. No inventes temporalidad, audio ni guion original; usa un solo momento de evidencia visual y concentra el plan en la siguiente pieza estática." : "FORMATO VIDEO: cada imagen está precedida por su timestamp exacto. Usa los frames como evidencia visual y la transcripción como evidencia verbal. Analiza tanto lo que se ve como lo que se escucha."} No agregues etiquetas de inferencia ni corchetes. Di “No visible en los frames recibidos” únicamente cuando falte evidencia.`,
            },
            ...imageInputs,
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 240));
  }

  const data = await response.json();
  const text = extractResponseText(data);
  const json = parseJson(text);

  return {
    ...normalizeAnalysisShape(json),
    score: clampNumber(json.score, 0, 100),
    verdict: normalizeVerdict(json.verdict, json.score),
  };
}

async function saveWinningRecipes({
  supabase,
  brandId,
  ownerId,
  analysisId,
  rules,
}: {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  brandId: string;
  ownerId: string;
  analysisId: string;
  rules: string[];
}) {
  const cleanRules = rules
    .map((rule) => rule.trim())
    .filter((rule, index, list) => rule.length > 8 && list.indexOf(rule) === index)
    .slice(0, 8);

  if (!cleanRules.length) return;

  await supabase.from("brand_recipes").insert(
    cleanRules.map((rule) => ({
      brand_id: brandId,
      owner_id: ownerId,
      source_analysis_id: analysisId,
      rule,
    })),
  );
}

function normalizeAnalysisShape(json: Record<string, unknown>) {
  const score = clampNumber(json.score, 0, 100);
  const verdict = normalizeVerdict(json.verdict, score);

  return {
    score,
    verdict,
    winning_reason:
      typeof json.winning_reason === "string"
        ? json.winning_reason
        : typeof json.summary === "string"
          ? json.summary
          : "El creativo fue analizado por estructura, psicología, claridad, oferta y potencial de producción.",
    core_diagnosis: isRecord(json.core_diagnosis) ? json.core_diagnosis : {},
    signals: isRecord(json.signals)
      ? json.signals
      : {
          scroll_stop: { level: "Medio", note: "Requiere revisar el primer impacto visual." },
          clarity: { level: "Medio", note: "Requiere reforzar que se vende y para quien." },
          offer: { level: "Medio", note: "Requiere hacer mas concreta la razon para actuar." },
        },
    structural_analysis: isRecord(json.structural_analysis) ? json.structural_analysis : {},
    dashboard: isRecord(json.dashboard) ? json.dashboard : {},
    psychological_analysis: isRecord(json.psychological_analysis) ? json.psychological_analysis : {},
    persuasion_triggers: toArray(json.persuasion_triggers),
    emotional_arc: toArray(json.emotional_arc),
    evidence_timeline: toArray(json.evidence_timeline),
    winning_recipe: toStringArray(json.winning_recipe),
    keep: toStringArray(json.keep),
    test: toStringArray(json.test || json.change || json.produce_next),
    original_script: typeof json.original_script === "string" ? json.original_script : "",
    script_variants: toArray(json.script_variants || json.variants),
    replication_plan: isRecord(json.replication_plan) ? json.replication_plan : {},
    generation_prompts: toArray(json.generation_prompts),
  };
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function extractResponseText(data: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (data.output_text) return data.output_text;
  return (
    data.output
      ?.flatMap((item) => item.content || [])
      .map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

function parseJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La IA no devolvio un diagnostico valido.");
    return JSON.parse(match[0]);
  }
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeVerdict(value: unknown, score: unknown) {
  const numericScore = Number(score);
  if (numericScore >= 90) return "Escalable";
  if (numericScore >= 75) return "Ganador";
  if (numericScore >= 60) return "Potencial";
  if (numericScore >= 40) return "Rescatable";
  return "Débil";
}
