import { NextRequest, NextResponse } from "next/server";
import { CHAT_STRATEGIST_PROMPT } from "@/lib/ai/prompts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  chargeCredits,
  CREDIT_COSTS,
  creditErrorStatus,
  refundCredits,
} from "@/lib/credits";
import { estimateCostUsd } from "@/lib/ai/provider-pricing";

type ChatInput = {
  conversationId?: string | null;
  message?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "La plataforma aun no esta configurada." },
      { status: 500 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Inicia sesión para usar el chat." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as ChatInput;
  const userMessage = body.message?.trim();

  if (!userMessage) {
    return NextResponse.json(
      { error: "Escribe o dicta una pregunta para continuar." },
      { status: 400 },
    );
  }

  const { data: brand } = await supabase
    .from("brands")
    .select(
      "id,name,website,category,audience,offer,voice,content_owner,creative_goal,strategic_context",
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json(
      { error: "Primero registra una marca para darle contexto a la IA." },
      { status: 400 },
    );
  }

  const [
    { data: economics },
    { data: recipes },
    { data: latestMeta },
    { data: latestCreative },
  ] = await Promise.all([
    supabase
      .from("brand_economics")
      .select("*")
      .eq("brand_id", brand.id)
      .eq("owner_id", user.id)
      .maybeSingle(),
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
Brief estratégico profundo: ${JSON.stringify(brand.strategic_context || {})}

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

  let conversation: { id: string; title: string; updated_at: string } | null =
    null;
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (body.conversationId) {
    const { data: existingConversation } = await supabase
      .from("chat_conversations")
      .select("id,title,updated_at")
      .eq("id", body.conversationId)
      .eq("owner_id", user.id)
      .eq("brand_id", brand.id)
      .maybeSingle();

    if (!existingConversation) {
      return NextResponse.json(
        { error: "No encontramos esa conversación." },
        { status: 404 },
      );
    }

    conversation = existingConversation;
    const { data: storedMessages } = await supabase
      .from("chat_messages")
      .select("role,content")
      .eq("conversation_id", conversation.id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);

    history = (storedMessages || []).reverse().map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
  }

  const preferredProvider = process.env.OPENAI_API_KEY
    ? ("openai" as const)
    : ("anthropic" as const);
  const preferredModel =
    preferredProvider === "anthropic"
      ? process.env.ANTHROPIC_MODEL || "claude-sonnet-5"
      : process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
  let creditCharge;
  try {
    creditCharge = await chargeCredits({
      userId: user.id,
      amount: CREDIT_COSTS.chat_message,
      reason: "chat_message",
      brandId: brand.id,
      provider: preferredProvider,
      model: preferredModel,
      inputTokens: 2600,
      outputTokens: 900,
      costUsd: estimateCostUsd({
        provider: preferredProvider,
        model:
          preferredProvider === "anthropic"
            ? "claude-sonnet-5"
            : "gpt-4.1-mini",
        inputTokens: 2600,
        outputTokens: 900,
      }),
      route: "chat",
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

  let answer = "";
  let provider: "anthropic" | "openai" = preferredProvider;

  try {
    answer = await askOpenAI(brandContext, history, userMessage);
    provider = "openai";
  } catch (openAiError) {
    try {
      answer = await askAnthropic(brandContext, history, userMessage);
      provider = "anthropic";
    } catch (anthropicError) {
      if (creditCharge.charged)
        await refundCredits(
          user.id,
          creditCharge.amount,
          "chat_message",
          brand.id,
          creditCharge.operationId,
        );
      console.error("chat providers failed", openAiError, anthropicError);
      return NextResponse.json(
        {
          error:
            "La estratega no pudo responder en este momento. Intenta nuevamente; tus créditos fueron devueltos.",
        },
        { status: 500 },
      );
    }
  }

  try {
    if (!conversation) {
      const { data: createdConversation, error: conversationError } =
        await supabase
          .from("chat_conversations")
          .insert({
            owner_id: user.id,
            brand_id: brand.id,
            title: conversationTitle(userMessage),
          })
          .select("id,title,updated_at")
          .single();

      if (conversationError || !createdConversation)
        throw conversationError || new Error("No se creó la conversación.");
      conversation = createdConversation;
    } else {
      const updatedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("chat_conversations")
        .update({ updated_at: updatedAt })
        .eq("id", conversation.id)
        .eq("owner_id", user.id);
      if (updateError) throw updateError;
      conversation = { ...conversation, updated_at: updatedAt };
    }

    const { data: savedMessages, error: messageError } = await supabase
      .from("chat_messages")
      .insert([
        {
          conversation_id: conversation.id,
          owner_id: user.id,
          role: "user",
          content: userMessage,
        },
        {
          conversation_id: conversation.id,
          owner_id: user.id,
          role: "assistant",
          content: answer,
        },
      ])
      .select("id,role");

    if (messageError) throw messageError;
    const assistantMessage = savedMessages?.find(
      (message) => message.role === "assistant",
    );

    return NextResponse.json({
      answer,
      provider,
      conversation,
      messageId: assistantMessage?.id,
    });
  } catch (persistenceError) {
    if (creditCharge.charged)
      await refundCredits(
        user.id,
        creditCharge.amount,
        "chat_message",
        brand.id,
        creditCharge.operationId,
      );
    console.error("chat history persistence failed", persistenceError);
    return NextResponse.json(
      {
        error:
          "La respuesta se generó, pero no pudimos guardarla. Tus créditos fueron devueltos; intenta nuevamente.",
      },
      { status: 500 },
    );
  }
}

function conversationTitle(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 62 ? `${clean.slice(0, 59).trimEnd()}…` : clean;
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
    ?.map((part: { type: string; text?: string }) =>
      part.type === "text" ? part.text : "",
    )
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
        {
          role: "system",
          content: `${CHAT_STRATEGIST_PROMPT}\n\n${brandContext}`,
        },
        ...history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
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
