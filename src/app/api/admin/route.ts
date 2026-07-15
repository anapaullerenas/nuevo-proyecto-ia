import { NextRequest, NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-auth";

const PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });

  const userId = request.nextUrl.searchParams.get("userId") || "";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1));
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: "Usuaria no válida." }, { status: 400 });

  const { admin } = context;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const [ledgerResult, allLedgerResult, rechargesResult, brandsResult, brandFilesResult, creativeFilesResult, galleryResult] = await Promise.all([
    admin
      .from("credit_ledger")
      .select("id,amount,reason,source,metadata,balance_after,allowance_remaining_after,created_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to),
    admin.from("credit_ledger").select("amount,metadata").eq("user_id", userId).lt("amount", 0),
    admin
      .from("recharge_requests")
      .select("id,folio,package,amount_usd,credits,status,note,created_at,resolved_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin.from("brands").select("id,name,status,created_at").eq("owner_id", userId).order("created_at", { ascending: false }),
    admin
      .from("brand_assets")
      .select("id,brand_id,file_name,kind,file_size,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("creative_assets")
      .select("id,brand_id,file_name,asset_type,file_size,status,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("static_creatives")
      .select("id,brand_id,storage_path,status,quality,created_at")
      .eq("owner_id", userId)
      .not("storage_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const errors = [
    ledgerResult.error,
    allLedgerResult.error,
    rechargesResult.error,
    brandsResult.error,
    brandFilesResult.error,
    creativeFilesResult.error,
    galleryResult.error,
  ].filter(Boolean);
  if (errors.length) {
    console.error("admin user detail failed", errors);
    return NextResponse.json({ error: "No pudimos cargar el detalle de esta usuaria." }, { status: 500 });
  }

  const moduleMap = new Map<string, { credits: number; cost: number; actions: number }>();
  for (const row of allLedgerResult.data || []) {
    const metadata = row.metadata as { module?: string; cost_usd?: number } | null;
    const moduleName = metadata?.module || "otros";
    const current = moduleMap.get(moduleName) || { credits: 0, cost: 0, actions: 0 };
    current.credits += Math.abs(Number(row.amount || 0));
    current.cost += Number(metadata?.cost_usd || 0);
    current.actions += 1;
    moduleMap.set(moduleName, current);
  }

  const gallery = await Promise.all(
    (galleryResult.data || []).map(async (item) => {
      const { data } = await admin.storage.from("creative-assets").createSignedUrl(item.storage_path || "", 3600);
      return { ...item, url: data?.signedUrl || null };
    }),
  );

  return NextResponse.json({
    ledger: ledgerResult.data || [],
    ledgerPage: page,
    ledgerPages: Math.max(1, Math.ceil((ledgerResult.count || 0) / PAGE_SIZE)),
    modules: [...moduleMap.entries()]
      .map(([module, values]) => ({ module, ...values }))
      .sort((a, b) => b.credits - a.credits),
    recharges: rechargesResult.data || [],
    brands: brandsResult.data || [],
    files: [...(brandFilesResult.data || []), ...(creativeFilesResult.data || [])],
    gallery,
  });
}

export async function POST(request: NextRequest) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Acceso restringido." }, { status: 403 });

  const { admin, user } = context;
  const body = (await request.json()) as {
    action?: string;
    requestId?: string;
    userId?: string;
    amount?: number;
    reason?: string;
    status?: string;
    email?: string;
    fullName?: string;
    note?: string;
  };

  try {
    if (body.action === "approve_recharge" && body.requestId) {
      const { error } = await admin.rpc("approve_recharge", { p_request_id: body.requestId, p_admin_id: user.id });
      if (error) throw error;
    } else if (body.action === "reject_recharge" && body.requestId && body.reason?.trim()) {
      const { data, error } = await admin
        .from("recharge_requests")
        .update({ status: "rechazada", note: body.reason.trim(), resolved_at: new Date().toISOString(), resolved_by: user.id })
        .eq("id", body.requestId)
        .eq("status", "pendiente")
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("La solicitud ya fue resuelta.");
    } else if (body.action === "grant" && body.userId && Number(body.amount) > 0 && body.reason?.trim()) {
      const amount = Math.min(100_000, Math.round(Number(body.amount)));
      const { error } = await admin.rpc("admin_adjust_credits", {
        p_user_id: body.userId,
        p_amount: amount,
        p_reason: "admin_manual_grant",
        p_admin_id: user.id,
        p_metadata: {
          reason: body.reason.trim(),
          granted_by: user.id,
          note: body.note?.trim() || null,
        },
      });
      if (error) throw error;
    } else if (body.action === "deduct" && body.userId && Number(body.amount) > 0 && body.reason?.trim()) {
      const amount = Math.min(100_000, Math.round(Number(body.amount)));
      const { error } = await admin.rpc("admin_adjust_credits", {
        p_user_id: body.userId,
        p_amount: -amount,
        p_reason: "admin_manual_deduct",
        p_admin_id: user.id,
        p_metadata: {
          reason: body.reason.trim(),
          deducted_by: user.id,
          note: body.note?.trim() || null,
        },
      });
      if (error) throw error;
    } else if (body.action === "status" && body.userId && ["active", "inactive"].includes(body.status || "")) {
      const { error } = await admin.from("profiles").update({ skool_status: body.status }).eq("id", body.userId);
      if (error) throw error;
    } else if (body.action === "add_access" && body.email) {
      const email = normalizeEmail(body.email);
      if (!email) return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });

      const { error: accessError } = await admin.from("manual_access_emails").upsert(
        {
          email,
          email_normalized: email,
          full_name: body.fullName?.trim() || null,
          note: body.note?.trim() || "Alta manual desde admin",
          status: "active",
          created_by: user.id,
          updated_by: user.id,
        },
        { onConflict: "email_normalized" },
      );
      if (accessError) throw accessError;

      let authUserId = await findAuthUserIdByEmail(email);
      if (!authUserId) {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: body.fullName?.trim()
            ? { full_name: body.fullName.trim() }
            : undefined,
        });
        if (createError && !createError.message.toLowerCase().includes("already")) throw createError;
        authUserId = created.user?.id || (await findAuthUserIdByEmail(email));
      }

      if (authUserId) {
        const { error: profileError } = await admin.from("profiles").upsert({
          id: authUserId,
          email,
          full_name: body.fullName?.trim() || null,
          skool_status: "active",
        });
        if (profileError) throw profileError;

        const { error: walletError } = await admin.from("credit_wallets").upsert({
          user_id: authUserId,
          balance: 0,
          monthly_allowance: 600,
          allowance_used: 0,
        }, { onConflict: "user_id", ignoreDuplicates: true });
        if (walletError) throw walletError;
      }
    } else if (body.action === "access_status" && body.email && ["active", "inactive"].includes(body.status || "")) {
      const email = normalizeEmail(body.email);
      if (!email) return NextResponse.json({ error: "Correo no válido." }, { status: 400 });
      const { error } = await admin
        .from("manual_access_emails")
        .update({ status: body.status, updated_by: user.id })
        .eq("email_normalized", email);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: "Acción administrativa incompleta." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin action failed", error);
    return NextResponse.json({ error: "No se pudo completar la acción. Actualiza el panel e intenta nuevamente." }, { status: 500 });
  }

  async function findAuthUserIdByEmail(email: string) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    return data.users.find((item) => item.email?.toLowerCase() === email)?.id || null;
  }
}

function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !email.includes("@")) return "";
  return email;
}
