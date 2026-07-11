"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./config";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseEnv();

  if (!url || !anonKey) {
    throw new Error("Supabase no esta configurado todavia.");
  }

  return createBrowserClient(url, anonKey);
}
