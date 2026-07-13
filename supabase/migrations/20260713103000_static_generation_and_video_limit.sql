insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'creative-assets',
    'creative-assets',
    false,
    209715200,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'application/pdf',
      'text/plain'
    ]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.static_creatives (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  prompt text not null,
  concept jsonb not null default '{}'::jsonb,
  status text not null default 'generated' check (status in ('generated', 'edited', 'downloaded', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.static_creatives enable row level security;

drop policy if exists "static_creatives_owner_all" on public.static_creatives;
create policy "static_creatives_owner_all" on public.static_creatives
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists static_creatives_brand_created_idx on public.static_creatives (brand_id, created_at desc);
