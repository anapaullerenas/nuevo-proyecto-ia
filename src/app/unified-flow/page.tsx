import type { Metadata } from "next";
import { UnifiedFlowMockup, type View } from "./UnifiedFlowMockup";

export const metadata: Metadata = {
  title: "Flujo unificado — Proyecto IA",
  description:
    "Maqueta interactiva con menú superior para Chat IA, Meta, Creativos, Estáticos, Marcas y Cuenta.",
};

const validViews: View[] = [
  "home",
  "chat",
  "meta",
  "creative",
  "static",
  "brands",
  "account",
  "admin",
];

function isView(value: unknown): value is View {
  return typeof value === "string" && validViews.includes(value as View);
}

export default async function UnifiedFlowPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const initialView = isView(params?.view) ? params.view : "home";

  return <UnifiedFlowMockup initialView={initialView} />;
}
