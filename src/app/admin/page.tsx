import Link from "next/link";
import { BrandMark } from "@/components/BrandIdentity";
import { AdminConsole, AdminDashboardData } from "@/components/AdminConsole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CREDIT_CATALOG,
  INITIAL_INCLUDED_CREDITS,
  TRIAL_REAL_COST_LIMIT_USD,
} from "@/lib/credit-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const session = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!session || !admin)
    return (
      <Denied
        title="Administración no configurada"
        text="Confirma la llave de servicio antes de abrir el panel."
      />
    );
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user)
    return (
      <Denied
        title="Acceso administrativo"
        text="Entra con la cuenta administradora para continuar."
        login
      />
    );
  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const { data: ownProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !allowed.length ||
    !allowed.includes((user.email || "").toLowerCase()) ||
    ownProfile?.role !== "admin"
  )
    return (
      <Denied
        title="Acceso restringido"
        text="Se requiere correo autorizado y rol de administradora."
      />
    );

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [
    { data: profiles },
    { data: wallets },
    { data: monthLedger },
    { data: historyLedger },
    { data: recharges },
    { data: brands },
    { data: assets },
    { data: statics },
    { data: analyses },
    { data: metas },
    { data: manualAccess },
    authUsers,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id,email,full_name,skool_status,onboarding_completed,created_at",
      ),
    admin
      .from("credit_wallets")
      .select(
        "user_id,balance,monthly_allowance,allowance_used,lifetime_spent",
      ),
    admin
      .from("credit_ledger")
      .select("user_id,amount,reason,metadata,created_at")
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("credit_ledger")
      .select(
        "user_id,amount,reason,metadata,balance_after,allowance_remaining_after,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(5000),
    admin
      .from("recharge_requests")
      .select(
        "id,folio,user_id,package,amount_usd,credits,status,note,created_at",
      )
      .order("created_at", { ascending: false }),
    admin.from("brands").select("id,owner_id,name"),
    admin.from("brand_assets").select("owner_id,file_size"),
    admin
      .from("static_creatives")
      .select("owner_id,quality,created_at")
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("creative_analyses")
      .select("owner_id,created_at")
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("meta_imports")
      .select("owner_id,status,created_at")
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("manual_access_emails")
      .select("id,email,email_normalized,full_name,status,note,created_at,updated_at")
      .order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const authUserList = authUsers.data.users || [];
  const emailById = new Map(authUserList.map((item) => [item.id, item.email || ""]));
  const authById = new Map(authUserList.map((item) => [item.id, item]));
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const manualByEmail = new Map(
    (manualAccess || []).map((item) => [String(item.email_normalized || item.email || "").toLowerCase(), item]),
  );
  const userIds = new Set<string>([
    ...(profiles || []).map((profile) => profile.id),
    ...authUserList.map((item) => item.id),
  ]);
  const users = [...userIds].map((userId) => {
    const profile = profileById.get(userId);
    const authUser = authById.get(userId);
    const email = String(profile?.email || authUser?.email || "").toLowerCase();
    const manual = manualByEmail.get(email);
    const wallet = (wallets || []).find((item) => item.user_id === userId);
    const userMonthLedger = (monthLedger || []).filter(
      (item) => item.user_id === userId,
    );
    const userHistory = (historyLedger || []).filter(
      (item) => item.user_id === userId,
    );
    const userRecharge = (recharges || []).filter(
      (item) => item.user_id === userId && item.status === "aprobada",
    );
    const storageBytes = (assets || [])
      .filter((item) => item.owner_id === userId)
      .reduce((s, item) => s + Number(item.file_size || 0), 0);
    const apiCost = userMonthLedger.reduce(
      (s, item) =>
        s +
        Number((item.metadata as { cost_usd?: number } | null)?.cost_usd || 0),
      0,
    );
    const revenue = userRecharge.reduce(
      (s, item) => s + Number(item.amount_usd || 0),
      0,
    );
    const storageCost = (storageBytes / 1e9) * 0.021;
    const createdAt = profile?.created_at || authUser?.created_at || manual?.created_at || new Date().toISOString();
    return {
      id: userId,
      email,
      name: profile?.full_name || manual?.full_name || authUser?.user_metadata?.full_name || "Sin nombre",
      status: profile?.skool_status || (manual?.status === "active" ? "active" : "pending"),
      accessSource: manual ? "Manual" : "Club/registro",
      hasAuthUser: Boolean(authUser),
      hasProfile: Boolean(profile),
      hasWallet: Boolean(wallet),
      manualAccess: manual?.status || null,
      balance:
        Number(wallet?.balance || 0) +
        Math.max(
          0,
          Number(wallet?.monthly_allowance || INITIAL_INCLUDED_CREDITS) -
            Number(wallet?.allowance_used || 0),
        ),
      spent: Number(wallet?.lifetime_spent || 0),
      apiCost,
      revenue,
      recharges: userRecharge.length,
      images: (statics || []).filter((item) => item.owner_id === userId)
        .length,
      analyses:
        (analyses || []).filter((item) => item.owner_id === userId).length +
        (metas || []).filter(
          (item) => item.owner_id === userId && item.status === "completed",
        ).length,
      storageMb: storageBytes / 1e6,
      profit: revenue - apiCost - storageCost,
      lastActivity: userHistory[0]?.created_at || createdAt,
      createdAt,
      onboarding: Boolean(profile?.onboarding_completed),
      brands: (brands || [])
        .filter((item) => item.owner_id === userId)
        .map((item) => item.name),
      ledger: userHistory.slice(0, 50).map((item) => {
        const metadata = item.metadata as {
          module?: string;
          brand_id?: string;
        } | null;
        return {
          amount: Number(item.amount),
          reason: item.reason,
          createdAt: item.created_at,
          balanceAfter:
            item.balance_after === null ? null : Number(item.balance_after),
          allowanceAfter:
            item.allowance_remaining_after === null
              ? null
              : Number(item.allowance_remaining_after),
          module: metadata?.module || null,
          brandId: metadata?.brand_id || null,
        };
      }),
    };
  });
  const apiCost = (monthLedger || []).reduce(
    (s, item) =>
      s +
      Number((item.metadata as { cost_usd?: number } | null)?.cost_usd || 0),
    0,
  );
  const revenue = (recharges || [])
    .filter(
      (item) =>
        item.status === "aprobada" && new Date(item.created_at) >= monthStart,
    )
    .reduce((s, item) => s + Number(item.amount_usd || 0), 0);
  const storageGb =
    (assets || []).reduce((s, item) => s + Number(item.file_size || 0), 0) /
    1e9;
  const spent = Math.abs(
    (monthLedger || [])
      .filter((item) => item.amount < 0)
      .reduce((s, item) => s + Number(item.amount), 0),
  );
  const limit = Number(process.env.MONTHLY_SPEND_LIMIT_USD || 300);
  const data: AdminDashboardData = {
    metrics: {
      spent,
      apiCost,
      revenue,
      profit: revenue - apiCost - storageGb * 0.021,
      limit,
      storageGb,
      openaiCost: providerCost(monthLedger || [], "openai"),
      anthropicCost: providerCost(monthLedger || [], "anthropic"),
      images: statics?.length || 0,
      analyses:
        (analyses?.length || 0) +
        (metas?.filter((item) => item.status === "completed").length || 0),
    },
    users,
    manualAccess: (manualAccess || []).map((item) => ({
      id: item.id,
      email: item.email,
      status: item.status,
      fullName: item.full_name,
      note: item.note,
      createdAt: item.created_at,
      hasAuthUser: authUserList.some((authUser) => authUser.email?.toLowerCase() === String(item.email_normalized || item.email || "").toLowerCase()),
      hasProfile: (profiles || []).some((profile) => String(profile.email || "").toLowerCase() === String(item.email_normalized || item.email || "").toLowerCase()),
    })),
    databaseOverview: {
      authUsers: authUserList.length,
      profiles: profiles?.length || 0,
      wallets: wallets?.length || 0,
      manualAccess: manualAccess?.length || 0,
      manualActive: (manualAccess || []).filter((item) => item.status === "active").length,
      clubTable: "miembros_club",
      accessTable: "manual_access_emails",
      profileTable: "profiles",
      walletTable: "credit_wallets",
    },
    recharges: (recharges || [])
      .filter((item) => item.status === "pendiente")
      .map((item) => ({
        ...item,
        email: emailById.get(item.user_id) || "",
        name:
          profiles?.find((profile) => profile.id === item.user_id)?.full_name ||
          "Sin nombre",
        old:
          new Date().getTime() - new Date(item.created_at).getTime() > 86400000,
      })),
    pricing: CREDIT_CATALOG.map((catalog) => {
      const rows = (monthLedger || []).filter(
        (item) =>
          (item.metadata as { module?: string } | null)?.module === catalog.module,
      );
      const average = rows.length
        ? rows.reduce(
            (s, item) =>
              s +
              Number(
                (item.metadata as { cost_usd?: number } | null)?.cost_usd || 0,
              ),
            0,
          ) / rows.length
        : 0;
      return {
        module: catalog.module,
        label: catalog.label,
        description: catalog.description,
        credits: catalog.credits,
        estimated: catalog.estimatedCostUsd,
        average,
      };
    }),
    trial: {
      includedCredits: INITIAL_INCLUDED_CREDITS,
      realCostLimit: TRIAL_REAL_COST_LIMIT_USD,
    },
  };
  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <BrandMark href="/dashboard" subtitle="Administración" />
        <Link href="/dashboard" className="secondary-action">
          Volver a plataforma
        </Link>
      </header>
      <AdminConsole data={data} />
    </main>
  );
}

function providerCost(rows: Array<{ metadata: unknown }>, provider: string) {
  return rows.reduce((sum, item) => {
    const metadata = item.metadata as {
      provider?: string;
      cost_usd?: number;
    } | null;
    return (
      sum +
      (metadata?.provider === provider ? Number(metadata.cost_usd || 0) : 0)
    );
  }, 0);
}
function Denied({
  title,
  text,
  login,
}: {
  title: string;
  text: string;
  login?: boolean;
}) {
  return (
    <main className="setup-state">
      <h1>{title}</h1>
      <p>{text}</p>
      <Link href={login ? "/login" : "/dashboard"} className="primary-action">
        {login ? "Entrar" : "Volver"}
      </Link>
    </main>
  );
}
