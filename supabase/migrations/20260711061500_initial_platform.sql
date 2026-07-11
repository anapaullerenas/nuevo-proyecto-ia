create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  skool_status text not null default 'pending' check (skool_status in ('pending', 'active', 'inactive', 'canceled')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  website text,
  category text,
  audience text,
  offer text,
  voice text,
  content_owner text not null default 'owner' check (content_owner in ('owner', 'team', 'agency', 'mixed')),
  creative_goal text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 300 check (balance >= 0),
  lifetime_purchased integer not null default 0,
  lifetime_spent integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  source text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.skool_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  skool_user_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive', 'canceled')),
  last_checked_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meta_imports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  file_name text,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'completed', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type in ('image', 'video')),
  storage_path text,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'analyzed', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.creative_analyses (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid references public.creative_assets(id) on delete set null,
  score integer check (score between 0 and 100),
  verdict text,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;

  insert into public.credit_wallets (user_id, balance)
  values (new.id, 300)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_brands_updated_at on public.brands;
create trigger touch_brands_updated_at before update on public.brands
for each row execute function public.touch_updated_at();

drop trigger if exists touch_credit_wallets_updated_at on public.credit_wallets;
create trigger touch_credit_wallets_updated_at before update on public.credit_wallets
for each row execute function public.touch_updated_at();

drop trigger if exists touch_skool_memberships_updated_at on public.skool_memberships;
create trigger touch_skool_memberships_updated_at before update on public.skool_memberships
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.skool_memberships enable row level security;
alter table public.meta_imports enable row level security;
alter table public.creative_assets enable row level security;
alter table public.creative_analyses enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "brands_owner_all" on public.brands
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "wallet_select_own" on public.credit_wallets
for select using (auth.uid() = user_id);

create policy "ledger_select_own" on public.credit_ledger
for select using (auth.uid() = user_id);

create policy "skool_select_own" on public.skool_memberships
for select using (auth.uid() = user_id or auth.email() = email);

create policy "meta_imports_owner_all" on public.meta_imports
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "creative_assets_owner_all" on public.creative_assets
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "creative_analyses_owner_all" on public.creative_analyses
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
