create table if not exists public.static_creative_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  static_id uuid not null references public.static_creatives(id) on delete cascade,
  archetype_id text not null,
  pattern_version text not null default '1.0.0',
  angle text,
  rating smallint not null check (rating in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, static_id)
);

create index if not exists static_creative_feedback_brand_archetype_idx
  on public.static_creative_feedback (brand_id, archetype_id, created_at desc);

alter table public.static_creative_feedback enable row level security;

create policy "static_creative_feedback_owner_all"
  on public.static_creative_feedback
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant select, insert, update, delete on public.static_creative_feedback to authenticated;
