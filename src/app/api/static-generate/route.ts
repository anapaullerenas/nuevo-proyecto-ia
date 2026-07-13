import { NextRequest, NextResponse } from "next/server";
import { compileDesignPrompt, getImageSize, normalizeStaticBrief, StaticArchetype, StaticBrief } from "@/lib/ai/static-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StaticGenerateInput = {
  brandId: string;
  creativeId?: string;
  ficha: StaticBrief;
  format: string;
  funnelStage: string;
  quality?: "medium" | "high";
  variants?: number;
  productAssetId?: string;
  serviceNoProduct?: boolean;
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

  let productAsset: { id: string; bucket_id: string; storage_path: string; file_name: string; mime_type: string | null } | null = null;
  if (!body.serviceNoProduct && body.productAssetId) {
    const { data: asset } = await supabase
      .from("brand_assets")
      .select("id,bucket_id,storage_path,file_name,mime_type")
      .eq("id", body.productAssetId)
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .maybeSingle();
    productAsset = asset;
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
      });

      const image = await generateImage({
        supabase,
        prompt,
        format: body.format,
        quality,
        productAsset,
      });

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
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  prompt: string;
  format: string;
  quality: "medium" | "high";
  productAsset: { bucket_id: string; storage_path: string; file_name: string; mime_type: string | null } | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("La generación de imágenes aún no está activa.");

  if (productAsset && supabase) {
    const { data: fileBlob } = await supabase.storage.from(productAsset.bucket_id).download(productAsset.storage_path);
    if (fileBlob) {
      try {
        return await generateImageEdit({
          apiKey,
          prompt,
          format,
          quality,
          fileBlob,
          fileName: productAsset.file_name,
        });
      } catch {
        // Si OpenAI rechaza la referencia por formato/peso, generamos sin bloquear la prueba.
      }
    }
  }

  return generateImageFromPrompt({ apiKey, prompt, format, quality });
}

async function generateImageEdit({
  apiKey,
  prompt,
  format,
  quality,
  fileBlob,
  fileName,
}: {
  apiKey: string;
  prompt: string;
  format: string;
  quality: "medium" | "high";
  fileBlob: Blob;
  fileName: string;
}) {
  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
  form.append("prompt", prompt);
  form.append("size", getImageSize(format));
  form.append("quality", quality);
  form.append("n", "1");
  form.append("image", fileBlob, fileName || "producto.png");

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
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt,
      size: getImageSize(format),
      quality,
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
