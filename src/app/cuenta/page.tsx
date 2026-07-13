import { redirect } from "next/navigation";
import { CreditCard, LogOut, ShieldCheck, WalletCards } from "lucide-react";
import { AppFrame, SetupState } from "@/components/AppFrame";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export default async function CuentaPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

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
            <h1>Créditos, acceso e integraciones.</h1>
            <p>Revisa saldo, consumo esperado y estado de acceso de tu cuenta.</p>
          </div>
          <div className="account-cards">
            <div>
              <CreditCard />
              <b>{workspace.walletBalance} créditos disponibles</b>
              <p>Los créditos se gastan en chats, análisis, imports y generación de estáticos.</p>
            </div>
            <div>
              <ShieldCheck />
              <b>Acceso por membresía</b>
              <p>Tu acceso puede activarse o pausarse según el estado de membresía definido por la administradora.</p>
            </div>
            <div>
              <WalletCards />
              <b>Recargas</b>
              <p>Los paquetes muestran el esquema de recarga que se conectará a pagos cuando se active venta pública.</p>
            </div>
          </div>
          <section className="credit-packages">
            {[
              { name: "Starter", price: "$10", credits: "1,000 créditos", note: "Para pruebas y uso ligero" },
              { name: "Growth", price: "$25", credits: "2,800 créditos", note: "Mejor para crear y analizar semanalmente" },
              { name: "Studio", price: "$50", credits: "6,000 créditos", note: "Para equipos o marcas con pauta activa" },
            ].map((pack) => (
              <article key={pack.name}>
                <span>{pack.name}</span>
                <b>{pack.price}</b>
                <p>{pack.credits}</p>
                <small>{pack.note}</small>
                <button disabled title="Las recargas se activan cuando se conecte pagos">Próximamente</button>
              </article>
            ))}
          </section>
          <div className="usage-table">
            <b>Referencia de consumo</b>
            <p>Chat IA: 5-15 créditos · Análisis creativo: 80-150 · Import Meta: 120-250 · Estático: 250-500.</p>
          </div>
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
