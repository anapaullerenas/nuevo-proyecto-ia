import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { hasUnlimitedAccessEmail } from "@/lib/auth/access-exceptions";
import { INITIAL_INCLUDED_CREDITS } from "@/lib/credit-catalog";
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
    supabase.from("credit_wallets").select("balance,monthly_allowance,allowance_used,allowance_reset_at,lifetime_spent,lifetime_purchased").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("role,email").eq("id", user.id).maybeSingle(),
  ]);

  const brandList = (brands || []) as WorkspaceBrand[];
  const cookieStore = await cookies();
  const preferredBrandId = cookieStore.get("active_brand_id")?.value;
  const activeBrand = brandList.find((brand) => brand.id === preferredBrandId) || brandList[0];

  if (!activeBrand) {
    redirect("/onboarding");
  }

  const unlimitedEmails = (process.env.UNLIMITED_CREDIT_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const accountEmail = (profile?.email || user.email || "").toLowerCase();
  const isUnlimited =
    profile?.role === "admin" ||
    hasUnlimitedAccessEmail(accountEmail) ||
    unlimitedEmails.includes(accountEmail);

  return {
    supabase,
    user,
    brandList,
    activeBrand,
    walletBalance: (wallet?.balance ?? 0) + monthlyRemaining(wallet, user.created_at),
    wallet,
    isUnlimited,
  };
}

export function monthlyRemaining(
  wallet: { monthly_allowance?: number | null; allowance_used?: number | null; allowance_reset_at?: string | null } | null,
  accountCreatedAt?: string | null,
) {
  if (!wallet) return 0;
  const allowance = Number(wallet.monthly_allowance || INITIAL_INCLUDED_CREDITS);
  const currentPeriodStart = creditPeriodStart(accountCreatedAt);
  const walletPeriodStart = wallet.allowance_reset_at ? new Date(`${wallet.allowance_reset_at}T00:00:00Z`) : null;
  if (!walletPeriodStart || walletPeriodStart < currentPeriodStart) return allowance;
  return Math.max(0, allowance - Number(wallet.allowance_used || 0));
}

export function creditPeriodStart(accountCreatedAt?: string | null) {
  const now = new Date();
  const anchor = accountCreatedAt ? new Date(accountCreatedAt) : now;
  if (Number.isNaN(anchor.getTime())) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  let months =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - anchor.getUTCMonth());
  if (now.getUTCDate() < anchor.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  return new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, anchor.getUTCDate()));
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
