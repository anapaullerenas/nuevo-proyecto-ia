import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "La confirmación está temporalmente en mantenimiento." }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const sessionId = request.nextUrl.searchParams.get("session_id") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ error: "Sesión de pago inválida." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("stripe_checkout_sessions")
    .select("status,credits,updated_at")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "No pudimos consultar el pago." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
  return NextResponse.json(data);
}
