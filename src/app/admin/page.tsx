import Link from "next/link";
import { BarChart3, CreditCard, Database, UsersRound } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAiStatus } from "@/lib/workspace";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="setup-state">
        <h1>Admin pendiente</h1>
        <p>Supabase debe estar conectado para ver operacion.</p>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="setup-state">
        <h1>Acceso administrativo</h1>
        <p>Entra con la cuenta duena para revisar usuarios, creditos e integraciones.</p>
        <Link href="/login" className="primary-action">Entrar</Link>
      </main>
    );
  }

  const [{ count: usersCount }, { count: brandsCount }, { data: wallets }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("brands").select("id", { count: "exact", head: true }),
    supabase.from("credit_wallets").select("balance"),
  ]);

  const ai = getAiStatus();
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminEmails.length === 0 || adminEmails.includes((user.email || "").toLowerCase());
  const totalCredits = (wallets || []).reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0);

  if (!isAdmin) {
    return (
      <main className="setup-state">
        <h1>Acceso restringido</h1>
        <p>Este panel es solo para la cuenta administradora de la plataforma.</p>
        <Link href="/dashboard" className="primary-action">Volver</Link>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Link href="/dashboard" className="brand-lockup">
          <span className="brand-mark" />
          <span>
            <b>Proyecto IA</b>
            <small>Administracion</small>
          </span>
        </Link>
        <Link href="/dashboard" className="secondary-action">Volver a plataforma</Link>
      </header>

      <section className="admin-shell">
        <div className="panel-heading split">
          <div>
            <span className="eyebrow">Panel madre</span>
            <h1>Operacion, creditos y acceso.</h1>
            <p>Vista para la duena: usuarios registrados, saldo, consumo e integraciones criticas.</p>
          </div>
          <div className="status-card compact">
            <b>IA interna</b>
            <span className={ai.openai || ai.anthropic ? "status-ok" : "status-warn"}>
              {ai.openai || ai.anthropic ? "Conectada" : "Pendiente de llaves"}
            </span>
          </div>
        </div>

        <div className="admin-metrics">
          <article><UsersRound /><span>Usuarios</span><b>{usersCount || 0}</b></article>
          <article><Database /><span>Marcas</span><b>{brandsCount || 0}</b></article>
          <article><CreditCard /><span>Creditos vivos</span><b>{totalCredits}</b></article>
          <article><BarChart3 /><span>Gasto estimado IA</span><b>$0.00</b></article>
        </div>

        <div className="admin-grid">
          <section>
            <h2>Reglas de creditos</h2>
            <p>Saldo inicial sugerido: 300 creditos. Recarga minima: $10. Cada accion debe registrar costo, modulo, usuario, marca y metadata.</p>
            <ul>
              <li>Chat IA: bajo consumo, ideal para uso frecuente.</li>
              <li>Analisis creativo: mayor costo por vision y reporte profundo.</li>
              <li>Meta import: costo por archivo y tamano de datos.</li>
              <li>Estaticos: costo mas alto por generacion y variantes.</li>
            </ul>
          </section>
          <section>
            <h2>Skool</h2>
            <p>La tabla de membresias esta creada. Falta decidir si se valida por webhook, API externa o sincronizacion programada.</p>
            <ul>
              <li>Activo: puede entrar y usar saldo.</li>
              <li>Inactivo: bloquea dashboard y muestra renovar acceso.</li>
              <li>Admin: puede ver panel madre e integraciones.</li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
