import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Brain,
  ChartNoAxesCombined,
  ImagePlus,
  MessageCircle,
  UploadCloud,
  WalletCards,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Brand = {
  id: string;
  name: string;
  category: string | null;
  content_owner: string | null;
  creative_goal: string | null;
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="setup-state">
        <h1>Supabase aun no esta conectado</h1>
        <p>Ya existe la interfaz. Falta terminar variables para guardar datos reales.</p>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: brands }, { data: wallet }] = await Promise.all([
    supabase.from("brands").select("id,name,category,content_owner,creative_goal").order("created_at", { ascending: false }),
    supabase.from("credit_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);

  const brandList = (brands || []) as Brand[];
  const activeBrand = brandList[0];

  if (!activeBrand) {
    redirect("/onboarding");
  }

  return (
    <main className="app-page">
      <header className="app-topbar">
        <Link href="/dashboard" className="brand-lockup">
          <span className="brand-mark" />
          <span>
            <b>Proyecto IA</b>
            <small>{activeBrand.name}</small>
          </span>
        </Link>
        <nav>
          <a>Chat IA</a>
          <a>Analisis Meta</a>
          <a>Analisis creativos</a>
          <a>Crear estaticos</a>
          <a>Mis marcas</a>
          <a>Cuenta</a>
        </nav>
        <div className="credit-pill">
          <WalletCards size={16} />
          <span>{wallet?.balance ?? 0} creditos</span>
        </div>
      </header>

      <section className="real-dashboard">
        <aside className="brand-context">
          <span className="eyebrow">Marca activa</span>
          <h1>{activeBrand.name}</h1>
          <p>{activeBrand.category || "Categoria pendiente"}</p>
          <dl>
            <div>
              <dt>Produccion</dt>
              <dd>{labelContentOwner(activeBrand.content_owner)}</dd>
            </div>
            <div>
              <dt>Objetivo</dt>
              <dd>{activeBrand.creative_goal || "Definir primer objetivo creativo"}</dd>
            </div>
          </dl>
          <Link href="/onboarding" className="secondary-action">
            Agregar otra marca
          </Link>
        </aside>

        <section className="empty-ops">
          <div className="empty-hero">
            <span className="eyebrow">Dashboard real</span>
            <h2>Aun no hay analisis, imports ni estaticos.</h2>
            <p>
              Esta es la pantalla correcta para una cuenta nueva: primero carga
              datos o conversa con la IA. Los resultados apareceran cuando
              existan acciones reales en la base.
            </p>
          </div>

          <div className="module-grid">
            <article>
              <MessageCircle />
              <b>Chat IA</b>
              <p>Preguntar que producir con el contexto de marca guardado.</p>
              <button>Iniciar conversacion</button>
            </article>
            <article>
              <ChartNoAxesCombined />
              <b>Analisis Meta</b>
              <p>Subir CSV/XLSX exportado desde Meta para detectar ganadores.</p>
              <button>
                <UploadCloud size={15} /> Subir export
              </button>
            </article>
            <article>
              <Brain />
              <b>Analisis creativos</b>
              <p>Subir video o imagen para obtener score, psicologia y variantes.</p>
              <button>Nuevo analisis</button>
            </article>
            <article>
              <ImagePlus />
              <b>Crear estaticos</b>
              <p>Crear desde cero o desde un creativo ganador cuando exista.</p>
              <button>Crear primer estatico</button>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}

function labelContentOwner(value: string | null) {
  const labels: Record<string, string> = {
    owner: "La duena/persona crea contenido",
    team: "Equipo interno",
    agency: "Agencia o freelancer",
    mixed: "Mixto",
  };

  return labels[value || ""] || "Pendiente";
}
