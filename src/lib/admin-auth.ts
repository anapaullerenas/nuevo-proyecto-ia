import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminContext = {
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  user: { id: string; email?: string };
};

export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!session || !admin) return null;

  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return null;

  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length || !allowed.includes((user.email || "").toLowerCase())) return null;

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return null;

  return { admin, user: { id: user.id, email: user.email } };
}
