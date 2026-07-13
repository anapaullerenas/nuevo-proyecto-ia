import type { SupabaseClient } from "@supabase/supabase-js";
import recoveredBrands from "./recovered-brands.json";

type LegacyBrand = {
  id: string;
  name: string;
  story?: string | null;
  product?: string | null;
  audience?: string | null;
  avatar?: string | null;
  voice?: string | null;
  visual?: string | null;
  offer?: string | null;
  claims?: string | null;
  forbidden?: string | null;
  legal?: string | null;
  learnings?: unknown;
};

const LEGACY_BRANDS: Record<string, { brand: LegacyBrand; category: string }> = {
  "lalocmtz@gmail.com": {
    brand: recoveredBrands.skinglow,
    category: "Cuidado de la piel",
  },
  "anapaulopezlle@gmail.com": {
    brand: recoveredBrands.ana,
    category: "Marca personal",
  },
};

export async function ensureExceptionWorkspace({
  database,
  email,
  userId,
}: {
  database: SupabaseClient;
  email: string;
  userId: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const legacySpec = LEGACY_BRANDS[normalizedEmail];
  if (!legacySpec) return;

  const { data: existingBrand, error: existingError } = await database
    .from("brands")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existingBrand) {
    const brand = legacySpec.brand;

    const { error: insertError } = await database.from("brands").insert({
      owner_id: userId,
      name: brand.name,
      category: legacySpec.category,
      audience: brand.audience || brand.avatar || "",
      offer: brand.offer || brand.product || "",
      voice: brand.voice || "",
      content_owner: "owner",
      creative_goal: "Crear, analizar y presentar contenido de la marca",
      status: "active",
      strategic_context: {
        brand_story: brand.story || "",
        differentiators: brand.product || "",
        pains: brand.avatar || "",
        desires: brand.audience || "",
        objections: "",
        awareness: "",
        angles: "",
        proof: brand.claims || "",
        beliefs: "",
        forbidden_claims: [brand.forbidden, brand.legal].filter(Boolean).join("\n\n"),
        visual_direction: brand.visual || "",
        legacy_brand_id: brand.id,
        legacy_learnings: JSON.stringify(brand.learnings || []),
        recovered_at: new Date().toISOString(),
      },
    });

    if (insertError) throw insertError;
  }

  const { error: profileError } = await database
    .from("profiles")
    .update({ skool_status: "active", onboarding_completed: true })
    .eq("id", userId);

  if (profileError) throw profileError;
}
