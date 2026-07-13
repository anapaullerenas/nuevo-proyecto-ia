import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const session = await createSupabaseServerClient(); const admin = createSupabaseAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Administración no configurada." }, { status: 503 });
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!allowed.length || !allowed.includes((user.email || "").toLowerCase()) || profile?.role !== "admin") return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });
  const body = await request.json() as { action?: string; requestId?: string; userId?: string; amount?: number; reason?: string; status?: string };
  try {
    if (body.action === "approve_recharge" && body.requestId) { const { error } = await admin.rpc("approve_recharge", { p_request_id: body.requestId, p_admin_id: user.id }); if (error) throw error; }
    else if (body.action === "reject_recharge" && body.requestId && body.reason?.trim()) { const { data, error } = await admin.from("recharge_requests").update({ status: "rechazada", note: body.reason.trim(), resolved_at: new Date().toISOString(), resolved_by: user.id }).eq("id", body.requestId).eq("status", "pendiente").select("id").maybeSingle(); if (error || !data) throw new Error("La solicitud ya fue resuelta."); }
    else if (body.action === "grant" && body.userId && Number(body.amount) > 0 && body.reason?.trim()) { const { error } = await admin.rpc("grant_credits", { p_user_id: body.userId, p_amount: Math.min(100000, Math.round(Number(body.amount))), p_reason: "admin_grant", p_metadata: { reason: body.reason.trim(), granted_by: user.id, provider: "manual", model: "manual", input_tokens: 0, output_tokens: 0, images: 0, cost_usd: 0 } }); if (error) throw error; }
    else if (body.action === "status" && body.userId && ["active","inactive"].includes(body.status || "")) { const { error } = await admin.from("profiles").update({ skool_status: body.status }).eq("id", body.userId); if (error) throw error; }
    else return NextResponse.json({ error: "Acción administrativa incompleta." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("admin action failed", error); return NextResponse.json({ error: "No se pudo completar la acción. Actualiza el panel e intenta nuevamente." }, { status: 500 }); }
}
