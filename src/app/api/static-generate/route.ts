import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { compileDesignPrompt, getImageSize, normalizeStaticBrief, StaticArchetype, StaticBrief } from "@/lib/ai/static-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    .select("id,name,voice")
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

  if (!body.serviceNoProduct && !productAsset) {
    return NextResponse.json({ error: "Elige una foto real del producto. No generaremos un empaque inventado." }, { status: 400 });
  }

  const [{ data: logoAssets }, { count: referenceCount }] = await Promise.all([
    supabase
      .from("brand_assets")
      .select("id,bucket_id,storage_path,file_name,mime_type,kind,metadata")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .eq("kind", "logo")
      .limit(6),
    supabase
      .from("brand_assets")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .eq("kind", "style_reference"),
  ]);

  if (!logoAssets?.length || (referenceCount || 0) < 5) {
    return NextResponse.json({ error: "Completa el kit visual con un logo y cinco referencias antes de generar." }, { status: 400 });
  }

  let styleReferences: ImageAsset[] = [];
  if (Array.isArray(body.referenceAssetIds) && body.referenceAssetIds.length) {
    const { data } = await supabase
      .from("brand_assets")
      .select("id,bucket_id,storage_path,file_name,mime_type,kind")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .eq("kind", "style_reference")
      .in("id", body.referenceAssetIds.slice(0, 10));
    styleReferences = data || [];
  }

  const logoSources = (await Promise.all(logoAssets.map(async (asset) => {
    const { data: blob } = await supabase.storage.from(asset.bucket_id).download(asset.storage_path);
    if (!blob) return null;
    return {
      buffer: Buffer.from(await blob.arrayBuffer()),
      variant: asset.metadata?.logo_variant || "primary",
    } as LogoSource;
  }))).filter((source): source is LogoSource => Boolean(source));

  if (!logoSources.length) {
    return NextResponse.json({ error: "No pudimos leer los logotipos oficiales. Vuelve a subirlos antes de generar." }, { status: 400 });
  }

  const { data: archetype } = ficha.arquetipo
    ? await supabase
        .from("static_archetypes")
        .select("id,name,label_visible,stage,prompt_fragment,structure")
        .eq("id", ficha.arquetipo)
        .maybeSingle()
    : { data: null };

  try {
    const results = [];
    for (let index = 0; index < variants; index += 1) {
      const prompt = compileDesignPrompt({
        brandName: brand.name,
        brandVoice: brand.voice,
        format: body.format,
        ficha,
        archetype: (archetype as StaticArchetype | null) || null,
        quality,
        serviceNoProduct: Boolean(body.serviceNoProduct),
        variantIndex: index + 1,
        styleReferenceCount: styleReferences.length,
        brandAssetCount: (productAsset ? 1 : 0) + logoSources.length,
      });

      const generatedImage = await generateImage({
        supabase,
        prompt,
        format: body.format,
        quality,
        productAsset,
        styleReferences,
      });
      const image = await composeBrandLayers(generatedImage, ficha, logoSources);

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
          ficha,
          archetype: ficha.arquetipo,
          format: body.format,
          funnel_stage: body.funnelStage,
          quality,
          version: index + 1,
          parent_id: body.creativeId || null,
          concept: {
            product_asset_id: productAsset?.id || null,
            service_no_product: Boolean(body.serviceNoProduct),
            variant: index + 1,
            reference_asset_ids: styleReferences.map((reference) => reference.id),
          },
          qa_report: {
            status: "pendiente_revision_visual",
            checklist: ["texto exacto", "producto visible", "zona segura", "sin elementos basura"],
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el estático." },
      { status: 500 },
    );
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

  const orderedAssets = [...styleReferences, ...(productAsset ? [productAsset] : [])];
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
        if (productAsset) {
          const detail = error instanceof Error ? error.message : "OpenAI rechazó la referencia.";
          throw new Error(`No generamos una sustitución falsa del producto. Revisa la foto original e intenta de nuevo. ${detail}`);
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
  form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
  form.append("prompt", prompt);
  form.append("size", getImageSize(format));
  form.append("quality", quality);
  form.append("n", "1");
  form.append("output_format", "png");
  files.forEach((file) => form.append("image[]", file.blob, file.name));

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 220));
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("La IA no devolvió imagen.");
  return b64 as string;
}

async function composeBrandLayers(base64: string, ficha: StaticBrief, logoSources: LogoSource[]) {
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

  const overlays: Array<{ input: Buffer; left?: number; top?: number }> = [];
  if (ficha.logo_usage !== "none") {
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
    const headlineLines = svgTextLines(ficha.texto_principal, 30, margin * 1.45, boxY + headlineSize * 1.18, headlineSize * 1.05);
    const secondaryY = boxY + headlineSize * (headlineLines.count > 1 ? 3.05 : 2.05);
    const overlay = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .copy { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; }
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
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 220));
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("La IA no devolvió imagen.");
  return b64 as string;
}
