insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'creative-assets',
    'creative-assets',
    false,
    52428800,
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
  ),
  (
    'meta-imports',
    'meta-imports',
    false,
    20971520,
    array[
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'brand-files',
    'brand-files',
    false,
    20971520,
    array[
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.creative_assets
add column if not exists file_name text,
add column if not exists file_size bigint,
add column if not exists mime_type text;

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  kind text not null check (kind in ('static_reference', 'brand_context', 'meta_export')),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'completed', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.uploaded_files enable row level security;

drop policy if exists "uploaded_files_owner_all" on public.uploaded_files;
create policy "uploaded_files_owner_all" on public.uploaded_files
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "storage_insert_own_project_files" on storage.objects;
drop policy if exists "storage_select_own_project_files" on storage.objects;
drop policy if exists "storage_update_own_project_files" on storage.objects;
drop policy if exists "storage_delete_own_project_files" on storage.objects;

create policy "storage_insert_own_project_files" on storage.objects
for insert
with check (
  bucket_id in ('creative-assets', 'meta-imports', 'brand-files')
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "storage_select_own_project_files" on storage.objects
for select
using (
  bucket_id in ('creative-assets', 'meta-imports', 'brand-files')
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "storage_update_own_project_files" on storage.objects
for update
using (
  bucket_id in ('creative-assets', 'meta-imports', 'brand-files')
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id in ('creative-assets', 'meta-imports', 'brand-files')
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "storage_delete_own_project_files" on storage.objects
for delete
using (
  bucket_id in ('creative-assets', 'meta-imports', 'brand-files')
  and auth.uid()::text = (storage.foldername(name))[1]
);
