grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.brands,
  public.credit_wallets,
  public.credit_ledger,
  public.skool_memberships,
  public.meta_imports,
  public.creative_assets,
  public.creative_analyses,
  public.uploaded_files,
  public.brand_recipes,
  public.brand_economics,
  public.static_creatives,
  public.brand_assets,
  public.static_archetypes,
  public.golden_briefs,
  public.brand_visual_identity,
  public.recharge_requests
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- Keep credit mutations server-only even if an earlier environment inherited
-- permissive function defaults. RLS continues to restrict every table above.
revoke all on function public.spend_credits(uuid,integer,text,jsonb) from public, anon, authenticated;
revoke all on function public.grant_credits(uuid,integer,text,jsonb) from public, anon, authenticated;
revoke all on function public.approve_recharge(uuid,uuid) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid,integer,text,jsonb) to service_role;
grant execute on function public.grant_credits(uuid,integer,text,jsonb) to service_role;
grant execute on function public.approve_recharge(uuid,uuid) to service_role;
