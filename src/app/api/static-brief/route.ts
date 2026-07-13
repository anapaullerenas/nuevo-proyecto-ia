import { NextRequest, NextResponse } from "next/server";
import { STATIC_BRIEF_DIRECTOR_PROMPT, STATIC_BRIEF_REVIEWER_PROMPT } from "@/lib/ai/prompts";
import { normalizeStaticBrief, STATIC_BRIEF_JSON_SCHEMA, StaticArchetype, StaticBrief, StaticBriefSchema } from "@/lib/ai/static-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 120;

type StaticBriefInput = {
  brandId: string;
  intent: string;
  format: string;
  funnelStage: string;
  archetypeId?: string;
  productAssetId?: string;
  logoAssetId?: string;
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

  const [{ data: logoAsset }, { count: referenceCount }] = await Promise.all([
    supabase
      .from("brand_assets")
      .select("id,file_name,label,kind")
      .eq("id", body.logoAssetId || "00000000-0000-0000-0000-000000000000")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .eq("kind", "logo")
      .maybeSingle(),
    supabase
      .from("brand_assets")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .eq("kind", "style_reference"),
  ]);

  if (!logoAsset || (referenceCount || 0) < 5) {
    return NextResponse.json({ error: "Completa el kit visual con un logo y cinco referencias antes de crear." }, { status: 400 });
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
      logoAsset,
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
  logoAsset,
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
  logoAsset: Record<string, unknown>;
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
    logo_oficial: logoAsset,
    servicio_sin_producto: serviceNoProduct,
    recetas_ganadoras: recipes,
    arquetipos_disponibles: archetypes,
    referencias_visuales_analizadas: references.map((reference) => ({
      nombre: reference.file_name,
      analisis: reference.metadata,
      regla: "Usar sólo estructura, jerarquía y tratamiento visual. No copiar identidad, producto ni texto.",
    })),
  };

  const draft = await requestStructuredBrief({
    apiKey,
    stage: "director",
    system: STATIC_BRIEF_DIRECTOR_PROMPT,
    user: JSON.stringify(context),
    maxTokens: 2500,
    temperature: 0.4,
    fallbackArchetype: archetypeId,
  });

  const brandSummary = [
    `Marca: ${brand.name || "Sin nombre"}`,
    `Categoría: ${brand.category || "No definida"}`,
    `Audiencia: ${brand.audience || "No definida"}`,
    `Oferta: ${brand.offer || "No definida"}`,
    `Voz: ${brand.voice || "No definida"}`,
  ].join("\n");

  const reviewed = await requestStructuredBrief({
    apiKey,
    stage: "reviewer",
    system: STATIC_BRIEF_REVIEWER_PROMPT,
    user: JSON.stringify({ resumen_marca: brandSummary, ficha_borrador: draft }),
    maxTokens: 2000,
    temperature: 0.2,
    fallbackArchetype: archetypeId,
  });

  if (reviewed.review_score < 85) {
    return requestStructuredBrief({
      apiKey,
      stage: "reviewer-correction",
      system: STATIC_BRIEF_REVIEWER_PROMPT,
      user: JSON.stringify({ resumen_marca: brandSummary, ficha_borrador: reviewed, instruccion: "Corrige la ficha hasta alcanzar al menos 85/100 sin inventar claims." }),
      maxTokens: 2000,
      temperature: 0.15,
      fallbackArchetype: archetypeId,
    });
  }

  return reviewed;
}

async function requestStructuredBrief({
  apiKey,
  stage,
  system,
  user,
  maxTokens,
  temperature,
  fallbackArchetype,
}: {
  apiKey: string;
  stage: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  fallbackArchetype: string;
}) {
  let previousText = "";
  let previousError = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini",
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_schema", json_schema: { name: `static_brief_${stage.replace(/[^a-z0-9_]/gi, "_")}`, strict: true, schema: STATIC_BRIEF_JSON_SCHEMA } },
        messages: [
          { role: "system", content: system },
          { role: "user", content: attempt === 0 ? user : `${user}\n\nREINTENTO DE REPARACIÓN: ${previousError}. Devuelve la ficha completa. Texto anterior: ${previousText.slice(0, 6000)}` },
        ],
      }),
    });

    if (!response.ok) {
      previousError = `respuesta ${response.status}`;
      console.error(`static-brief ${stage} OpenAI error`, response.status, (await response.text()).slice(0, 500));
      continue;
    }

    const data = await response.json();
    previousText = data.choices?.[0]?.message?.content || "";
    try {
      const parsed = JSON.parse(previousText) as Partial<StaticBrief>;
      return StaticBriefSchema.parse(normalizeStaticBrief(parsed, fallbackArchetype));
    } catch (error) {
      previousError = error instanceof Error ? error.message : "JSON inválido";
      console.error(`static-brief ${stage} validation error`, previousError, previousText.slice(0, 500));
    }
  }

  throw new Error("No pude armar la ficha en este momento. Intenta de nuevo; no se descontaron créditos.");
}
