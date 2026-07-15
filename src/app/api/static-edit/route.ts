import { NextRequest, NextResponse } from "next/server";
import { getImageSize, StaticBrief } from "@/lib/ai/static-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  chargeCredits,
  CREDIT_COSTS,
  creditErrorStatus,
  refundCredits,
} from "@/lib/credits";
import { estimateCostUsd } from "@/lib/ai/provider-pricing";
import {
  appendInputFidelityWhenSupported,
  imageApiErrorFromResponse,
  imageGenerationFailure,
} from "@/lib/ai/image-api-errors";

export const maxDuration = 300;

type EditInput = { staticId: string; instruction: string };

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return NextResponse.json(
      { error: "La plataforma no está conectada." },
      { status: 500 },
    );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Inicia sesión para corregir la imagen." },
      { status: 401 },
    );

  const body = (await request.json()) as EditInput;
  const instruction = body.instruction?.trim();
  if (!body.staticId || !instruction || instruction.length < 6) {
    return NextResponse.json(
      { error: "Describe la corrección puntual que quieres hacer." },
      { status: 400 },
    );
  }

  const { data: source } = await supabase
    .from("static_creatives")
    .select(
      "id,brand_id,storage_path,prompt,ficha,archetype,format,funnel_stage,quality,version",
    )
    .eq("id", body.staticId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!source?.storage_path)
    return NextResponse.json(
      { error: "No encontré la imagen que quieres corregir." },
      { status: 404 },
    );

  const { data: sourceBlob, error: sourceError } = await supabase.storage
    .from("creative-assets")
    .download(source.storage_path);
  if (sourceError || !sourceBlob)
    return NextResponse.json(
      { error: "No pudimos abrir la versión elegida." },
      { status: 400 },
    );

  let creditCharge;
  try {
    creditCharge = await chargeCredits({
      userId: user.id,
      amount: CREDIT_COSTS.static_edit,
      reason: "static_edit",
      brandId: source.brand_id,
      provider: "openai",
      model: "gpt-image-2-medium",
      images: 1,
      costUsd: estimateCostUsd({
        provider: "openai",
        model: "gpt-image-2-medium",
        images: 1,
      }),
      route: "image",
    });
  } catch (error) {
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
    const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer());
    const currentFicha = source.ficha as StaticBrief;
    const replacement = parseTextReplacement(instruction);
    const nextFicha = replacement
      ? replaceFichaText(currentFicha, replacement.from, replacement.to)
      : currentFicha;
    const changedFichaText =
      JSON.stringify(nextFicha) !== JSON.stringify(currentFicha);

    const output = await editWithImageModel(
      sourceBuffer,
      source.format || "4:5 Feed",
      source.quality === "high" ? "high" : "medium",
      instruction,
    );

    const storagePath = `${user.id}/${source.brand_id}/static-edit-${Date.now()}-${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("creative-assets")
      .upload(storagePath, output, { contentType: "image/png" });
    if (uploadError) throw uploadError;
    const { data: signed } = await supabase.storage
      .from("creative-assets")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    const { data: saved, error: saveError } = await supabase
      .from("static_creatives")
      .insert({
        brand_id: source.brand_id,
        owner_id: user.id,
        storage_path: storagePath,
        prompt: `${source.prompt || ""}\nCORRECCIÓN: ${instruction}`,
        ficha: nextFicha,
        archetype: source.archetype,
        format: source.format,
        funnel_stage: source.funnel_stage,
        quality: source.quality,
        version: (source.version || 1) + 1,
        parent_id: source.id,
        concept: {
          edit_instruction: instruction,
          source_static_id: source.id,
          text_only_edit: Boolean(replacement && changedFichaText),
        },
        qa_report: { status: "version_corregida", instruction },
        status: "edited",
      })
      .select(
        "id,storage_path,prompt,ficha,archetype,format,funnel_stage,quality,version,parent_id,status,created_at",
      )
      .single();
    if (saveError) throw saveError;

    return NextResponse.json({
      static: { ...saved, public_url: signed?.signedUrl || null },
    });
  } catch (error) {
    if (creditCharge.charged)
      await refundCredits(
        user.id,
        creditCharge.amount,
        "static_edit",
        source.brand_id,
        creditCharge.operationId,
      );
    console.error("static edit failed", error);
    const failure = imageGenerationFailure(error);
    return NextResponse.json(
      { error: failure.message, code: failure.code },
      { status: failure.status },
    );
  }
}

async function editWithImageModel(
  source: Buffer,
  format: string,
  quality: "medium" | "high",
  instruction: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Image editing is not configured");
  const form = new FormData();
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  form.append("model", model);
  form.append("size", getImageSize(format));
  form.append("quality", quality);
  form.append("n", "1");
  form.append("output_format", "png");
  appendInputFidelityWhenSupported(form, model);
  form.append(
    "image[]",
    new Blob([new Uint8Array(source)], { type: "image/png" }),
    "version-original.png",
  );
  form.append(
    "prompt",
    `Edita esta pieza publicitaria. Aplica SOLAMENTE este cambio: ${instruction}. Conserva exactamente composición, dimensiones, producto, envase, iluminación, modelo, logo, colores y todos los demás textos. No rediseñes la pieza. No añadas elementos. Devuelve una sola imagen terminada.`,
  );
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) throw await imageApiErrorFromResponse(response);
  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned");
  return Buffer.from(b64, "base64");
}

function parseTextReplacement(instruction: string) {
  const normalized = instruction.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const patterns = [
    /(?:en lugar de)\s+["']([^"']+)["']\s+(?:pon|ponle|escribe|coloca)\s+["']([^"']+)["']/i,
    /(?:cambia|reemplaza|sustituye)\s+["']([^"']+)["']\s+(?:por|a)\s+["']([^"']+)["']/i,
    /(?:en lugar de)\s+(.+?)\s+(?:pon|ponle|escribe|coloca)\s+(.+?)(?:\.|$)/i,
    /(?:cambia|reemplaza|sustituye)\s+(.+?)\s+(?:por|a)\s+(.+?)(?:\.|$)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return { from: match[1].trim(), to: match[2].trim() };
  }
  return null;
}

function replaceFichaText(ficha: StaticBrief, from: string, to: string) {
  const replace = (value: string) =>
    value.replace(new RegExp(escapeRegExp(from), "gi"), to);
  return {
    ...ficha,
    concepto: replace(ficha.concepto),
    texto_principal: replace(ficha.texto_principal),
    texto_secundario: replace(ficha.texto_secundario),
    cta: replace(ficha.cta),
    disclaimer: replace(ficha.disclaimer),
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
