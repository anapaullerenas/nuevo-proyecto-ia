import { NextRequest, NextResponse } from "next/server";
import { CREATIVE_DISSECTION_PROMPT } from "@/lib/ai/prompts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CreativeAnalysisInput = {
  assetId: string;
  frames?: string[];
};

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "La plataforma aun no esta configurada." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesion para analizar creativos." }, { status: 401 });
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
    .select("id,name,website,category,audience,offer,voice,content_owner,creative_goal")
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

    const result = await analyzeWithOpenAI({
      brand,
      asset,
      imageInputs,
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

async function getImageInputs(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  asset: { asset_type: string; storage_path: string; mime_type: string | null },
  frames: string[],
) {
  if (frames.length) {
    return frames.slice(0, 8).map((frame) => ({
      type: "input_image",
      image_url: frame,
    }));
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
  previousRecipes,
}: {
  brand: Record<string, string | null>;
  asset: { asset_type: string; file_name: string | null };
  imageInputs: Array<{ type: string; image_url: string }>;
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

RECETAS GANADORAS PREVIAS DE ESTA MARCA
${previousRecipes.length ? previousRecipes.map((recipe, index) => `${index + 1}. ${recipe}`).join("\n") : "Aun no hay recetas previas guardadas."}

CREATIVO
Tipo: ${asset.asset_type}
Archivo: ${asset.file_name || "Sin nombre"}
Frames recibidos: ${imageInputs.length}
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
      max_output_tokens: 6000,
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
              text: `${brandContext}\nAnaliza este creativo con el esquema JSON obligatorio. Si es video, trata los frames como momentos secuenciales del anuncio.`,
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
          : "El creativo fue analizado por estructura, psicologia, claridad, oferta y potencial de produccion.",
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
    winning_recipe: toStringArray(json.winning_recipe),
    keep: toStringArray(json.keep),
    test: toStringArray(json.test || json.change || json.produce_next),
    original_script: typeof json.original_script === "string" ? json.original_script : "",
    script_variants: toArray(json.script_variants || json.variants),
    replication_plan: isRecord(json.replication_plan) ? json.replication_plan : {},
    generation_prompts: toArray(json.generation_prompts),
  };
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
  const allowed = ["Debil", "Rescatable", "Potencial", "Ganador", "Escalable"];
  if (typeof value === "string" && allowed.includes(value)) return value;
  const numericScore = Number(score);
  if (numericScore >= 90) return "Escalable";
  if (numericScore >= 75) return "Ganador";
  if (numericScore >= 60) return "Potencial";
  if (numericScore >= 40) return "Rescatable";
  return "Debil";
}
