import { NextRequest, NextResponse } from "next/server";
import { STATIC_BRIEF_DIRECTOR_PROMPT, STATIC_BRIEF_REVIEWER_PROMPT } from "@/lib/ai/prompts";
import { normalizeStaticBrief, StaticArchetype, StaticBrief } from "@/lib/ai/static-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 120;

type StaticBriefInput = {
  brandId: string;
  intent: string;
  format: string;
  funnelStage: string;
  archetypeId?: string;
  productAssetId?: string;
  serviceNoProduct?: boolean;
  referenceAssetIds?: string[];
};

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Estamos ajustando la plataforma. Intenta de nuevo en unos minutos." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para crear fichas de estáticos." }, { status: 401 });
  }

  const body = (await request.json()) as StaticBriefInput;
  const intent = body.intent?.trim();

  if (!body.brandId || !intent || intent.length < 16) {
    return NextResponse.json({ error: "Escribe qué quieres comunicar con un poco más de contexto." }, { status: 400 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id,name,website,category,audience,offer,voice,content_owner,creative_goal")
    .eq("id", body.brandId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "No encontré la marca activa." }, { status: 404 });
  }

  let productAsset: Record<string, unknown> | null = null;
  if (!body.serviceNoProduct) {
    if (!body.productAssetId) {
      return NextResponse.json(
        { error: "Sube o elige al menos una foto de producto antes de crear la ficha." },
        { status: 400 },
      );
    }

    const { data: asset } = await supabase
      .from("brand_assets")
      .select("id,file_name,mime_type,kind,label")
      .eq("id", body.productAssetId)
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!asset) {
      return NextResponse.json({ error: "No encontré la foto de producto elegida." }, { status: 404 });
    }
    productAsset = asset;
  }

  const [{ data: recipes }, { data: archetypes }, { data: references }] = await Promise.all([
    supabase
      .from("brand_recipes")
      .select("rule")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("static_archetypes")
      .select("id,name,label_visible,stage,prompt_fragment,structure")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("brand_assets")
      .select("id,file_name,label,metadata")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .eq("kind", "style_reference")
      .in("id", Array.isArray(body.referenceAssetIds) && body.referenceAssetIds.length ? body.referenceAssetIds.slice(0, 10) : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  try {
    const ficha = await createBriefWithOpenAI({
      brand,
      intent,
      format: body.format,
      funnelStage: body.funnelStage,
      archetypeId: body.archetypeId || "automatico",
      productAsset,
      serviceNoProduct: Boolean(body.serviceNoProduct),
      recipes: (recipes || []).map((recipe) => String(recipe.rule)),
      archetypes: (archetypes || []) as StaticArchetype[],
      references: references || [],
    });

    const { data: saved, error: saveError } = await supabase
      .from("static_creatives")
      .insert({
        brand_id: brand.id,
        owner_id: user.id,
        ficha,
        archetype: ficha.arquetipo,
        format: body.format,
        funnel_stage: body.funnelStage,
        quality: "medium",
        concept: {
          intent,
          product_asset_id: body.productAssetId || null,
          service_no_product: Boolean(body.serviceNoProduct),
          reference_asset_ids: (references || []).map((reference) => reference.id),
        },
        status: "brief",
      })
      .select("id,ficha,archetype,format,funnel_stage,status,created_at")
      .single();

    if (saveError) throw new Error(saveError.message);

    return NextResponse.json({ creativeId: saved.id, ficha: saved.ficha, saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la ficha del anuncio." },
      { status: 500 },
    );
  }
}

async function createBriefWithOpenAI({
  brand,
  intent,
  format,
  funnelStage,
  archetypeId,
  productAsset,
  serviceNoProduct,
  recipes,
  archetypes,
  references,
}: {
  brand: Record<string, string | null>;
  intent: string;
  format: string;
  funnelStage: string;
  archetypeId: string;
  productAsset: Record<string, unknown> | null;
  serviceNoProduct: boolean;
  recipes: string[];
  archetypes: StaticArchetype[];
  references: Array<{ id: string; file_name: string; label: string | null; metadata: unknown }>;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("La directora creativa aún no está activa.");

  const context = {
    marca: brand,
    intencion_usuario: intent,
    formato: format,
    etapa_embudo: funnelStage,
    arquetipo_solicitado: archetypeId,
    activo_producto: productAsset,
    servicio_sin_producto: serviceNoProduct,
    recetas_ganadoras: recipes,
    arquetipos_disponibles: archetypes,
    referencias_visuales_analizadas: references.map((reference) => ({
      nombre: reference.file_name,
      analisis: reference.metadata,
      regla: "Usar sólo estructura, jerarquía y tratamiento visual. No copiar identidad, producto ni texto.",
    })),
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini",
      temperature: 0.45,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STATIC_BRIEF_DIRECTOR_PROMPT },
        {
          role: "user",
          content: JSON.stringify(context),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 220));
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("La IA no devolvió una ficha editable.");

  const draft = normalizeStaticBrief(JSON.parse(text) as Partial<StaticBrief>, archetypeId);
  const review = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STATIC_BRIEF_REVIEWER_PROMPT },
        { role: "user", content: JSON.stringify({ contexto: context, ficha_borrador: draft }) },
      ],
    }),
  });

  if (!review.ok) {
    const errorText = await review.text();
    throw new Error(`La revisión creativa falló: ${errorText.slice(0, 180)}`);
  }

  const reviewData = await review.json();
  const reviewedText = reviewData.choices?.[0]?.message?.content;
  if (!reviewedText) throw new Error("La dirección creativa no devolvió una ficha aprobada.");

  return normalizeStaticBrief(JSON.parse(reviewedText) as Partial<StaticBrief>, archetypeId);
}
