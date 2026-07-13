import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StaticGenerationInput = {
  brandId: string;
  direction: string;
  referenceMode?: string;
  format: string;
  funnelStage: string;
  variants: number;
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
    return NextResponse.json({ error: "Inicia sesión para crear estáticos." }, { status: 401 });
  }

  const body = (await request.json()) as StaticGenerationInput;
  const direction = body.direction?.trim();
  const variants = Math.min(Math.max(Number(body.variants) || 1, 1), 4);

  if (!body.brandId || !direction || direction.length < 20) {
    return NextResponse.json({ error: "Falta una dirección creativa clara para generar." }, { status: 400 });
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

  const { data: recipes } = await supabase
    .from("brand_recipes")
    .select("rule")
    .eq("brand_id", brand.id)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const results = [];

  try {
    for (let index = 0; index < variants; index += 1) {
      const prompt = buildStaticPrompt({
        brand,
        direction,
        format: body.format,
        funnelStage: body.funnelStage,
        variant: index + 1,
        recipes: (recipes || []).map((recipe) => recipe.rule),
      });

      const image = await generateImage(prompt, body.format);
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
          concept: {
            direction,
            format: body.format,
            funnel_stage: body.funnelStage,
            reference_mode: body.referenceMode || "automatico",
            variant: index + 1,
          },
          status: "generated",
        })
        .select("id,storage_path,prompt,concept,created_at")
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

function buildStaticPrompt({
  brand,
  direction,
  format,
  funnelStage,
  variant,
  recipes,
}: {
  brand: Record<string, string | null>;
  direction: string;
  format: string;
  funnelStage: string;
  variant: number;
  recipes: string[];
}) {
  return `
Crear una pieza publicitaria estática premium para Meta/Instagram.

MARCA
Nombre: ${brand.name || "No especificado"}
Categoría: ${brand.category || "No especificada"}
Audiencia: ${brand.audience || "No especificada"}
Oferta: ${brand.offer || "No especificada"}
Voz: ${brand.voice || "No especificada"}
Objetivo creativo: ${brand.creative_goal || "No especificado"}

DIRECCIÓN CREATIVA
${direction}

FORMATO: ${format}
ETAPA DEL EMBUDO: ${funnelStage}
VARIANTE: ${variant}

RECETAS GANADORAS DE LA MARCA
${recipes.length ? recipes.map((recipe, idx) => `${idx + 1}. ${recipe}`).join("\n") : "Aún no hay recetas previas; priorizar claridad de oferta y beneficio visual."}

REQUISITOS VISUALES
- Diseño limpio, femenino, moderno y premium, sin parecer plantilla genérica.
- Jerarquía clara: hook principal grande, beneficio concreto, prueba o mecanismo, CTA breve.
- Composición lista para anuncio: producto/beneficio debe entenderse en 2 segundos.
- No uses textos diminutos ni bloques largos. Máximo 8-12 palabras visibles.
- Evita marcas de agua, mockups con texto ilegible, exceso de elementos y fondos oscuros pesados.
- Si representas personas, que se vean naturales, aspiracionales y reales.
`;
}

async function generateImage(prompt: string, format: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("La generación de imágenes aún no está activa.");

  const size = format.includes("1:1") || format.includes("Carrusel") ? "1024x1024" : "1024x1536";

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt,
      size,
      n: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 240));
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("La IA no devolvió imagen.");
  return b64;
}
