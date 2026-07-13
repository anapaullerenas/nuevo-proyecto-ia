import { NextRequest, NextResponse } from "next/server";
import { STATIC_BRIEF_DIRECTOR_PROMPT, STATIC_BRIEF_REVIEWER_PROMPT } from "@/lib/ai/prompts";
import { normalizeStaticBrief, STATIC_BRIEF_JSON_SCHEMA, StaticArchetype, StaticBrief, StaticBriefSchema } from "@/lib/ai/static-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { chargeCredits, CREDIT_COSTS, creditErrorStatus, refundCredits } from "@/lib/credits";
import { estimateCostUsd } from "@/lib/ai/provider-pricing";
import { CURATED_STATIC_FORMATS, getCuratedStaticFormat, staticFormatReferencePayload } from "@/lib/static-format-catalog";

export const maxDuration = 120;

const externalReferencePatterns = {
  none: { regla: "Dirección original basada en la marca y el objetivo." },
  product_context: { nombre: "Producto en contexto", estructura: "Escena real, producto protagonista y anotaciones breves de ingredientes o beneficios.", regla: "Usar sólo jerarquía y encuadre; nunca copiar identidad, producto ni texto ajenos." },
  creator_bundle: { nombre: "Creadora + producto", estructura: "Presencia humana auténtica, producto en mano, luz cálida y composición de prueba social.", regla: "Usar sólo estructura y naturalidad; conservar identidad y activos propios." },
  aspirational_demo: { nombre: "Resultado aspiracional", estructura: "Resultado visible primero, producto como respaldo y tipografía editorial con mucho aire.", regla: "Inspirarse en la lectura visual sin replicar identidad o claims ajenos." },
} as const;

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
  externalReference?: "none" | "product_context" | "creator_bundle" | "aspirational_demo";
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
    .select("id,name,website,category,audience,offer,voice,content_owner,creative_goal,strategic_context")
    .eq("id", body.brandId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "No encontré la marca activa." }, { status: 404 });
  }

  const { data: logoAsset } = await supabase
    .from("brand_assets")
    .select("id,file_name,label,kind")
    .eq("id", body.logoAssetId || "00000000-0000-0000-0000-000000000000")
    .eq("brand_id", brand.id)
    .eq("owner_id", user.id)
    .eq("kind", "logo")
    .maybeSingle();

  let productAsset: Record<string, unknown> | null = null;
  if (!body.serviceNoProduct && body.productAssetId) {
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
    productAsset = asset || null;
  }

  const [{ data: recipes }, { data: references }, { data: goldenBriefs }, { data: visualIdentity }] = await Promise.all([
    supabase
      .from("brand_recipes")
      .select("rule")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("brand_assets")
      .select("id,file_name,label,metadata")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .eq("kind", "style_reference")
      .in("id", Array.isArray(body.referenceAssetIds) && body.referenceAssetIds.length ? body.referenceAssetIds.slice(0, 10) : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("golden_briefs").select("archetype_id,scope,ficha").eq("active", true).or(`scope.eq.global,brand_id.eq.${brand.id}`).limit(12),
    supabase.from("brand_visual_identity").select("colores_hex,tipografia_estilo,luz_y_foto,estilo_general").eq("brand_id", brand.id).maybeSingle(),
  ]);

  let creditCharge;
  try {
    creditCharge = await chargeCredits({ userId: user.id, amount: CREDIT_COSTS.static_brief, reason: "static_brief", brandId: brand.id, provider: "openai", model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini", inputTokens: 3500, outputTokens: 2000, costUsd: estimateCostUsd({ provider: "openai", model: "gpt-4.1-mini", inputTokens: 3500, outputTokens: 2000 }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No pudimos validar tus créditos." }, { status: creditErrorStatus(error) });
  }
  try {
    const ficha = await createBriefWithOpenAI({
      brand,
      intent,
      format: body.format,
      funnelStage: body.funnelStage,
      archetypeId: body.archetypeId || "automatico",
      productAsset,
      logoAsset: logoAsset || null,
      serviceNoProduct: Boolean(body.serviceNoProduct || !productAsset),
      recipes: (recipes || []).map((recipe) => String(recipe.rule)),
      archetypes: CURATED_STATIC_FORMATS,
      references: references || [],
      externalReference: body.externalReference || "none",
      goldenBriefs: goldenBriefs || [],
      visualIdentity,
    });

    if (!visualIdentity) {
      await supabase.from("brand_visual_identity").upsert({ brand_id: brand.id, owner_id: user.id, colores_hex: ficha.paleta, tipografia_estilo: typographyForArchetype(ficha.arquetipo), luz_y_foto: ficha.art_direction.iluminacion, estilo_general: ficha.art_direction.tratamiento_color }, { onConflict: "brand_id" });
    }

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
          service_no_product: Boolean(body.serviceNoProduct || !productAsset),
          reference_asset_ids: (references || []).map((reference) => reference.id),
          external_reference: body.externalReference || "none",
          format_reference: staticFormatReferencePayload(ficha.arquetipo),
        },
        status: "brief",
      })
      .select("id,ficha,archetype,format,funnel_stage,status,created_at")
      .single();

    if (saveError) throw new Error(saveError.message);

    return NextResponse.json({ creativeId: saved.id, ficha: saved.ficha, saved });
  } catch (error) {
    if (creditCharge.charged) await refundCredits(user.id, creditCharge.amount, "static_brief", brand.id);
    console.error("static brief failed", error);
    return NextResponse.json(
      { error: "No pudimos preparar la dirección del anuncio. Tus créditos fueron devueltos; intenta nuevamente." },
      { status: 500 },
    );
  }
}

function typographyForArchetype(archetype: string) { if (["post_its","anotaciones_manuscritas"].includes(archetype)) return "manuscrita"; if (["producto_heroe_editorial","diagrama_callouts","prueba_social_flotante"].includes(archetype)) return "serif_editorial"; if (archetype === "ticket_novedad") return "condensada"; return "sans_geometrica"; }

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
  externalReference,
  goldenBriefs,
  visualIdentity,
}: {
  brand: Record<string, unknown>;
  intent: string;
  format: string;
  funnelStage: string;
  archetypeId: string;
  productAsset: Record<string, unknown> | null;
  logoAsset: Record<string, unknown> | null;
  serviceNoProduct: boolean;
  recipes: string[];
  archetypes: StaticArchetype[];
  references: Array<{ id: string; file_name: string; label: string | null; metadata: unknown }>;
  externalReference: keyof typeof externalReferencePatterns;
  goldenBriefs: Array<{ archetype_id: string; scope: string; ficha: unknown }>;
  visualIdentity: Record<string, unknown> | null;
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
    estructura_externa_elegida: externalReferencePatterns[externalReference],
    identidad_visual_persistente: visualIdentity,
    ejemplos_de_ficha_excelente: goldenBriefs.filter((brief) => archetypeId === "automatico" || brief.archetype_id === archetypeId).slice(0, 3),
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
    `Marca: ${String(brand.name || "Sin nombre")}`,
    `Categoría: ${String(brand.category || "No definida")}`,
    `Audiencia: ${String(brand.audience || "No definida")}`,
    `Oferta: ${String(brand.offer || "No definida")}`,
    `Voz: ${String(brand.voice || "No definida")}`,
    `Contexto estratégico: ${JSON.stringify(brand.strategic_context || {})}`,
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
    const corrected = await requestStructuredBrief({
      apiKey,
      stage: "reviewer-correction",
      system: STATIC_BRIEF_REVIEWER_PROMPT,
      user: JSON.stringify({ resumen_marca: brandSummary, ficha_borrador: reviewed, instruccion: "Corrige la ficha hasta alcanzar al menos 85/100 sin inventar claims." }),
      maxTokens: 2000,
      temperature: 0.15,
      fallbackArchetype: archetypeId,
    });
    return lockRequestedArchetype(corrected, archetypeId);
  }

  return lockRequestedArchetype(reviewed, archetypeId);
}

function lockRequestedArchetype(brief: StaticBrief, requestedArchetype: string) {
  const requested = getCuratedStaticFormat(requestedArchetype);
  if (!requested) return brief;

  return {
    ...brief,
    arquetipo: requested.id,
    arquetipo_label: requested.label_visible,
  };
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
