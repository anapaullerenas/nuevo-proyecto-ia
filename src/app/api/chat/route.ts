import { NextRequest, NextResponse } from "next/server";
import { CHAT_STRATEGIST_PROMPT } from "@/lib/ai/prompts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ChatInput = {
  messages?: Array<{ role: "user" | "assistant"; text: string }>;
  message?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "La plataforma aun no esta configurada." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para usar el chat." }, { status: 401 });
  }

  const body = (await request.json()) as ChatInput;
  const userMessage = body.message?.trim();

  if (!userMessage) {
    return NextResponse.json({ error: "Escribe o dicta una pregunta para continuar." }, { status: 400 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id,name,website,category,audience,offer,voice,content_owner,creative_goal")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "Primero registra una marca para darle contexto a la IA." }, { status: 400 });
  }

  const [{ data: economics }, { data: recipes }, { data: latestMeta }, { data: latestCreative }] = await Promise.all([
    supabase.from("brand_economics").select("*").eq("brand_id", brand.id).eq("owner_id", user.id).maybeSingle(),
    supabase
      .from("brand_recipes")
      .select("rule")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("meta_imports")
      .select("file_name,status,summary,created_at")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("creative_analyses")
      .select("score,verdict,analysis,created_at")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const brandContext = `
MARCA ACTIVA
Nombre: ${brand.name || "Sin nombre"}
Categoria: ${brand.category || "No especificada"}
Sitio/Instagram: ${brand.website || "No especificado"}
Audiencia: ${brand.audience || "No especificada"}
Oferta: ${brand.offer || "No especificada"}
Voz de marca: ${brand.voice || "No especificada"}
Quien crea contenido: ${brand.content_owner || "No especificado"}
Objetivo creativo: ${brand.creative_goal || "No especificado"}

NUMEROS DE RENTABILIDAD GUARDADOS
${
  economics
    ? `Ticket: $${economics.ticket}
CPA objetivo: $${economics.target_cpa}
ROAS break even: ${economics.break_even_roas}x
ROAS objetivo: ${economics.target_roas}x
CPL/mensaje maximo: $${economics.max_cpl}`
    : "La marca aun no ha guardado su calculadora de costos."
}

ULTIMO ANALISIS META
${
  latestMeta
    ? `Archivo: ${latestMeta.file_name || "Sin nombre"}
Estado: ${latestMeta.status}
Resumen: ${JSON.stringify(latestMeta.summary || {}).slice(0, 900)}`
    : "Aun no hay export de Meta analizado."
}

RECETAS GANADORAS ACUMULADAS
${
  recipes?.length
    ? recipes.map((recipe, index) => `${index + 1}. ${recipe.rule}`).join("\n")
    : "Aun no hay recetas ganadoras guardadas."
}

ULTIMO ANALISIS CREATIVO
${
  latestCreative
    ? `Score: ${latestCreative.score}/100
Etiqueta: ${latestCreative.verdict}
Aprendizaje: ${String((latestCreative.analysis as { winning_reason?: string } | null)?.winning_reason || "").slice(0, 600)}`
    : "Aun no hay analisis creativo guardado."
}
`;

  const history = (body.messages || [])
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.text,
    }));

  try {
    const answer = await askAnthropic(brandContext, history, userMessage);
    return NextResponse.json({ answer, provider: "anthropic" });
  } catch (anthropicError) {
    try {
      const answer = await askOpenAI(brandContext, history, userMessage);
      return NextResponse.json({ answer, provider: "openai" });
    } catch {
      const message = anthropicError instanceof Error ? anthropicError.message : "No se pudo generar respuesta.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
}

async function askAnthropic(
  brandContext: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("El asistente aun no esta activo.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 1400,
      temperature: 0.65,
      system: `${CHAT_STRATEGIST_PROMPT}\n\n${brandContext}`,
      messages: [...history, { role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 220));
  }

  const data = await response.json();
  const text = data.content
    ?.map((part: { type: string; text?: string }) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();

  if (!text) throw new Error("La IA no devolvio respuesta.");
  return text;
}

async function askOpenAI(
  brandContext: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("El asistente aun no esta activo.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini",
      temperature: 0.65,
      max_tokens: 1400,
      messages: [
        { role: "system", content: `${CHAT_STRATEGIST_PROMPT}\n\n${brandContext}` },
        ...history.map((message) => ({ role: message.role, content: message.content })),
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText.slice(0, 220));
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) throw new Error("La IA no devolvio respuesta.");
  return text;
}
