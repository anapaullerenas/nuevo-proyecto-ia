import { NextRequest, NextResponse } from "next/server";
import { compileDesignPrompt, getImageSize, normalizeStaticBrief, StaticArchetype, StaticBrief } from "@/lib/ai/static-machine";
import { composeStaticCreative, TextCompositionError, type LogoSource, type TextCompositionVerification } from "@/lib/ai/static-composer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { chargeCredits, CREDIT_COSTS, creditErrorStatus, refundCredits } from "@/lib/credits";
import { estimateCostUsd } from "@/lib/ai/provider-pricing";
import { appendInputFidelityWhenSupported, ImageApiError, imageApiErrorFromResponse, imageGenerationFailure } from "@/lib/ai/image-api-errors";
import { CURATED_STATIC_FORMATS, getCuratedStaticFormat, staticFormatReferencePayload } from "@/lib/static-format-catalog";

export const maxDuration = 300;

type StaticGenerateInput = {
  brandId: string;
  creativeId?: string;
  ficha: StaticBrief;
  format: string;
  funnelStage: string;
  quality?: "medium" | "high";
  variants?: number;
  productAssetId?: string;
  logoAssetId?: string;
  serviceNoProduct?: boolean;
  referenceAssetIds?: string[];
  variantOffset?: number;
};

type ImageAsset = { id: string; bucket_id: string; storage_path: string; file_name: string; mime_type: string | null; kind: string; metadata?: { logo_variant?: "primary" | "light" | "dark" } | null };

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Estamos ajustando la plataforma. Intenta de nuevo en unos minutos." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para generar estáticos." }, { status: 401 });
  }

  const body = (await request.json()) as StaticGenerateInput;
  const quality = body.quality === "high" ? "high" : "medium";
  const variants = Math.min(Math.max(Number(body.variants) || 1, 1), 4);
  const ficha = normalizeStaticBrief(body.ficha);

  if (!body.brandId || !body.format || !body.funnelStage) {
    return NextResponse.json({ error: "Faltan datos de la ficha para generar." }, { status: 400 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id,name,voice,category")
    .eq("id", body.brandId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "No encontré la marca activa." }, { status: 404 });
  }
  let productAsset: ImageAsset | null = null;
  if (!body.serviceNoProduct && body.productAssetId) {
    const { data: asset } = await supabase
      .from("brand_assets")
      .select("id,bucket_id,storage_path,file_name,mime_type,kind")
      .eq("id", body.productAssetId)
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .maybeSingle();
    productAsset = asset;
  }

  const { data: logoAssets } = await supabase
    .from("brand_assets")
    .select("id,bucket_id,storage_path,file_name,mime_type,kind,metadata")
    .eq("brand_id", brand.id)
    .eq("owner_id", user.id)
    .eq("kind", "logo")
    .limit(6);

  let styleReferences: ImageAsset[] = [];
  if (Array.isArray(body.referenceAssetIds) && body.referenceAssetIds.length) {
    const { data } = await supabase
      .from("brand_assets")
      .select("id,bucket_id,storage_path,file_name,mime_type,kind")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .eq("kind", "style_reference")
      .in("id", body.referenceAssetIds.slice(0, 10));
    styleReferences = (data || []).slice(0, 3);
  }

  const logoSources = (await Promise.all((logoAssets || []).map(async (asset) => {
    const { data: blob } = await supabase.storage.from(asset.bucket_id).download(asset.storage_path);
    if (!blob) return null;
    return {
      buffer: Buffer.from(await blob.arrayBuffer()),
      variant: asset.metadata?.logo_variant || "primary",
    } as LogoSource;
  }))).filter((source): source is LogoSource => Boolean(source));

  const curatedArchetype = getCuratedStaticFormat(ficha.arquetipo);
  const { data: storedArchetype } = !curatedArchetype && ficha.arquetipo
    ? await supabase
        .from("static_archetypes")
        .select("id,name,label_visible,stage,prompt_fragment,structure")
        .eq("id", ficha.arquetipo)
        .maybeSingle()
    : { data: null };
  const archetype = (curatedArchetype || storedArchetype) as StaticArchetype | null;
  const activeArchetypes = variants > 1 ? CURATED_STATIC_FORMATS : [];
  const candidateArchetypes = [archetype, ...activeArchetypes.filter((item) => item.id !== archetype?.id && normalizeStage(item.stage) === normalizeStage(body.funnelStage)), ...activeArchetypes.filter((item) => item.id !== archetype?.id)]
    .filter((item, index, list) => Boolean(item) && list.findIndex((candidate) => candidate?.id === item?.id) === index) as StaticArchetype[];

  const creditAmount = variants * (quality === "high" ? CREDIT_COSTS.static_generate_high : CREDIT_COSTS.static_generate_medium);
  let creditCharge;
  try {
    creditCharge = await chargeCredits({ userId: user.id, amount: creditAmount, reason: quality === "high" ? "static_generate_high" : "static_generate_medium", brandId: brand.id, provider: "openai", model: `gpt-image-2-${quality}`, images: variants, costUsd: estimateCostUsd({ provider: "openai", model: `gpt-image-2-${quality}`, images: variants }), route: "image" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No pudimos validar tus créditos." }, { status: creditErrorStatus(error) });
  }
  try {
    const results = [];
    for (let index = 0; index < variants; index += 1) {
      const variationIndex = index + Math.max(0, Number(body.variantOffset) || 0);
      const variantArchetype = candidateArchetypes[variationIndex] || candidateArchetypes[variationIndex % Math.max(candidateArchetypes.length, 1)] || (archetype as StaticArchetype | null);
      const variantFicha = variationIndex === 0 ? ficha : adaptBriefToArchetype(ficha, variantArchetype);
      const prompt = compileDesignPrompt({
        brandName: brand.name,
        brandVoice: brand.voice,
        brandCategory: brand.category,
        format: body.format,
        ficha: variantFicha,
        archetype: variantArchetype,
        quality,
        serviceNoProduct: Boolean(body.serviceNoProduct || !productAsset),
        variantIndex: variationIndex + 1,
        styleReferenceCount: styleReferences.length,
        brandAssetCount: (productAsset ? 1 : 0) + logoSources.length,
      });

      let generatedImage = await generateImage({
        supabase,
        prompt,
        format: body.format,
        quality,
        productAsset,
        styleReferences,
      });
      let composition = await composeGeneratedImage(generatedImage, variantFicha, logoSources);
      let image = composition.image;
      let qa = await inspectStaticImage({ supabase, image, productAsset, format: body.format, ficha: variantFicha, textVerification: composition.verification, composeError: composition.composeError });
      if (qa.veredicto === "regenerar") {
        generatedImage = await generateImage({
          supabase,
          prompt: `${prompt}\n\nREGENERACIÓN OBLIGATORIA TRAS QA: ${qa.razon}. Corrige exactamente este problema sin cambiar el producto ni el mensaje.`,
          format: body.format,
          quality,
          productAsset,
          styleReferences,
        });
        composition = await composeGeneratedImage(generatedImage, variantFicha, logoSources);
        image = composition.image;
        qa = await inspectStaticImage({ supabase, image, productAsset, format: body.format, ficha: variantFicha, textVerification: composition.verification, composeError: composition.composeError });
      }

      const storagePath = `${user.id}/${brand.id}/static-${Date.now()}-${crypto.randomUUID()}.png`;
      const buffer = Buffer.from(image, "base64");

      const { error: uploadError } = await supabase.storage.from("creative-assets").upload(storagePath, buffer, {
        contentType: "image/png",
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);

      const { data: signed } = await supabase.storage.from("creative-assets").createSignedUrl(storagePath, 60 * 60 * 24 * 7);

      const { data: saved, error: saveError } = await supabase
        .from("static_creatives")
        .insert({
          brand_id: brand.id,
          owner_id: user.id,
          storage_path: storagePath,
          prompt,
          ficha: variantFicha,
          archetype: variantFicha.arquetipo,
          format: body.format,
          funnel_stage: body.funnelStage,
          quality,
          version: index + 1,
          parent_id: body.creativeId || null,
          concept: {
            product_asset_id: productAsset?.id || null,
            service_no_product: Boolean(body.serviceNoProduct || !productAsset),
            variant: index + 1,
            reference_asset_ids: styleReferences.map((reference) => reference.id),
            format_reference: staticFormatReferencePayload(variantFicha.arquetipo),
          },
          qa_report: qa,
          metadata: {
            qa,
            compose_error: composition.composeError,
            text_verification: composition.verification,
            format_reference: staticFormatReferencePayload(variantFicha.arquetipo),
          },
          status: "generated",
        })
        .select("id,storage_path,prompt,ficha,archetype,format,funnel_stage,quality,version,status,created_at")
        .single();

      if (saveError) throw new Error(saveError.message);

      results.push({
        ...saved,
        public_url: signed?.signedUrl,
      });
    }

    return NextResponse.json({ statics: results });
  } catch (error) {
    if (creditCharge.charged) await refundCredits(user.id, creditCharge.amount, quality === "high" ? "static_generate_high" : "static_generate_medium", brand.id);
    console.error("static generation failed", error);
    const failure = imageGenerationFailure(error);
    return NextResponse.json(
      { error: failure.message, code: failure.code },
      { status: failure.status },
    );
  }
}

function adaptBriefToArchetype(ficha: StaticBrief, archetype: StaticArchetype | null): StaticBrief {
  if (!archetype) return ficha;
  const structure = archetype.structure || {};
  const zones = (structure.estructura || structure.zones || {}) as Record<string, string>;
  const art = (structure.art_direction_default || {}) as Partial<StaticBrief["art_direction"]>;
  return normalizeStaticBrief({ ...ficha, arquetipo: archetype.id, arquetipo_label: archetype.label_visible, composicion: { zona_superior: zones.zona_superior || zones.top || ficha.composicion.zona_superior, zona_media: zones.zona_media || zones.middle || zones.center || ficha.composicion.zona_media, zona_inferior: zones.zona_inferior || zones.bottom || ficha.composicion.zona_inferior }, art_direction: { ...ficha.art_direction, ...art } });
}

function normalizeStage(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

type StaticQa = {
  producto_fiel: boolean;
  texto_correcto: boolean;
  texto_presente_y_legible: boolean;
  sin_formas_vacias: boolean;
  zona_segura_ok: boolean;
  sin_artefactos: boolean;
  cumple_reglas_de_oro: boolean;
  look_disenador: boolean;
  veredicto: "aprobada" | "regenerar";
  razon: string;
};

async function inspectStaticImage({
  supabase,
  image,
  productAsset,
  format,
  ficha,
  textVerification,
  composeError,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  image: string;
  productAsset: ImageAsset | null;
  format: string;
  ficha: StaticBrief;
  textVerification: TextCompositionVerification;
  composeError: string | null;
}): Promise<StaticQa> {
  const fallback: StaticQa = applyProgrammaticQa({
    producto_fiel: true,
    texto_correcto: true,
    texto_presente_y_legible: true,
    sin_formas_vacias: true,
    zona_segura_ok: true,
    sin_artefactos: true,
    cumple_reglas_de_oro: true,
    look_disenador: true,
    veredicto: "aprobada",
    razon: "QA visual no disponible; se aplicó la verificación raster programática.",
  }, ficha, textVerification, composeError);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;
  const expectedCta = ficha.cta_usage === "none" ? "NO DEBE HABER CTA" : cleanQaText(ficha.cta) || "NO DEBE HABER CTA";
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: `Audita la PRIMERA imagen, que es el PNG FINAL YA COMPUESTO del anuncio ${format}; no evalúes una base previa.

COPY EXACTO ESPERADO
- Principal: ${JSON.stringify(cleanQaText(ficha.texto_principal))}
- Secundario: ${JSON.stringify(cleanQaText(ficha.texto_secundario))}
- CTA: ${JSON.stringify(expectedCta)}
- Disclaimer: ${JSON.stringify(cleanQaText(ficha.disclaimer) || "NO DEBE HABER DISCLAIMER")}

CHECKLIST CRÍTICO
- texto_presente_y_legible: confirma visualmente que cada bloque no vacío aparece escrito, completo, legible y con acentos correctos. Si falta principal, secundario, CTA requerido o disclaimer requerido, devuelve false.
- sin_formas_vacias: devuelve false si existe cualquier tarjeta, barra, píldora, post-it o mancha de color sin texto visible dentro. Una píldora no puede existir cuando no hay CTA y una franja legal no puede existir cuando no hay disclaimer.
- texto_correcto: el copy visible coincide exactamente con el aprobado, sin pseudotexto ni errores.
- Rechaza también si el producto está deformado o es diferente, hay elementos a menos de 6% del borde, dos badges, menos de 30% de aire, manos/rostros/packaging con artefactos o apariencia evidente de IA.
- look_disenador exige fotografía comercial creíble, jerarquía clara, materiales físicos y calidad digna de pauta.

Si CUALQUIER booleano es false, veredicto debe ser "regenerar".` },
    { type: "image_url", image_url: { url: `data:image/png;base64,${image}`, detail: "high" } },
  ];
  if (productAsset && supabase) {
    const { data } = await supabase.storage.from(productAsset.bucket_id).download(productAsset.storage_path);
    if (data) content.push({ type: "image_url", image_url: { url: `data:${productAsset.mime_type || "image/png"};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`, detail: "high" } });
  }
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini", temperature: 0, max_tokens: 600, response_format: { type: "json_schema", json_schema: { name: "static_visual_qa", strict: true, schema: { type: "object", additionalProperties: false, properties: { producto_fiel: { type: "boolean" }, texto_correcto: { type: "boolean" }, texto_presente_y_legible: { type: "boolean" }, sin_formas_vacias: { type: "boolean" }, zona_segura_ok: { type: "boolean" }, sin_artefactos: { type: "boolean" }, cumple_reglas_de_oro: { type: "boolean" }, look_disenador: { type: "boolean" }, veredicto: { type: "string", enum: ["aprobada", "regenerar"] }, razon: { type: "string" } }, required: ["producto_fiel","texto_correcto","texto_presente_y_legible","sin_formas_vacias","zona_segura_ok","sin_artefactos","cumple_reglas_de_oro","look_disenador","veredicto","razon"] } } }, messages: [{ role: "system", content: "Eres control de calidad visual estricto para anuncios DTC. La primera imagen es siempre el PNG final compuesto; la segunda, si existe, es el producto fuente de verdad." }, { role: "user", content }] }) });
    if (!response.ok) return fallback;
    const data = await response.json();
    return applyProgrammaticQa(JSON.parse(data.choices?.[0]?.message?.content || "{}") as StaticQa, ficha, textVerification, composeError);
  } catch (error) {
    console.error("static visual QA failed", error);
    return fallback;
  }
}

function cleanQaText(value: string | null | undefined) {
  return String(value || "").trim();
}

function applyProgrammaticQa(qa: StaticQa, ficha: StaticBrief, verification: TextCompositionVerification, composeError: string | null): StaticQa {
  const expectsLayeredText = ficha.text_render_mode === "layered" && [
    ficha.texto_principal,
    ficha.texto_secundario,
    ficha.cta_usage === "none" ? "" : ficha.cta,
    ficha.disclaimer,
  ].some((value) => cleanQaText(value));
  const rasterTextOk = !expectsLayeredText || (verification.passed && !composeError);
  const result = {
    ...qa,
    texto_presente_y_legible: Boolean(qa.texto_presente_y_legible && rasterTextOk),
    sin_formas_vacias: Boolean(qa.sin_formas_vacias && verification.emptyShapeCount === 0),
  };
  const checks = [result.producto_fiel, result.texto_correcto, result.texto_presente_y_legible, result.sin_formas_vacias, result.zona_segura_ok, result.sin_artefactos, result.cumple_reglas_de_oro, result.look_disenador];
  if (checks.some((check) => !check)) {
    const programmaticReason = !rasterTextOk ? `La verificación raster no encontró el texto compuesto${composeError ? `: ${composeError}` : ""}.` : "";
    return { ...result, veredicto: "regenerar", razon: [result.razon, programmaticReason].filter(Boolean).join(" ") };
  }
  return { ...result, veredicto: "aprobada" };
}

async function generateImage({
  supabase,
  prompt,
  format,
  quality,
  productAsset,
  styleReferences,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  prompt: string;
  format: string;
  quality: "medium" | "high";
  productAsset: ImageAsset | null;
  styleReferences: ImageAsset[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("La generación de imágenes aún no está activa.");

  const orderedAssets = [...(productAsset ? [productAsset] : []), ...styleReferences];
  if (orderedAssets.length && supabase) {
    const files = [];
    for (const [index, asset] of orderedAssets.entries()) {
      const { data: fileBlob, error } = await supabase.storage.from(asset.bucket_id).download(asset.storage_path);
      if (error || !fileBlob) {
        if (asset.kind === "product_photo") throw new Error("No pudimos leer la foto original del producto. Vuelve a subirla antes de generar.");
        continue;
      }
      files.push({
        blob: fileBlob,
        name: asset.kind === "style_reference"
          ? `inspiracion-no-copiar-${index + 1}-${asset.file_name}`
          : `fuente-de-verdad-marca-${asset.file_name || "producto.png"}`,
      });
    }

    if (files.length) {
      try {
        return await generateImageEdit({ apiKey, prompt, format, quality, files });
      } catch (error) {
        if (error instanceof ImageApiError) throw error;
        if (productAsset) {
          console.error("image reference rejected", error);
          throw new Error("No generamos una sustitución falsa del producto. Revisa la foto original e intenta de nuevo.");
        }
        throw error;
      }
    }
  }

  if (productAsset) throw new Error("No pudimos usar la foto original del producto. La generación fue detenida para proteger su fidelidad.");
  return generateImageFromPrompt({ apiKey, prompt, format, quality });
}

async function generateImageEdit({
  apiKey,
  prompt,
  format,
  quality,
  files,
}: {
  apiKey: string;
  prompt: string;
  format: string;
  quality: "medium" | "high";
  files: Array<{ blob: Blob; name: string }>;
}) {
  const form = new FormData();
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", getImageSize(format));
  form.append("quality", quality);
  form.append("n", "1");
  form.append("output_format", "png");
  appendInputFidelityWhenSupported(form, model);
  files.forEach((file) => form.append("image[]", file.blob, file.name));

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    throw await imageApiErrorFromResponse(response);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("La IA no devolvió imagen.");
  return b64 as string;
}

async function composeGeneratedImage(base64: string, ficha: StaticBrief, logoSources: LogoSource[]) {
  const base = Buffer.from(base64, "base64");
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const composed = await composeStaticCreative({ base, ficha, logoSources });
      return { image: composed.buffer.toString("base64"), composeError: null, verification: composed.verification };
    } catch (error) {
      lastError = error;
      console.error("static composition attempt failed", { attempt, error });
    }
  }

  const verification = lastError instanceof TextCompositionError
    ? lastError.verification
    : {
        passed: ficha.text_render_mode !== "layered",
        expectedRegions: ficha.text_render_mode === "layered" ? 1 : 0,
        totalContrastPixels: 0,
        emptyShapeCount: 0,
        regions: [],
      } satisfies TextCompositionVerification;
  const composeError = lastError instanceof Error ? lastError.message : "Falló la composición de capas.";
  return { image: base64, composeError, verification };
}

async function generateImageFromPrompt({
  apiKey,
  prompt,
  format,
  quality,
}: {
  apiKey: string;
  prompt: string;
  format: string;
  quality: "medium" | "high";
}) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt,
      size: getImageSize(format),
      quality,
      output_format: "png",
      n: 1,
    }),
  });

  if (!response.ok) {
    throw await imageApiErrorFromResponse(response);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("La IA no devolvió imagen.");
  return b64 as string;
}
