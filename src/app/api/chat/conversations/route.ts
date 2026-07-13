import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "La plataforma aún no está configurada.", status: 500 } as const;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Inicia sesión para ver tus conversaciones.", status: 401 } as const;

  return { supabase, user } as const;
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedClient();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const conversationId = request.nextUrl.searchParams.get("id");
  if (!conversationId) {
    return NextResponse.json({ error: "Selecciona una conversación." }, { status: 400 });
  }

  const { data: conversation } = await auth.supabase
    .from("chat_conversations")
    .select("id,title,updated_at")
    .eq("id", conversationId)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ error: "No encontramos esa conversación." }, { status: 404 });
  }

  const { data: messages, error } = await auth.supabase
    .from("chat_messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "No pudimos cargar la conversación." }, { status: 500 });
  }

  return NextResponse.json({
    conversation,
    messages: (messages || []).map((message) => ({
      id: message.id,
      role: message.role,
      text: message.content,
    })),
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedClient();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const conversationId = request.nextUrl.searchParams.get("id");
  if (!conversationId) {
    return NextResponse.json({ error: "Selecciona una conversación." }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("owner_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: "No pudimos eliminar la conversación." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
