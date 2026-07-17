import { redirect } from "next/navigation";
import { CreditCard, LogOut, ShieldCheck, WalletCards } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { RechargePackages } from "@/components/RechargePackages";
import {
  CREDIT_CATALOG,
  CREDIT_LABELS,
  TRIAL_REAL_COST_LIMIT_USD,
  INITIAL_INCLUDED_CREDITS,
} from "@/lib/credit-catalog";

export const dynamic = "force-dynamic";

export default async function CuentaPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;
  const [{ data: ledger }, { data: pendingRecharge }] = await Promise.all([
    workspace.supabase
      .from("credit_ledger")
      .select(
        "id,amount,reason,metadata,created_at,balance_after,allowance_remaining_after",
      )
      .eq("user_id", workspace.user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    workspace.supabase
      .from("recharge_requests")
      .select("folio,status,created_at")
      .eq("user_id", workspace.user.id)
      .eq("status", "pendiente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const wallet = workspace.wallet;
  const allowance = Number(wallet?.monthly_allowance || INITIAL_INCLUDED_CREDITS);
  const allowanceUsed = Number(wallet?.allowance_used || 0);
  const allowanceRemaining = Math.max(0, allowance - allowanceUsed);

  async function signOut() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut();
    redirect("/login");
  }

  return (
    <AppFrame
      active="/cuenta"
      brand={workspace.activeBrand}
      brandList={workspace.brandList}
      credits={workspace.walletBalance}
      unlimited={workspace.isUnlimited}
    >
      <section className="work-page account-grid">
        <article className="studio-panel">
          <div className="panel-heading">
            <span className="eyebrow">Cuenta</span>
            <h1>Créditos, acceso e integraciones.</h1>
            <p>
              Revisa saldo, consumo esperado y estado de acceso de tu cuenta.
            </p>
          </div>
          <div className="account-cards">
            <div>
              <CreditCard />
              <b>
                {workspace.isUnlimited
                  ? "Créditos ilimitados"
                  : `${workspace.walletBalance.toLocaleString("es-MX")} créditos disponibles`}
              </b>
              <p>
                {workspace.isUnlimited
                  ? "Tu cuenta de prueba puede crear y analizar sin límite."
                  : "Los créditos se gastan en chats, análisis, imports y generación de estáticos."}
              </p>
            </div>
            <div>
              <ShieldCheck />
              <b>Acceso por membresía</b>
              <p>
                Tu acceso puede activarse o pausarse según el estado de
                membresía definido por la administradora.
              </p>
            </div>
            <div>
              <WalletCards />
              <b>Recargas</b>
              <p>
                Las recargas compradas no expiran y se confirman manualmente por
                WhatsApp.
              </p>
            </div>
          </div>
          {!workspace.isUnlimited && (
            <section className="allowance-card">
              <div>
                <span>Créditos incluidos</span>
                <b>
                  {allowanceRemaining.toLocaleString("es-MX")} de{" "}
                  {allowance.toLocaleString("es-MX")} disponibles
                </b>
              </div>
              <div className="allowance-track">
                <span
                  style={{
                    width: `${Math.min(100, (allowanceUsed / allowance) * 100)}%`,
                  }}
                />
              </div>
              <small>
                Tu cuenta inicia con {INITIAL_INCLUDED_CREDITS.toLocaleString("es-MX")} créditos. El uso incluido está protegido por un tope real de ${TRIAL_REAL_COST_LIMIT_USD.toFixed(2)} de IA.
              </small>
              <small>
                Saldo comprado sin vencimiento:{" "}
                {Number(wallet?.balance || 0).toLocaleString("es-MX")} créditos
              </small>
            </section>
          )}
          <RechargePackages pendingFolio={pendingRecharge?.folio} />
          <section className="usage-table account-cost-table">
            <header>
              <b>Costos por acción</b>
              <small>Los créditos indican el saldo que usa cada acción dentro de la plataforma.</small>
            </header>
            <div>
              {CREDIT_CATALOG.map((item) => (
                <article key={item.module}>
                  <span>{item.label}</span>
                  <small>{item.description}</small>
                  <b>{item.credits} cr</b>
                </article>
              ))}
            </div>
          </section>
          <section className="ledger-history">
            <header>
              <b>Historial de créditos</b>
              <small>Últimos 100 movimientos · cargos y abonos</small>
            </header>
            {ledger?.length ? (
              <div>
                {ledger.map((entry) => {
                  const metadata = entry.metadata as { module?: string } | null;
                  return (
                    <article key={entry.id}>
                      <time>
                        {new Date(entry.created_at).toLocaleString("es-MX", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      <span>{labelReason(entry.reason, metadata?.module)}</span>
                      <b className={entry.amount > 0 ? "positive" : ""}>
                        {entry.amount > 0 ? "+" : ""}
                        {entry.amount}
                      </b>
                      <small>
                        {Number(entry.allowance_remaining_after || 0) +
                          Number(entry.balance_after || 0)}{" "}
                        restantes
                      </small>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p>Aún no hay movimientos de créditos.</p>
            )}
          </section>
          <form action={signOut}>
            <button className="soft-button">
              <LogOut size={16} /> Cerrar sesión
            </button>
          </form>
        </article>
      </section>
    </AppFrame>
  );
}

function labelReason(reason: string, module?: string) {
  const labels: Record<string, string> = {
    ...CREDIT_LABELS,
    chat_message: "Chat IA",
    voice_note: "Nota de voz",
    creative_analysis_image: "Análisis estático",
    creative_analysis_video: "Análisis de video",
    creative_analysis_script: "Análisis de guion",
    meta_analysis: "Análisis Meta",
    static_brief: "Dirección creativa",
    static_generate_medium: "Imagen estándar",
    static_generate_high: "Imagen alta",
    static_edit: "Corrección de imagen",
    reference_analysis: "Referencia visual",
    recharge: "Recarga",
    refund: "Devolución automática",
    admin_grant: "Créditos de cortesía",
  };
  return reason === "refund" && module
    ? `Devolución · ${labels[module] || module}`
    : labels[reason] || reason;
}
