import { redirect } from "next/navigation";
import { CreditCard, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAiStatus, getWorkspace } from "@/lib/workspace";

export default async function CuentaPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const ai = getAiStatus();

  async function signOut() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut();
    redirect("/login");
  }

  return (
    <AppFrame active="/cuenta" brand={workspace.activeBrand} credits={workspace.walletBalance}>
      <section className="work-page account-grid">
        <article className="studio-panel">
          <div className="panel-heading">
            <span className="eyebrow">Cuenta</span>
            <h1>Creditos, acceso e integraciones.</h1>
            <p>Este panel sera donde la usuaria entienda saldo, consumo y estado de acceso.</p>
          </div>
          <div className="account-cards">
            <div>
              <CreditCard />
              <b>{workspace.walletBalance} creditos disponibles</b>
              <p>El siguiente paso es definir paquetes, recargas y costo por accion.</p>
            </div>
            <div>
              <ShieldCheck />
              <b>Skool pendiente</b>
              <p>La base ya tiene tabla para membresias. Falta conectar webhook o verificacion externa.</p>
            </div>
            <div>
              <KeyRound />
              <b>Llaves IA</b>
              <p>OpenAI: {ai.openai ? "configurada" : "pendiente"} · Anthropic: {ai.anthropic ? "configurada" : "pendiente"}</p>
            </div>
          </div>
          <form action={signOut}>
            <button className="soft-button">
              <LogOut size={16} /> Cerrar sesion
            </button>
          </form>
        </article>
      </section>
    </AppFrame>
  );
}
