import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RECHARGE_PACKAGES, type RechargePackageId } from "@/lib/recharge-packages";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient(); const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Las recargas están temporalmente en mantenimiento." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para solicitar una recarga." }, { status: 401 });
  const { package: packageId } = (await request.json()) as { package?: RechargePackageId };
  const selected = packageId ? RECHARGE_PACKAGES[packageId] : null;
  if (!selected || !packageId) return NextResponse.json({ error: "Elige un paquete válido." }, { status: 400 });
  await admin.from("recharge_requests").update({ status: "expirada", resolved_at: new Date().toISOString() }).eq("user_id", user.id).eq("status", "pendiente").lt("created_at", new Date(Date.now() - 72 * 3600_000).toISOString());
  const { data: pending } = await admin.from("recharge_requests").select("folio").eq("user_id", user.id).eq("status", "pendiente").maybeSingle();
  if (pending) return NextResponse.json({ error: `Ya tienes una recarga pendiente con folio ${pending.folio}.` }, { status: 409 });
  const { data: profile } = await admin.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle();
  const { data, error } = await admin.from("recharge_requests").insert({ user_id: user.id, package: packageId, amount_usd: selected.amount, credits: selected.credits }).select("folio").single();
  if (error || !data) { console.error("recharge request failed", error); return NextResponse.json({ error: "No pudimos crear la solicitud de recarga." }, { status: 500 }); }
  const phone = (process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || "").replace(/\D/g, "");
  const message = `Hola, soy ${profile?.full_name || "usuaria de Anapau iA"} (${profile?.email || user.email}). Folio ${data.folio}: quiero el paquete ${selected.name} de $${selected.amount} (${selected.credits.toLocaleString("es-MX")} créditos).`;
  return NextResponse.json({ folio: data.folio, whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null });
}
