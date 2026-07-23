import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  chargeCredits,
  CREDIT_COSTS,
  creditErrorStatus,
  refundCredits,
} from "@/lib/credits";
import { estimateCostUsd } from "@/lib/ai/provider-pricing";
import { CURATED_STATIC_FORMATS, getCuratedStaticFormat } from "@/lib/static-format-catalog";
import { parseStructuredJson } from "@/lib/meta-ads";

export const maxDuration = 120;

type Input = {
  assetId: string;
};

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
      { error: "Inicia sesión para analizar referencias." },
      { status: 401 },
    );

  const { assetId } = (await request.json()) as Input;
  if (!assetId)
    return NextResponse.json(
      { error: "Falta la referencia." },
      { status: 400 },
    );

  const { data: asset } = await supabase
    .from("brand_assets")
    .select("id,brand_id,bucket_id,storage_path,file_name,mime_type,metadata")
    .eq("id", assetId)
    .eq("owner_id", user.id)
    .eq("kind", "style_reference")
    .maybeSingle();

  if (!asset)
    return NextResponse.json(
      { error: "No encontré la referencia." },
      { status: 404 },
    );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "El análisis visual aún no está activo." },
      { status: 503 },
    );

  const { count: analyzedCount } = await supabase
    .from("brand_assets")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", asset.brand_id)
    .eq("owner_id", user.id)
    .eq("kind", "style_reference")
    .filter("metadata->>analysis_status", "eq", "ready");
  let creditCharge: Awaited<ReturnType<typeof chargeCredits>> = {
    charged: false,
    amount: 0,
    operationId: null,
  };
  if ((analyzedCount || 0) >= 6) {
    try {
      creditCharge = await chargeCredits({
        userId: user.id,
        amount: CREDIT_COSTS.reference_analysis,
        reason: "reference_analysis",
        brandId: asset.brand_id,
        provider: "openai",
        model: "gpt-4.1-mini",
        inputTokens: 1800,
        outputTokens: 900,
        costUsd: estimateCostUsd({
          provider: "openai",
          model: "gpt-4.1-mini",
          inputTokens: 1800,
          outputTokens: 900,
        }),
        route: "analysis",
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
  }
  try {
    const { data: blob, error: downloadError } = await supabase.storage
      .from(asset.bucket_id)
      .download(asset.storage_path);
    if (downloadError || !blob)
      throw new Error(downloadError?.message || "No se pudo leer la imagen.");

    const source = Buffer.from(await blob.arrayBuffer());
    const optimized = await sharp(source)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    const encoded = optimized.toString("base64");
    const mime = "image/jpeg";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
        temperature: 0.15,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Analiza una referencia de anuncio para una directora creativa. Extrae principios reutilizables, nunca identidad ajena. Primero clasifica la estructura contra este catálogo: ${JSON.stringify(CURATED_STATIC_FORMATS.map((format) => ({ id: format.id, nombre: format.label_visible, descripcion: format.short_description })))}. Devuelve JSON con: matched_archetype_id (id exacto o null), match_confidence (0 a 1), classification_reason, layout, jerarquia, densidad, tratamiento_fotografico, tratamiento_producto, estilo_tipografico, paleta_mood, patron_copy, elementos_reutilizables, elementos_no_copiar y custom_recipe (sólo si match_confidence es menor a 0.72). Sé concreto. No inventes texto ilegible.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Referencia: ${asset.file_name}` },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mime};base64,${encoded}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
      }),
    });

    const responseText = await response.text();
    if (!response.ok)
      throw new Error(
        `El proveedor visual respondió ${response.status}: ${responseText.slice(0, 160)}`,
      );
    let data: {
      choices?: Array<{ message?: { content?: string | Record<string, unknown> } }>;
    };
    try {
      data = JSON.parse(responseText) as typeof data;
    } catch {
      throw new Error("El proveedor visual devolvió una respuesta incompleta.");
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("La IA no devolvió el análisis visual.");

    const rawAnalysis = parseStructuredJson(content) as Record<string, unknown>;
    const matched = getCuratedStaticFormat(String(rawAnalysis.matched_archetype_id || ""));
    const confidence = Math.max(0, Math.min(1, Number(rawAnalysis.match_confidence) || 0));
    const analysis = {
      ...rawAnalysis,
      matched_archetype_id: matched && confidence >= 0.72 ? matched.id : null,
      matched_archetype_label: matched && confidence >= 0.72 ? matched.label_visible : null,
      match_confidence: confidence,
      recipe_mode: matched && confidence >= 0.72 ? "catalog" : "custom",
    };
    const metadata = {
      ...((asset.metadata as Record<string, unknown> | null) || {}),
      analysis,
      analysis_status: "ready",
      analyzed_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase
      .from("brand_assets")
      .update({ metadata })
      .eq("id", asset.id);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ assetId: asset.id, analysis });
  } catch (error) {
    if (creditCharge.charged)
      await refundCredits(
        user.id,
        creditCharge.amount,
        "reference_analysis",
        asset.brand_id,
        creditCharge.operationId,
      );
    console.error("reference analysis failed", error);
    await supabase
      .from("brand_assets")
      .update({
        metadata: {
          ...((asset.metadata as Record<string, unknown> | null) || {}),
          analysis_status: "error",
        },
      })
      .eq("id", asset.id);
    return NextResponse.json(
      {
        error:
          "No pudimos leer esta referencia. Si hubo cobro, los créditos ya fueron devueltos.",
      },
      { status: 500 },
    );
  }
}
