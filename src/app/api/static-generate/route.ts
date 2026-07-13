import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { compileDesignPrompt, getImageSize, normalizeStaticBrief, StaticArchetype, StaticBrief } from "@/lib/ai/static-machine";
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
type LogoSource = { buffer: Buffer; variant: "primary" | "light" | "dark" };

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
  const { data: visualIdentity } = await supabase.from("brand_visual_identity").select("tipografia_estilo").eq("brand_id", brand.id).maybeSingle();

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
      let image = await composeBrandLayers(generatedImage, variantFicha, logoSources, visualIdentity?.tipografia_estilo);
      let qa = await inspectStaticImage({ supabase, image, productAsset, format: body.format, ficha: variantFicha });
      if (qa.veredicto === "regenerar") {
        generatedImage = await generateImage({
          supabase,
          prompt: `${prompt}\n\nREGENERACIÓN OBLIGATORIA TRAS QA: ${qa.razon}. Corrige exactamente este problema sin cambiar el producto ni el mensaje.`,
          format: body.format,
          quality,
          productAsset,
          styleReferences,
        });
        image = await composeBrandLayers(generatedImage, variantFicha, logoSources, visualIdentity?.tipografia_estilo);
        qa = await inspectStaticImage({ supabase, image, productAsset, format: body.format, ficha: variantFicha });
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
          metadata: { qa, format_reference: staticFormatReferencePayload(variantFicha.arquetipo) },
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

type StaticQa = { producto_fiel: boolean; texto_correcto: boolean; zona_segura_ok: boolean; sin_artefactos: boolean; cumple_reglas_de_oro: boolean; look_disenador: boolean; veredicto: "aprobada" | "regenerar"; razon: string };

async function inspectStaticImage({ supabase, image, productAsset, format, ficha }: { supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>; image: string; productAsset: ImageAsset | null; format: string; ficha: StaticBrief }): Promise<StaticQa> {
  const fallback: StaticQa = { producto_fiel: true, texto_correcto: true, zona_segura_ok: true, sin_artefactos: true, cumple_reglas_de_oro: true, look_disenador: true, veredicto: "aprobada", razon: "QA visual no disponible; requiere revisión humana." };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: `Audita este anuncio ${format}. Texto aprobado: ${ficha.texto_principal} / ${ficha.texto_secundario} / ${ficha.cta_usage === "none" ? "sin CTA" : ficha.cta}. Rechaza si: producto deformado o diferente, texto baked incorrecto, elementos a menos de 6% del borde, dos badges, menos de 30% de aire, manos/rostros/packaging con artefactos o apariencia evidente de IA. look_disenador exige fotografía comercial creíble, jerarquía y materiales físicos.` },
    { type: "image_url", image_url: { url: `data:image/png;base64,${image}`, detail: "high" } },
  ];
  if (productAsset && supabase) {
    const { data } = await supabase.storage.from(productAsset.bucket_id).download(productAsset.storage_path);
    if (data) content.push({ type: "image_url", image_url: { url: `data:${productAsset.mime_type || "image/png"};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`, detail: "high" } });
  }
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini", temperature: 0, max_tokens: 500, response_format: { type: "json_schema", json_schema: { name: "static_visual_qa", strict: true, schema: { type: "object", additionalProperties: false, properties: { producto_fiel: { type: "boolean" }, texto_correcto: { type: "boolean" }, zona_segura_ok: { type: "boolean" }, sin_artefactos: { type: "boolean" }, cumple_reglas_de_oro: { type: "boolean" }, look_disenador: { type: "boolean" }, veredicto: { type: "string", enum: ["aprobada", "regenerar"] }, razon: { type: "string" } }, required: ["producto_fiel","texto_correcto","zona_segura_ok","sin_artefactos","cumple_reglas_de_oro","look_disenador","veredicto","razon"] } } }, messages: [{ role: "system", content: "Eres control de calidad visual estricto para anuncios DTC. La primera imagen es el anuncio; la segunda, si existe, es el producto fuente de verdad." }, { role: "user", content }] }) });
    if (!response.ok) return fallback;
    const data = await response.json();
    return JSON.parse(data.choices?.[0]?.message?.content || "{}") as StaticQa;
  } catch (error) {
    console.error("static visual QA failed", error);
    return fallback;
  }
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

async function composeBrandLayers(base64: string, ficha: StaticBrief, logoSources: LogoSource[], typographyStyle?: string | null) {
  const input = Buffer.from(base64, "base64");
  const image = sharp(input);
  const metadata = await image.metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1350;
  const margin = Math.round(width * .07);
  const headlineSize = Math.round(width * .058);
  const secondarySize = Math.round(width * .029);
  const disclaimerSize = Math.round(width * .018);
  const boxHeight = Math.round(height * (ficha.disclaimer ? .22 : .18));
  const boxY = height - boxHeight - margin;
  const secondary = escapeSvg(ficha.texto_secundario);
  const cta = escapeSvg(ficha.cta);
  const disclaimer = escapeSvg(ficha.disclaimer);
  const palette = /^#[0-9a-f]{6}$/i.test(ficha.paleta[0] || "") ? ficha.paleta[0] : "#632E59";
  const typeface = typographyStyle === "serif_editorial" ? "Georgia,serif" : typographyStyle === "condensada" ? "Impact,sans-serif" : typographyStyle === "redondeada" ? "Trebuchet MS,sans-serif" : typographyStyle === "manuscrita" ? "Comic Sans MS,cursive" : "Helvetica Neue,Arial,sans-serif";

  const overlays: Array<{ input: Buffer; left?: number; top?: number }> = [];
  if (ficha.logo_usage !== "none" && logoSources.length > 0) {
    const sampleWidth = Math.max(1, Math.round(width * .28));
    const sampleHeight = Math.max(1, Math.round(height * .12));
    const { channels } = await sharp(input).extract({ left: width - sampleWidth, top: 0, width: sampleWidth, height: sampleHeight }).stats();
    const luminance = channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / Math.max(1, Math.min(3, channels.length));
    const preferredVariant = luminance < 138 ? "light" : "dark";
    const chosen = logoSources.find((source) => source.variant === preferredVariant)
      || logoSources.find((source) => source.variant === "primary")
      || logoSources[0];
    const logoWidth = Math.round(width * (ficha.logo_usage === "prominent" ? .19 : .13));
    const logo = await sharp(chosen.buffer).resize({ width: logoWidth, height: Math.round(height * .065), fit: "inside" }).png().toBuffer();
    const logoMeta = await sharp(logo).metadata();
    overlays.push({ input: logo, left: width - margin - (logoMeta.width || logoWidth), top: margin });
  }

  if (ficha.text_render_mode === "layered") {
    if (ficha.arquetipo === "post_its") {
      const postIt = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>.note{font-family:'Comic Sans MS',cursive;fill:#392a35;text-anchor:middle;font-weight:700}.fine{font-family:${typeface};fill:#fff;font-size:${disclaimerSize}px}</style><g transform="translate(${margin},${Math.round(height*.12)}) rotate(-3 ${Math.round(width*.2)} ${Math.round(height*.08)})"><rect width="${Math.round(width*.42)}" height="${Math.round(height*.15)}" rx="8" fill="#fff1a8" filter="drop-shadow(0 8px 8px rgba(40,20,35,.18))"/><text x="${Math.round(width*.21)}" y="${Math.round(height*.09)}" class="note" font-size="${headlineSize*.72}">${escapeSvg(ficha.texto_principal)}</text></g><g transform="translate(${Math.round(width*.5)},${Math.round(height*.44)}) rotate(3 ${Math.round(width*.2)} ${Math.round(height*.08)})"><rect width="${Math.round(width*.4)}" height="${Math.round(height*.15)}" rx="8" fill="#f6c6df" filter="drop-shadow(0 8px 8px rgba(40,20,35,.18))"/><text x="${Math.round(width*.2)}" y="${Math.round(height*.09)}" class="note" font-size="${secondarySize*.9}">${escapeSvg(ficha.texto_secundario)}</text></g>${ficha.cta_usage!=="none"?`<g transform="translate(${Math.round(width*.12)},${Math.round(height*.72)}) rotate(-2 ${Math.round(width*.18)} ${Math.round(height*.06)})"><rect width="${Math.round(width*.36)}" height="${Math.round(height*.12)}" rx="8" fill="#dce8c8" filter="drop-shadow(0 8px 8px rgba(40,20,35,.18))"/><text x="${Math.round(width*.18)}" y="${Math.round(height*.074)}" class="note" font-size="${secondarySize*.88}">${escapeSvg(ficha.cta)}</text></g>`:""}${disclaimer?`<text x="${margin}" y="${height-margin}" class="fine">${disclaimer}</text>`:""}</svg>`;
      overlays.unshift({ input: Buffer.from(postIt) });
    } else if (ficha.arquetipo === "anotaciones_manuscritas") {
      const notes = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>.note{font-family:'Comic Sans MS',cursive;fill:#fff;font-weight:800;paint-order:stroke;stroke:rgba(30,20,28,.3);stroke-width:3px}</style><text x="${margin}" y="${Math.round(height*.18)}" class="note" font-size="${headlineSize*.72}">${escapeSvg(ficha.texto_principal)} ↘</text><text x="${Math.round(width*.48)}" y="${Math.round(height*.78)}" class="note" font-size="${secondarySize}">↖ ${escapeSvg(ficha.texto_secundario)}</text></svg>`;
      overlays.unshift({ input: Buffer.from(notes) });
    } else {
    const headlineLines = svgTextLines(ficha.texto_principal, 30, margin * 1.45, boxY + headlineSize * 1.18, headlineSize * 1.05);
    const secondaryY = boxY + headlineSize * (headlineLines.count > 1 ? 3.05 : 2.05);
    const overlay = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .copy { font-family: ${typeface}; fill: #ffffff; }
        .headline { font-size: ${headlineSize}px; font-weight: 800; letter-spacing: -1px; }
        .secondary { font-size: ${secondarySize}px; font-weight: 600; }
        .cta { font-size: ${secondarySize}px; font-weight: 800; fill: ${palette}; }
        .legal { font-size: ${disclaimerSize}px; font-weight: 500; fill: rgba(255,255,255,.86); }
      </style>
      <rect x="${margin}" y="${boxY}" width="${width - margin * 2}" height="${boxHeight}" rx="${Math.round(width * .025)}" fill="${palette}" fill-opacity=".94"/>
      <text class="copy headline">${headlineLines.svg}</text>
      <text x="${margin * 1.45}" y="${secondaryY}" class="copy secondary">${secondary}</text>
      ${ficha.cta_usage === "button" ? `<rect x="${width - margin * 1.45 - Math.min(width * .3, Math.max(170, cta.length * secondarySize * .56))}" y="${boxY + headlineSize * 1.15}" width="${Math.min(width * .3, Math.max(170, cta.length * secondarySize * .56))}" height="${secondarySize * 1.75}" rx="${secondarySize * .88}" fill="#fff6f0"/>` : ""}
      ${ficha.cta_usage !== "none" ? `<text x="${width - margin * 1.45 - Math.min(width * .3, Math.max(170, cta.length * secondarySize * .56)) / 2}" y="${boxY + headlineSize * 1.15 + secondarySize * 1.15}" text-anchor="middle" class="copy cta">${cta}</text>` : ""}
      ${disclaimer ? `<text x="${margin * 1.45}" y="${boxY + boxHeight - disclaimerSize * 1.5}" class="copy legal">${disclaimer}</text>` : ""}
    </svg>`;
    overlays.unshift({ input: Buffer.from(overlay) });
    }
  }

  const output = await image.composite(overlays).png().toBuffer();
  return output.toString("base64");
}

function escapeSvg(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] || character);
}

function svgTextLines(value: string, maxCharacters: number, x: number, y: number, lineHeight: number) {
  const words = escapeSvg(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1) || "";
    if (!current || `${current} ${word}`.length > maxCharacters) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  }
  const visible = lines.slice(0, 2);
  return {
    count: visible.length,
    svg: visible.map((line, index) => `<tspan x="${x}" y="${y + index * lineHeight}">${line}</tspan>`).join(""),
  };
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
