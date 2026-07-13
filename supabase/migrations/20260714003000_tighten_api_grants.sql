-- The application tables are protected by RLS. Legacy community tables are
-- intentionally excluded because they contain private membership data.
revoke all privileges on all tables in schema public from authenticated;
revoke all privileges on all sequences in schema public from authenticated;
revoke execute on all functions in schema public from authenticated;

alter default privileges in schema public
  revoke all privileges on tables from authenticated;
alter default privileges in schema public
  revoke all privileges on sequences from authenticated;
alter default privileges in schema public
  revoke execute on functions from authenticated;

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

revoke all on function public.spend_credits(uuid,integer,text,jsonb) from public, anon, authenticated;
revoke all on function public.grant_credits(uuid,integer,text,jsonb) from public, anon, authenticated;
revoke all on function public.approve_recharge(uuid,uuid) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid,integer,text,jsonb) to service_role;
grant execute on function public.grant_credits(uuid,integer,text,jsonb) to service_role;
grant execute on function public.approve_recharge(uuid,uuid) to service_role;
