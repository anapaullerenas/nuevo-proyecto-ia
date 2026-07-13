create table if not exists public.brand_recipes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_analysis_id uuid references public.creative_analyses(id) on delete set null,
  rule text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_economics (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  ticket numeric not null default 0,
  variable_cost numeric not null default 0,
  contribution numeric not null default 0,
  contribution_margin numeric not null default 0,
  target_net_margin numeric not null default 0,
  target_cpa numeric not null default 0,
  break_even_roas numeric not null default 0,
  target_roas numeric not null default 0,
  max_cpl numeric not null default 0,
  assumptions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.brand_recipes enable row level security;
alter table public.brand_economics enable row level security;

drop policy if exists "brand_recipes_owner_all" on public.brand_recipes;
create policy "brand_recipes_owner_all" on public.brand_recipes
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "brand_economics_owner_all" on public.brand_economics;
create policy "brand_economics_owner_all" on public.brand_economics
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop trigger if exists touch_brand_economics_updated_at on public.brand_economics;
create trigger touch_brand_economics_updated_at before update on public.brand_economics
for each row execute function public.touch_updated_at();

create index if not exists brand_recipes_brand_created_idx on public.brand_recipes (brand_id, created_at desc);
