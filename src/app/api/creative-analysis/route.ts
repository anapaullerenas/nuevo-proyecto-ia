import { NextRequest, NextResponse } from "next/server";
import { CREATIVE_DISSECTION_PROMPT } from "@/lib/ai/prompts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  chargeCredits,
  CREDIT_COSTS,
  creditErrorStatus,
  refundCredits,
} from "@/lib/credits";
import { estimateCostUsd } from "@/lib/ai/provider-pricing";

type CreativeAnalysisInput = {
  assetId: string;
  frames?: Array<string | { image: string; timestamp: number }>;
};

type ParsedCreativeAnalysisInput = CreativeAnalysisInput & {
  audioFile?: File;
  audioDurationSeconds?: number;
};

type VideoTranscript = {
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
  durationSeconds?: number;
  textModel: "gpt-4o-transcribe" | "whisper-1";
  timestampModel?: "whisper-1";
};

type OpenAIImageInput = {
  type: "input_image";
  image_url: string;
  detail: "high";
};

type OpenAITextInput = {
  type: "input_text";
  text: string;
};

type OpenAIContentInput = OpenAIImageInput | OpenAITextInput;

const MAX_TRANSCRIPTION_FILE_SIZE = 24 * 1024 * 1024;

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "La plataforma aun no esta configurada." },
      { status: 500 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Inicia sesión para analizar creativos." },
      { status: 401 },
    );
  }

  let body: ParsedCreativeAnalysisInput;
  try {
    body = await parseCreativeAnalysisRequest(request);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pude leer el creativo enviado.",
      },
      { status: 400 },
    );
  }

  if (!body.assetId) {
    return NextResponse.json(
      { error: "Falta el creativo a analizar." },
      { status: 400 },
    );
  }

  const { data: asset, error: assetError } = await supabase
    .from("creative_assets")
    .select("id,brand_id,owner_id,asset_type,storage_path,file_name,mime_type")
    .eq("id", body.assetId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (assetError || !asset) {
    return NextResponse.json(
      { error: "No encontre ese creativo en tu cuenta." },
      { status: 404 },
    );
  }

  const { data: brand } = await supabase
    .from("brands")
    .select(
      "id,name,website,category,audience,offer,voice,content_owner,creative_goal,strategic_context",
    )
    .eq("id", asset.brand_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json(
      { error: "No encontre la marca del creativo." },
      { status: 404 },
    );
  }

  await supabase
    .from("creative_assets")
    .update({ status: "processing" })
    .eq("id", asset.id)
    .eq("owner_id", user.id);

  const reason =
    asset.asset_type === "video"
      ? "creative_analysis_video"
      : "creative_analysis_image";
  const visionModel = process.env.OPENAI_VISION_MODEL || "gpt-4.1";
  let creditCharge;
  try {
    creditCharge = await chargeCredits({
      userId: user.id,
      amount: CREDIT_COSTS[reason],
      reason,
      brandId: asset.brand_id,
      provider: "openai",
      model: visionModel,
      inputTokens: asset.asset_type === "video" ? 8000 : 2500,
      outputTokens: 3500,
      costUsd: estimateCostUsd({
        provider: "openai",
        model: visionModel,
        inputTokens: asset.asset_type === "video" ? 8000 : 2500,
        outputTokens: 3500,
      }),
      route: "analysis",
    });
  } catch (error) {
    await supabase
      .from("creative_assets")
      .update({ status: "uploaded" })
      .eq("id", asset.id)
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
    const imageInputs = await getImageInputs(
      supabase,
      asset,
      body.frames || [],
    );

    if (!imageInputs.length) {
      throw new Error(
        "No pude leer imagenes o frames para analizar este creativo.",
      );
    }

    const { data: recipes } = await supabase
      .from("brand_recipes")
      .select("rule")
      .eq("brand_id", asset.brand_id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12);

    const transcript =
      asset.asset_type === "video"
        ? await transcribeVideo(
            supabase,
            asset,
            body.audioFile,
            body.audioDurationSeconds,
          )
        : null;
    const aiResult = await analyzeWithOpenAI({
      brand,
      asset,
      imageInputs,
      transcript,
      previousRecipes: (recipes || [])
        .map((recipe) => recipe.rule)
        .filter(Boolean),
    });
    const result =
      asset.asset_type === "video" && transcript
        ? attachVerifiedVideoEvidence(aiResult, transcript, imageInputs)
        : aiResult;

    await supabase
      .from("creative_assets")
      .update({ status: "analyzed" })
      .eq("id", asset.id)
      .eq("owner_id", user.id);

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
    if (creditCharge.charged)
      await refundCredits(
        user.id,
        creditCharge.amount,
        reason,
        asset.brand_id,
        creditCharge.operationId,
      );
    console.error("creative analysis failed", error);
    await supabase
      .from("creative_assets")
      .update({ status: "failed" })
      .eq("id", asset.id)
      .eq("owner_id", user.id);
    return NextResponse.json(
      {
        error:
          "No pudimos terminar este análisis. Tus créditos fueron devueltos; prueba nuevamente con el archivo original.",
      },
      { status: 500 },
    );
  }
}

async function transcribeVideo(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  asset: {
    storage_path: string | null;
    file_name: string | null;
    mime_type: string | null;
  },
  extractedAudio?: File,
  extractedAudioDurationSeconds?: number,
): Promise<VideoTranscript> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error("La transcripción del video aún no está activa.");

  let source: Blob;
  let sourceName: string;
  let sourceType: string;

  if (extractedAudio?.size) {
    source = extractedAudio;
    sourceName = extractedAudio.name || "audio-completo.wav";
    sourceType = extractedAudio.type || "audio/wav";
  } else {
    if (!asset.storage_path)
      throw new Error(
        "El video grande debe analizarse desde el archivo original seleccionado.",
      );
    const { data, error } = await supabase.storage
      .from("creative-assets")
      .download(asset.storage_path);
    if (error || !data)
      throw new Error(
        error?.message || "No pude descargar el video para escucharlo.",
      );
    source = data;
    sourceName = asset.file_name || "creativo.mp4";
    sourceType = asset.mime_type || data.type || "video/mp4";
  }

  if (source.size > MAX_TRANSCRIPTION_FILE_SIZE) {
    throw new Error(
      "No pude preparar el audio completo sin exceder el límite de transcripción. No se generó un análisis parcial.",
    );
  }

  const audioFile = new File([source], sourceName, { type: sourceType });
  const [precisionResult, timestampResult] = await Promise.allSettled([
    requestPrecisionTranscript(apiKey, audioFile),
    requestTimestampedTranscript(apiKey, audioFile),
  ]);

  const precision =
    precisionResult.status === "fulfilled" ? precisionResult.value : null;
  const timestamped =
    timestampResult.status === "fulfilled" ? timestampResult.value : null;

  if (!precision?.text && !timestamped?.text) {
    const precisionError =
      precisionResult.status === "rejected" ? precisionResult.reason : null;
    const timestampError =
      timestampResult.status === "rejected" ? timestampResult.reason : null;
    console.error("OpenAI transcription failed", {
      precisionError,
      timestampError,
    });
    throw new Error(
      "OpenAI no pudo reconstruir el audio completo. No se generó un análisis parcial.",
    );
  }

  const text = precision?.text || timestamped?.text || "";
  const durationSeconds =
    timestamped?.duration || extractedAudioDurationSeconds || undefined;
  const segments = timestamped?.segments?.length
    ? timestamped.segments
        .map((segment) => ({
          start: Number(segment.start) || 0,
          end: Number(segment.end) || 0,
          text: segment.text?.trim() || "",
        }))
        .filter((segment) => segment.text)
    : text
      ? [{ start: 0, end: durationSeconds || 0, text }]
      : [];

  return {
    text: text.trim(),
    segments,
    durationSeconds,
    textModel: precision?.text ? "gpt-4o-transcribe" : "whisper-1",
    timestampModel: timestamped?.segments?.length ? "whisper-1" : undefined,
  };
}

async function requestPrecisionTranscript(apiKey: string, audioFile: File) {
  const form = new FormData();
  form.append("file", audioFile);
  form.append("model", "gpt-4o-transcribe");
  form.append("language", "es");
  form.append("response_format", "json");
  form.append("temperature", "0");
  form.append(
    "prompt",
    "Transcribe literalmente el anuncio completo en español. Conserva nombres de marca, cifras, anglicismos, muletillas, repeticiones y llamadas a la acción; no resumas ni completes frases.",
  );

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    },
  );

  if (!response.ok) {
    throw new Error(
      `gpt-4o-transcribe respondió ${response.status}: ${(await response.text()).slice(0, 180)}`,
    );
  }

  return (await response.json()) as { text?: string };
}

async function requestTimestampedTranscript(apiKey: string, audioFile: File) {
  const form = new FormData();
  form.append("file", audioFile);
  form.append("model", "whisper-1");
  form.append("language", "es");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    },
  );

  if (!response.ok) {
    throw new Error(
      `whisper-1 respondió ${response.status}: ${(await response.text()).slice(0, 180)}`,
    );
  }

  return (await response.json()) as {
    text?: string;
    duration?: number;
    segments?: Array<{ start?: number; end?: number; text?: string }>;
  };
}

async function parseCreativeAnalysisRequest(
  request: NextRequest,
): Promise<ParsedCreativeAnalysisInput> {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("multipart/form-data")) {
    return (await request.json()) as ParsedCreativeAnalysisInput;
  }

  const form = await request.formData();
  const assetId = form.get("assetId");
  const rawFrames = form.get("frames");
  const audio = form.get("audio");
  const rawDuration = form.get("audioDurationSeconds");

  if (typeof assetId !== "string" || !assetId) {
    throw new Error("Falta el creativo a analizar.");
  }

  let frames: CreativeAnalysisInput["frames"] = [];
  if (typeof rawFrames === "string" && rawFrames) {
    const parsed = JSON.parse(rawFrames) as unknown;
    if (!Array.isArray(parsed))
      throw new Error("Los frames del video no tienen un formato válido.");
    frames = parsed as CreativeAnalysisInput["frames"];
  }

  return {
    assetId,
    frames,
    audioFile: audio instanceof File && audio.size ? audio : undefined,
    audioDurationSeconds:
      typeof rawDuration === "string"
        ? Number(rawDuration) || undefined
        : undefined,
  };
}

async function getImageInputs(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  asset: {
    asset_type: string;
    storage_path: string | null;
    mime_type: string | null;
  },
  frames: Array<string | { image: string; timestamp: number }>,
): Promise<OpenAIContentInput[]> {
  if (frames.length) {
    return frames.slice(0, 12).flatMap((frame, index) => {
      const image = typeof frame === "string" ? frame : frame.image;
      const timestamp = typeof frame === "string" ? null : frame.timestamp;
      return [
        {
          type: "input_text" as const,
          text:
            timestamp === null
              ? `Frame visual ${index + 1}`
              : `FRAME VERIFICADO ${index + 1} · ${formatSeconds(timestamp)}`,
        },
        {
          type: "input_image" as const,
          image_url: image,
          detail: "high" as const,
        },
      ];
    });
  }

  if (asset.asset_type !== "image") return [];
  if (!asset.storage_path) return [];

  const { data, error } = await supabase.storage
    .from("creative-assets")
    .download(asset.storage_path);
  if (error || !data)
    throw new Error(error?.message || "No pude descargar la imagen.");

  const buffer = Buffer.from(await data.arrayBuffer());
  const mimeType = asset.mime_type || data.type || "image/png";
  return [
    {
      type: "input_image",
      image_url: `data:${mimeType};base64,${buffer.toString("base64")}`,
      detail: "high",
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
  imageInputs: OpenAIContentInput[];
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
${transcript?.text ? transcript.text : "No aplica o no hay audio comprobable."}

SEGMENTOS CON TIEMPOS
${
  transcript?.segments.length
    ? transcript.segments
        .map(
          (segment) =>
            `[${formatSeconds(segment.start)}-${formatSeconds(segment.end)}] ${segment.text}`,
        )
        .join("\n")
    : "No hay segmentos con tiempos. No inventes diálogo."
}
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

function attachVerifiedVideoEvidence(
  result: ReturnType<typeof normalizeAnalysisShape> & {
    score: number;
    verdict: string;
  },
  transcript: VideoTranscript,
  imageInputs: OpenAIContentInput[],
) {
  const structuralAnalysis = isRecord(result.structural_analysis)
    ? result.structural_analysis
    : {};
  const verifiedTranscription = transcript.segments.map((segment) => ({
    second: formatSeconds(segment.start),
    text: segment.text,
  }));

  return {
    ...result,
    original_script: transcript.text,
    structural_analysis: {
      ...structuralAnalysis,
      transcription: verifiedTranscription,
    },
    source_coverage: {
      transcript_verified: Boolean(transcript.text),
      transcript_characters: transcript.text.length,
      transcript_segments: transcript.segments.length,
      duration_seconds: transcript.durationSeconds || null,
      visual_frames: imageInputs.filter((input) => input.type === "input_image")
        .length,
      transcription_model: transcript.textModel,
      timestamp_model: transcript.timestampModel || null,
    },
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
    .filter(
      (rule, index, list) => rule.length > 8 && list.indexOf(rule) === index,
    )
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
          scroll_stop: {
            level: "Medio",
            note: "Requiere revisar el primer impacto visual.",
          },
          clarity: {
            level: "Medio",
            note: "Requiere reforzar que se vende y para quien.",
          },
          offer: {
            level: "Medio",
            note: "Requiere hacer mas concreta la razon para actuar.",
          },
        },
    structural_analysis: isRecord(json.structural_analysis)
      ? json.structural_analysis
      : {},
    dashboard: isRecord(json.dashboard) ? json.dashboard : {},
    psychological_analysis: isRecord(json.psychological_analysis)
      ? json.psychological_analysis
      : {},
    persuasion_triggers: toArray(json.persuasion_triggers),
    emotional_arc: toArray(json.emotional_arc),
    evidence_timeline: toArray(json.evidence_timeline),
    winning_recipe: toStringArray(json.winning_recipe),
    keep: toStringArray(json.keep),
    test: toStringArray(json.test || json.change || json.produce_next),
    original_script:
      typeof json.original_script === "string" ? json.original_script : "",
    script_variants: toArray(json.script_variants || json.variants),
    replication_plan: isRecord(json.replication_plan)
      ? json.replication_plan
      : {},
    generation_prompts: toArray(json.generation_prompts),
    source_coverage: isRecord(json.source_coverage) ? json.source_coverage : {},
  };
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function extractResponseText(data: {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
}) {
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
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

function normalizeVerdict(value: unknown, score: unknown) {
  const numericScore = Number(score);
  if (numericScore >= 90) return "Escalable";
  if (numericScore >= 75) return "Ganador";
  if (numericScore >= 60) return "Potencial";
  if (numericScore >= 40) return "Rescatable";
  return "Débil";
}
