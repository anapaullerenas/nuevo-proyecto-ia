import Link from "next/link";
import { WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceBrand } from "@/lib/workspace";

const navItems = [
  { href: "/chat", label: "Chat IA" },
  { href: "/analisis-meta", label: "Analisis Meta" },
  { href: "/calculadora-costos", label: "Calculadora" },
  { href: "/analisis-creativos", label: "Analisis creativos" },
  { href: "/crear-estaticos", label: "Crear estaticos" },
  { href: "/marcas", label: "Mis marcas" },
  { href: "/cuenta", label: "Cuenta" },
];

export function AppFrame({
  active,
  brand,
  credits,
  children,
}: {
  active: string;
  brand: WorkspaceBrand;
  credits: number;
  children: ReactNode;
}) {
  return (
    <main className="app-page">
      <header className="app-topbar">
        <Link href="/dashboard" className="brand-lockup">
          <span className="brand-mark" />
          <span>
            <b>Proyecto IA</b>
            <small>{brand.name}</small>
          </span>
        </Link>
        <nav aria-label="Navegacion principal">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={active === item.href ? "is-active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/cuenta" className="credit-pill">
          <WalletCards size={16} />
          <span>{credits} creditos</span>
        </Link>
      </header>
      {children}
    </main>
  );
}

export function SetupState() {
  return (
    <main className="setup-state">
      <h1>Supabase aun no esta conectado</h1>
      <p>Cuando las variables esten listas, este modulo guardara datos reales.</p>
    </main>
  );
}
