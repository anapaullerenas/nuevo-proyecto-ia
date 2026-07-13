import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CreativeAnalysisInput = {
  assetId: string;
  frames?: string[];
};

const CREATIVE_ANALYSIS_PROMPT = `
Eres una analista creativa senior especializada en anuncios de Meta, TikTok e Instagram.

Vas a evaluar un creativo para una emprendedora que quiere vender mas. Tu diagnostico debe ser profundo, accionable y sin relleno.

Evalua:
1. Hook / capacidad de detener scroll.
2. Claridad inmediata: que se vende, para quien y por que importa.
3. Oferta: promesa, incentivo, friccion, urgencia.
4. Psicologia: deseo, objecion, creencia que cambia, emocion que activa.
5. Prueba: evidencia, demostracion, contexto real, confianza.
6. Marca: coherencia, recordacion y credibilidad.
7. Produccion: formato, composicion, texto, ritmo visual si aplica.
8. Que mantener, que cambiar y que producir despues.

Scoring:
- Hook: 20
- Claridad: 15
- Oferta: 15
- Prueba: 15
- Psicologia: 15
- Formato/plataforma: 10
- Marca/confianza: 10

Clasificacion:
0-39 Debil
40-59 Rescatable
60-74 Potencial
75-89 Ganador
90-100 Escalable

Devuelve SOLO JSON valido con esta forma:
{
  "score": number,
  "verdict": "Debil" | "Rescatable" | "Potencial" | "Ganador" | "Escalable",
  "summary": string,
  "why_it_works": string[],
  "diagnosis": {
    "hook": {"level": "Bajo" | "Medio" | "Alto", "note": string},
    "clarity": {"level": "Bajo" | "Medio" | "Alto", "note": string},
    "offer": {"level": "Bajo" | "Medio" | "Alto", "note": string},
    "psychology": {"level": "Bajo" | "Medio" | "Alto", "note": string},
    "proof": {"level": "Bajo" | "Medio" | "Alto", "note": string},
    "brand": {"level": "Bajo" | "Medio" | "Alto", "note": string}
  },
  "keep": string[],
  "change": string[],
  "produce_next": string[],
  "variants": [
    {"name": string, "angle": string, "hook": string, "execution": string}
  ]
}
`;

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
    .select("name,website,category,audience,offer,voice,content_owner,creative_goal")
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

    const result = await analyzeWithOpenAI({
      brand,
      asset,
      imageInputs,
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
    return frames.slice(0, 4).map((frame) => ({
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
}: {
  brand: Record<string, string | null>;
  asset: { asset_type: string; file_name: string | null };
  imageInputs: Array<{ type: string; image_url: string }>;
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

CREATIVO
Tipo: ${asset.asset_type}
Archivo: ${asset.file_name || "Sin nombre"}
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1",
      temperature: 0.45,
      max_output_tokens: 1800,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: CREATIVE_ANALYSIS_PROMPT }],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: `${brandContext}\nAnaliza este creativo con el formato JSON solicitado.` },
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
    ...json,
    score: clampNumber(json.score, 0, 100),
    verdict: normalizeVerdict(json.verdict, json.score),
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
