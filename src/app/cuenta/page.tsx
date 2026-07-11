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
            <h1>Creditos, acceso e integraciones.</h1>
            <p>Este panel sera donde la usuaria entienda saldo, consumo y estado de acceso.</p>
          </div>
          <div className="account-cards">
            <div>
              <CreditCard />
              <b>{workspace.walletBalance} creditos disponibles</b>
              <p>Los creditos se gastaran en chats, analisis, imports y generacion de estaticos.</p>
            </div>
            <div>
              <ShieldCheck />
              <b>Acceso por membresia</b>
              <p>La validacion con Skool se conectara al final para activar o bloquear acceso.</p>
            </div>
            <div>
              <WalletCards />
              <b>Recargas</b>
              <p>Mockup listo: paquetes de saldo para probar el esquema antes de conectar pagos.</p>
            </div>
          </div>
          <section className="credit-packages">
            {[
              { name: "Starter", price: "$10", credits: "1,000 creditos", note: "Para pruebas y uso ligero" },
              { name: "Growth", price: "$25", credits: "2,800 creditos", note: "Mejor para crear y analizar semanalmente" },
              { name: "Studio", price: "$50", credits: "6,000 creditos", note: "Para equipos o marcas con pauta activa" },
            ].map((pack) => (
              <article key={pack.name}>
                <span>{pack.name}</span>
                <b>{pack.price}</b>
                <p>{pack.credits}</p>
                <small>{pack.note}</small>
                <button disabled>Agregar saldo</button>
              </article>
            ))}
          </section>
          <div className="usage-table">
            <b>Referencia de consumo</b>
            <p>Chat IA: 5-15 creditos · Analisis creativo: 80-150 · Import Meta: 120-250 · Estatico: 250-500.</p>
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
