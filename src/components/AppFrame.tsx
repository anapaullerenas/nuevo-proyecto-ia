import Link from "next/link";
import { WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandIdentity";
import type { WorkspaceBrand } from "@/lib/workspace";

const navItems = [
  { href: "/dashboard", label: "Chat IA" },
  { href: "/analisis-meta", label: "Análisis Meta" },
  { href: "/calculadora-costos", label: "Calculadora" },
  { href: "/analisis-creativos", label: "Análisis creativos" },
  { href: "/crear-estaticos", label: "Crear estáticos" },
  { href: "/marcas", label: "Mis marcas" },
  { href: "/cuenta", label: "Cuenta" },
];

export function AppFrame({
  active,
  brand,
  credits,
  unlimited = false,
  children,
}: {
  active: string;
  brand: WorkspaceBrand;
  credits: number;
  unlimited?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="app-page">
      <header className="app-topbar">
        <BrandMark href="/dashboard" subtitle={brand.name} />
        <nav aria-label="Navegacion principal">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={active === item.href ? "is-active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/cuenta" className="credit-pill">
          <WalletCards size={16} />
          <span>{unlimited ? "Créditos ilimitados" : `${credits} créditos`}</span>
        </Link>
      </header>
      {children}
    </main>
  );
}

export function SetupState() {
  return (
    <main className="setup-state">
      <h1>Estamos ajustando la plataforma</h1>
      <p>Vuelve en unos minutos para continuar trabajando con tu marca.</p>
    </main>
  );
}
