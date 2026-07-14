import Link from "next/link";
import { AdminConsole, type AdminDashboardData } from "@/components/AdminConsole";
import { BrandMark } from "@/components/BrandIdentity";
import { CREDIT_CATALOG, creditPriceUsd, INITIAL_INCLUDED_CREDITS } from "@/lib/credit-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LedgerRow = {
  user_id: string;
  amount: number;
  reason: string;
  metadata: { module?: string; provider?: string; cost_usd?: number } | null;
  created_at: string;
};

export default async function AdminPage() {
  const session = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!session || !admin) {
    return <Denied title="Administración no configurada" text="Confirma la llave de servicio antes de abrir el panel." />;
  }

  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return <Denied title="Acceso administrativo" text="Entra con la cuenta administradora para continuar." login />;

  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const { data: ownProfile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!allowed.length || !allowed.includes((user.email || "").toLowerCase()) || ownProfile?.role !== "admin") {
    return <Denied title="Acceso restringido" text="Se requiere correo autorizado y rol de administradora." />;
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const weekStart = new Date(now.getTime() - 7 * 86_400_000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000);

  const [
    profilesResult,
    walletsResult,
    ledgerResult,
    rechargesResult,
    brandsResult,
    brandAssetsResult,
    creativeAssetsResult,
    uploadedFilesResult,
    staticsResult,
    analysesResult,
    metasResult,
    authUsers,
  ] = await Promise.all([
    admin.from("profiles").select("id,email,full_name,role,skool_status,onboarding_completed,created_at"),
    admin.from("credit_wallets").select("user_id,balance,monthly_allowance,allowance_used,lifetime_spent"),
    admin.from("credit_ledger").select("user_id,amount,reason,metadata,created_at").order("created_at", { ascending: false }),
    admin.from("recharge_requests").select("id,folio,user_id,package,amount_usd,credits,status,note,created_at,resolved_at").order("created_at", { ascending: false }),
    admin.from("brands").select("id,owner_id,name,created_at"),
    admin.from("brand_assets").select("owner_id,file_size"),
    admin.from("creative_assets").select("owner_id,file_size"),
    admin.from("uploaded_files").select("owner_id,file_size"),
    admin.from("static_creatives").select("id,owner_id,status,quality,created_at"),
    admin.from("creative_analyses").select("id,owner_id,created_at"),
    admin.from("meta_imports").select("id,owner_id,status,summary,created_at"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const queryErrors = [
    profilesResult.error,
    walletsResult.error,
    ledgerResult.error,
    rechargesResult.error,
    brandsResult.error,
    brandAssetsResult.error,
    creativeAssetsResult.error,
    uploadedFilesResult.error,
    staticsResult.error,
    analysesResult.error,
    metasResult.error,
    authUsers.error,
  ].filter(Boolean);
  if (queryErrors.length) {
    console.error("admin dashboard query failed", queryErrors);
    return <Denied title="No pudimos cargar el panel" text="Los datos administrativos no están disponibles en este momento." />;
  }

  const profiles = profilesResult.data || [];
  const wallets = walletsResult.data || [];
  const ledger = (ledgerResult.data || []) as LedgerRow[];
  const recharges = rechargesResult.data || [];
  const brands = brandsResult.data || [];
  const statics = staticsResult.data || [];
  const analyses = analysesResult.data || [];
  const metas = metasResult.data || [];
  const authRows = authUsers.data.users || [];
  const emailById = new Map(authRows.map((item) => [item.id, item.email || ""]));
  const storageRows = [
    ...(brandAssetsResult.data || []),
    ...(creativeAssetsResult.data || []),
    ...(uploadedFilesResult.data || []),
  ];
  const metaStorage = metas.map((item) => ({
    owner_id: item.owner_id,
    file_size: Number((item.summary as { file_size?: number } | null)?.file_size || 0),
  }));
  storageRows.push(...metaStorage);

  const users = profiles.map((profile) => {
    const wallet = wallets.find((item) => item.user_id === profile.id);
    const userLedger = ledger.filter((item) => item.user_id === profile.id);
    const userRecharges = recharges.filter((item) => item.user_id === profile.id && item.status === "aprobada");
    const storageBytes = storageRows
      .filter((item) => item.owner_id === profile.id)
      .reduce((sum, item) => sum + Number(item.file_size || 0), 0);
    const apiCost = userLedger.reduce((sum, item) => sum + Number(item.metadata?.cost_usd || 0), 0);
    const revenue = userRecharges.reduce((sum, item) => sum + Number(item.amount_usd || 0), 0);
    const allowanceRemaining = Math.max(0, Number(wallet?.monthly_allowance || INITIAL_INCLUDED_CREDITS) - Number(wallet?.allowance_used || 0));

    return {
      id: profile.id,
      email: profile.email || emailById.get(profile.id) || "",
      name: profile.full_name || "Sin nombre",
      status: profile.skool_status,
      balance: Number(wallet?.balance || 0) + allowanceRemaining,
      spent: Number(wallet?.lifetime_spent || 0),
      apiCost,
      revenue,
      recharges: userRecharges.length,
      images: statics.filter((item) => item.owner_id === profile.id && item.status !== "brief" && item.status !== "failed").length,
      analyses:
        analyses.filter((item) => item.owner_id === profile.id).length +
        metas.filter((item) => item.owner_id === profile.id && item.status === "completed").length,
      storageMb: storageBytes / 1_000_000,
      profit: revenue - apiCost - (storageBytes / 1_000_000_000) * 0.021,
      lastActivity: userLedger[0]?.created_at || profile.created_at,
      createdAt: profile.created_at,
      onboarding: Boolean(profile.onboarding_completed) && brands.some((brand) => brand.owner_id === profile.id),
      brands: brands.filter((brand) => brand.owner_id === profile.id).map((brand) => brand.name),
    };
  });

  const monthLedger = ledger.filter((item) => new Date(item.created_at) >= monthStart);
  const monthRecharges = recharges.filter((item) => item.status === "aprobada" && new Date(item.resolved_at || item.created_at) >= monthStart);
  const monthStatics = statics.filter((item) => new Date(item.created_at) >= monthStart);
  const monthAnalyses = analyses.filter((item) => new Date(item.created_at) >= monthStart);
  const monthMetas = metas.filter((item) => item.status === "completed" && new Date(item.created_at) >= monthStart);
  const storageBytes = storageRows.reduce((sum, item) => sum + Number(item.file_size || 0), 0);
  const apiCost = costOf(monthLedger);
  const revenue = monthRecharges.reduce((sum, item) => sum + Number(item.amount_usd || 0), 0);
  const spent = Math.abs(monthLedger.filter((item) => item.amount < 0).reduce((sum, item) => sum + Number(item.amount), 0));
  const limit = Number(process.env.MONTHLY_SPEND_LIMIT_USD || 300);

  const weeklySpend = users.map((item) => ({
    id: item.id,
    name: item.name,
    amount: Math.abs(
      ledger
        .filter((entry) => entry.user_id === item.id && entry.amount < 0 && new Date(entry.created_at) >= weekStart)
        .reduce((sum, entry) => sum + Number(entry.amount), 0),
    ),
  }));
  const weeklyAverage = weeklySpend.reduce((sum, item) => sum + item.amount, 0) / Math.max(users.length, 1);
  const anomalies = weeklySpend.filter((item) => item.amount > 0 && item.amount > weeklyAverage * 5);

  const data: AdminDashboardData = {
    metrics: {
      spent,
      apiCost,
      revenue,
      recharges: monthRecharges.length,
      profit: revenue - apiCost - (storageBytes / 1_000_000_000) * 0.021,
      limit,
      storageGb: storageBytes / 1_000_000_000,
      openaiCost: providerCost(monthLedger, "openai"),
      anthropicCost: providerCost(monthLedger, "anthropic"),
      images: monthStatics.filter((item) => item.status !== "brief" && item.status !== "failed").length,
      imageCost: moduleCost(monthLedger, ["static_generate_medium", "static_generate_high", "static_edit"]),
      creativeAnalyses: monthAnalyses.length,
      creativeAnalysisCost: moduleCost(monthLedger, ["creative_analysis_image", "creative_analysis_video"]),
      metaAnalyses: monthMetas.length,
      metaAnalysisCost: moduleCost(monthLedger, ["meta_analysis"]),
      briefs: monthStatics.filter((item) => item.status === "brief").length,
      users: profiles.length,
      activeUsers: profiles.filter((item) => item.skool_status === "active").length,
      inactiveUsers: profiles.filter((item) => ["inactive", "canceled"].includes(item.skool_status)).length,
      pendingUsers: profiles.filter((item) => item.skool_status === "pending").length,
    },
    users,
    recharges: recharges
      .filter((item) => item.status === "pendiente")
      .map((item) => ({
        ...item,
        email: emailById.get(item.user_id) || "",
        name: profiles.find((profile) => profile.id === item.user_id)?.full_name || "Sin nombre",
        old: now.getTime() - new Date(item.created_at).getTime() > 86_400_000,
      })),
    pricing: CREDIT_CATALOG.map((item) => {
      const { module, credits } = item;
      const rows = monthLedger.filter((item) => item.amount < 0 && item.metadata?.module === module);
      const average = rows.length ? costOf(rows) / rows.length : 0;
      const estimated = item.estimatedCostUsd;
      const effectiveCost = average || estimated;
      const price = creditPriceUsd(credits);
      return { module, label: item.label, description: item.description, credits, estimated, average, price, margin: effectiveCost > 0 ? price / effectiveCost : 0 };
    }),
    alerts: {
      anomalies: anomalies.map((item) => `${item.name} (${item.amount.toLocaleString("es-MX")} cr)`),
      lowBalance: users.filter((item) => item.balance < 50).length,
      pendingValidation: profiles.filter((item) => item.skool_status === "pending" && new Date(item.created_at) < threeDaysAgo).length,
      incompleteOnboarding: users.filter((item) => !item.onboarding).length,
      apiLimit: limit > 0 && apiCost / limit >= 0.8,
      oldRecharges: recharges.filter((item) => item.status === "pendiente" && now.getTime() - new Date(item.created_at).getTime() > 86_400_000).length,
    },
  };

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <BrandMark href="/dashboard" subtitle="Administración" />
        <Link href="/dashboard" className="secondary-action">Volver a plataforma</Link>
      </header>
      <AdminConsole data={data} />
    </main>
  );
}

function costOf(rows: LedgerRow[]) {
  return rows.reduce((sum, item) => sum + Number(item.metadata?.cost_usd || 0), 0);
}

function providerCost(rows: LedgerRow[], provider: string) {
  return costOf(rows.filter((item) => item.metadata?.provider === provider));
}

function moduleCost(rows: LedgerRow[], modules: string[]) {
  return costOf(rows.filter((item) => item.metadata?.module && modules.includes(item.metadata.module)));
}

function Denied({ title, text, login }: { title: string; text: string; login?: boolean }) {
  return (
    <main className="setup-state">
      <h1>{title}</h1>
      <p>{text}</p>
      <Link href={login ? "/login" : "/dashboard"} className="primary-action">{login ? "Entrar" : "Volver"}</Link>
    </main>
  );
}
