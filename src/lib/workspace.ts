import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WorkspaceBrand = {
  id: string;
  name: string;
  category: string | null;
  content_owner: string | null;
  creative_goal: string | null;
  audience?: string | null;
  offer?: string | null;
  voice?: string | null;
  website?: string | null;
  strategic_context?: Record<string, string> | null;
};

export async function getWorkspace() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: brands }, { data: wallet }, { data: profile }] = await Promise.all([
    supabase
      .from("brands")
      .select("id,name,website,category,audience,offer,voice,content_owner,creative_goal,strategic_context")
      .order("created_at", { ascending: false }),
    supabase.from("credit_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("role,email").eq("id", user.id).maybeSingle(),
  ]);

  const brandList = (brands || []) as WorkspaceBrand[];
  const activeBrand = brandList[0];

  if (!activeBrand) {
    redirect("/onboarding");
  }

  const unlimitedEmails = (process.env.UNLIMITED_CREDIT_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const accountEmail = (profile?.email || user.email || "").toLowerCase();
  // Skinglow is the owner test workspace. Keep this exception until billing is activated.
  const isUnlimited =
    profile?.role === "admin" ||
    unlimitedEmails.includes(accountEmail) ||
    activeBrand.name.trim().toLowerCase() === "skinglow";

  return {
    supabase,
    user,
    brandList,
    activeBrand,
    walletBalance: wallet?.balance ?? 0,
    isUnlimited,
  };
}

export function labelContentOwner(value: string | null) {
  const labels: Record<string, string> = {
    owner: "La dueña/persona crea contenido",
    team: "Equipo interno",
    agency: "Agencia o freelancer",
    mixed: "Mixto",
  };

  return labels[value || ""] || "Pendiente";
}

export function getAiStatus() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}
